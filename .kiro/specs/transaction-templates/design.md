# Transaction Templates - Technical Design Document

## Overview

Transaction Templates is a feature that enables MobiBooks users to record frequently used transactions quickly by saving preset configurations. This design document outlines the technical implementation strategy, data models, API interfaces, UI components, and integration points with the existing MobiBooks architecture.

The feature is built on the principle of transparency—templates are a convenience layer that doesn't affect the underlying transaction system, reporting logic, or data model. A transaction recorded from a template is indistinguishable from a manually recorded transaction.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MobiBooks App                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              UI Layer (React Native)                 │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ Home Screen (Quick Templates Section)           │ │  │
│  │  │ Create Template Screen                          │ │  │
│  │  │ Edit Template Screen                            │ │  │
│  │  │ Template Cards & Context Menu                   │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ▲                                  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         State Management Layer                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ TemplatesContext (Redux-like state)             │ │  │
│  │  │ useTemplates Hook (Custom hook)                 │ │  │
│  │  │ Memoization & Performance Optimization          │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ▲                                  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Business Logic Layer                         │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ Template Library Functions                      │ │  │
│  │  │ - createTemplate()                              │ │  │
│  │  │ - updateTemplate()                              │ │  │
│  │  │ - deleteTemplate()                              │ │  │
│  │  │ - getTemplates()                                │ │  │
│  │  │ - useTemplateForTransaction()                   │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ▲                                  │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Data Access Layer                           │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ Supabase Client                                 │ │  │
│  │  │ - transaction_templates table                   │ │  │
│  │  │ - Indexes: (user_id), (user_id, is_deleted)    │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Integration with Existing Systems

Templates integrate seamlessly with:
- **TransactionsContext**: Templates use the same `recordSale()` and `recordExpense()` functions
- **Transaction Recording Flow**: Templates pre-fill the transaction form but don't change the recording logic
- **Reporting System**: Template transactions are treated identically to manual transactions
- **Categories System**: Templates reference existing categories from the categories table

## Components and Interfaces

### Data Models

#### Template Interface

```typescript
interface Template {
  id: string;                    // UUID primary key
  user_id: string;               // User who owns the template
  name: string;                  // Template name (1-100 chars)
  type: 'sale' | 'expense';      // Transaction type
  default_amount: number;        // Pre-filled amount (positive)
  category: string | null;       // Optional category reference
  description: string | null;    // Optional description (max 500 chars)
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
  is_deleted: number;            // Soft delete flag (0 or 1)
}
```

#### TemplateInput Interface (for creation/updates)

```typescript
interface TemplateInput {
  name: string;
  type: 'sale' | 'expense';
  default_amount: number;
  category?: string | null;
  description?: string | null;
}
```

#### TemplateResponse Interface (API responses)

```typescript
interface TemplateResponse {
  success: boolean;
  data?: Template;
  error?: string;
  message?: string;
}
```

#### TemplateListResponse Interface

```typescript
interface TemplateListResponse {
  success: boolean;
  data: Template[];
  total: number;
  hasMore: boolean;
}
```

### API/Library Functions

All template functions are located in `lib/templates.ts`:

```typescript
// Create a new template
export async function createTemplate(input: TemplateInput): Promise<Template>

// Get all active templates for current user
export async function getTemplates(limit?: number, offset?: number): Promise<Template[]>

// Get a single template by ID
export async function getTemplateById(id: string): Promise<Template>

// Update an existing template
export async function updateTemplate(id: string, input: TemplateInput): Promise<Template>

// Soft delete a template
export async function deleteTemplate(id: string): Promise<void>

// Use a template to pre-fill transaction form
export async function useTemplateForTransaction(templateId: string): Promise<Template>

// Validate template input
export function validateTemplateInput(input: TemplateInput): { valid: boolean; errors: string[] }

// Serialize template to JSON
export function serializeTemplate(template: Template): string

// Parse template from JSON
export function parseTemplate(json: string): Template

// Pretty print template
export function prettyPrintTemplate(template: Template): string
```

### React Hooks

#### useTemplates Hook

```typescript
interface UseTemplatesReturn {
  templates: Template[];
  loading: boolean;
  error: string | null;
  
  // Operations
  createTemplate: (input: TemplateInput) => Promise<Template>;
  updateTemplate: (id: string, input: TemplateInput) => Promise<Template>;
  deleteTemplate: (id: string) => Promise<void>;
  useTemplate: (id: string) => Promise<Template>;
  
  // Utilities
  refresh: () => Promise<void>;
  getRecentTemplates: (count?: number) => Template[];
}

export function useTemplates(): UseTemplatesReturn
```

## Database Schema

### transaction_templates Table

```sql
CREATE TABLE IF NOT EXISTS transaction_templates (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'expense')),
  default_amount REAL NOT NULL CHECK (default_amount > 0),
  category TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_user_id 
  ON transaction_templates(user_id);

CREATE INDEX IF NOT EXISTS idx_templates_user_active 
  ON transaction_templates(user_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_templates_created_at 
  ON transaction_templates(created_at DESC);
```

### Schema Rationale

- **UUID Primary Key**: Ensures global uniqueness and enables client-side generation
- **user_id Index**: Fast filtering of user-specific templates
- **Composite Index (user_id, is_deleted)**: Optimizes the most common query pattern
- **Soft Delete Flag**: Preserves data integrity while allowing logical deletion
- **Timestamps**: Enable sorting and audit trails
- **CHECK Constraints**: Enforce data validity at the database level

## Context/State Management

### TemplatesContext

The TemplatesContext manages template state and operations:

```typescript
interface TemplatesContextType {
  templates: Template[];
  loading: boolean;
  error: string | null;
  
  createTemplate: (input: TemplateInput) => Promise<Template>;
  updateTemplate: (id: string, input: TemplateInput) => Promise<Template>;
  deleteTemplate: (id: string) => Promise<void>;
  useTemplate: (id: string) => Promise<Template>;
  refresh: () => Promise<void>;
}

export function TemplatesProvider({ children }: { children: React.ReactNode })
export function useTemplatesContext(): TemplatesContextType
```

### Integration with TransactionsContext

When a template is used:
1. Template data is retrieved from TemplatesContext
2. Transaction form is opened with pre-filled values
3. User edits values if needed
4. `recordSale()` or `recordExpense()` is called (same as manual recording)
5. TransactionsContext updates with the new transaction
6. No template reference is stored in the transaction

## UI Components

### TemplateCard Component

Displays a single template in the Quick Templates section:

```typescript
interface TemplateCardProps {
  template: Template;
  onPress: (template: Template) => void;
  onLongPress: (template: Template) => void;
}

export function TemplateCard({ template, onPress, onLongPress }: TemplateCardProps)
```

**Features:**
- Displays template name, type (with icon/color), and default amount
- Touch-friendly (minimum 44px height)
- Long-press support for edit/delete menu
- Visual indicator for transaction type (green for sales, red for expenses)

### QuickTemplatesSection Component

Displays up to 6 most recent templates on home screen:

```typescript
interface QuickTemplatesSectionProps {
  templates: Template[];
  onTemplatePress: (template: Template) => void;
  loading?: boolean;
}

export function QuickTemplatesSection({ templates, onTemplatePress, loading }: QuickTemplatesSectionProps)
```

**Features:**
- Horizontal scrolling for more than 6 templates
- Empty state message when no templates exist
- Lazy loading for additional templates on scroll
- Memoized to prevent unnecessary re-renders

### CreateTemplateScreen Component

Screen for creating new templates:

```typescript
export default function CreateTemplateScreen()
```

**Features:**
- Input fields: Name, Type (dropdown), Amount, Category (dropdown), Description
- Form validation with error messages
- Success message on save
- Navigation back to home screen after save

### EditTemplateScreen Component

Screen for editing existing templates:

```typescript
export default function EditTemplateScreen()
```

**Features:**
- Pre-populated form fields
- Same validation as creation
- Success message on update
- Navigation back to home screen after update

### TemplateContextMenu Component

Context menu for template actions (edit/delete):

```typescript
interface TemplateContextMenuProps {
  template: Template;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  visible: boolean;
  onDismiss: () => void;
}

export function TemplateContextMenu({ template, onEdit, onDelete, visible, onDismiss }: TemplateContextMenuProps)
```

## Navigation

### Navigation Flow

```
Home Screen
├── Quick Templates Section
│   ├── Tap Template → Record Expense/Sale Modal (pre-filled)
│   └── Long-press Template → Context Menu
│       ├── Edit → Edit Template Screen
│       └── Delete → Confirmation Dialog
├── Create Template Button → Create Template Screen
└── Settings/Menu → Template Management Screen (future)
```

### Route Structure

```typescript
// In app/(tabs)/_layout.tsx
export const templateRoutes = {
  createTemplate: '/modals/create-template',
  editTemplate: '/modals/edit-template/:id',
  templateManagement: '/modals/template-management',
};

// Usage
router.push(templateRoutes.createTemplate);
router.push(`/modals/edit-template/${templateId}`);
```

## Performance Optimizations

### Memoization Strategy

1. **Template List Memoization**
   ```typescript
   const memoizedTemplates = useMemo(() => 
     templates.filter(t => !t.is_deleted).slice(0, 6),
     [templates]
   );
   ```

2. **Component Memoization**
   ```typescript
   export const TemplateCard = React.memo(({ template, onPress }: TemplateCardProps) => {
     // Component implementation
   });
   ```

3. **Callback Memoization**
   ```typescript
   const handleTemplatePress = useCallback((template: Template) => {
     // Handle template press
   }, []);
   ```

### Query Optimization

- Use indexed queries: `WHERE user_id = ? AND is_deleted = 0`
- Load first 6 templates by default
- Implement lazy loading for additional templates
- Cache templates in memory to avoid repeated fetches

### Lazy Loading Strategy

```typescript
const [displayedCount, setDisplayedCount] = useState(6);

const handleScroll = useCallback((event) => {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
  if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 100) {
    setDisplayedCount(prev => Math.min(prev + 6, templates.length));
  }
}, [templates.length]);
```

### Performance Targets

- Template load time: < 100ms
- Form display time: < 500ms
- Transaction save time: < 1 second
- Total template-to-saved-transaction time: < 3 seconds

## Integration Points

### With Transaction Recording Flow

1. User taps template from Quick Templates section
2. Template data is passed to transaction form modal
3. Form opens with pre-filled values:
   - Amount: `template.default_amount`
   - Category: `template.category`
   - Description: `template.description`
   - Type: `template.type` (determines sale vs expense)
4. User can edit any field
5. On save, `recordSale()` or `recordExpense()` is called with edited values
6. Transaction is recorded exactly like a manual transaction

### With Categories System

- Template creation screen shows dropdown of existing categories
- New categories cannot be created from template screen
- Categories are fetched from the `categories` table
- Template stores category reference (not category ID, just name for simplicity)

### With Reporting System

- Template transactions are stored identically to manual transactions
- No template marker or reference in transaction record
- Reports treat all transactions equally
- Profit calculation includes template transactions without distinction

## Error Handling

### Validation Errors

```typescript
interface ValidationError {
  field: string;
  message: string;
}

// Template name validation
- Empty: "Template name is required"
- Too long (>100 chars): "Template name must be 100 characters or less"

// Transaction type validation
- Invalid: "Transaction type must be 'sale' or 'expense'"

// Amount validation
- Empty: "Amount is required"
- Non-numeric: "Amount must be a number"
- Non-positive: "Amount must be greater than 0"

// Description validation
- Too long (>500 chars): "Description must be 500 characters or less"
```

### Database Errors

```typescript
// Handle Supabase errors
- Network error: "Unable to connect. Please check your internet connection."
- Auth error: "You must be logged in to manage templates"
- Database error: "An error occurred. Please try again."
- Conflict error: "This template was modified. Please refresh and try again."
```

### Recovery Strategies

1. **Optimistic Updates**: Update UI immediately, revert on error
2. **Retry Logic**: Implement exponential backoff for failed requests
3. **Error Boundaries**: Catch and display errors gracefully
4. **Fallback UI**: Show cached data if fresh fetch fails

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Template Data Integrity

For any template created with valid input, all fields should be stored exactly as provided and retrievable without modification.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

### Property 2: Soft Delete Isolation

For any soft-deleted template, it should not appear in any query results for active templates, but the template record should still exist in the database.

**Validates: Requirements 2.5, 7.2, 7.3, 7.4, 13.4**

### Property 3: Template Serialization Round-Trip

For any valid template object, serializing to JSON and then parsing back should produce an equivalent object.

**Validates: Requirements 16.1, 16.2, 16.3, 16.7**

### Property 4: Transaction Type Consistency

For any template with type "sale", transactions recorded from it should have positive amounts. For type "expense", transactions should have negative amounts.

**Validates: Requirements 10.1, 10.2, 10.3, 10.5**

### Property 5: Template Transparency

For any transaction recorded from a template, the transaction record should be indistinguishable from a manually recorded transaction (no template marker or reference).

**Validates: Requirements 4.6, 12.1, 12.2, 12.3, 12.4, 12.7**

### Property 6: Form Pre-filling Accuracy

For any template used to open the transaction form, all pre-filled fields should match the template values exactly.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 5.6**

### Property 7: Template Ordering

For any set of templates, the most recently created 6 should be displayed first in the Quick Templates section.

**Validates: Requirements 5.2, 5.8, 13.3**

### Property 8: Input Validation Consistency

For any template input, the same validation rules should apply during creation and update operations.

**Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6**

### Property 9: Category Dropdown Accuracy

For any template creation screen, the category dropdown should contain exactly the categories from the categories table, no more and no less.

**Validates: Requirements 9.3, 9.4**

### Property 10: Performance Responsiveness

For any template operation (create, read, update, delete), the operation should complete within the specified time threshold without blocking the UI.

**Validates: Requirements 8.1, 11.1, 11.2, 11.3, 11.4, 11.5**

## Testing Strategy

### Unit Testing

Unit tests verify specific examples, edge cases, and error conditions:

- Template creation with valid/invalid inputs
- Template update with boundary values
- Template deletion and soft delete verification
- Validation error messages
- Serialization/deserialization edge cases
- Category dropdown population
- Form pre-filling accuracy

### Property-Based Testing

Property-based tests verify universal properties across all inputs:

- **Template Data Integrity**: Generate random templates, verify all fields are stored and retrieved correctly
- **Soft Delete Isolation**: Generate templates, soft delete random ones, verify they don't appear in queries
- **Serialization Round-Trip**: Generate random templates, serialize/deserialize, verify equivalence
- **Transaction Type Consistency**: Generate templates with both types, verify amount signs match
- **Template Transparency**: Generate transactions from templates, verify no template marker exists
- **Form Pre-filling**: Generate templates, verify form fields match template values
- **Template Ordering**: Generate multiple templates, verify ordering by creation date
- **Input Validation**: Generate invalid inputs, verify validation catches all cases
- **Category Dropdown**: Generate category sets, verify dropdown matches exactly
- **Performance**: Measure operation times, verify they meet thresholds

### Test Configuration

- Minimum 100 iterations per property test
- Tag format: `Feature: transaction-templates, Property {number}: {property_text}`
- Use fast-check or similar library for property generation
- Mock Supabase for unit tests, use real database for integration tests

## Future Enhancements

1. **Template Categories**: Group templates by custom categories
2. **Template Sharing**: Share templates with other users
3. **Template Analytics**: Track which templates are used most frequently
4. **Smart Suggestions**: Recommend templates based on transaction history
5. **Template Versioning**: Track template changes over time
6. **Bulk Operations**: Create/delete multiple templates at once
7. **Template Import/Export**: Export templates as JSON for backup/sharing
8. **Conditional Templates**: Templates that adjust amounts based on date or other factors
