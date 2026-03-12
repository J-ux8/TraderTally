# Implementation Plan: Transaction Templates

## Overview

This implementation plan breaks down the Transaction Templates feature into discrete, actionable coding tasks. The feature adds a template system that allows users to save and quickly reuse frequently used transactions. Templates are transparent to the transaction system—a transaction recorded from a template is indistinguishable from a manually recorded transaction.

The implementation follows a layered approach: database setup → core library functions → state management → UI components → navigation → integration → testing.

## Tasks

- [x] 1. Database Migration - Create transaction_templates Table
  - Create migration file for transaction_templates table with all required columns
  - Add indexes on user_id and (user_id, is_deleted) for query optimization
  - Add CHECK constraints for type and default_amount validation
  - Verify migration runs successfully on app initialization
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 2. Core Library Functions - Template CRUD Operations
  - [x] 2.1 Implement createTemplate() function
    - Accept TemplateInput and validate all fields
    - Generate UUID for template ID
    - Store template in transaction_templates table
    - Return created Template object
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ]* 2.2 Write property test for Template Data Integrity
    - **Property 1: Template Data Integrity**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
    - Generate random valid templates, verify all fields stored and retrieved correctly

  - [x] 2.3 Implement getTemplates() function
    - Fetch all active templates for current user ordered by created_at DESC
    - Use indexed query on (user_id, is_deleted)
    - Support optional limit and offset parameters for pagination
    - Return array of Template objects
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 2.4 Implement getTemplateById() function
    - Fetch single template by ID
    - Verify template belongs to current user
    - Return Template object or throw error if not found
    - _Requirements: 13.1, 13.2_

  - [x] 2.5 Implement updateTemplate() function
    - Accept template ID and TemplateInput
    - Validate all fields using same rules as creation
    - Update template in database
    - Return updated Template object
    - _Requirements: 6.3, 6.4, 6.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ]* 2.6 Write property test for Input Validation Consistency
    - **Property 8: Input Validation Consistency**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6**
    - Generate invalid inputs, verify same validation rules apply for create and update

  - [x] 2.7 Implement deleteTemplate() function
    - Soft delete template by setting is_deleted = 1
    - Verify template belongs to current user
    - Return success confirmation
    - _Requirements: 7.2, 7.3, 7.4_

  - [ ]* 2.8 Write property test for Soft Delete Isolation
    - **Property 2: Soft Delete Isolation**
    - **Validates: Requirements 2.5, 7.2, 7.3, 7.4, 13.4**
    - Generate templates, soft delete random ones, verify they don't appear in queries

  - [x] 2.9 Implement validateTemplateInput() function
    - Validate name: required, max 100 characters
    - Validate type: must be 'sale' or 'expense'
    - Validate default_amount: must be positive number > 0
    - Validate description: optional, max 500 characters
    - Return validation result with error messages
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 2.10 Write unit tests for validateTemplateInput()
    - Test valid inputs pass validation
    - Test empty name fails
    - Test name > 100 chars fails
    - Test invalid type fails
    - Test non-positive amount fails
    - Test description > 500 chars fails
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 3. Serialization and Parsing Functions
  - [x] 3.1 Implement serializeTemplate() function
    - Convert Template object to JSON string
    - Include all required fields
    - _Requirements: 16.1_

  - [x] 3.2 Implement parseTemplate() function
    - Parse JSON string into Template object
    - Validate parsed data conforms to Template schema
    - Return descriptive error if invalid
    - _Requirements: 16.2, 16.4, 16.5_

  - [ ]* 3.3 Write property test for Serialization Round-Trip
    - **Property 3: Template Serialization Round-Trip**
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.7**
    - Generate random templates, serialize/deserialize, verify equivalence

  - [x] 3.4 Implement prettyPrintTemplate() function
    - Format Template object into human-readable JSON with indentation
    - _Requirements: 16.6_

- [x] 4. React Hooks - useTemplates Hook
  - [x] 4.1 Create useTemplates hook with state management
    - Initialize templates state, loading state, error state
    - Fetch templates on mount using getTemplates()
    - Implement refresh() function to re-fetch templates
    - Implement getRecentTemplates(count) to get most recent N templates
    - _Requirements: 8.2, 8.4, 8.5, 8.6_

  - [x] 4.2 Implement createTemplate operation in hook
    - Wrap createTemplate() library function
    - Update local state optimistically
    - Handle errors and revert on failure
    - _Requirements: 3.9, 11.4_

  - [x] 4.3 Implement updateTemplate operation in hook
    - Wrap updateTemplate() library function
    - Update local state optimistically
    - Handle errors and revert on failure
    - _Requirements: 6.5, 6.7, 11.4_

  - [x] 4.4 Implement deleteTemplate operation in hook
    - Wrap deleteTemplate() library function
    - Update local state optimistically
    - Handle errors and revert on failure
    - _Requirements: 7.3, 7.4, 11.4_

  - [x] 4.5 Implement useTemplate operation in hook
    - Wrap useTemplateForTransaction() library function
    - Return template data for form pre-filling
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 4.6 Write unit tests for useTemplates hook
    - Test hook initializes with empty templates
    - Test hook fetches templates on mount
    - Test createTemplate updates state
    - Test updateTemplate updates state
    - Test deleteTemplate removes from state
    - Test refresh re-fetches templates
    - Test getRecentTemplates returns correct count
    - _Requirements: 8.2, 8.4, 8.5, 8.6_

- [x] 5. Context Setup - TemplatesContext and Provider
  - [x] 5.1 Create TemplatesContext with TypeScript interfaces
    - Define TemplatesContextType interface with all operations
    - Create React Context with default values
    - _Requirements: 8.2, 8.4, 8.5_

  - [x] 5.2 Implement TemplatesProvider component
    - Use useTemplates hook internally
    - Provide context value to children
    - Handle loading and error states
    - _Requirements: 8.2, 8.4, 8.5_

  - [x] 5.3 Implement useTemplatesContext hook
    - Retrieve context value
    - Throw error if used outside provider
    - _Requirements: 8.2, 8.4, 8.5_

  - [x] 5.4 Integrate TemplatesProvider into app root
    - Wrap app with TemplatesProvider in app/_layout.tsx
    - Ensure provider is above all components that use templates
    - _Requirements: 8.2, 8.4, 8.5_

- [x] 6. UI Components - TemplateCard Component
  - [x] 6.1 Create TemplateCard component
    - Display template name, transaction type, and default amount
    - Show visual indicator for transaction type (color/icon)
    - Implement onPress callback for template selection
    - Implement onLongPress callback for context menu
    - Ensure minimum 44px height for touch-friendliness
    - _Requirements: 5.3, 15.1, 15.8_

  - [ ]* 6.2 Write unit tests for TemplateCard
    - Test component renders template data correctly
    - Test onPress callback fires on tap
    - Test onLongPress callback fires on long-press
    - Test visual indicators display correctly
    - _Requirements: 5.3, 15.1, 15.8_

- [x] 7. UI Components - QuickTemplatesSection Component
  - [x] 7.1 Create QuickTemplatesSection component
    - Display up to 6 most recent templates as horizontal scrollable cards
    - Show empty state message when no templates exist
    - Implement horizontal scroll with lazy loading
    - Memoize component to prevent unnecessary re-renders
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 8.2, 8.3, 8.4, 8.7_

  - [x] 7.2 Implement lazy loading for additional templates
    - Detect scroll near end of list
    - Load next batch of templates on scroll
    - Update displayed count incrementally
    - _Requirements: 8.7, 13.6_

  - [ ]* 7.3 Write unit tests for QuickTemplatesSection
    - Test component displays up to 6 templates
    - Test empty state message displays when no templates
    - Test onTemplatePress callback fires
    - Test horizontal scrolling works
    - Test lazy loading triggers on scroll
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 8. UI Components - CreateTemplateScreen
  - [x] 8.1 Create CreateTemplateScreen component
    - Implement form with fields: Name, Type (dropdown), Amount, Category (dropdown), Description
    - Fetch categories from CategoriesContext
    - Implement form validation with error messages
    - Implement save button that calls createTemplate()
    - Navigate back to home screen on success
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 9.3, 9.4, 15.3_

  - [ ]* 8.2 Write unit tests for CreateTemplateScreen
    - Test form fields render correctly
    - Test category dropdown populated from context
    - Test validation errors display
    - Test save button calls createTemplate
    - Test navigation on success
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 9. UI Components - EditTemplateScreen
  - [x] 9.1 Create EditTemplateScreen component
    - Load template by ID from route params
    - Pre-populate form fields with current template values
    - Implement form validation with error messages
    - Implement save button that calls updateTemplate()
    - Navigate back to home screen on success
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 15.4_

  - [ ]* 9.2 Write unit tests for EditTemplateScreen
    - Test form fields pre-populate correctly
    - Test validation errors display
    - Test save button calls updateTemplate
    - Test navigation on success
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 10. UI Components - TemplateContextMenu
  - [x] 10.1 Create TemplateContextMenu component
    - Display context menu on long-press with Edit and Delete options
    - Implement onEdit callback to navigate to EditTemplateScreen
    - Implement onDelete callback to show confirmation dialog
    - _Requirements: 6.1, 7.1_

  - [x] 10.2 Implement delete confirmation dialog
    - Show confirmation message: "Delete this template?"
    - Implement confirm button that calls deleteTemplate()
    - Implement cancel button to dismiss dialog
    - Show success message on deletion
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 10.3 Write unit tests for TemplateContextMenu
    - Test context menu displays on long-press
    - Test Edit option navigates to edit screen
    - Test Delete option shows confirmation
    - Test confirmation deletes template
    - _Requirements: 6.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11. Navigation Setup - Routes for Template Screens
  - [x] 11.1 Create route definitions for template screens
    - Define route for CreateTemplateScreen: /modals/create-template
    - Define route for EditTemplateScreen: /modals/edit-template/:id
    - Export route constants for use throughout app
    - _Requirements: 5.6_

  - [x] 11.2 Add template screens to navigation stack
    - Add CreateTemplateScreen to app/(tabs)/_layout.tsx
    - Add EditTemplateScreen to app/(tabs)/_layout.tsx
    - Ensure routes are accessible from home screen
    - _Requirements: 5.6_

- [x] 12. Home Screen Integration - Add Quick Templates Section
  - [x] 12.1 Integrate QuickTemplatesSection into home screen
    - Import QuickTemplatesSection component
    - Get templates from useTemplatesContext hook
    - Display section above transaction list
    - Implement onTemplatePress to open transaction form with pre-filled values
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 12.2 Add Create Template button to home screen
    - Add button to navigate to CreateTemplateScreen
    - Position button in header or action area
    - _Requirements: 3.1_

  - [ ]* 12.3 Write integration tests for home screen templates
    - Test QuickTemplatesSection displays on home screen
    - Test Create Template button navigates to creation screen
    - Test template tap opens transaction form
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 13. Transaction Form Integration - Pre-filling from Templates
  - [x] 13.1 Modify transaction form to accept template data
    - Accept optional template parameter in form props
    - Pre-fill amount field with template.default_amount
    - Pre-fill category field with template.category
    - Pre-fill description field with template.description
    - Set transaction type based on template.type
    - Focus amount field for quick editing
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 13.2 Implement template-to-transaction flow
    - When template is tapped, pass template data to transaction form
    - Form opens with pre-filled values
    - User can edit any field before saving
    - On save, call recordSale() or recordExpense() with edited values
    - Transaction is recorded exactly like manual transaction (no template marker)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 10.1, 10.2, 10.3, 10.4, 10.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ]* 13.3 Write property test for Form Pre-filling Accuracy
    - **Property 6: Form Pre-filling Accuracy**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 5.6**
    - Generate templates, verify all pre-filled fields match template values exactly

  - [ ]* 13.4 Write property test for Transaction Type Consistency
    - **Property 4: Transaction Type Consistency**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**
    - Generate templates with both types, verify amount signs match type

  - [ ]* 13.5 Write property test for Template Transparency
    - **Property 5: Template Transparency**
    - **Validates: Requirements 4.6, 12.1, 12.2, 12.3, 12.4, 12.7**
    - Generate transactions from templates, verify no template marker in record

  - [ ]* 13.6 Write unit tests for transaction form pre-filling
    - Test form fields pre-fill correctly from template
    - Test amount field is focused and editable
    - Test user can edit pre-filled values
    - Test transaction saves with edited values
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 14. Performance Optimization - Memoization and Callbacks
  - [x] 14.1 Implement memoization for template list
    - Use useMemo to cache filtered and sorted template list
    - Memoize only when templates array changes
    - _Requirements: 8.2, 8.4_

  - [x] 14.2 Implement component memoization
    - Wrap TemplateCard with React.memo
    - Wrap QuickTemplatesSection with React.memo
    - _Requirements: 8.2, 8.4_

  - [x] 14.3 Implement callback memoization
    - Wrap template handlers with useCallback
    - Memoize onTemplatePress, onEdit, onDelete callbacks
    - _Requirements: 8.5_

  - [ ]* 14.4 Write performance tests
    - Test template load time < 100ms
    - Test form display time < 500ms
    - Test transaction save time < 1 second
    - Test total template-to-saved-transaction time < 3 seconds
    - _Requirements: 8.1, 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 15. Checkpoint - Ensure All Tests Pass
  - Ensure all unit tests pass
  - Ensure all property-based tests pass
  - Ensure all integration tests pass
  - Ask the user if questions arise

- [x] 16. Category Dropdown Integration
  - [x] 16.1 Fetch categories from CategoriesContext
    - Import useCategoriesContext hook
    - Get categories list from context
    - _Requirements: 9.3, 9.4_

  - [ ]* 16.2 Write property test for Category Dropdown Accuracy
    - **Property 9: Category Dropdown Accuracy**
    - **Validates: Requirements 9.3, 9.4**
    - Generate category sets, verify dropdown matches exactly

  - [ ]* 16.3 Write unit tests for category dropdown
    - Test dropdown populated from context
    - Test all categories from context appear in dropdown
    - Test no extra categories appear
    - _Requirements: 9.3, 9.4_

- [x] 17. Template Ordering and Retrieval
  - [x] 17.1 Implement template ordering by creation date
    - Fetch templates ordered by created_at DESC
    - Display most recent 6 templates first
    - _Requirements: 5.8, 13.3_

  - [ ]* 17.2 Write property test for Template Ordering
    - **Property 7: Template Ordering**
    - **Validates: Requirements 5.2, 5.8, 13.3**
    - Generate multiple templates, verify most recent 6 displayed first

  - [ ]* 17.3 Write unit tests for template ordering
    - Test templates ordered by creation date DESC
    - Test most recent 6 templates displayed
    - Test pagination works correctly
    - _Requirements: 5.8, 13.3_

- [x] 18. Error Handling and User Feedback
  - [x] 18.1 Implement validation error messages
    - Display field-specific error messages on validation failure
    - Show error toast for database errors
    - _Requirements: 3.8, 14.5_

  - [x] 18.2 Implement success messages
    - Show success toast on template creation
    - Show success toast on template update
    - Show success toast on template deletion
    - _Requirements: 3.9, 6.6, 7.5_

  - [x] 18.3 Implement error recovery
    - Implement retry logic for failed operations
    - Revert optimistic updates on error
    - Display user-friendly error messages
    - _Requirements: 11.6_

  - [ ]* 18.4 Write unit tests for error handling
    - Test validation errors display correctly
    - Test database errors handled gracefully
    - Test success messages display
    - Test retry logic works
    - _Requirements: 3.8, 6.6, 7.5, 11.6_

- [ ] 19. Performance Validation - Load Time Targets
  - [ ] 19.1 Verify template load time < 100ms
    - Measure time from screen render to templates displayed
    - Use React DevTools Profiler
    - _Requirements: 8.1_

  - [ ] 19.2 Verify form display time < 500ms
    - Measure time from template tap to form open
    - Use React DevTools Profiler
    - _Requirements: 11.1_

  - [ ] 19.3 Verify transaction save time < 1 second
    - Measure time from save button tap to transaction recorded
    - Use React DevTools Profiler
    - _Requirements: 11.2_

  - [ ] 19.4 Verify total template-to-saved-transaction time < 3 seconds
    - Measure end-to-end time from template tap to transaction saved
    - Use React DevTools Profiler
    - _Requirements: 11.3_

- [ ] 20. Final Checkpoint - Ensure All Tests Pass and Feature Complete
  - Ensure all unit tests pass
  - Ensure all property-based tests pass
  - Ensure all integration tests pass
  - Verify all performance targets met
  - Verify all requirements covered
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation and catch issues early
- Performance tests verify the feature meets speed requirements
- All tasks assume TypeScript/React Native environment with Supabase backend
- Template transactions are stored identically to manual transactions (no template marker)
- Templates are scoped per user and use soft deletes for data preservation
