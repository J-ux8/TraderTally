# Design Document: Offline-First Sync System

## Overview

The offline-first sync system is a production-grade synchronization engine that ensures reliable, zero-data-loss bidirectional synchronization between local SQLite storage and Supabase cloud storage for the MobiBooks bookkeeping application. The system follows a local-first architecture where SQLite serves as the source of truth, all user operations succeed immediately offline, and cloud synchronization happens asynchronously with automatic conflict resolution.

### Design Goals

- **Zero Data Loss**: All user actions persist locally before any cloud operation
- **Offline-First**: Full CRUD functionality without network connectivity
- **Idempotent Operations**: Cloud writes produce identical results when retried
- **Automatic Conflict Resolution**: Latest-update-wins strategy for multi-device conflicts
- **Performance**: Local writes < 100ms, batch uploads < 5 seconds
- **Reliability**: Exponential backoff retry with mutex-protected sync cycles

### Key Design Decisions

1. **SQLite as Source of Truth**: All reads and writes go to local SQLite first, ensuring the app remains functional regardless of network state. This eliminates the complexity of cache invalidation and provides instant user feedback.

2. **Sync Metadata in Application Tables**: Rather than maintaining separate sync tracking tables, we embed sync metadata (sync_status, sync_version, retry_count) directly in each data table. This simplifies queries and ensures atomic updates.

3. **Upsert-Based Cloud Writes**: Using Supabase's `INSERT ... ON CONFLICT(id) DO UPDATE` ensures idempotent operations. The same record can be uploaded multiple times without creating duplicates.

4. **Soft Deletes**: Records are never physically deleted during sync. Instead, we set `is_deleted = true` and propagate this flag to all devices, ensuring deletions synchronize correctly.

5. **Single Sync Process**: A mutex lock prevents concurrent sync operations, avoiding race conditions and ensuring consistent state transitions.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│  (React Native Components + Hooks)                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repository Layer                          │
│  BaseRepository, TransactionRepository,                     │
│  CategoryRepository, DebtRepository                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Local SQLite Database                      │
│  (Source of Truth - transactions, categories, debts)        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Sync Engine                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  SyncQueue   │  │ SyncLock     │  │ RetryStrategy│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ConflictRes.  │  │ SyncLogger   │                        │
│  └──────────────┘  └──────────────┘                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Network Monitor                            │
│  (NetInfo - detects connectivity changes)                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Cloud Storage                      │
│  (Postgres with RLS - backup and multi-device sync)         │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Write Operation Flow:**
1. User initiates create/update/delete operation
2. Repository validates input and generates UUID
3. Repository writes to SQLite with `sync_status = 'pending'`
4. Repository returns success to UI immediately (< 100ms)
5. Sync trigger fires (debounced to 20 seconds)
6. SyncEngine acquires mutex lock
7. SyncEngine uploads pending records in batches of 50
8. SyncEngine marks uploaded records as `sync_status = 'synced'`
9. SyncEngine releases mutex lock

**Sync Cycle Flow:**
1. Acquire sync lock (fail if already syncing)
2. Upload phase: Query pending records, batch upload to Supabase
3. Mark uploaded records as synced
4. Download phase: Fetch server updates since last_sync_time
5. Merge phase: Apply server updates to local SQLite
6. Conflict resolution: Compare updated_at timestamps
7. Update sync_metadata with current timestamp
8. Release sync lock

### Sync Triggers

The sync engine initiates synchronization on these events:
- **App Start**: Full sync on application launch
- **Network Reconnect**: Detected by NetInfo listener
- **User Action**: After create/update/delete (debounced 20s)
- **Background Timer**: Every 60 seconds while app is active
- **Manual Trigger**: User pulls to refresh

All triggers are throttled to maximum 1 sync per 20 seconds to prevent excessive network usage.

## Components and Interfaces

### SyncEngine

Core orchestrator for all synchronization operations.

```typescript
interface SyncEngine {
  // Start a full sync cycle (upload then download)
  sync(): Promise<SyncResult>;
  
  // Upload pending local changes to cloud
  uploadPendingRecords(): Promise<UploadResult>;
  
  // Download and merge server changes
  downloadServerUpdates(): Promise<DownloadResult>;
  
  // Check if sync is currently running
  isSyncing(): boolean;
  
  // Get current sync status
  getStatus(): SyncStatus;
}

interface SyncResult {
  success: boolean;
  uploadedCount: number;
  downloadedCount: number;
  conflictsResolved: number;
  errors: SyncError[];
  duration: number; // milliseconds
}

type SyncStatus = 'idle' | 'syncing' | 'error';
```

### SyncQueue

Manages batching and ordering of records for upload.

```typescript
interface SyncQueue {
  // Get next batch of pending records (max 50)
  getNextBatch(tableName: string): Promise<SyncRecord[]>;
  
  // Mark records as syncing
  markAsSyncing(recordIds: string[]): Promise<void>;
  
  // Mark records as synced
  markAsSynced(recordIds: string[]): Promise<void>;
  
  // Mark records as failed
  markAsFailed(recordIds: string[], error: string): Promise<void>;
  
  // Get count of pending records
  getPendingCount(): Promise<number>;
}

interface SyncRecord {
  id: string;
  user_id: string;
  table_name: string;
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed' | 'offline';
  sync_version: number;
  retry_count: number;
  updated_at: string;
  data: Record<string, any>;
}
```

### ConflictResolver

Handles conflicts when the same record is modified on multiple devices.

```typescript
interface ConflictResolver {
  // Resolve conflict between local and server versions
  resolve(local: SyncRecord, server: SyncRecord): ResolvedRecord;
  
  // Determine if a conflict exists
  hasConflict(local: SyncRecord, server: SyncRecord): boolean;
}

interface ResolvedRecord {
  winner: 'local' | 'server';
  record: SyncRecord;
  reason: string;
}

// Conflict Resolution Strategy: Latest-Update-Wins
// 1. Compare updated_at timestamps
// 2. If server.updated_at > local.updated_at → server wins
// 3. If local.updated_at > server.updated_at → local wins
// 4. If equal → server wins (tie-breaker)
```

### RetryStrategy

Implements exponential backoff for failed sync operations.

```typescript
interface RetryStrategy {
  // Calculate delay before next retry
  getRetryDelay(retryCount: number): number;
  
  // Check if should retry
  shouldRetry(retryCount: number): boolean;
  
  // Reset retry count after success
  resetRetryCount(recordId: string): Promise<void>;
}

// Retry Schedule:
// retry_count 0 → immediate
// retry_count 1 → 10 seconds
// retry_count 2 → 30 seconds
// retry_count 3 → 2 minutes
// retry_count 4 → 10 minutes
// retry_count 5+ → 10 minutes
// Maximum retries: 10
```

### SyncLock

Ensures only one sync process runs at a time using mutex pattern.

```typescript
interface SyncLock {
  // Acquire lock (returns false if already locked)
  acquire(): Promise<boolean>;
  
  // Release lock
  release(): Promise<void>;
  
  // Check if locked
  isLocked(): boolean;
  
  // Force release (for error recovery)
  forceRelease(): Promise<void>;
}

// Implementation: In-memory boolean flag with timestamp
// Auto-release after 5 minutes to prevent deadlock
```

### NetworkMonitor

Monitors network connectivity using React Native NetInfo.

```typescript
interface NetworkMonitor {
  // Check current connectivity
  isOnline(): Promise<boolean>;
  
  // Subscribe to connectivity changes
  subscribe(callback: (isOnline: boolean) => void): () => void;
  
  // Get network type (wifi, cellular, none)
  getNetworkType(): Promise<NetworkType>;
}

type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown';
```

### SyncLogger

Provides observability and debugging capabilities.

```typescript
interface SyncLogger {
  // Log sync operation start
  logSyncStart(): Promise<string>; // returns log_id
  
  // Log sync operation completion
  logSyncComplete(logId: string, result: SyncResult): Promise<void>;
  
  // Log sync error
  logSyncError(logId: string, error: Error): Promise<void>;
  
  // Log conflict resolution
  logConflict(recordId: string, resolution: ResolvedRecord): Promise<void>;
  
  // Get recent logs
  getRecentLogs(limit: number): Promise<SyncLog[]>;
  
  // Export logs for debugging
  exportLogs(): Promise<string>; // returns JSON string
}

interface SyncLog {
  id: string;
  timestamp: string;
  operation: 'sync_start' | 'sync_complete' | 'sync_error' | 'conflict';
  record_type?: string;
  record_id?: string;
  status: 'success' | 'error';
  error_message?: string;
  device_id: string;
  duration_ms?: number;
}
```

### BaseRepository

Abstract base class for all data repositories with sync support.

```typescript
abstract class BaseRepository<T> {
  protected tableName: string;
  protected db: SQLite.SQLiteDatabase;
  
  // Create record with sync metadata
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  
  // Update record and increment sync_version
  async update(id: string, data: Partial<T>): Promise<T>;
  
  // Soft delete (set is_deleted = true)
  async delete(id: string): Promise<void>;
  
  // Get by ID (excludes soft-deleted)
  async getById(id: string): Promise<T | null>;
  
  // List all (excludes soft-deleted)
  async list(userId: string): Promise<T[]>;
  
  // Get pending sync records
  async getPendingSync(): Promise<T[]>;
  
  // Update sync status
  async updateSyncStatus(id: string, status: SyncStatus): Promise<void>;
}
```

## Data Models

### Sync Metadata Fields

All synchronized tables include these fields:

```typescript
interface SyncMetadata {
  id: string;                    // UUID primary key
  user_id: string;               // User identifier for RLS
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
  is_deleted: boolean;           // Soft delete flag
  sync_status: SyncStatus;       // Current sync state
  sync_version: number;          // Incremented on each local change
  retry_count: number;           // Number of failed sync attempts
}

type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed' | 'offline';
```

### Transaction Model

```typescript
interface Transaction extends SyncMetadata {
  amount: number;                // Transaction amount
  category: string;              // Category name
  description: string;           // User description
  transaction_date: string;      // ISO 8601 date
}
```

### Category Model

```typescript
interface Category extends SyncMetadata {
  name: string;                  // Display name
  normalized_name: string;       // Lowercase for uniqueness check
}
```

### Debt Model

```typescript
interface Debt extends SyncMetadata {
  customer_name: string;         // Customer identifier
  amount: number;                // Debt amount
  due_date: string | null;       // ISO 8601 date
  note: string | null;           // Optional note
  is_settled: boolean;           // Settlement status
}
```

### Sync Metadata Table

```typescript
interface SyncMetadataRecord {
  user_id: string;               // Primary key
  last_sync_time: string | null; // Last successful sync timestamp
  last_push_time: string | null; // Last successful upload timestamp
  device_id: string;             // Unique device identifier
}
```

### Sync Log Table

```typescript
interface SyncLogRecord {
  id: string;                    // UUID primary key
  timestamp: string;             // ISO 8601 timestamp
  operation: string;             // Operation type
  status: 'success' | 'error';   // Operation result
  record_count: number;          // Number of records processed
  error_message: string | null;  // Error details if failed
  operation_duration_ms: number; // Duration in milliseconds
}
```

## Database Schema

### SQLite Schema

```sql
-- Transactions table
CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT,
  description TEXT,
  transaction_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending',
  sync_version INTEGER DEFAULT 1,
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_sync_status ON transactions(sync_status) 
  WHERE sync_status = 'pending';
CREATE INDEX idx_transactions_updated_at ON transactions(updated_at);

-- Categories table
CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending',
  sync_version INTEGER DEFAULT 1,
  retry_count INTEGER DEFAULT 0,
  UNIQUE(user_id, normalized_name)
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_normalized_name ON categories(user_id, normalized_name);
CREATE INDEX idx_categories_sync_status ON categories(sync_status) 
  WHERE sync_status = 'pending';

-- Debts table
CREATE TABLE debts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT,
  note TEXT,
  is_settled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending',
  sync_version INTEGER DEFAULT 1,
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_debts_user_id ON debts(user_id);
CREATE INDEX idx_debts_created_at ON debts(created_at);
CREATE INDEX idx_debts_sync_status ON debts(sync_status) 
  WHERE sync_status = 'pending';

-- Sync metadata table
CREATE TABLE sync_metadata (
  user_id TEXT PRIMARY KEY NOT NULL,
  last_sync_time TEXT,
  last_push_time TEXT,
  device_id TEXT NOT NULL
);

-- Sync logs table
CREATE TABLE sync_logs (
  id TEXT PRIMARY KEY NOT NULL,
  timestamp TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  error_message TEXT,
  operation_duration_ms INTEGER
);

CREATE INDEX idx_sync_logs_timestamp ON sync_logs(timestamp);
```

### Supabase Schema

The Supabase schema mirrors the SQLite schema with Row Level Security (RLS) policies:

```sql
-- Enable RLS on all tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can access own transactions"
  ON transactions FOR ALL
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can access own categories"
  ON categories FOR ALL
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can access own debts"
  ON debts FOR ALL
  USING (auth.uid()::text = user_id);
```

## Sync Algorithm

### Upload Phase

```typescript
async function uploadPendingRecords(tableName: string): Promise<UploadResult> {
  const batch = await syncQueue.getNextBatch(tableName);
  
  if (batch.length === 0) {
    return { uploadedCount: 0, errors: [] };
  }
  
  await syncQueue.markAsSyncing(batch.map(r => r.id));
  
  try {
    // Batch upsert to Supabase
    const { data, error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: 'id' });
    
    if (error) throw error;
    
    // Mark as synced
    await syncQueue.markAsSynced(batch.map(r => r.id));
    
    return { uploadedCount: batch.length, errors: [] };
  } catch (error) {
    // Retry individual records on batch failure
    return await retryIndividualRecords(batch, tableName);
  }
}

async function retryIndividualRecords(
  batch: SyncRecord[], 
  tableName: string
): Promise<UploadResult> {
  const errors: SyncError[] = [];
  let uploadedCount = 0;
  
  for (const record of batch) {
    try {
      await supabase.from(tableName).upsert(record, { onConflict: 'id' });
      await syncQueue.markAsSynced([record.id]);
      uploadedCount++;
    } catch (error) {
      await incrementRetryCount(record.id);
      errors.push({ recordId: record.id, error: error.message });
    }
  }
  
  return { uploadedCount, errors };
}
```

### Download Phase

```typescript
async function downloadServerUpdates(tableName: string): Promise<DownloadResult> {
  const metadata = await getSyncMetadata();
  const lastSyncTime = metadata.last_sync_time || '1970-01-01T00:00:00Z';
  
  // Fetch records updated since last sync
  const { data: serverRecords, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', lastSyncTime)
    .order('updated_at', { ascending: true })
    .limit(50);
  
  if (error) throw error;
  
  let downloadedCount = 0;
  let conflictsResolved = 0;
  
  for (const serverRecord of serverRecords) {
    const localRecord = await getLocalRecord(serverRecord.id);
    
    if (!localRecord) {
      // New record from server
      await insertLocalRecord(serverRecord);
      downloadedCount++;
    } else if (localRecord.sync_status === 'synced') {
      // Server update for synced record
      await updateLocalRecord(serverRecord);
      downloadedCount++;
    } else {
      // Conflict: local has pending changes
      const resolved = await conflictResolver.resolve(localRecord, serverRecord);
      await applyResolvedRecord(resolved);
      conflictsResolved++;
    }
  }
  
  // Update last sync time
  await updateSyncMetadata({ last_sync_time: new Date().toISOString() });
  
  return { downloadedCount, conflictsResolved };
}
```

### Conflict Resolution

```typescript
function resolveConflict(
  local: SyncRecord, 
  server: SyncRecord
): ResolvedRecord {
  const localTime = new Date(local.updated_at).getTime();
  const serverTime = new Date(server.updated_at).getTime();
  
  if (serverTime > localTime) {
    return {
      winner: 'server',
      record: server,
      reason: 'Server version is newer'
    };
  } else if (localTime > serverTime) {
    return {
      winner: 'local',
      record: local,
      reason: 'Local version is newer'
    };
  } else {
    // Timestamps equal - prefer server as tie-breaker
    return {
      winner: 'server',
      record: server,
      reason: 'Timestamps equal, server wins tie-breaker'
    };
  }
}
```


## Migration Strategy

### Adding Sync Support to Existing Tables

The migration process adds sync metadata columns to existing tables without data loss:

```typescript
async function migrateToSyncSupport(db: SQLite.SQLiteDatabase) {
  await db.execAsync('BEGIN TRANSACTION');
  
  try {
    // Add sync columns to transactions
    await addColumnIfMissing(db, 'transactions', 'is_deleted', 'INTEGER DEFAULT 0');
    await addColumnIfMissing(db, 'transactions', 'sync_status', "TEXT DEFAULT 'pending'");
    await addColumnIfMissing(db, 'transactions', 'sync_version', 'INTEGER DEFAULT 1');
    await addColumnIfMissing(db, 'transactions', 'retry_count', 'INTEGER DEFAULT 0');
    
    // Initialize sync_status for existing records
    await db.execAsync(`
      UPDATE transactions 
      SET sync_status = 'pending', sync_version = 1, retry_count = 0
      WHERE sync_status IS NULL
    `);
    
    // Repeat for categories and debts tables
    // ... (similar pattern)
    
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  type: string
) {
  const info = await db.getAllAsync(`PRAGMA table_info(${table})`);
  const exists = info.some((col: any) => col.name === column);
  
  if (!exists) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
```

### Migration Validation

After migration, validate data integrity:

```typescript
async function validateMigration(db: SQLite.SQLiteDatabase) {
  // Check all records have sync metadata
  const tables = ['transactions', 'categories', 'debts'];
  
  for (const table of tables) {
    const nullSyncStatus = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM ${table} WHERE sync_status IS NULL`
    );
    
    if (nullSyncStatus.count > 0) {
      throw new Error(`Migration failed: ${table} has records without sync_status`);
    }
  }
  
  // Verify no data loss
  const preCount = await getRecordCount(db, 'transactions');
  const postCount = await getRecordCount(db, 'transactions');
  
  if (preCount !== postCount) {
    throw new Error('Migration caused data loss');
  }
}
```

