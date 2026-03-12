# Transaction Templates Requirements Document

## Introduction

Transaction Templates is a feature that enables MobiBooks users to record frequently used transactions quickly by saving preset configurations. When users tap a template, the transaction form opens with pre-filled values (amount, category, description), allowing them to edit the amount if needed and save the transaction in under 3 seconds. Templates are scoped per user and support both sales and expense transactions. This feature significantly improves user efficiency for repetitive transactions while maintaining full compatibility with existing reporting logic.

## Glossary

- **Template**: A saved preset configuration containing transaction type, default amount, category, and description
- **Template_ID**: Unique identifier (UUID) for each template
- **User_ID**: Unique identifier for the user who owns the template
- **Transaction_Type**: Either "sale" (positive amount) or "expense" (negative amount)
- **Default_Amount**: The pre-filled amount value when template is used
- **Category**: Broad classification for the transaction (e.g., Food Sales, Transport, Supplies, Services)
- **Description**: Specific product or service details (e.g., "Bread", "Taxi fare")
- **Quick_Templates_Section**: UI section on home screen displaying up to 6 most recently used templates
- **Template_Management**: Features for editing and deleting templates via long-press or menu options
- **Optimistic_Update**: Immediate UI update before server confirmation
- **Memoization**: Caching computed values to prevent unnecessary recalculations

## Requirements

### Requirement 1: Transaction Template Data Model

**User Story:** As a developer, I want a well-structured template data model, so that templates can be reliably stored and retrieved.

#### Acceptance Criteria

1. THE Template_Model SHALL have the following fields: template_id (UUID), user_id (TEXT), name (TEXT), type (TEXT: "sale"|"expense"), default_amount (REAL), category (TEXT), description (TEXT), created_at (TIMESTAMP)
2. THE Template_Model SHALL use UUID as the primary key for template_id
3. THE Template_Model SHALL enforce user_id as a required field to scope templates per user
4. THE Template_Model SHALL store type as either "sale" or "expense" with no other values allowed
5. THE Template_Model SHALL allow default_amount to be any positive real number
6. THE Template_Model SHALL allow category and description to be optional (nullable) fields
7. THE Template_Model SHALL automatically set created_at to the current timestamp when a template is created

### Requirement 2: Database Table Creation

**User Story:** As a system, I want a persistent database table for templates, so that templates survive app restarts and sync across devices.

#### Acceptance Criteria

1. WHEN the app initializes, THE Database_Schema SHALL create a transaction_templates table if it does not exist
2. THE transaction_templates table SHALL have columns: id (UUID PRIMARY KEY), user_id (TEXT NOT NULL), name (TEXT NOT NULL), type (TEXT NOT NULL), default_amount (REAL NOT NULL), category (TEXT), description (TEXT), created_at (TIMESTAMP NOT NULL), updated_at (TIMESTAMP NOT NULL), is_deleted (INTEGER DEFAULT 0)
3. THE transaction_templates table SHALL have an index on user_id for fast user-scoped queries
4. THE transaction_templates table SHALL have an index on (user_id, is_deleted) for efficient filtering of active templates
5. THE transaction_templates table SHALL support soft deletes via the is_deleted flag
6. THE transaction_templates table SHALL use Supabase as the backend storage system

### Requirement 3: Template Creation Screen

**User Story:** As a user, I want a dedicated screen to create new templates, so that I can save my frequently used transactions.

#### Acceptance Criteria

1. WHEN the user navigates to the template creation screen, THE Screen SHALL display input fields for: Template Name, Transaction Type (dropdown: Sale/Expense), Default Amount, Category (dropdown), Description
2. THE Template_Name field SHALL be required and accept text input up to 100 characters
3. THE Transaction_Type field SHALL be a dropdown with exactly two options: "Sale" and "Expense"
4. THE Default_Amount field SHALL accept numeric input and be required
5. THE Category field SHALL be a dropdown populated from existing categories and be optional
6. THE Description field SHALL accept text input up to 500 characters and be optional
7. WHEN the user taps the "Save Template" button, THE Screen SHALL validate that Template Name and Transaction Type are provided
8. IF validation fails, THE Screen SHALL display an error message indicating which fields are required
9. WHEN validation succeeds, THE Screen SHALL save the template to the database and display a success message
10. WHEN the template is saved successfully, THE Screen SHALL navigate back to the previous screen

### Requirement 4: Template Usage - Form Pre-filling

**User Story:** As a user, I want to tap a template and have the transaction form open with pre-filled values, so that I can quickly record transactions.

#### Acceptance Criteria

1. WHEN the user taps a template from the Quick Templates section, THE Transaction_Form SHALL open with the following fields pre-filled: amount (from default_amount), category (from template category), description (from template description)
2. THE Transaction_Form SHALL display the template's transaction type (Sale or Expense) as the active selection
3. THE Amount field SHALL be editable and focused, allowing the user to change the value before saving
4. THE Category and Description fields SHALL be editable, allowing the user to modify them if needed
5. WHEN the user taps "Save", THE System SHALL record the transaction with the edited values (or original template values if not changed)
6. THE Recorded_Transaction SHALL be stored exactly like a normal transaction (no special template marker)
7. THE Recorded_Transaction SHALL NOT affect reporting logic - all transactions are treated identically in reports

### Requirement 5: Home Screen Integration - Quick Templates Section

**User Story:** As a user, I want to see my most frequently used templates on the home screen, so that I can access them quickly without navigating to a separate screen.

#### Acceptance Criteria

1. WHEN the home screen loads, THE Home_Screen SHALL display a "Quick Templates" section above the transaction list
2. THE Quick_Templates_Section SHALL display up to 6 templates as horizontal scrollable cards
3. EACH Template_Card SHALL display: template name, transaction type (Sale/Expense), and default amount
4. WHEN there are more than 6 templates, THE Quick_Templates_Section SHALL enable horizontal scrolling to view additional templates
5. WHEN there are no templates, THE Quick_Templates_Section SHALL display a message: "No templates yet. Create one to get started."
6. WHEN the user taps a template card, THE Transaction_Form SHALL open with pre-filled values from that template
7. THE Quick_Templates_Section SHALL load templates instantly without visible loading delay
8. THE Quick_Templates_Section SHALL display the 6 most recently created templates

### Requirement 6: Template Management - Edit Functionality

**User Story:** As a user, I want to edit existing templates, so that I can update them as my business needs change.

#### Acceptance Criteria

1. WHEN the user long-presses a template card in the Quick Templates section, THE System SHALL display a context menu with options: "Edit" and "Delete"
2. WHEN the user taps "Edit", THE Template_Edit_Screen SHALL open with all template fields pre-populated with current values
3. THE Template_Edit_Screen SHALL allow editing of: Template Name, Transaction Type, Default Amount, Category, Description
4. WHEN the user taps "Save Changes", THE System SHALL validate the updated values
5. IF validation succeeds, THE System SHALL update the template in the database
6. WHEN the template is updated successfully, THE System SHALL display a success message and navigate back to the home screen
7. THE Updated_Template SHALL be reflected immediately in the Quick Templates section

### Requirement 7: Template Management - Delete Functionality

**User Story:** As a user, I want to delete templates I no longer use, so that my template list stays organized.

#### Acceptance Criteria

1. WHEN the user long-presses a template card and taps "Delete", THE System SHALL display a confirmation dialog: "Delete this template?"
2. WHEN the user confirms deletion, THE System SHALL soft-delete the template (set is_deleted = 1)
3. THE Deleted_Template SHALL be removed immediately from the Quick Templates section
4. THE Deleted_Template SHALL NOT appear in any template lists
5. WHEN deletion is complete, THE System SHALL display a success message

### Requirement 8: Template Performance - Instant Loading

**User Story:** As a user, I want templates to load instantly on the home screen, so that I don't experience delays when opening the app.

#### Acceptance Criteria

1. WHEN the home screen loads, THE Quick_Templates_Section SHALL display templates within 100ms of screen render
2. THE Template_Loading SHALL use memoization to cache template data and prevent unnecessary re-renders
3. WHEN templates are fetched from the database, THE System SHALL use indexed queries on (user_id, is_deleted) for optimal performance
4. THE Template_List SHALL be memoized using useMemo to prevent recalculation on every render
5. THE Template_Handlers (create, edit, delete) SHALL be wrapped with useCallback to prevent unnecessary function recreations
6. WHEN the user navigates away from the home screen and returns, THE Templates SHALL remain in memory and not require a fresh fetch
7. THE System SHALL implement pagination if the user has more than 100 templates (load first 6, lazy-load additional on scroll)

### Requirement 9: Category and Description Separation

**User Story:** As a user, I want to use broad categories and specific descriptions, so that my transactions are organized logically without turning products into categories.

#### Acceptance Criteria

1. THE Category field SHALL contain only broad classifications (e.g., Food Sales, Transport, Supplies, Services)
2. THE Description field SHALL contain specific product or service details (e.g., "Bread", "Taxi fare", "Office pens")
3. WHEN a user creates a template, THE System SHALL NOT allow creating new categories from the template creation screen
4. THE Category dropdown SHALL only show existing categories from the categories table
5. WHEN a template is used to record a transaction, THE Category and Description SHALL be stored separately in the transaction record
6. THE Reports_Module SHALL use Category for grouping and Description for itemization

### Requirement 10: Transaction Type Consistency

**User Story:** As a system, I want to ensure template transaction types are consistent with the transaction system, so that templates always create valid transactions.

#### Acceptance Criteria

1. WHEN a template is created with type "sale", THE System SHALL record transactions with positive amounts
2. WHEN a template is created with type "expense", THE System SHALL record transactions with negative amounts
3. WHEN a user uses a template to record a transaction, THE Amount_Sign SHALL match the template type (positive for sales, negative for expenses)
4. THE Template_Type SHALL NOT change the transaction recording logic - all transactions are stored identically regardless of template origin
5. WHEN a transaction is recorded from a template, THE Transaction_Record SHALL be indistinguishable from a manually recorded transaction

### Requirement 11: Template Creation Speed

**User Story:** As a user, I want to record transactions from templates in under 3 seconds, so that I can quickly capture business activity.

#### Acceptance Criteria

1. WHEN the user taps a template and the transaction form opens, THE Form_Display_Time SHALL be less than 500ms
2. WHEN the user edits the amount and taps "Save", THE Transaction_Save_Time SHALL be less than 1 second
3. THE Total_Time_From_Template_Tap_To_Saved_Transaction SHALL be less than 3 seconds
4. THE System SHALL use optimistic UI updates to provide immediate feedback
5. WHEN a transaction is saved, THE Home_Screen_Profit_Display SHALL update immediately before server confirmation
6. IF the server save fails, THE System SHALL display an error and allow the user to retry

### Requirement 12: Reports Compatibility

**User Story:** As a system, I want templates to be transparent to the reporting system, so that template transactions don't distort business analytics.

#### Acceptance Criteria

1. WHEN a transaction is recorded from a template, THE Transaction_Record SHALL NOT contain any template identifier or marker
2. THE Reports_Module SHALL treat template transactions identically to manually recorded transactions
3. WHEN generating reports, THE System SHALL NOT differentiate between template and non-template transactions
4. THE Profit_Calculation SHALL include all transactions equally, regardless of origin
5. THE Category_Reports SHALL group template transactions by category exactly like normal transactions
6. THE Date_Reports SHALL include template transactions in date-based groupings exactly like normal transactions
7. WHEN a template is deleted, THE Transactions_Created_From_That_Template SHALL remain in the transaction history

### Requirement 13: Template Listing and Retrieval

**User Story:** As a system, I want to efficiently retrieve templates for display, so that the app remains responsive.

#### Acceptance Criteria

1. WHEN the home screen loads, THE System SHALL fetch all active templates for the current user
2. THE Template_Query SHALL use the (user_id, is_deleted) index for optimal performance
3. THE System SHALL retrieve templates ordered by created_at DESC (most recent first)
4. WHEN templates are retrieved, THE System SHALL exclude soft-deleted templates (is_deleted = 1)
5. THE Template_Retrieval_Function SHALL accept optional limit and offset parameters for pagination
6. WHEN more than 6 templates exist, THE System SHALL load the first 6 by default and support lazy-loading of additional templates

### Requirement 14: Template Validation

**User Story:** As a system, I want to validate template data before saving, so that invalid templates don't corrupt the database.

#### Acceptance Criteria

1. WHEN a template is created, THE System SHALL validate that name is not empty and not longer than 100 characters
2. WHEN a template is created, THE System SHALL validate that type is either "sale" or "expense"
3. WHEN a template is created, THE System SHALL validate that default_amount is a positive number greater than 0
4. WHEN a template is created, THE System SHALL validate that description (if provided) is not longer than 500 characters
5. IF any validation fails, THE System SHALL return a descriptive error message
6. WHEN a template is updated, THE System SHALL apply the same validation rules as creation

### Requirement 15: User Interface - Mobile-First Design

**User Story:** As a user, I want a clean, mobile-first interface for templates, so that I can easily manage them on my phone.

#### Acceptance Criteria

1. THE Template_Cards in the Quick Templates section SHALL be touch-friendly with minimum 44px height
2. THE Template_Card_Text SHALL be readable at normal viewing distance without zooming
3. THE Template_Creation_Screen SHALL use a single-column layout optimized for mobile screens
4. THE Template_Edit_Screen SHALL use a single-column layout optimized for mobile screens
5. THE Context_Menu (long-press) SHALL display options with adequate spacing for touch accuracy
6. THE Confirmation_Dialogs SHALL be centered and sized appropriately for mobile screens
7. THE Quick_Templates_Section SHALL use horizontal scrolling for templates exceeding 6 items
8. THE Template_Cards SHALL display transaction type with a visual indicator (e.g., color or icon)

### Requirement 16: Parser and Serializer for Template Data

**User Story:** As a system, I want to reliably serialize and deserialize template data, so that templates can be exported, imported, or synced reliably.

#### Acceptance Criteria

1. THE Template_Serializer SHALL convert a Template object to JSON format with all required fields
2. THE Template_Parser SHALL parse JSON data into a valid Template object
3. WHEN a Template object is serialized to JSON and then parsed back, THE Resulting_Object SHALL be equivalent to the original (round-trip property)
4. THE Template_Parser SHALL validate that parsed data conforms to the Template schema
5. IF parsed data is invalid, THE Template_Parser SHALL return a descriptive error message
6. THE Template_Pretty_Printer SHALL format Template objects into human-readable JSON with proper indentation
7. FOR ALL valid Template objects, parsing then printing then parsing SHALL produce an equivalent object

