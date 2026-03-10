# Design Document: Supabase-Only Architecture

## Overview

The Supabase-only architecture is a simplified, production-grade backend design that eliminates the complex offline-first sync system in favor of direct Supabase queries with real-time subscriptions. All data is stored exclusively in Supabase PostgreSQL with Row Level Security (RLS) policies enforcing user data isolation. The system provides fast performance, simplified codebase, real-time updates, and eliminates database locking issues that plagued the previous architecture.

### Design Goals

- **Simplicity**: Remove 100+ files of sync logic, repositories, and migrations
- **Performance**: Direct Supabase queries with no sync overhead (< 500ms operations)
- **Real-Time**: Supabase subscriptions push changes to all connected clients
- **Reliability**: RLS policies enforce data isolation, no database locks
- **Maintainability**: Clear separation between data layer (services) and UI layer (contexts)
- **Data Integrity**: Soft deletes preserve data, timestamps track all changes

### Key Design Decisions

1. **Supabase as Single Source of Truth**: All data lives exclusively in Supabase PostgreSQL. No local SQLite database means no sync conflicts, no database locks, and no reconciliation logic needed.

2. **Direct Query Pattern**: Service functions execute Supabase queries directly without caching, queuing, or sync metadata. This eliminates the repository pattern and sync engine complexity.

3. **RLS for Data Isolation**: PostgreSQL Row Level Security policies automatically restrict each user to their own data. No application-level authorization logic needed.

4. **Real-Time Subscriptions**: Supabase real-time feature pushes database changes to connected clients, eliminating the need for manual refresh or polling.

5. **Soft Deletes**: Records are marked as deleted (is_deleted = 1) rather than removed, preserving data and simplifying recovery.

6. **Simplified Authentication**: No sync triggers on login/logout. Authentication is purely Supabase Auth with AsyncStorage for session persistence.

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
│                    Context Layer                             │
│  TransactionsContext, CategoriesContext, DebtsContext       │
│  (State management + real-time subscriptions)               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  lib/categories.ts, lib/transactions.ts, lib/debts.ts       │
│  (Direct Supabase queries)                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Client                             │
│  (Authentication + Database + Real-Time)                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Cloud (PostgreSQL)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Categories   │  │ Transactions │  │ Debts        │     │
│  │ (RLS)        │  │ (RLS)        │  │ (RLS)        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Read Operation Flow:**
1. UI component calls context function (e.g., `useTransactionsContext().transactions`)
2. Context has already loaded data from Supabase on mount
3. Real-time subscription updates state when data changes
4. UI re-renders with latest data

**Write Operation Flow:**
1. UI component calls context function (e.g., `recordSale(amount, category)`)
2. Context calls service function (e.g., `recordSale()` from lib/transactions.ts)
3. Service function gets authenticated user ID from Supabase Auth
4. Service function executes INSERT query directly to Supabase
5. Supabase RLS policy validates user_id matches auth.uid()
6. Query succeeds or throws error
7. Context refreshes data from Supabase
8. Real-time subscription notifies all connected clients
9. UI re-renders with updated data

**Real-Time Subscription Flow:**
1. Context initializes and subscribes to table changes
2. Supabase real-time channel listens for INSERT/UPDATE/DELETE events
3. When data changes (by any client), Supabase pushes event to all subscribers
4. Context receives event and updates local state
5. UI re-renders automatically
6. On component unmount, subscription is unsubscribed

## Components and Interfaces

### Service Layer

#### lib/categories.ts

```typescript
interface Category {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

// Get all non-deleted categories for authenticated user
export async function getUserCategories(): Promise<Category[]>

// Add new category for authenticated user
export async function addCategory(name: string): Promise<Category>

// Soft delete category by setting is_deleted = 1
export async function deleteCategory(id: string): Promise<void>
```

#### lib/transactions.ts

```typescript
interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

// Record sale (positive amount)
export async function recordSale(
  amount: number,
  category: string | null,
  description: string | null,
  date?: string
): Promise<Transaction>

// Record expense (negative amount)
export async function recordExpense(
  amount: number,
  category: string | null,
  description: string | null,
  date?: string
): Promise<Transaction>

// Get all non-deleted transactions for authenticated user
export async function getUserTransactions(): Promise<Transaction[]>

// Update transaction
export async function updateTransaction(
  id: string,
  amount: number,
  category: string | null,
  description: string | null,
  date?: string
): Promise<void>

// Soft delete transaction
export async function deleteTransaction(id: string): Promise<void>

// Calculate total profit (sum of all amounts)
export async function getRealTimeProfit(): Promise<number>
```

#### lib/debts.ts

```typescript
interface Debt {
  id: string;
  user_id: string;
  customer_name: string;
  amount: number;
  due_date: string | null;
  note: string | null;
  is_settled: number;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

// Get all non-deleted debts for authenticated user
export async function getUserDebts(): Promise<Debt[]>

// Create new debt
export async function addDebt(
  customer_name: string,
  amount: number,
  due_date?: string,
  note?: string
): Promise<Debt>

// Update debt
export async function updateDebt(
  id: string,
  customer_name: string,
  amount: number,
  due_date?: string,
  note?: string
): Promise<void>

// Mark debt as settled
export async function settleDebt(id: string): Promise<void>

// Soft delete debt
export async function deleteDebt(id: string): Promise<void>
```

#### lib/auth.ts

```typescript
// Sign in with email and password
export async function signIn(email: string, password: string): Promise<any>

// Register new user with profile data
export async function registerWithProfile(
  email: string,
  password: string,
  fullName: string,
  phoneNumber: string,
  businessType: string
): Promise<any>

// Sign out and clear session
export async function signOut(): Promise<void>

// Request password reset email
export async function forgotPassword(email: string): Promise<any>

// Update user password
export async function updatePassword(newPassword: string): Promise<any>
```

### Context Layer

#### TransactionsContext

```typescript
interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  refresh: () => Promise<void>;
  recordSale: (amount: number, category: string | null, description: string | null, date?: string) => Promise<any>;
  recordExpense: (amount: number, category: string | null, description: string | null, date?: string) => Promise<any>;
  updateTransaction: (id: string, amount: number, category: string | null, description: string | null, date?: string) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
}

// Provider component that wraps app
export function TransactionsProvider({ children }: { children: React.ReactNode }): JSX.Element

// Hook to use transactions context
export function useTransactionsContext(): TransactionsContextType
```

**Responsibilities:**
- Load transactions on mount
- Subscribe to real-time changes
- Provide functions to record sales/expenses
- Provide functions to update/delete transactions
- Refresh data after mutations
- Unsubscribe on unmount

#### CategoriesContext

```typescript
interface CategoriesContextType {
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
  addCategory: (name: string) => Promise<Category>;
  removeCategory: (id: string) => Promise<void>;
}

export function CategoriesProvider({ children }: { children: React.ReactNode }): JSX.Element
export function useCategoriesContext(): CategoriesContextType
```

#### DebtsContext

```typescript
interface DebtsContextType {
  debts: Debt[];
  loading: boolean;
  refresh: () => Promise<void>;
  addDebt: (customer_name: string, amount: number, due_date?: string, note?: string) => Promise<Debt>;
  updateDebt: (id: string, customer_name: string, amount: number, due_date?: string, note?: string) => Promise<void>;
  settleDebt: (id: string) => Promise<void>;
  removeDebt: (id: string) => Promise<void>;
}

export function DebtsProvider({ children }: { children: React.ReactNode }): JSX.Element
export function useDebtsContext(): DebtsContextType
```

## Data Models

### Database Schema

#### Categories Table

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted INTEGER DEFAULT 0,
  
  CONSTRAINT categories_user_id_name_unique UNIQUE(user_id, normalized_name) WHERE is_deleted = 0
);

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_is_deleted ON categories(is_deleted);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `user_id`: Foreign key to auth.users, enables RLS filtering
- `name`: Display name of category
- `normalized_name`: Lowercase name for uniqueness checking
- `created_at`: Timestamp when created
- `updated_at`: Timestamp when last modified
- `is_deleted`: Soft delete flag (0 = active, 1 = deleted)

#### Transactions Table

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT,
  description TEXT,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted INTEGER DEFAULT 0,
  
  CONSTRAINT transactions_amount_not_zero CHECK (amount != 0)
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_is_deleted ON transactions(is_deleted);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `user_id`: Foreign key to auth.users, enables RLS filtering
- `amount`: Transaction amount (positive for sales, negative for expenses)
- `category`: Category name (nullable)
- `description`: Transaction description (nullable)
- `transaction_date`: Date of transaction
- `created_at`: Timestamp when created
- `updated_at`: Timestamp when last modified
- `is_deleted`: Soft delete flag (0 = active, 1 = deleted)

#### Debts Table

```sql
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  due_date DATE,
  note TEXT,
  is_settled INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted INTEGER DEFAULT 0,
  
  CONSTRAINT debts_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_debts_user_id ON debts(user_id);
CREATE INDEX idx_debts_is_settled ON debts(is_settled);
CREATE INDEX idx_debts_is_deleted ON debts(is_deleted);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `user_id`: Foreign key to auth.users, enables RLS filtering
- `customer_name`: Name of customer/debtor
- `amount`: Debt amount (always positive)
- `due_date`: When debt is due (nullable)
- `note`: Additional notes (nullable)
- `is_settled`: Settlement flag (0 = unsettled, 1 = settled)
- `created_at`: Timestamp when created
- `updated_at`: Timestamp when last modified
- `is_deleted`: Soft delete flag (0 = active, 1 = deleted)

## Row Level Security (RLS) Policies

### Categories RLS

```sql
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Users can view their own categories
CREATE POLICY "Users can view their own categories" ON categories
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own categories
CREATE POLICY "Users can insert their own categories" ON categories
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own categories
CREATE POLICY "Users can update their own categories" ON categories
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own categories
CREATE POLICY "Users can delete their own categories" ON categories
FOR DELETE USING (auth.uid() = user_id);
```

### Transactions RLS

```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view their own transactions" ON transactions
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own transactions
CREATE POLICY "Users can insert their own transactions" ON transactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own transactions
CREATE POLICY "Users can update their own transactions" ON transactions
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own transactions
CREATE POLICY "Users can delete their own transactions" ON transactions
FOR DELETE USING (auth.uid() = user_id);
```

### Debts RLS

```sql
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- Users can view their own debts
CREATE POLICY "Users can view their own debts" ON debts
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own debts
CREATE POLICY "Users can insert their own debts" ON debts
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own debts
CREATE POLICY "Users can update their own debts" ON debts
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own debts
CREATE POLICY "Users can delete their own debts" ON debts
FOR DELETE USING (auth.uid() = user_id);
```

## Real-Time Subscriptions

### Subscription Architecture

Each context subscribes to real-time changes on its respective table:

```typescript
// In TransactionsContext
useEffect(() => {
  const channel = supabase
    .channel('transactions-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${user.id}`
      },
      (payload) => {
        // Handle INSERT/UPDATE/DELETE
        // Update local state
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user.id]);
```

### Subscription Events

**INSERT Event**: New transaction created
- Action: Add to transactions array
- State: `setTransactions([...transactions, newTransaction])`

**UPDATE Event**: Transaction modified
- Action: Replace in transactions array
- State: `setTransactions(transactions.map(t => t.id === updated.id ? updated : t))`

**DELETE Event**: Transaction soft-deleted (is_deleted = 1)
- Action: Remove from transactions array
- State: `setTransactions(transactions.filter(t => t.id !== deleted.id))`

### Subscription Lifecycle

1. **Mount**: Subscribe to table changes
2. **Active**: Receive and process events
3. **Unmount**: Unsubscribe to prevent memory leaks

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: User Data Isolation

*For any* authenticated user and any other user, when querying categories, transactions, or debts, the result should only contain records where user_id matches the authenticated user's ID.

**Validates: Requirements 2.2, 3.4, 4.2, 7.4, 7.5**

### Property 2: Soft Delete Filtering

*For any* record (category, transaction, or debt), when is_deleted is set to 1, subsequent queries should not return that record in the results.

**Validates: Requirements 2.5, 3.7, 4.6, 12.1, 12.2, 12.3, 12.4**

### Property 3: Amount Sign Consistency

*For any* sale recorded, the amount should be positive. *For any* expense recorded, the amount should be negative.

**Validates: Requirements 3.1, 3.2**

### Property 4: Real-Time Subscription Updates

*For any* transaction, category, or debt inserted/updated/deleted by one client, all other connected clients should receive the change and update their local state within 1 second.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

### Property 5: Profit Calculation Accuracy

*For any* set of transactions, the calculated profit should equal the sum of all amounts where user_id matches the authenticated user AND is_deleted = 0.

**Validates: Requirements 3.8, 14.1**

### Property 6: Authentication Required

*For any* service function (getUserCategories, recordSale, getUserTransactions, getUserDebts, etc.) called without authentication, the function should throw an error with message "Not authenticated".

**Validates: Requirements 2.6, 3.9, 4.7**

### Property 7: Timestamp Preservation

*For any* record, created_at should remain unchanged after updates, and updated_at should be newer than or equal to created_at.

**Validates: Requirements 12.5, 12.6**

### Property 8: No Sync Logic in Auth Service

*For any* authentication operation (signIn, registerWithProfile, signOut), no sync functions should be called and no sync-related imports should exist in lib/auth.ts.

**Validates: Requirements 5.6, 5.7**

### Property 9: No Sync Logic in TransactionsContext

*For any* TransactionsContext operation, the context should not contain sync logic, offline handling, or debounced operations.

**Validates: Requirements 8.7**

### Property 10: Immediate Persistence

*For any* transaction, category, or debt created/updated, the record should be immediately persisted to Supabase without queuing or sync delays.

**Validates: Requirements 14.1, 14.2, 14.3**

### Property 11: No Database Locks

*For any* logout operation or simultaneous operations, the system should not encounter database table locked errors.

**Validates: Requirements 9.1, 9.2**

### Property 12: Performance Target

*For any* operation (fetching categories, recording transactions, fetching transactions, calculating profit), the operation should complete within 500ms.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 13: Codebase Simplification

*For any* lib/ directory, the total number of files should be fewer than 50 (down from 100+).

**Validates: Requirements 1.7, 15.1**

### Property 14: Error Propagation

*For any* Supabase query failure, the error should be thrown with original error details (not silently ignored or returning undefined).

**Validates: Requirements 2.7, 3.10, 4.8, 13.1, 13.6**

### Property 15: Subscription Cleanup

*For any* context component that subscribes to real-time changes, the subscription should be unsubscribed on component unmount to prevent memory leaks.

**Validates: Requirements 6.7**

## Error Handling

### Error Categories

#### Authentication Errors

```typescript
// User not authenticated
throw new Error('Not authenticated');

// Invalid credentials
throw new Error('Invalid email or password');

// Email not verified
throw new Error('Email not verified');
```

#### Network Errors

```typescript
// Network unavailable
throw new Error('Network error: unable to connect to Supabase');

// Request timeout
throw new Error('Request timeout');

// Connection lost
throw new Error('Connection lost');
```

#### Validation Errors

```typescript
// Empty category name
throw new Error('Category name cannot be empty');

// Invalid amount
throw new Error('Amount must be greater than 0');

// Missing required field
throw new Error('Customer name is required');
```

### Error Handling Strategy

1. **Service Layer**: Throw errors with descriptive messages
2. **Context Layer**: Catch errors and log to console
3. **UI Layer**: Display error messages to user
4. **Fallback**: Provide manual refresh option

```typescript
try {
  const result = await recordSale(amount, category, description);
  await loadTransactions();
} catch (error) {
  console.error('Error recording sale:', error);
  // Show error toast to user
  // Provide retry option
}
```

## Testing Strategy

### Unit Testing

Unit tests verify specific examples, edge cases, and error conditions:

**Categories Service Tests:**
- Adding a category with valid name succeeds and returns category with correct fields
- Adding a category with empty name fails with validation error
- Adding a category with whitespace-only name fails with validation error
- Deleting a category soft-deletes it (is_deleted = 1)
- Getting categories filters out soft-deleted records
- Getting categories returns results ordered by name ascending
- Unauthenticated user throws "Not authenticated" error
- Supabase query failure throws error with original details

**Transactions Service Tests:**
- Recording a sale creates transaction with positive amount
- Recording an expense creates transaction with negative amount
- Getting transactions filters out soft-deleted records
- Getting transactions returns results ordered by transaction_date descending
- Updating transaction updates all fields (amount, category, description, date)
- Deleting transaction soft-deletes it (is_deleted = 1)
- Calculating profit sums all amounts correctly
- Unauthenticated user throws "Not authenticated" error
- Supabase query failure throws error with original details

**Debts Service Tests:**
- Creating debt with valid data succeeds and returns debt with correct fields
- Creating debt with negative amount fails with validation error
- Updating debt updates all fields
- Settling debt sets is_settled = 1
- Deleting debt soft-deletes it (is_deleted = 1)
- Getting debts filters out soft-deleted records
- Unauthenticated user throws "Not authenticated" error
- Supabase query failure throws error with original details

**Auth Service Tests:**
- Sign in with valid credentials succeeds and returns session
- Sign in with invalid credentials fails with error
- Register creates new user with profile data
- Sign out clears Supabase session and AsyncStorage
- Password reset sends email via Supabase
- Update password changes password in Supabase
- No sync functions are called during authentication

**Context Tests:**
- TransactionsContext loads transactions on mount
- TransactionsContext subscribes to real-time changes on mount
- recordSale calls service and refreshes data
- recordExpense calls service and refreshes data
- updateTransaction calls service and refreshes data
- removeTransaction calls service and refreshes data
- Unsubscribe on unmount prevents memory leaks
- CategoriesContext loads categories on mount
- DebtsContext loads debts on mount

### Property-Based Testing

Property-based tests verify universal properties across all inputs using fast-check:

**Property 1: User Data Isolation**
*For any* authenticated user and any other user, when querying transactions, the result should only contain transactions where user_id matches the authenticated user.
**Validates: Requirements 2.2, 3.4, 4.2, 7.4, 7.5**
**Test Configuration**: 100 iterations, random user IDs and transaction data

**Property 2: Soft Delete Filtering**
*For any* transaction, when is_deleted is set to 1, subsequent queries should not return that transaction.
**Validates: Requirements 2.5, 3.7, 4.6, 12.1, 12.2, 12.3, 12.4**
**Test Configuration**: 100 iterations, random transactions with is_deleted flag

**Property 3: Amount Sign Consistency**
*For any* sale, the recorded amount should be positive. *For any* expense, the recorded amount should be negative.
**Validates: Requirements 3.1, 3.2**
**Test Configuration**: 100 iterations, random positive and negative amounts

**Property 4: Real-Time Subscription Updates**
*For any* transaction inserted by one client, all other connected clients should receive the change within 1 second.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**
**Test Configuration**: 100 iterations, random transactions with timing verification

**Property 5: Profit Calculation Accuracy**
*For any* set of transactions, the calculated profit should equal the sum of all amounts where is_deleted = 0.
**Validates: Requirements 3.8, 14.1**
**Test Configuration**: 100 iterations, random transaction sets with various amounts

**Property 6: Authentication Required**
*For any* service function called without authentication, the function should throw an error with message "Not authenticated".
**Validates: Requirements 2.6, 3.9, 4.7**
**Test Configuration**: 100 iterations, all service functions without auth

**Property 7: Timestamp Preservation**
*For any* record, created_at should remain unchanged after updates, and updated_at should be newer than created_at.
**Validates: Requirements 12.5, 12.6**
**Test Configuration**: 100 iterations, random records with updates

**Property 8: No Sync Logic in Auth Service**
*For any* authentication operation, no sync functions should be called.
**Validates: Requirements 5.6, 5.7**
**Test Configuration**: 100 iterations, all auth operations with sync function verification

**Property 9: No Sync Logic in TransactionsContext**
*For any* TransactionsContext operation, the context should not contain sync logic.
**Validates: Requirements 8.7**
**Test Configuration**: 100 iterations, all context operations with code inspection

**Property 10: Immediate Persistence**
*For any* transaction created, the record should be immediately persisted to Supabase.
**Validates: Requirements 14.1, 14.2, 14.3**
**Test Configuration**: 100 iterations, random transactions with persistence verification

**Property 11: No Database Locks**
*For any* logout operation or simultaneous operations, no database lock errors should occur.
**Validates: Requirements 9.1, 9.2**
**Test Configuration**: 100 iterations, concurrent operations with error monitoring

**Property 12: Performance Target**
*For any* operation, the operation should complete within 500ms.
**Validates: Requirements 10.1, 10.2, 10.3, 10.4**
**Test Configuration**: 100 iterations, all operations with timing verification

**Property 13: Codebase Simplification**
*For any* lib/ directory, the total number of files should be fewer than 50.
**Validates: Requirements 1.7, 15.1**
**Test Configuration**: Single verification, file count check

**Property 14: Error Propagation**
*For any* Supabase query failure, the error should be thrown with original details.
**Validates: Requirements 2.7, 3.10, 4.8, 13.1, 13.6**
**Test Configuration**: 100 iterations, random query failures with error verification

**Property 15: Subscription Cleanup**
*For any* context component, subscriptions should be unsubscribed on unmount.
**Validates: Requirements 6.7**
**Test Configuration**: 100 iterations, component mount/unmount with subscription verification

### Testing Configuration

- **Unit Tests**: Jest with React Testing Library
- **Property Tests**: fast-check for JavaScript
- **Minimum Iterations**: 100 per property test
- **Tag Format**: `Feature: supabase-only-architecture, Property {number}: {property_text}`
- **Coverage Target**: 80% code coverage for services and contexts

### Dual Testing Approach

Unit tests and property tests are complementary:
- **Unit tests** verify specific examples, edge cases, and error conditions
- **Property tests** verify universal properties across all inputs
- Together they provide comprehensive coverage

## Error Handling

### Error Scenarios

#### Authentication Errors

**Scenario**: User not authenticated
- **Trigger**: Service function called without valid session
- **Response**: Throw error "Not authenticated"
- **Recovery**: Redirect to login screen

**Scenario**: Email not verified
- **Trigger**: User tries to access app before verifying email
- **Response**: Throw error "Email not verified"
- **Recovery**: Show verification prompt

#### Network Errors

**Scenario**: Network unavailable
- **Trigger**: Supabase query fails due to no internet
- **Response**: Throw error with network details
- **Recovery**: Show offline message, provide retry button

**Scenario**: Request timeout
- **Trigger**: Supabase query takes > 30 seconds
- **Response**: Throw error "Request timeout"
- **Recovery**: Provide retry option

#### Validation Errors

**Scenario**: Empty category name
- **Trigger**: User tries to add category with empty name
- **Response**: Throw error "Category name cannot be empty"
- **Recovery**: Show validation message in UI

**Scenario**: Invalid amount
- **Trigger**: User tries to record transaction with 0 amount
- **Response**: Throw error "Amount must be greater than 0"
- **Recovery**: Show validation message in UI

### Error Logging

All errors are logged to console with context:

```typescript
console.error('Error recording sale:', {
  error: error.message,
  code: error.code,
  details: error.details,
  timestamp: new Date().toISOString()
});
```

## Performance Considerations

### Query Optimization

1. **Indexes**: Created on user_id, transaction_date, is_deleted for fast filtering
2. **Filtering**: WHERE clauses applied at database level, not in application
3. **Ordering**: ORDER BY applied at database level for efficient sorting
4. **Pagination**: Not needed for typical user data volumes (< 10,000 records)

### Real-Time Performance

1. **Subscription Filtering**: Filter by user_id at subscription level to reduce events
2. **Batch Updates**: Multiple changes batched into single state update
3. **Debouncing**: Avoid excessive re-renders from rapid updates

### Caching Strategy

1. **No Application Cache**: Supabase real-time subscriptions eliminate need for cache
2. **Browser Cache**: Supabase client handles HTTP caching
3. **Session Cache**: AsyncStorage stores auth session for offline access

### Performance Targets

- **Category Fetch**: < 500ms
- **Transaction Record**: < 500ms
- **Transaction Fetch**: < 500ms
- **Profit Calculation**: < 500ms
- **Real-Time Update**: < 1 second

## Files to Delete

The following files from the offline-first architecture should be deleted:

```
lib/offline/                          (entire folder - 50+ files)
├── sync/
│   ├── SyncEngine.ts
│   ├── SyncQueue.ts
│   ├── SyncLock.ts
│   ├── SyncLogger.ts
│   ├── ConflictResolver.ts
│   ├── RetryStrategy.ts
│   ├── NetworkMonitor.ts
│   ├── __tests__/                    (entire folder)
│   └── README.md
├── repositories/
│   ├── BaseRepository.ts
│   ├── CategoryRepository.ts
│   ├── TransactionRepository.ts
│   ├── DebtRepository.ts
│   └── __tests__/                    (entire folder)
└── README.md

database/
├── migrations.ts
├── schema-validator.ts
├── device-id.ts
└── __tests__/                        (entire folder)

contexts/
└── __tests__/                        (entire folder)
```

## Files to Simplify

The following files should be simplified to remove sync logic:

```
lib/categories.ts                     (remove repository pattern)
lib/transactions.ts                   (remove repository pattern)
lib/debts.ts                          (remove repository pattern)
lib/auth.ts                           (remove sync triggers)
contexts/TransactionsContext.tsx      (remove sync logic)
```

## Migration Path

### Phase 1: Create New Services
1. Create simplified lib/categories.ts with direct Supabase queries
2. Create simplified lib/transactions.ts with direct Supabase queries
3. Create simplified lib/debts.ts with direct Supabase queries
4. Create simplified lib/auth.ts without sync triggers

### Phase 2: Create New Contexts
1. Create TransactionsContext with real-time subscriptions
2. Create CategoriesContext with real-time subscriptions
3. Create DebtsContext with real-time subscriptions

### Phase 3: Update UI Components
1. Update components to use new contexts
2. Test all screens with new architecture
3. Verify real-time updates work correctly

### Phase 4: Delete Old Files
1. Delete lib/offline/ directory
2. Delete database/ directory (except schema reference)
3. Delete contexts/__tests__/ directory
4. Delete old service implementations

## Conclusion

The Supabase-only architecture provides a simpler, faster, and more maintainable solution for MobiBooks. By eliminating the complex offline-first sync system and leveraging Supabase's built-in features (RLS, real-time subscriptions, authentication), the codebase is reduced from 100+ files to approximately 20 files. The system provides better performance, real-time updates, and eliminates database locking issues that plagued the previous architecture.
