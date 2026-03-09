# Requirements Document

## Introduction

The MobiBooks offline-first sync system ensures reliable, zero-data-loss synchronization between local SQLite storage and Supabase cloud storage for a bookkeeping mobile application. The system prioritizes local-first data persistence, guarantees idempotent cloud operations, handles network failures gracefully, and provides seamless multi-device support with automatic conflict resolution.

## Glossary

- **Sync_Engine**: The core synchronization component responsible for coordinating data transfer between local and cloud storage
- **Local_Store**: SQLite database on the mobile device serving as the primary data store
- **Cloud_Store**: Supabase Postgres database serving as the backup and multi-device sync target
- **Sync_Record**: A data entity (category, transaction, or debt) with sync metadata
- **Sync_Status**: Enumeration of record states: synced, pending, syncing, failed, offline
- **Sync_Version**: Monotonically increasing integer used for conflict detection
- **Device_ID**: Unique identifier for each device accessing the system
- **Conflict**: Situation where the same record has been modified on multiple devices
- **Soft_Delete**: Marking a record as deleted using is_deleted flag rather than physical deletion
- **Batch**: Group of up to 50 records processed together during synchronization
- **Retry_Strategy**: Exponential backoff algorithm with maximum 10 retry attempts
- **Network_Monitor**: Component that detects network connectivity changes using NetInfo
- **Sync_Trigger**: Event that initiates a synchronization cycle
- **Sync_Log**: Audit record capturing sync operations for debugging and observability
- **Idempotent_Operation**: Cloud write operation that produces the same result when executed multiple times

## Requirements

### Requirement 1: Local-First Data Persistence

**User Story:** As a user, I want all my data saved locally first, so that I never lose data regardless of network conditions.

#### Acceptance Criteria

1. WHEN a user creates or modifies a Sync_Record, THE Local_Store SHALL persist the data before any cloud operation
2. THE Sync_Engine SHALL return success to the user interface immediately after Local_Store persistence completes
3. IF Local_Store persistence fails, THEN THE Sync_Engine SHALL return an error to the user interface without attempting cloud synchronization
4. THE Local_Store SHALL serve as the source of truth for all read operations
5. FOR ALL write operations, the Local_Store persistence time SHALL be less than 100ms

### Requirement 2: Idempotent Cloud Synchronization

**User Story:** As a developer, I want cloud writes to be idempotent, so that retry operations never create duplicate records.

#### Acceptance Criteria

1. WHEN THE Sync_Engine uploads a Sync_Record to Cloud_Store, THE Cloud_Store SHALL use the record id as the primary key for upsert operations
2. THE Sync_Engine SHALL include sync_version in all cloud write operations
3. WHEN a Sync_Record is uploaded multiple times with the same sync_version, THE Cloud_Store SHALL produce identical results
4. THE Sync_Engine SHALL increment sync_version only when the record content changes locally
5. FOR ALL Sync_Records, parsing the local record then uploading then downloading then parsing SHALL produce an equivalent record (round-trip property)

### Requirement 3: Network Failure Handling

**User Story:** As a user, I want the app to handle network failures gracefully, so that I can continue working offline without errors.

#### Acceptance Criteria

1. WHEN THE Network_Monitor detects no network connectivity, THE Sync_Engine SHALL mark all pending operations with sync_status "offline"
2. WHEN a cloud write operation fails due to network error, THE Sync_Engine SHALL increment retry_count and schedule a retry
3. THE Retry_Strategy SHALL use exponential backoff with delays of 2^retry_count seconds
4. WHEN retry_count reaches 10, THE Sync_Engine SHALL mark the Sync_Record sync_status as "failed"
5. WHEN THE Network_Monitor detects network reconnection, THE Sync_Engine SHALL trigger synchronization for all non-synced records
6. THE Sync_Engine SHALL continue accepting local writes regardless of network state

### Requirement 4: Multi-Device Synchronization

**User Story:** As a user, I want to access my data from multiple devices, so that I can work from my phone or tablet seamlessly.

#### Acceptance Criteria

1. WHEN a Sync_Record is created or modified, THE Sync_Engine SHALL include the Device_ID in the record metadata
2. WHEN THE Sync_Engine downloads records from Cloud_Store, THE Sync_Engine SHALL merge records from all devices into Local_Store
3. THE Sync_Engine SHALL synchronize records bidirectionally between Local_Store and Cloud_Store
4. WHEN THE Sync_Engine detects a Conflict, THE Sync_Engine SHALL apply the conflict resolution strategy
5. THE Sync_Engine SHALL download cloud changes before uploading local changes during each sync cycle

### Requirement 5: Conflict Resolution

**User Story:** As a user, I want conflicts resolved automatically, so that I don't have to manually merge data when using multiple devices.

#### Acceptance Criteria

1. WHEN THE Sync_Engine detects a Conflict, THE Sync_Engine SHALL compare the updated_at timestamps of both versions
2. THE Sync_Engine SHALL retain the Sync_Record with the latest updated_at timestamp
3. THE Sync_Engine SHALL update the sync_version of the winning record
4. THE Sync_Engine SHALL log the conflict resolution decision to Sync_Log
5. WHEN both versions have identical updated_at timestamps, THE Sync_Engine SHALL retain the cloud version

### Requirement 6: Efficient Batch Processing

**User Story:** As a developer, I want sync operations batched efficiently, so that the system performs well with thousands of records.

#### Acceptance Criteria

1. WHEN THE Sync_Engine processes pending uploads, THE Sync_Engine SHALL group records into Batches of 50 records
2. THE Sync_Engine SHALL process each Batch as a single transaction to Cloud_Store
3. WHEN a Batch upload fails, THE Sync_Engine SHALL retry the entire Batch
4. THE Sync_Engine SHALL prioritize records by updated_at timestamp, oldest first
5. WHEN THE Sync_Engine processes downloads, THE Sync_Engine SHALL fetch records in Batches of 50 records

### Requirement 7: Soft Delete Implementation

**User Story:** As a user, I want deleted items synchronized across devices, so that deletions on one device appear on all devices.

#### Acceptance Criteria

1. WHEN a user deletes a Sync_Record, THE Sync_Engine SHALL set the is_deleted flag to true in Local_Store
2. THE Sync_Engine SHALL synchronize Soft_Delete operations to Cloud_Store
3. THE Sync_Engine SHALL exclude records where is_deleted equals true from user interface queries
4. THE Sync_Engine SHALL include Soft_Delete records in synchronization operations
5. WHEN THE Sync_Engine downloads a Soft_Delete record, THE Sync_Engine SHALL apply the deletion to Local_Store

### Requirement 8: Sync Status Tracking

**User Story:** As a user, I want to see the sync status of my data, so that I know when my changes are backed up to the cloud.

#### Acceptance Criteria

1. THE Sync_Engine SHALL maintain sync_status for each Sync_Record with values: synced, pending, syncing, failed, offline
2. WHEN a Sync_Record is created or modified locally, THE Sync_Engine SHALL set sync_status to "pending"
3. WHEN THE Sync_Engine begins uploading a Sync_Record, THE Sync_Engine SHALL set sync_status to "syncing"
4. WHEN a Sync_Record upload completes successfully, THE Sync_Engine SHALL set sync_status to "synced"
5. WHEN a Sync_Record upload fails after maximum retries, THE Sync_Engine SHALL set sync_status to "failed"
6. WHEN THE Network_Monitor detects no connectivity, THE Sync_Engine SHALL set sync_status to "offline" for pending records

### Requirement 9: Sync Trigger Management

**User Story:** As a user, I want my data synchronized automatically, so that I don't have to manually trigger backups.

#### Acceptance Criteria

1. WHEN the application starts, THE Sync_Engine SHALL trigger a synchronization cycle
2. WHEN THE Network_Monitor detects network reconnection, THE Sync_Engine SHALL trigger a synchronization cycle
3. WHEN a user creates or modifies a Sync_Record, THE Sync_Engine SHALL trigger a synchronization cycle
4. THE Sync_Engine SHALL trigger a synchronization cycle every 60 seconds while the application is active
5. THE Sync_Engine SHALL prevent concurrent synchronization cycles using a mutex lock

### Requirement 10: User Interface Indicators

**User Story:** As a user, I want visual feedback about sync status, so that I understand the state of my data backup.

#### Acceptance Criteria

1. THE user interface SHALL display a sync status indicator showing: synced, syncing, pending, offline, or failed
2. WHEN all Sync_Records have sync_status "synced", THE user interface SHALL display a "synced" indicator
3. WHEN any Sync_Record has sync_status "syncing", THE user interface SHALL display a "syncing" indicator with animation
4. WHEN any Sync_Record has sync_status "pending" or "offline", THE user interface SHALL display a "pending" indicator
5. WHEN any Sync_Record has sync_status "failed", THE user interface SHALL display a "failed" indicator with warning color
6. WHEN a synchronization cycle completes successfully, THE user interface SHALL display a toast notification
7. WHEN a Sync_Record remains in "failed" status for more than 24 hours, THE user interface SHALL display a warning notification

### Requirement 11: Sync Metadata Management

**User Story:** As a developer, I want comprehensive sync metadata, so that I can track and debug synchronization issues.

#### Acceptance Criteria

1. THE Sync_Engine SHALL maintain the following metadata for each Sync_Record: id, user_id, created_at, updated_at, sync_status, sync_version, retry_count, device_id, is_deleted
2. WHEN a Sync_Record is created, THE Sync_Engine SHALL initialize sync_version to 1, retry_count to 0, and sync_status to "pending"
3. WHEN a Sync_Record is modified, THE Sync_Engine SHALL increment sync_version and update updated_at timestamp
4. WHEN a sync operation fails, THE Sync_Engine SHALL increment retry_count
5. WHEN a sync operation succeeds, THE Sync_Engine SHALL reset retry_count to 0
6. THE Sync_Engine SHALL generate a unique Device_ID on first application launch and persist it

### Requirement 12: Observability and Logging

**User Story:** As a developer, I want detailed sync logs, so that I can diagnose and fix synchronization issues.

#### Acceptance Criteria

1. THE Sync_Engine SHALL maintain a Sync_Log table with columns: id, timestamp, operation, record_type, record_id, status, error_message, device_id
2. WHEN THE Sync_Engine begins a synchronization cycle, THE Sync_Engine SHALL log the operation start
3. WHEN a Sync_Record upload succeeds, THE Sync_Engine SHALL log the success with record details
4. WHEN a Sync_Record upload fails, THE Sync_Engine SHALL log the failure with error message
5. WHEN THE Sync_Engine resolves a Conflict, THE Sync_Engine SHALL log the conflict resolution decision
6. THE Sync_Engine SHALL retain Sync_Log entries for 30 days
7. THE Sync_Engine SHALL provide a method to export Sync_Log entries for debugging

### Requirement 13: Categories Table Synchronization

**User Story:** As a user, I want my expense categories synchronized, so that I have consistent categories across all devices.

#### Acceptance Criteria

1. THE Sync_Engine SHALL synchronize the categories table with columns: id, user_id, name, normalized_name, created_at, updated_at, is_deleted, sync_status, sync_version, retry_count, device_id
2. WHEN a category is created or modified, THE Sync_Engine SHALL apply all sync metadata requirements
3. THE Sync_Engine SHALL enforce unique constraint on normalized_name per user_id during conflict resolution
4. WHEN a category name conflict occurs, THE Sync_Engine SHALL apply the latest-update-wins strategy

### Requirement 14: Transactions Table Synchronization

**User Story:** As a user, I want my transactions synchronized, so that I can see all my expenses and income on any device.

#### Acceptance Criteria

1. THE Sync_Engine SHALL synchronize the transactions table with columns: id, user_id, amount, category, description, transaction_date, created_at, updated_at, is_deleted, sync_status, sync_version, retry_count, device_id
2. WHEN a transaction is created or modified, THE Sync_Engine SHALL apply all sync metadata requirements
3. THE Sync_Engine SHALL maintain referential integrity between transactions and categories during synchronization
4. THE Sync_Engine SHALL handle transactions with thousands of records efficiently using batch processing

### Requirement 15: Debts Table Synchronization

**User Story:** As a user, I want my debt records synchronized, so that I can track customer debts from any device.

#### Acceptance Criteria

1. THE Sync_Engine SHALL synchronize the debts table with columns: id, user_id, customer_name, amount, due_date, note, is_settled, created_at, updated_at, is_deleted, sync_status, sync_version, retry_count, device_id
2. WHEN a debt record is created or modified, THE Sync_Engine SHALL apply all sync metadata requirements
3. WHEN a debt is marked as settled on one device, THE Sync_Engine SHALL synchronize the is_settled status to all devices
4. THE Sync_Engine SHALL preserve the settlement timestamp during synchronization

### Requirement 16: Database Migration Support

**User Story:** As a developer, I want automated database migrations, so that existing user data is preserved when adding sync capabilities.

#### Acceptance Criteria

1. THE Sync_Engine SHALL provide migration scripts to add sync metadata columns to existing tables
2. WHEN a migration runs on existing data, THE Sync_Engine SHALL initialize sync_version to 1 for all existing records
3. WHEN a migration runs on existing data, THE Sync_Engine SHALL set sync_status to "pending" for all existing records
4. THE Sync_Engine SHALL preserve all existing user data during migration
5. THE Sync_Engine SHALL execute migrations transactionally to prevent partial updates

### Requirement 17: Performance Requirements

**User Story:** As a user, I want the app to remain responsive, so that sync operations don't slow down my work.

#### Acceptance Criteria

1. THE Sync_Engine SHALL execute all synchronization operations on a background thread
2. THE Local_Store write operations SHALL complete within 100ms for single records
3. THE Sync_Engine SHALL process a Batch of 50 records within 5 seconds under normal network conditions
4. THE Sync_Engine SHALL handle Local_Store databases with 10,000+ records without performance degradation
5. THE user interface SHALL remain responsive during synchronization operations

### Requirement 18: Security and Data Isolation

**User Story:** As a user, I want my data kept private, so that other users cannot access my financial information.

#### Acceptance Criteria

1. THE Sync_Engine SHALL include user_id in all Cloud_Store queries to enforce data isolation
2. THE Cloud_Store SHALL enforce Row Level Security policies that restrict access to records where user_id matches the authenticated user
3. THE Sync_Engine SHALL validate user authentication before initiating any cloud synchronization
4. WHEN authentication fails, THE Sync_Engine SHALL mark sync operations as "failed" and log the authentication error
5. THE Sync_Engine SHALL never cache or expose authentication credentials in Sync_Log entries

### Requirement 19: Error Recovery

**User Story:** As a user, I want the app to recover from errors automatically, so that temporary issues don't permanently break synchronization.

#### Acceptance Criteria

1. WHEN THE Sync_Engine encounters a transient error, THE Sync_Engine SHALL retry the operation using the Retry_Strategy
2. WHEN THE Sync_Engine encounters a permanent error (e.g., authentication failure), THE Sync_Engine SHALL mark the operation as "failed" without retrying
3. WHEN a Sync_Record is marked as "failed", THE user interface SHALL provide a manual retry option
4. WHEN a user triggers manual retry, THE Sync_Engine SHALL reset retry_count to 0 and attempt synchronization
5. THE Sync_Engine SHALL distinguish between network errors, authentication errors, and data validation errors

### Requirement 20: Offline Mode Support

**User Story:** As a user, I want full app functionality offline, so that I can work without internet connectivity.

#### Acceptance Criteria

1. THE application SHALL provide full create, read, update, and delete functionality when offline
2. WHEN offline, THE Sync_Engine SHALL queue all changes for synchronization when connectivity returns
3. THE user interface SHALL display an offline indicator when THE Network_Monitor detects no connectivity
4. WHEN offline, THE Sync_Engine SHALL not attempt any cloud operations
5. THE application SHALL load all data from Local_Store regardless of network state
