# Requirements Document: Supabase-Only Architecture

## Introduction

MobiBooks currently uses a complex offline-first sync system (100+ files) that causes performance issues, database locking errors, and difficult maintenance. This feature replaces the entire offline-first architecture with a simplified Supabase-only approach where all data is stored directly in Supabase with no local SQLite sync engine. The new architecture will provide better performance, simpler codebase, real-time updates, and production-ready reliability.

## Glossary

- **Supabase**: Backend-as-a-Service platform providing PostgreSQL database, authentication, and real-time subscriptions
- **RLS (Row Level Security)**: PostgreSQL security policy that restricts data access based on user identity
- **Real-time Subscription**: Supabase feature that pushes database changes to connected clients
- **Soft Delete**: Marking records as deleted (is_deleted flag) instead of removing them from database
- **Direct Query**: Supabase query executed immediately without local caching or sync queue
- **User Data Isolation**: Ensuring each user can only access their own data through RLS policies
- **Authentication Flow**: Process of user login/registration and session management
- **Data Layer**: Set of functions that handle all database operations (categories, transactions, debts)
- **Sync Engine**: Previous system that synchronized local SQLite with Supabase (being removed)
- **Repository Pattern**: Previous abstraction layer for database operations (being removed)

## Requirements

### Requirement 1: Remove Offline-First Sync Engine

**User Story:** As a developer, I want to remove the complex offline-first sync system, so that the codebase is simpler and easier to maintain.

#### Acceptance Criteria

1. THE System SHALL delete all files in lib/offline/ directory (50+ files including SyncEngine, SyncQueue, SyncLock, SyncLogger, ConflictResolver, RetryStrategy, NetworkMonitor)
2. THE System SHALL delete all files in lib/offline/repositories/ directory (BaseRepository, CategoryRepository, TransactionRepository, DebtRepository and all tests)
3. THE System SHALL delete database/migrations.ts, database/schema-validator.ts, and database/device-id.ts
4. THE System SHALL delete all __tests__ folders in database/ and contexts/ directories
5. THE System SHALL remove all sync-related imports and function calls from lib/auth.ts
6. THE System SHALL remove all sync-related logic from contexts/TransactionsContext.tsx
7. WHEN the sync engine is removed, THE System SHALL have fewer than 50 files in lib/ directory (down from 100+)

### Requirement 2: Implement Direct Supabase Queries for Categories

**User Story:** As a user, I want categories to be fetched directly from Supabase, so that I can see my categories without sync delays.

#### Acceptance Criteria

1. WHEN a user requests their categories, THE Categories_Service SHALL query Supabase directly using the authenticated user's ID
2. THE Categories_Service SHALL filter categories WHERE user_id matches the authenticated user AND is_deleted = 0
3. THE Categories_Service SHALL return categories ordered by name in ascending order
4. WHEN adding a new category, THE Categories_Service SHALL insert the category into Supabase with user_id, name, and normalized_name
5. WHEN deleting a category, THE Categories_Service SHALL perform a soft delete by setting is_deleted = 1 (not removing the record)
6. IF the user is not authenticated, THEN THE Categories_Service SHALL throw an error with message "Not authenticated"
7. IF a Supabase query fails, THEN THE Categories_Service SHALL throw the error with original error details

### Requirement 3: Implement Direct Supabase Queries for Transactions

**User Story:** As a user, I want transactions to be recorded and retrieved directly from Supabase, so that my sales and expenses are immediately persisted.

#### Acceptance Criteria

1. WHEN recording a sale, THE Transactions_Service SHALL insert a transaction with positive amount into Supabase
2. WHEN recording an expense, THE Transactions_Service SHALL insert a transaction with negative amount into Supabase
3. WHEN a user requests their transactions, THE Transactions_Service SHALL query Supabase directly using the authenticated user's ID
4. THE Transactions_Service SHALL filter transactions WHERE user_id matches the authenticated user AND is_deleted = 0
5. THE Transactions_Service SHALL return transactions ordered by transaction_date in descending order (newest first)
6. WHEN updating a transaction, THE Transactions_Service SHALL update the amount, category, description, and transaction_date in Supabase
7. WHEN deleting a transaction, THE Transactions_Service SHALL perform a soft delete by setting is_deleted = 1
8. WHEN calculating real-time profit, THE Transactions_Service SHALL sum all transaction amounts WHERE user_id matches authenticated user AND is_deleted = 0
9. IF the user is not authenticated, THEN THE Transactions_Service SHALL throw an error with message "Not authenticated"
10. IF a Supabase query fails, THEN THE Transactions_Service SHALL throw the error with original error details

### Requirement 4: Implement Direct Supabase Queries for Debts

**User Story:** As a user, I want to manage debts directly in Supabase, so that my debt records are immediately persisted and accessible.

#### Acceptance Criteria

1. WHEN a user requests their debts, THE Debts_Service SHALL query Supabase directly using the authenticated user's ID
2. THE Debts_Service SHALL filter debts WHERE user_id matches the authenticated user AND is_deleted = 0
3. WHEN creating a debt, THE Debts_Service SHALL insert a debt record with customer_name, amount, due_date, and note
4. WHEN updating a debt, THE Debts_Service SHALL update the debt record in Supabase
5. WHEN marking a debt as settled, THE Debts_Service SHALL update is_settled = 1 in Supabase
6. WHEN deleting a debt, THE Debts_Service SHALL perform a soft delete by setting is_deleted = 1
7. IF the user is not authenticated, THEN THE Debts_Service SHALL throw an error with message "Not authenticated"
8. IF a Supabase query fails, THEN THE Debts_Service SHALL throw the error with original error details

### Requirement 5: Simplify Authentication Flow

**User Story:** As a user, I want a simplified authentication flow without sync triggers, so that login and logout are fast and reliable.

#### Acceptance Criteria

1. WHEN a user signs in, THE Auth_Service SHALL authenticate with Supabase and return user session (no sync triggered)
2. WHEN a user registers, THE Auth_Service SHALL create a new user in Supabase with email, password, and profile data
3. WHEN a user signs out, THE Auth_Service SHALL clear the Supabase session and clear AsyncStorage (no sync cleanup needed)
4. WHEN a user requests password reset, THE Auth_Service SHALL send a password reset email via Supabase
5. WHEN a user updates their password, THE Auth_Service SHALL update the password in Supabase
6. THE Auth_Service SHALL NOT trigger any sync operations during login or logout
7. THE Auth_Service SHALL NOT attempt to sync local database on authentication state changes

### Requirement 6: Implement Real-Time Subscriptions for Live Updates

**User Story:** As a user, I want real-time updates when data changes, so that I see the latest information without manual refresh.

#### Acceptance Criteria

1. WHEN a user is viewing transactions, THE Transactions_Context SHALL subscribe to real-time changes on the transactions table
2. WHEN a transaction is inserted/updated/deleted by any client, THE Transactions_Context SHALL receive the change and update local state
3. WHEN a user is viewing categories, THE Categories_Context SHALL subscribe to real-time changes on the categories table
4. WHEN a category is inserted/updated/deleted by any client, THE Categories_Context SHALL receive the change and update local state
5. WHEN a user is viewing debts, THE Debts_Context SHALL subscribe to real-time changes on the debts table
6. WHEN a debt is inserted/updated/deleted by any client, THE Debts_Context SHALL receive the change and update local state
7. WHEN a user navigates away from a screen, THE subscription SHALL be unsubscribed to prevent memory leaks
8. IF a subscription fails, THE System SHALL log the error and allow manual refresh as fallback

### Requirement 7: Implement Row Level Security (RLS) Policies

**User Story:** As a developer, I want RLS policies to enforce data isolation, so that users can only access their own data.

#### Acceptance Criteria

1. THE System SHALL create RLS policy on categories table: users can only SELECT/INSERT/UPDATE/DELETE their own categories (WHERE user_id = auth.uid())
2. THE System SHALL create RLS policy on transactions table: users can only SELECT/INSERT/UPDATE/DELETE their own transactions (WHERE user_id = auth.uid())
3. THE System SHALL create RLS policy on debts table: users can only SELECT/INSERT/UPDATE/DELETE their own debts (WHERE user_id = auth.uid())
4. WHEN a user attempts to query another user's data, THE RLS policy SHALL prevent access and return empty result
5. WHEN a user attempts to insert data with another user's ID, THE RLS policy SHALL prevent the insert
6. THE System SHALL enable RLS on all three tables (categories, transactions, debts)

### Requirement 8: Simplify TransactionsContext

**User Story:** As a developer, I want TransactionsContext to be simplified, so that it only handles data fetching and state management without sync logic.

#### Acceptance Criteria

1. THE TransactionsContext SHALL maintain transactions state as an array of transaction objects
2. WHEN the context is initialized, THE TransactionsContext SHALL load transactions from Supabase
3. WHEN recordSale is called, THE TransactionsContext SHALL call Transactions_Service and refresh the transactions list
4. WHEN recordExpense is called, THE TransactionsContext SHALL call Transactions_Service and refresh the transactions list
5. WHEN updateTransaction is called, THE TransactionsContext SHALL call Transactions_Service and refresh the transactions list
6. WHEN removeTransaction is called, THE TransactionsContext SHALL call Transactions_Service and refresh the transactions list
7. THE TransactionsContext SHALL NOT contain any sync logic, offline handling, or debounced operations
8. THE TransactionsContext SHALL provide a refresh() function to manually reload transactions from Supabase

### Requirement 9: Eliminate Database Locking Issues

**User Story:** As a user, I want to avoid database locking errors, so that logout and other operations complete successfully.

#### Acceptance Criteria

1. WHEN a user logs out, THE System SHALL NOT encounter database table locked errors
2. WHEN multiple operations occur simultaneously, THE System SHALL NOT encounter database locking conflicts
3. THE System SHALL NOT use local SQLite database for data persistence (all data in Supabase)
4. WHEN a user logs out, THE System SHALL clear AsyncStorage without database operations
5. THE System SHALL use Supabase's built-in connection pooling to prevent lock contention

### Requirement 10: Achieve Fast Performance

**User Story:** As a user, I want fast performance, so that all operations complete quickly without sync overhead.

#### Acceptance Criteria

1. WHEN fetching categories, THE System SHALL complete within 500ms (no sync queue delays)
2. WHEN recording a transaction, THE System SHALL complete within 500ms (direct Supabase insert)
3. WHEN fetching transactions, THE System SHALL complete within 500ms (no sync engine overhead)
4. WHEN calculating profit, THE System SHALL complete within 500ms (direct Supabase aggregation)
5. THE System SHALL NOT perform background sync operations that slow down user interactions
6. THE System SHALL NOT maintain local SQLite database that requires sync reconciliation

### Requirement 11: Ensure Email Verification Works Correctly

**User Story:** As a user, I want email verification to work reliably, so that I can complete registration without errors.

#### Acceptance Criteria

1. WHEN a user registers, THE Auth_Service SHALL send a verification email via Supabase
2. WHEN a user clicks the verification link, THE Auth_Service SHALL mark the email as verified in Supabase
3. THE System SHALL NOT trigger sync operations during email verification
4. WHEN a user is not verified, THE System SHALL allow them to request a new verification email
5. IF email verification fails, THE System SHALL return a descriptive error message

### Requirement 12: Support Soft Delete for Data Recovery

**User Story:** As a user, I want soft deletes to preserve data, so that deleted records can be recovered if needed.

#### Acceptance Criteria

1. WHEN a category is deleted, THE System SHALL set is_deleted = 1 instead of removing the record
2. WHEN a transaction is deleted, THE System SHALL set is_deleted = 1 instead of removing the record
3. WHEN a debt is deleted, THE System SHALL set is_deleted = 1 instead of removing the record
4. WHEN querying data, THE System SHALL filter WHERE is_deleted = 0 to exclude soft-deleted records
5. THE System SHALL preserve created_at and updated_at timestamps for all records
6. THE System SHALL update updated_at timestamp when any record is modified

### Requirement 13: Implement Proper Error Handling

**User Story:** As a developer, I want proper error handling, so that errors are clear and actionable.

#### Acceptance Criteria

1. WHEN a Supabase query fails, THE System SHALL throw an error with the original error details
2. WHEN a user is not authenticated, THE System SHALL throw an error with message "Not authenticated"
3. WHEN a network error occurs, THE System SHALL throw an error with network details
4. WHEN a validation error occurs, THE System SHALL throw an error with validation details
5. THE System SHALL log all errors to console for debugging
6. THE System SHALL NOT silently fail or return undefined for errors

### Requirement 14: Maintain Data Consistency

**User Story:** As a user, I want data consistency across all operations, so that my records are always accurate.

#### Acceptance Criteria

1. WHEN a transaction is recorded, THE System SHALL immediately persist it to Supabase (no queue)
2. WHEN a category is added, THE System SHALL immediately persist it to Supabase (no queue)
3. WHEN a debt is created, THE System SHALL immediately persist it to Supabase (no queue)
4. THE System SHALL NOT have conflicting local and remote data (no sync conflicts)
5. WHEN multiple clients modify the same record, THE System SHALL use Supabase's last-write-wins strategy
6. THE System SHALL maintain referential integrity through Supabase foreign keys

### Requirement 15: Reduce Codebase Complexity

**User Story:** As a developer, I want a simpler codebase, so that the project is easier to understand and maintain.

#### Acceptance Criteria

1. THE System SHALL have fewer than 50 files in lib/ directory (down from 100+)
2. THE System SHALL remove all repository pattern abstractions
3. THE System SHALL remove all sync engine files and logic
4. THE System SHALL remove all offline-first handling code
5. THE System SHALL have direct Supabase queries in service functions
6. THE System SHALL have clear separation between data layer (services) and UI layer (contexts/components)

