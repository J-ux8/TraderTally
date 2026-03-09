# Database Module - Offline-First Sync System

This module contains the database schema, migrations, and utilities for the offline-first sync system.

## Task 1 Implementation: Database Schema Enhancements

### Overview

Task 1 enhances the database schema with:
- Device ID generation and persistence
- Performance indexes on `updated_at` columns
- Schema validation utilities
- Safe migration system

### Files Added/Modified

#### New Files

1. **`device-id.ts`** - Device ID management
   - `getOrCreateDeviceId()` - Generate or retrieve device ID
   - `hasDeviceId()` - Check if device ID exists
   - `clearDeviceIdCache()` - Clear cached device ID

2. **`schema-validator.ts`** - Schema validation utilities
   - `validateSyncSchema()` - Validate entire schema
   - `hasColumn()` - Check if column exists
   - `getTableColumns()` - Get table column info

3. **`index.ts`** - Module exports

4. **`__tests__/validate-task1.ts`** - Validation script

#### Modified Files

1. **`schema.ts`**
   - Added `device_id` column to `sync_metadata` table
   - Added `idx_transactions_updated_at` index
   - Added `idx_categories_updated_at` index
   - Added `idx_debts_updated_at` index

2. **`migrations.ts`**
   - Bumped schema version to 5
   - Added `device_id` column migration
   - Added index creation for `updated_at` columns
   - Added `createIndexIfMissing()` helper function

3. **`../lib/database.ts`**
   - Added schema validation on database initialization

## Usage

### Device ID Management

```typescript
import { getOrCreateDeviceId } from './database/device-id';

// Get or create device ID for a user
const deviceId = await getOrCreateDeviceId(db, userId);

// Check if device ID exists
const exists = await hasDeviceId(db, userId);
```

### Schema Validation

```typescript
import { validateSyncSchema } from './database/schema-validator';

// Validate entire schema
const result = await validateSyncSchema(db);

if (!result.valid) {
  console.error('Schema validation failed:', result.errors);
}
```

### Running Validation

To manually validate the Task 1 implementation:

```bash
# Note: This requires a React Native environment
# Run in the app to see validation output in console
```

## Database Schema

### sync_metadata Table

```sql
CREATE TABLE sync_metadata (
  user_id TEXT PRIMARY KEY NOT NULL,
  last_sync_time TEXT,
  last_push_time TEXT,
  device_id TEXT NOT NULL  -- NEW: Added in Task 1
);
```

### Performance Indexes

All synchronized tables now have indexes on `updated_at` for efficient sync queries:

- `idx_transactions_updated_at`
- `idx_categories_updated_at`
- `idx_debts_updated_at`

### Sync Metadata Columns

All synchronized tables (transactions, categories, debts) have:

- `id` - UUID primary key
- `user_id` - User identifier
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `is_deleted` - Soft delete flag
- `sync_status` - Sync state (pending, syncing, synced, failed, offline)
- `sync_version` - Version counter for conflict detection
- `retry_count` - Number of failed sync attempts

## Migration Safety

The migration system is designed to be safe and preserve all existing data:

1. **Incremental migrations** - Only adds missing columns, never drops tables
2. **Idempotent** - Can be run multiple times safely
3. **Transactional** - Uses transactions to prevent partial updates
4. **Validated** - Schema validation runs after migrations

## Requirements Satisfied

Task 1 satisfies the following requirements:

- **11.6** - Device ID in sync metadata
- **16.1** - Migration scripts for sync metadata columns
- **16.2** - Initialize sync_version to 1 for existing records
- **16.3** - Set sync_status to 'pending' for existing records

## Next Steps

Task 1 provides the foundation for the sync system. Next tasks will:

- Implement SyncQueue for batch management (Task 2.1)
- Implement SyncLock for mutex protection (Task 2.2)
- Implement RetryStrategy for exponential backoff (Task 2.3)
- Implement NetworkMonitor using NetInfo (Task 2.4)
- Implement SyncLogger for observability (Task 2.5)
