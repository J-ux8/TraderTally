# Implementation Plan: Supabase-Only Architecture

## Overview

This implementation plan converts MobiBooks from a complex offline-first sync system (100+ files) to a simplified Supabase-only architecture with direct queries and real-time subscriptions. The plan is organized into 5 phases: setup, service layer creation, context layer creation, UI integration, and cleanup. Each phase builds on previous work with incremental validation through tests.

## Tasks

### Phase 1: Setup and Preparation

- [ ] 1. Set up Supabase RLS policies and verify database schema
  - Execute SQL to enable RLS on categories, transactions, and debts tables
  - Create RLS policies for SELECT, INSERT, UPDATE, DELETE operations
  - Verify all policies are correctly configured in Supabase dashboard
  - Create a verification script to test RLS enforcement
  - _Requirements: 7.1, 7.2, 7.3, 7.6_

  - [ ]* 1.1 Write property test for user data isolation
    - **Property 1: User Data Isolation**
    - **Validates: Requirements 2.2, 3.4, 4.2, 7.4, 7.5**

### Phase 2: Service Layer Implementation

- [ ] 2. Implement lib/categories.ts with direct Supabase queries
  - Create Category interface with all required fields (id, user_id, name, normalized_name, created_at, updated_at, is_deleted)
  - Implement getUserCategories() to fetch non-deleted categories for authenticated user
  - Implement addCategory(name) to insert new category with normalized_name
  - Implement deleteCategory(id) to soft-delete by setting is_deleted = 1
  - Add authentication check to throw "Not authenticated" error if user not logged in
  - Add error handling to propagate Supabase errors with original details
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 13.1, 13.6_

  - [ ]* 2.1 Write unit tests for categories service
    - Test adding category with valid name succeeds
    - Test adding category with empty name fails with validation error
    - Test adding category with whitespace-only name fails
    - Test deleting category soft-deletes it (is_deleted = 1)
    - Test getting categories filters out soft-deleted records
    - Test getting categories returns results ordered by name ascending
    - Test unauthenticated user throws "Not authenticated" error
    - Test Supabase query failure throws error with original details
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.2 Write property test for soft delete filtering
    - **Property 2: Soft Delete Filtering**
    - **Validates: Requirements 2.5, 12.1, 12.2, 12.3, 12.4**

- [ ] 3. Implement lib/transactions.ts with direct Supabase queries
  - Create Transaction interface with all required fields (id, user_id, amount, category, description, transaction_date, created_at, updated_at, is_deleted)
  - Implement recordSale(amount, category, description, date) to insert transaction with positive amount
  - Implement recordExpense(amount, category, description, date) to insert transaction with negative amount
  - Implement getUserTransactions() to fetch non-deleted transactions for authenticated user ordered by transaction_date descending
  - Implement updateTransaction(id, amount, category, description, date) to update transaction fields
  - Implement deleteTransaction(id) to soft-delete by setting is_deleted = 1
  - Implement getRealTimeProfit() to sum all transaction amounts where is_deleted = 0
  - Add authentication check to throw "Not authenticated" error if user not logged in
  - Add error handling to propagate Supabase errors with original details
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 13.1, 13.6_

  - [ ]* 3.1 Write unit tests for transactions service
    - Test recording sale creates transaction with positive amount
    - Test recording expense creates transaction with negative amount
    - Test getting transactions filters out soft-deleted records
    - Test getting transactions returns results ordered by transaction_date descending
    - Test updating transaction updates all fields (amount, category, description, date)
    - Test deleting transaction soft-deletes it (is_deleted = 1)
    - Test calculating profit sums all amounts correctly
    - Test unauthenticated user throws "Not authenticated" error
    - Test Supabase query failure throws error with original details
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 3.2 Write property test for amount sign consistency
    - **Property 3: Amount Sign Consistency**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 3.3 Write property test for profit calculation accuracy
    - **Property 5: Profit Calculation Accuracy**
    - **Validates: Requirements 3.8, 14.1**

- [ ] 4. Implement lib/debts.ts with direct Supabase queries
  - Create Debt interface with all required fields (id, user_id, customer_name, amount, due_date, note, is_settled, created_at, updated_at, is_deleted)
  - Implement getUserDebts() to fetch non-deleted debts for authenticated user
  - Implement addDebt(customer_name, amount, due_date, note) to insert new debt
  - Implement updateDebt(id, customer_name, amount, due_date, note) to update debt fields
  - Implement settleDebt(id) to set is_settled = 1
  - Implement deleteDebt(id) to soft-delete by setting is_deleted = 1
  - Add authentication check to throw "Not authenticated" error if user not logged in
  - Add error handling to propagate Supabase errors with original details
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 13.1, 13.6_

  - [ ]* 4.1 Write unit tests for debts service
    - Test creating debt with valid data succeeds and returns debt with correct fields
    - Test creating debt with negative amount fails with validation error
    - Test updating debt updates all fields
    - Test settling debt sets is_settled = 1
    - Test deleting debt soft-deletes it (is_deleted = 1)
    - Test getting debts filters out soft-deleted records
    - Test unauthenticated user throws "Not authenticated" error
    - Test Supabase query failure throws error with original details
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [ ] 5. Simplify lib/auth.ts to remove sync triggers
  - Review current lib/auth.ts and identify all sync-related imports and function calls
  - Remove all imports from lib/offline/ directory
  - Remove all sync trigger calls from signIn, registerWithProfile, signOut functions
  - Implement signIn(email, password) to authenticate with Supabase and return session
  - Implement registerWithProfile(email, password, fullName, phoneNumber, businessType) to create new user with profile data
  - Implement signOut() to clear Supabase session and clear AsyncStorage
  - Implement forgotPassword(email) to send password reset email via Supabase
  - Implement updatePassword(newPassword) to update password in Supabase
  - Verify no sync operations are triggered during authentication
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 13.1, 13.6_

  - [ ]* 5.1 Write unit tests for auth service
    - Test sign in with valid credentials succeeds and returns session
    - Test sign in with invalid credentials fails with error
    - Test register creates new user with profile data
    - Test sign out clears Supabase session and AsyncStorage
    - Test password reset sends email via Supabase
    - Test update password changes password in Supabase
    - Test no sync functions are called during authentication
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 5.2 Write property test for authentication required
    - **Property 6: Authentication Required**
    - **Validates: Requirements 2.6, 3.9, 4.7**

  - [ ]* 5.3 Write property test for no sync logic in auth service
    - **Property 8: No Sync Logic in Auth Service**
    - **Validates: Requirements 5.6, 5.7**

- [ ] 6. Checkpoint - Verify all service layer tests pass
  - Run all unit tests for categories, transactions, debts, and auth services
  - Verify all property tests pass (Properties 1-8)
  - Check code coverage is at least 80% for service layer
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: Context Layer Implementation

- [ ] 7. Implement CategoriesContext with real-time subscriptions
  - Create CategoriesContextType interface with categories array, loading state, refresh function, addCategory, removeCategory
  - Implement CategoriesProvider component that wraps children
  - On mount: load categories from Supabase using getUserCategories()
  - On mount: subscribe to real-time changes on categories table filtered by user_id
  - Handle INSERT event: add new category to state
  - Handle UPDATE event: replace category in state
  - Handle DELETE event: remove category from state (soft delete)
  - On unmount: unsubscribe from real-time channel to prevent memory leaks
  - Implement refresh() function to manually reload categories from Supabase
  - Implement addCategory(name) to call service and refresh state
  - Implement removeCategory(id) to call service and refresh state
  - _Requirements: 6.3, 6.4, 6.7, 8.1, 8.2, 8.3_

  - [ ]* 7.1 Write unit tests for CategoriesContext
    - Test CategoriesContext loads categories on mount
    - Test CategoriesContext subscribes to real-time changes on mount
    - Test addCategory calls service and refreshes data
    - Test removeCategory calls service and refreshes data
    - Test unsubscribe on unmount prevents memory leaks
    - _Requirements: 6.3, 6.4, 6.7_

- [ ] 8. Implement TransactionsContext with real-time subscriptions
  - Create TransactionsContextType interface with transactions array, loading state, refresh function, recordSale, recordExpense, updateTransaction, removeTransaction
  - Implement TransactionsProvider component that wraps children
  - On mount: load transactions from Supabase using getUserTransactions()
  - On mount: subscribe to real-time changes on transactions table filtered by user_id
  - Handle INSERT event: add new transaction to state
  - Handle UPDATE event: replace transaction in state
  - Handle DELETE event: remove transaction from state (soft delete)
  - On unmount: unsubscribe from real-time channel to prevent memory leaks
  - Implement refresh() function to manually reload transactions from Supabase
  - Implement recordSale(amount, category, description, date) to call service and refresh state
  - Implement recordExpense(amount, category, description, date) to call service and refresh state
  - Implement updateTransaction(id, amount, category, description, date) to call service and refresh state
  - Implement removeTransaction(id) to call service and refresh state
  - Remove all sync logic, offline handling, and debounced operations
  - _Requirements: 6.1, 6.2, 6.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 8.1 Write unit tests for TransactionsContext
    - Test TransactionsContext loads transactions on mount
    - Test TransactionsContext subscribes to real-time changes on mount
    - Test recordSale calls service and refreshes data
    - Test recordExpense calls service and refreshes data
    - Test updateTransaction calls service and refreshes data
    - Test removeTransaction calls service and refreshes data
    - Test unsubscribe on unmount prevents memory leaks
    - Test no sync logic exists in context
    - _Requirements: 6.1, 6.2, 6.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 8.2 Write property test for real-time subscription updates
    - **Property 4: Real-Time Subscription Updates**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

  - [ ]* 8.3 Write property test for no sync logic in TransactionsContext
    - **Property 9: No Sync Logic in TransactionsContext**
    - **Validates: Requirements 8.7**

- [ ] 9. Implement DebtsContext with real-time subscriptions
  - Create DebtsContextType interface with debts array, loading state, refresh function, addDebt, updateDebt, settleDebt, removeDebt
  - Implement DebtsProvider component that wraps children
  - On mount: load debts from Supabase using getUserDebts()
  - On mount: subscribe to real-time changes on debts table filtered by user_id
  - Handle INSERT event: add new debt to state
  - Handle UPDATE event: replace debt in state
  - Handle DELETE event: remove debt from state (soft delete)
  - On unmount: unsubscribe from real-time channel to prevent memory leaks
  - Implement refresh() function to manually reload debts from Supabase
  - Implement addDebt(customer_name, amount, due_date, note) to call service and refresh state
  - Implement updateDebt(id, customer_name, amount, due_date, note) to call service and refresh state
  - Implement settleDebt(id) to call service and refresh state
  - Implement removeDebt(id) to call service and refresh state
  - _Requirements: 6.5, 6.6, 6.7, 8.1, 8.2, 8.3_

  - [ ]* 9.1 Write unit tests for DebtsContext
    - Test DebtsContext loads debts on mount
    - Test DebtsContext subscribes to real-time changes on mount
    - Test addDebt calls service and refreshes data
    - Test updateDebt calls service and refreshes data
    - Test settleDebt calls service and refreshes data
    - Test removeDebt calls service and refreshes data
    - Test unsubscribe on unmount prevents memory leaks
    - _Requirements: 6.5, 6.6, 6.7_

- [ ] 10. Checkpoint - Verify all context layer tests pass
  - Run all unit tests for CategoriesContext, TransactionsContext, and DebtsContext
  - Verify all property tests pass (Properties 4, 9)
  - Check code coverage is at least 80% for context layer
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: UI Integration

- [ ] 11. Update UI components to use new contexts
  - Update app/(tabs)/index.tsx to use TransactionsContext instead of old sync system
  - Update app/(tabs)/debts.tsx to use DebtsContext instead of old sync system
  - Update app/(tabs)/record-expense.tsx to use TransactionsContext and CategoriesContext
  - Update all other components that reference old sync system or repositories
  - Replace all imports from lib/offline/ with imports from new services and contexts
  - Verify all components render correctly with new contexts
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 12. Test all screens with new architecture
  - Test home screen displays transactions correctly
  - Test home screen displays profit calculation correctly
  - Test debts screen displays debts correctly
  - Test record expense screen allows recording expenses
  - Test record sale screen allows recording sales
  - Test categories screen displays categories correctly
  - Test adding new category works correctly
  - Test deleting category works correctly
  - Test updating transaction works correctly
  - Test deleting transaction works correctly
  - _Requirements: 3.3, 3.4, 3.5, 4.1, 4.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 13. Verify real-time updates work correctly
  - Test that changes made in one client appear in another client within 1 second
  - Test that adding transaction in one client updates all connected clients
  - Test that updating transaction in one client updates all connected clients
  - Test that deleting transaction in one client updates all connected clients
  - Test that adding category in one client updates all connected clients
  - Test that adding debt in one client updates all connected clients
  - Test that settling debt in one client updates all connected clients
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 13.1 Write property test for subscription cleanup
    - **Property 15: Subscription Cleanup**
    - **Validates: Requirements 6.7**

### Phase 5: Cleanup and Validation

- [ ] 14. Delete lib/offline/ directory and all sync-related files
  - Delete lib/offline/sync/ directory (SyncEngine.ts, SyncQueue.ts, SyncLock.ts, SyncLogger.ts, ConflictResolver.ts, RetryStrategy.ts, NetworkMonitor.ts and all __tests__)
  - Delete lib/offline/repositories/ directory (BaseRepository.ts, CategoryRepository.ts, TransactionRepository.ts, DebtRepository.ts and all __tests__)
  - Delete lib/offline/README.md
  - Delete entire lib/offline/ directory
  - Verify no imports from lib/offline/ remain in codebase
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 15.1, 15.2, 15.3, 15.4_

- [ ] 15. Delete database/ directory files and old test directories
  - Delete database/migrations.ts
  - Delete database/schema-validator.ts
  - Delete database/device-id.ts
  - Delete database/__tests__/ directory
  - Delete contexts/__tests__/ directory
  - Verify no imports from deleted files remain in codebase
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 15.1, 15.2, 15.3, 15.4_

- [ ] 16. Verify codebase simplification
  - Count total files in lib/ directory (should be fewer than 50)
  - Verify all repository pattern abstractions are removed
  - Verify all sync engine files and logic are removed
  - Verify all offline-first handling code is removed
  - Verify direct Supabase queries exist in service functions
  - Verify clear separation between data layer (services) and UI layer (contexts/components)
  - _Requirements: 1.7, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [ ]* 16.1 Write property test for codebase simplification
    - **Property 13: Codebase Simplification**
    - **Validates: Requirements 1.7, 15.1**

### Phase 6: Testing and Validation

- [ ] 17. Write comprehensive unit tests for all services and contexts
  - Ensure all unit tests from previous phases are complete
  - Verify test coverage is at least 80% for all services and contexts
  - Run full unit test suite and verify all tests pass
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ] 18. Write comprehensive property-based tests for all correctness properties
  - Ensure all property tests from previous phases are complete
  - Verify Property 1: User Data Isolation (100 iterations)
  - Verify Property 2: Soft Delete Filtering (100 iterations)
  - Verify Property 3: Amount Sign Consistency (100 iterations)
  - Verify Property 4: Real-Time Subscription Updates (100 iterations)
  - Verify Property 5: Profit Calculation Accuracy (100 iterations)
  - Verify Property 6: Authentication Required (100 iterations)
  - Verify Property 7: Timestamp Preservation (100 iterations)
  - Verify Property 8: No Sync Logic in Auth Service (100 iterations)
  - Verify Property 9: No Sync Logic in TransactionsContext (100 iterations)
  - Verify Property 10: Immediate Persistence (100 iterations)
  - Verify Property 11: No Database Locks (100 iterations)
  - Verify Property 12: Performance Target (100 iterations)
  - Verify Property 13: Codebase Simplification (single verification)
  - Verify Property 14: Error Propagation (100 iterations)
  - Verify Property 15: Subscription Cleanup (100 iterations)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [ ] 19. Run full test suite and verify all tests pass
  - Run all unit tests (services and contexts)
  - Run all property-based tests (all 15 properties)
  - Verify code coverage is at least 80% for all services and contexts
  - Verify no test failures or warnings
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Performance testing and validation
  - Measure time to fetch categories (target: < 500ms)
  - Measure time to record transaction (target: < 500ms)
  - Measure time to fetch transactions (target: < 500ms)
  - Measure time to calculate profit (target: < 500ms)
  - Measure time for real-time updates to propagate (target: < 1 second)
  - Verify no database locking errors occur during logout
  - Verify no database locking errors occur during simultaneous operations
  - _Requirements: 9.1, 9.2, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 20.1 Write property test for performance target
    - **Property 12: Performance Target**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

  - [ ]* 20.2 Write property test for no database locks
    - **Property 11: No Database Locks**
    - **Validates: Requirements 9.1, 9.2**

  - [ ]* 20.3 Write property test for immediate persistence
    - **Property 10: Immediate Persistence**
    - **Validates: Requirements 14.1, 14.2, 14.3**

  - [ ]* 20.4 Write property test for error propagation
    - **Property 14: Error Propagation**
    - **Validates: Requirements 2.7, 3.10, 4.8, 13.1, 13.6**

  - [ ]* 20.5 Write property test for timestamp preservation
    - **Property 7: Timestamp Preservation**
    - **Validates: Requirements 12.5, 12.6**

- [ ] 21. Final checkpoint - Ensure all tests pass and feature is complete
  - Verify all unit tests pass
  - Verify all property-based tests pass
  - Verify code coverage is at least 80%
  - Verify all performance targets are met
  - Verify no database locking errors
  - Verify codebase has fewer than 50 files in lib/ directory
  - Verify all requirements are satisfied
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP, but are strongly recommended for production quality
- Each task references specific requirements for traceability
- Checkpoints (tasks 6, 10, 19, 21) ensure incremental validation
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- All tasks build incrementally on previous work with no orphaned code
- Service layer (Phase 2) must be complete before context layer (Phase 3)
- Context layer (Phase 3) must be complete before UI integration (Phase 4)
- UI integration (Phase 4) must be complete before cleanup (Phase 5)
- All implementation tasks must be complete before testing (Phase 6)
