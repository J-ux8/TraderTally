# Sync Infrastructure

This directory contains the core synchronization components for the offline-first sync system.

## Components

### SyncQueue

The `SyncQueue` class manages batching and ordering of records for upload to the cloud.

**Key Features:**
- Fetches up to 50 pending records per batch (Requirement 6.1)
- Orders records by `updated_at` timestamp, oldest first (Requirement 6.4)
- Manages sync status transitions: pending → syncing → synced/failed
- Implements retry logic with exponential backoff (max 10 retries)
- Provides pending count for UI status indicators

**Methods:**
- `getNextBatch(tableName, userId)` - Get next batch of pending records
- `markAsSyncing(tableName, recordIds)` - Mark records as syncing
- `markAsSynced(tableName, recordIds)` - Mark records as synced and reset retry count
- `markAsFailed(tableName, recordIds, error)` - Mark records as failed and increment retry count
- `getPendingCount(userId)` - Get total count of pending records across all tables
- `markAsOffline(userId)` - Mark pending records as offline when no connectivity
- `markOfflineAsPending(userId)` - Mark offline records as pending when network reconnects

**Usage Example:**
```typescript
import { SyncQueue } from './SyncQueue';

// Get next batch of pending transactions
const batch = await SyncQueue.getNextBatch('transactions', userId);

// Mark as syncing
await SyncQueue.markAsSyncing('transactions', batch.map(r => r.id));

// Upload to cloud...
// On success:
await SyncQueue.markAsSynced('transactions', batch.map(r => r.id));

// On failure:
await SyncQueue.markAsFailed('transactions', batch.map(r => r.id), 'Network error');
```

### SyncLock

The `SyncLock` class ensures only one sync process runs at a time using a mutex pattern.

**Key Features:**
- In-memory boolean flag for lock state (Requirement 9.5)
- Timestamp-based auto-release after 5 minutes to prevent deadlock
- Force release mechanism for error recovery
- Thread-safe lock acquisition and release

**Methods:**
- `acquire()` - Acquire the sync lock (returns false if already locked)
- `release()` - Release the sync lock
- `isLocked()` - Check if lock is currently held
- `forceRelease()` - Force release lock for error recovery

**Usage Example:**
```typescript
import { SyncLock } from './SyncLock';

async function performSync() {
  // Try to acquire lock
  const acquired = await SyncLock.acquire();
  
  if (!acquired) {
    console.log('Sync already in progress, skipping');
    return;
  }

  try {
    // Perform sync operations...
    await uploadPendingRecords();
    await downloadServerUpdates();
  } finally {
    // Always release lock, even on error
    await SyncLock.release();
  }
}
```

**Auto-Release Behavior:**
The lock automatically releases after 5 minutes to prevent deadlock if a sync process crashes without releasing the lock. This ensures the system can recover from stuck sync operations.

**Error Recovery:**
If a sync process crashes without releasing the lock, use `forceRelease()` to manually clear the lock state:
```typescript
// In error recovery or monitoring code
await SyncLock.forceRelease();
```

### RetryStrategy

The `RetryStrategy` class implements exponential backoff for failed sync operations.

**Key Features:**
- Exponential backoff schedule: 10s, 30s, 2m, 10m, 10m (Requirements 3.2, 3.3)
- Maximum 10 retry attempts before marking as failed (Requirement 3.4)
- Automatic retry count reset after successful sync (Requirement 11.5)
- Deterministic delay calculation for predictable retry behavior

**Methods:**
- `getRetryDelay(retryCount)` - Calculate delay before next retry in milliseconds
- `shouldRetry(retryCount)` - Check if should retry based on retry count
- `resetRetryCount(tableName, recordId)` - Reset retry count after successful sync
- `getMaxRetries()` - Get maximum number of retries allowed (10)

**Retry Schedule:**
| Retry Count | Delay |
|-------------|-------|
| 0 | 10 seconds |
| 1 | 30 seconds |
| 2 | 2 minutes |
| 3 | 10 minutes |
| 4+ | 10 minutes |

**Usage Example:**
```typescript
import { RetryStrategy } from './RetryStrategy';

async function uploadWithRetry(record) {
  // Check if should retry
  if (!RetryStrategy.shouldRetry(record.retry_count)) {
    console.log('Max retries reached, marking as failed');
    await SyncQueue.markAsFailed('transactions', [record.id], 'Max retries exceeded');
    return;
  }

  // Get retry delay
  const delay = RetryStrategy.getRetryDelay(record.retry_count);
  console.log(`Retrying in ${delay}ms...`);
  
  // Wait for delay
  await new Promise(resolve => setTimeout(resolve, delay));
  
  try {
    // Attempt upload
    await uploadToCloud(record);
    
    // Success - reset retry count
    await RetryStrategy.resetRetryCount('transactions', record.id);
  } catch (error) {
    // Failure - increment retry count
    await SyncQueue.markAsFailed('transactions', [record.id], error.message);
  }
}
```

**Integration with SyncQueue:**
The `RetryStrategy` works seamlessly with `SyncQueue` to manage failed sync operations:
1. `SyncQueue.markAsFailed()` increments retry_count
2. `RetryStrategy.shouldRetry()` checks if retry_count < 10
3. `RetryStrategy.getRetryDelay()` calculates exponential backoff delay
4. After successful sync, `RetryStrategy.resetRetryCount()` resets to 0

### NetworkMonitor

The `NetworkMonitor` class monitors network connectivity using React Native NetInfo.

**Key Features:**
- Real-time network connectivity detection (Requirements 3.1, 20.3)
- Connectivity change notifications (Requirement 3.5)
- Network type detection (wifi/cellular/none/unknown)
- Singleton pattern for consistent state across the app

**Methods:**
- `isOnline()` - Check current connectivity status (returns Promise<boolean>)
- `subscribe(callback)` - Subscribe to connectivity changes (returns unsubscribe function)
- `getNetworkType()` - Get current network type (returns Promise<NetworkType>)

**Network Types:**
- `wifi` - Connected via WiFi
- `cellular` - Connected via cellular data
- `none` - No network connection
- `unknown` - Unknown connection type (e.g., ethernet, bluetooth)

**Usage Example:**
```typescript
import { networkMonitor } from './NetworkMonitor';

// Check if online before sync
const isOnline = await networkMonitor.isOnline();
if (!isOnline) {
  console.log('Offline - skipping sync');
  await SyncQueue.markAsOffline(userId);
  return;
}

// Subscribe to connectivity changes
const unsubscribe = networkMonitor.subscribe((isOnline) => {
  if (isOnline) {
    console.log('Network reconnected - triggering sync');
    syncEngine.sync();
  } else {
    console.log('Network disconnected - marking records as offline');
    SyncQueue.markAsOffline(userId);
  }
});

// Get network type for logging
const networkType = await networkMonitor.getNetworkType();
console.log(`Connected via ${networkType}`);

// Cleanup when component unmounts
unsubscribe();
```

**Integration with SyncEngine:**
The `NetworkMonitor` integrates with the sync engine to:
1. Check connectivity before attempting cloud operations
2. Skip sync and mark records as offline when no connectivity
3. Trigger sync automatically when network reconnects
4. Provide network type information for logging and debugging

**Connectivity Detection:**
The monitor considers the device online when:
- `isConnected` is true AND
- `isInternetReachable` is not false (true or null)

This handles scenarios like:
- Airplane mode: offline
- Captive portal: offline (connected but no internet)
- Poor connectivity: online (optimistic when reachability unknown)

### SyncLogger

The `SyncLogger` class provides observability and debugging capabilities for the sync system.

**Key Features:**
- Logs all sync operations (start, complete, error) (Requirements 12.2, 12.3, 12.4)
- Tracks conflict resolution decisions (Requirement 12.5)
- Provides log retrieval and export for debugging (Requirement 12.7)
- Automatic cleanup of logs older than 30 days (Requirement 12.6)
- Stores logs in SQLite for offline access

**Methods:**
- `logSyncStart()` - Log sync operation start (returns log ID)
- `logSyncComplete(logId, result)` - Log sync operation completion with metrics
- `logSyncError(logId, error)` - Log sync error with error message
- `logConflict(recordId, resolution)` - Log conflict resolution decision
- `getRecentLogs(limit)` - Get recent logs for debugging (default 100)
- `exportLogs()` - Export all logs as JSON string (up to 1000 logs)
- `cleanupOldLogs()` - Delete logs older than 30 days

**Log Types:**
- `sync_start` - Sync cycle initiated
- `sync_complete` - Sync cycle completed successfully
- `sync_error` - Sync cycle failed with error
- `conflict` - Conflict resolved during sync

**Usage Example:**
```typescript
import { SyncLogger } from './SyncLogger';

// Start sync and get log ID
const logId = await SyncLogger.logSyncStart();

try {
  // Perform sync operations
  const result = await performSync();
  
  // Log successful completion
  await SyncLogger.logSyncComplete(logId, {
    success: true,
    uploadedCount: 15,
    downloadedCount: 10,
    conflictsResolved: 2,
    errors: [],
    duration: 2500,
  });
} catch (error) {
  // Log error
  await SyncLogger.logSyncError(logId, error);
}

// Log conflict resolution with both versions for debugging
await SyncLogger.logConflict('record-123', {
  winner: 'server',
  record: serverRecord,
  reason: 'Server version is newer',
}, localRecord, serverRecord);

// Get recent logs for debugging
const logs = await SyncLogger.getRecentLogs(50);
console.log('Recent sync operations:', logs);

// Export logs for support
const exported = await SyncLogger.exportLogs();
// Send to support or save to file

// Cleanup old logs (run periodically)
await SyncLogger.cleanupOldLogs();
```

**Log Structure:**
```typescript
interface SyncLog {
  id: string;                    // Unique log ID
  timestamp: string;             // ISO 8601 timestamp
  operation: string;             // sync_start, sync_complete, sync_error, conflict
  status: 'success' | 'error';   // Operation result
  device_id: string;             // Device identifier
  error_message?: string;        // Error details (for errors)
  duration_ms?: number;          // Duration in milliseconds (for complete)
  metadata?: Record<string, any>; // Additional data (counts, resolution details)
}
```

**Integration with SyncEngine:**
The `SyncLogger` integrates with the sync engine to:
1. Log every sync cycle start and completion
2. Track sync performance metrics (duration, counts)
3. Record all errors for debugging
4. Document conflict resolution decisions
5. Provide audit trail for sync operations

**Debugging Workflow:**
1. User reports sync issue
2. Export logs using `exportLogs()`
3. Review logs to identify:
   - When sync last succeeded
   - What errors occurred
   - Which records failed to sync
   - Conflict resolution decisions
4. Use log data to diagnose and fix issues

### SyncEngine

The `SyncEngine` class orchestrates the full synchronization process, using `SyncQueue` for batch management and `SyncLock` for mutex protection.

**Key Features:**
- Mutex lock prevents concurrent sync operations (uses SyncLock)
- Push phase: Upload local changes to cloud
- Pull phase: Download and merge cloud changes
- Conflict resolution using latest-update-wins strategy
- Network connectivity checking

### ConflictResolver

The `ConflictResolver` class handles conflicts when the same record is modified on multiple devices.

**Strategy:**
- Latest `updated_at` timestamp wins
- Server deletion wins if it happened later
- Deterministic resolution ensures consistency

## Testing

The sync infrastructure includes comprehensive unit and integration tests:

- `SyncQueue.test.ts` - Unit tests for SyncQueue methods
- `SyncQueue.integration.test.ts` - Integration tests for batch processing workflows
- `SyncLock.test.ts` - Unit tests for SyncLock mutex operations
- `SyncLock.integration.test.ts` - Integration tests for concurrent sync prevention
- `RetryStrategy.test.ts` - Unit tests for retry delay calculation and retry logic
- `RetryStrategy.integration.test.ts` - Integration tests for retry workflow with database
- `NetworkMonitor.test.ts` - Unit tests for NetworkMonitor connectivity detection
- `NetworkMonitor.integration.test.ts` - Integration tests for connectivity scenarios
- `SyncLogger.test.ts` - Unit tests for SyncLogger logging operations
- `SyncLogger.integration.test.ts` - Integration tests for log lifecycle and retrieval

Run tests:
```bash
npm test -- lib/offline/sync/__tests__/
```

## Requirements Mapping

This implementation satisfies the following requirements:

- **3.1**: Check network connectivity before sync operations
- **3.2**: Use exponential backoff with delays of 2^retry_count seconds
- **3.3**: Increment retry_count when cloud write operation fails
- **3.4**: Mark sync_status as "failed" when retry_count reaches 10
- **3.5**: Trigger synchronization when network reconnects
- **6.1**: Group records into batches of 50 records
- **6.2**: Process each batch as a single transaction
- **6.4**: Prioritize records by updated_at timestamp, oldest first
- **8.2**: Set sync_status to "pending" for retry or "failed" after max retries
- **8.3**: Set sync_status to "syncing" when upload begins
- **8.4**: Set sync_status to "synced" when upload completes successfully
- **8.6**: Set sync_status to "offline" for pending records when no connectivity
- **9.5**: Prevent concurrent synchronization cycles using a mutex lock
- **11.5**: Reset retry_count to 0 when sync operation succeeds
- **12.1**: Maintain sync_logs table with comprehensive columns
- **12.2**: Log operation start when sync cycle begins
- **12.3**: Log success with record details when upload succeeds
- **12.4**: Log failure with error message when upload fails
- **12.5**: Log conflict resolution decision
- **12.6**: Retain sync log entries for 30 days
- **12.7**: Provide method to export sync log entries for debugging
- **20.3**: Display offline indicator when no connectivity detected
