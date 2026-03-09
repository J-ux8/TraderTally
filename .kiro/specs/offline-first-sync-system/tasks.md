# Implementation Plan: Offline-First Sync System

## Overview

This plan rebuilds the MobiBooks sync system into a production-grade offline-first architecture. The implementation follows a strict local-first approach where SQLite is the source of truth, all operations succeed immediately offline, and cloud synchronization happens asynchronously with automatic conflict resolution.

The existing codebase has basic sync infrastructure that needs to be enhanced with proper batching, retry logic, mutex locking, network monitoring, observability, and comprehensive testing.

## Tasks

- [x] 1. Enhance database schema and create migration utilities
  - Update sync_metadata table to include device_id column
  - Add missing indexes for performance (updated_at columns)
  - Create device ID generation and persistence logic
  - Validate all tables have required sync metadata columns
  - _Requirements: 11.6, 16.1, 16.2, 16.3_

- [x] 2. Implement core sync infrastructure components
  - [x] 2.1 Create SyncQueue for batch management
    - Implement getNextBatch() to fetch up to 50 pending records ordered by updated_at
    - Implement markAsSyncing(), markAsSynced(), markAsFailed() status update methods
    - Implement getPendingCount() for UI status indicators
    - _Requirements: 6.1, 6.2, 6.4, 8.2, 8.3, 8.4_
  
  - [x] 2.2 Create SyncLock for mutex protection
    - Implement acquire() and release() with in-memory boolean flag
    - Add timestamp-based auto-release after 5 minutes to prevent deadlock
    - Implement isLocked() status check
    - Implement forceRelease() for error recovery
    - _Requirements: 9.5_
  
  - [x] 2.3 Create RetryStrategy for exponential backoff
    - Implement getRetryDelay() with schedule: 10s, 30s, 2m, 10m, 10m
    - Implement shouldRetry() checking retry_count < 10
    - Implement resetRetryCount() after successful sync
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [x] 2.4 Create NetworkMonitor using NetInfo
    - Implement isOnline() to check current connectivity
    - Implement subscribe() for connectivity change callbacks
    - Implement getNetworkType() returning wifi/cellular/none
    - _Requirements: 3.1, 3.5, 20.3_
  
  - [x] 2.5 Create SyncLogger for observability
    - Implement logSyncStart(), logSyncComplete(), logSyncError()
    - Implement logConflict() for conflict resolution tracking
    - Implement getRecentLogs() and exportLogs() for debugging
    - Create sync_logs table with proper schema if not exists
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.7_

- [x] 3. Rebuild SyncEngine with production-grade features
  - [x] 3.1 Implement sync() orchestration method
    - Add mutex lock acquisition at start (fail fast if locked)
    - Implement upload phase calling uploadPendingRecords() for each table
    - Implement download phase calling downloadServerUpdates() for each table
    - Update sync_metadata.last_sync_time after successful completion
    - Release mutex lock in finally block
    - Add comprehensive error handling and logging
    - _Requirements: 1.2, 9.5, 17.1_
  
  - [x] 3.2 Implement uploadPendingRecords() with batching
    - Use SyncQueue.getNextBatch() to fetch 50 records at a time
    - Mark records as 'syncing' before upload
    - Perform batch upsert to Supabase with onConflict: 'id'
    - On success: mark as 'synced' and reset retry_count
    - On failure: retry individual records, increment retry_count
    - Apply RetryStrategy for failed records
    - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 8.3, 8.4_
  
  - [x] 3.3 Implement downloadServerUpdates() with incremental sync
    - Query Supabase for records updated since last_sync_time
    - Fetch in batches of 50 records ordered by updated_at
    - For each server record: check if exists locally
    - New records: insert with sync_status = 'synced'
    - Existing records: call ConflictResolver.resolve()
    - Apply resolved records to local database
    - _Requirements: 4.2, 4.3, 4.5, 6.5_
  
  - [x] 3.4 Add network failure handling
    - Check NetworkMonitor.isOnline() before sync operations
    - Mark pending records as 'offline' when no connectivity
    - Skip cloud operations entirely when offline
    - Continue accepting local writes regardless of network state
    - _Requirements: 3.1, 3.6, 20.4_
  
  - [x] 3.5 Implement sync trigger management
    - Add debounced trigger on user actions (20 second throttle)
    - Add network reconnection listener using NetworkMonitor
    - Add 60-second background timer while app is active
    - Ensure all triggers respect mutex lock
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]* 3.6 Write unit tests for SyncEngine
  - Test mutex lock prevents concurrent syncs
  - Test batch processing with >50 records
  - Test retry logic with exponential backoff
  - Test offline mode skips cloud operations
  - _Requirements: 3.2, 6.1, 9.5, 20.4_

- [x] 4. Enhance ConflictResolver with comprehensive logic
  - [x] 4.1 Implement resolve() method with latest-update-wins
    - Compare updated_at timestamps (server > local → server wins)
    - Handle equal timestamps (server wins as tie-breaker)
    - Return ResolvedRecord with winner, record, and reason
    - _Requirements: 5.1, 5.2, 5.5_
  
  - [x] 4.2 Add conflict detection and logging
    - Implement hasConflict() checking sync_status and updated_at
    - Log all conflict resolutions to SyncLogger
    - Include both versions in conflict log for debugging
    - _Requirements: 5.4, 12.5_

- [ ]* 4.3 Write property test for conflict resolution
  - **Property 1: Conflict resolution is deterministic**
  - **Validates: Requirements 5.1, 5.2**
  - Generate random pairs of local/server records with different timestamps
  - Verify resolve() always returns same winner for same inputs
  - Verify newer timestamp always wins

- [x] 5. Update BaseRepository with enhanced sync support
  - [x] 5.1 Enhance save() method
    - Ensure sync_version increments on updates (not on inserts)
    - Set sync_status = 'pending' for all writes
    - Ensure updated_at timestamp updates on every change
    - Maintain created_at immutability
    - _Requirements: 1.1, 1.2, 2.4, 11.2, 11.3_
  
  - [x] 5.2 Enhance softDelete() method
    - Set is_deleted = 1 instead of physical deletion
    - Increment sync_version and set sync_status = 'pending'
    - Update updated_at timestamp
    - _Requirements: 7.1, 7.2_
  
  - [x] 5.3 Add getPendingSync() method
    - Query records where sync_status = 'pending' or 'failed'
    - Order by updated_at ascending (oldest first)
    - Exclude soft-deleted records from user queries
    - _Requirements: 6.4, 7.3_
  
  - [x] 5.4 Add updateSyncStatus() method
    - Update sync_status for given record ID
    - Used by SyncQueue for status transitions
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [ ]* 5.5 Write property test for BaseRepository
  - **Property 2: Round-trip consistency**
  - **Validates: Requirements 2.5**
  - Create record → save locally → read back → verify all fields match
  - Update record → save → read → verify sync_version incremented
  - Soft delete → verify is_deleted = 1 and sync_status = 'pending'

- [x] 6. Update TransactionRepository with sync support
  - Ensure all CRUD operations use BaseRepository.save()
  - Ensure list() queries exclude is_deleted = 1 records
  - Add proper user_id filtering on all queries
  - Verify sync_version increments on updates
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 7. Update CategoryRepository with sync support
  - Ensure all CRUD operations use BaseRepository.save()
  - Ensure list() queries exclude is_deleted = 1 records
  - Add proper user_id filtering on all queries
  - Handle normalized_name uniqueness during conflict resolution
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 8. Update DebtRepository with sync support
  - Ensure all CRUD operations use BaseRepository.save()
  - Ensure list() queries exclude is_deleted = 1 records
  - Add proper user_id filtering on all queries
  - Preserve is_settled status during synchronization
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 9. Checkpoint - Verify core sync functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integrate sync engine with TransactionsContext
  - [x] 10.1 Initialize SyncEngine on context mount
    - Create SyncEngine instance with user_id
    - Set up NetworkMonitor listeners
    - Trigger initial sync on app start
    - _Requirements: 9.1_
  
  - [x] 10.2 Add sync trigger on data mutations
    - Call SyncEngine.sync() after create/update/delete operations
    - Debounce triggers to max 1 sync per 20 seconds
    - Handle sync errors gracefully without blocking UI
    - _Requirements: 9.3, 9.4_
  
  - [x] 10.3 Add background sync timer
    - Set up 60-second interval timer
    - Call SyncEngine.sync() on each interval
    - Clear timer on context unmount
    - _Requirements: 9.4_
  
  - [x] 10.4 Add network reconnection handler
    - Subscribe to NetworkMonitor connectivity changes
    - Trigger sync when transitioning from offline to online
    - Update UI sync status based on network state
    - _Requirements: 3.5, 9.2_

- [x] 11. Update UI components for sync status display
  - [x] 11.1 Enhance OfflineIndicator component
    - Display sync status: synced, syncing, pending, offline, failed
    - Show animated spinner when syncing
    - Show warning icon for failed status
    - Display last synced timestamp
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 11.2 Add sync status to transaction list
    - Show pending indicator on unsynced transactions
    - Show failed indicator with retry button
    - Update indicators in real-time as sync progresses
    - _Requirements: 10.1, 10.4, 10.5_
  
  - [x] 11.3 Add toast notifications for sync events
    - Show success toast when sync completes
    - Show warning toast for failed records after 24 hours
    - Show error toast for authentication failures
    - _Requirements: 10.6, 10.7_
  
  - [x] 11.4 Add manual retry functionality
    - Add "Retry Sync" button in failed state
    - Reset retry_count and trigger sync on button press
    - Provide user feedback on retry attempt
    - _Requirements: 19.3, 19.4_

- [x] 12. Add comprehensive error handling and recovery
  - [x] 12.1 Implement error classification
    - Distinguish network errors (transient, should retry)
    - Distinguish authentication errors (permanent, don't retry)
    - Distinguish validation errors (permanent, don't retry)
    - _Requirements: 19.2, 19.5_
  
  - [x] 12.2 Add authentication validation
    - Check user authentication before sync operations
    - Mark sync as failed on authentication errors
    - Never expose credentials in logs
    - _Requirements: 18.3, 18.4, 18.5_
  
  - [x] 12.3 Implement graceful degradation
    - Continue local operations when sync fails
    - Queue changes for retry when connectivity returns
    - Provide clear user feedback on sync state
    - _Requirements: 3.6, 19.1, 20.1, 20.2_

- [ ]* 12.4 Write integration tests for error scenarios
  - Test network failure during upload
  - Test authentication failure handling
  - Test retry logic with exponential backoff
  - Test offline mode with queued changes
  - _Requirements: 3.2, 3.3, 19.1, 20.4_

- [x] 13. Implement performance optimizations
  - [x] 13.1 Add database indexes
    - Verify index on transactions(sync_status) WHERE sync_status = 'pending'
    - Verify index on transactions(updated_at)
    - Verify index on categories(sync_status) WHERE sync_status = 'pending'
    - Verify index on debts(sync_status) WHERE sync_status = 'pending'
    - _Requirements: 17.4_
  
  - [x] 13.2 Optimize batch processing
    - Ensure batch size of 50 records for uploads
    - Ensure batch size of 50 records for downloads
    - Process batches in parallel where possible
    - _Requirements: 6.1, 6.5, 17.3_
  
  - [x] 13.3 Ensure background thread execution
    - Run all sync operations on background thread
    - Keep UI thread responsive during sync
    - Update UI state asynchronously
    - _Requirements: 17.1, 17.5_

- [ ]* 13.4 Write performance tests
  - Test local write completes < 100ms
  - Test batch upload of 50 records < 5 seconds
  - Test database with 10,000+ records
  - _Requirements: 1.5, 17.2, 17.3, 17.4_

- [x] 14. Implement security and data isolation
  - [x] 14.1 Add user_id validation
    - Include user_id in all Supabase queries
    - Verify RLS policies enforce user_id matching
    - Test data isolation between users
    - _Requirements: 18.1, 18.2_
  
  - [x] 14.2 Add authentication checks
    - Validate user authentication before sync
    - Handle authentication failures gracefully
    - Provide clear error messages for auth issues
    - _Requirements: 18.3, 18.4_

- [ ]* 14.3 Write security tests
  - Test RLS policies prevent cross-user access
  - Test authentication validation before sync
  - Test credential protection in logs
  - _Requirements: 18.1, 18.2, 18.5_

- [x] 15. Final integration and testing
  - [x] 15.1 Test multi-device synchronization
    - Create records on device A, verify sync to device B
    - Create conflicting changes on both devices
    - Verify conflict resolution applies latest-update-wins
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_
  
  - [x] 15.2 Test soft delete synchronization
    - Delete record on device A, verify deletion syncs to device B
    - Verify deleted records excluded from UI queries
    - Verify deleted records included in sync operations
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 15.3 Test offline mode functionality
    - Disable network, create/update/delete records
    - Verify all operations succeed locally
    - Re-enable network, verify sync completes
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_
  
  - [x] 15.4 Test sync status tracking
    - Verify status transitions: pending → syncing → synced
    - Verify failed status after max retries
    - Verify offline status when no connectivity
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation builds incrementally on existing code
- Checkpoints ensure validation at key milestones
- Property tests validate universal correctness properties
- Integration tests validate end-to-end workflows
- All sync operations must preserve local data integrity
- Network failures should never block local operations
- The sync engine must be idempotent and safe to retry
