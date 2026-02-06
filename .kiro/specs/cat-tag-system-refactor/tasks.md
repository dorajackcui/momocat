# Implementation Plan: CAT Tool Tag System Refactor

## Overview

This implementation plan breaks down the tag system refactor into incremental, testable steps. Each task builds on previous work, with property-based tests integrated throughout to validate correctness early. The plan follows a bottom-up approach: data models → services → components → integration.

## Tasks

- [x] 1. Enhance core data models and utilities
  - [x] 1.1 Extend Token interface with tag metadata
    - Add `tagType`, `pairedIndex`, and `validationState` to Token.meta
    - Update TypeScript types in `packages/core/src/index.ts`
    - _Requirements: 14.1_
  
  - [x] 1.2 Create TagMetadata interface
    - Define interface with index, type, pairedIndex, isPaired, displayText, validationState
    - Export from core package
    - _Requirements: 14.1_
  
  - [x] 1.3 Implement getTagDisplayInfo utility
    - Parse tag content to determine type (paired-start, paired-end, standalone)
    - Generate display text ([N, N], ⟨N⟩)
    - Return TagDisplayInfo object
    - _Requirements: 1.3, 1.8_
  
  - [ ]* 1.4 Write property test for tag display format
    - **Property 1: Tag Display Format Correctness**
    - **Validates: Requirements 1.3, 1.8**
    - Generate random tag contents (HTML, placeholders, printf-style)
    - Verify display format matches expected pattern for each type
    - _Requirements: 1.3, 1.8_

- [x] 2. Implement TagManager service
  - [x] 2.1 Create TagManager class with basic structure
    - Set up event emitter pattern with listeners map
    - Implement on() and emit() methods
    - _Requirements: 14.5_
  
  - [x] 2.2 Implement tag insertion methods
    - Write insertTag() to insert single tag at cursor position
    - Write insertAllTags() to insert all source tags
    - Emit 'tagInserted' events
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [ ]* 2.3 Write property tests for tag insertion
    - **Property 6: Tag Insertion by Index**
    - **Validates: Requirements 4.1**
    - **Property 7: Bulk Tag Insertion Order Preservation**
    - **Validates: Requirements 4.2, 4.5**
    - Generate random token sequences and insertion positions
    - Verify tags appear at correct positions
    - Verify order and spacing preservation for bulk insertion
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [x] 2.4 Implement tag deletion method
    - Write deleteTag() to remove tag by index
    - Emit 'tagDeleted' event
    - _Requirements: 5.1, 5.2, 5.5_
  
  - [ ]* 2.5 Write property test for tag deletion
    - **Property 9: Tag Deletion**
    - **Validates: Requirements 5.1, 5.2, 5.5**
    - Generate random token sequences with tags
    - Verify tag removal and surrounding token integrity
    - _Requirements: 5.1, 5.2, 5.5_
  
  - [x] 2.6 Implement tag movement method
    - Write moveTag() to reorder tags via drag-and-drop
    - Emit 'tagMoved' event
    - _Requirements: 7.3, 7.4_
  
  - [ ]* 2.7 Write property test for tag movement
    - **Property 13: Tag Drag-and-Drop Movement**
    - **Validates: Requirements 7.3**
    - Generate random token sequences and move operations
    - Verify tag appears at new position with correct relative order
    - _Requirements: 7.3_
  
  - [x] 2.8 Implement tag pairing logic
    - Write findPairedTag() to locate matching opening/closing tags
    - Handle nested tags correctly
    - Return undefined for standalone tags
    - _Requirements: 1.9, 9.5, 14.2_
  
  - [ ]* 2.9 Write property test for tag pairing
    - **Property 2: Tag Pairing Identification**
    - **Validates: Requirements 1.9, 9.5, 14.2**
    - Generate random sequences with paired and standalone tags
    - Verify correct pairing identification
    - Verify standalone tags have no pair
    - _Requirements: 1.9, 9.5, 14.2_
  
  - [x] 2.10 Implement getTagMetadata() method
    - Combine display info and pairing info
    - Return complete TagMetadata object
    - _Requirements: 14.1_
  
  - [x] 2.11 Implement copyTag() method
    - Return tag content string for clipboard
    - _Requirements: 6.1, 6.3_

- [x] 3. Implement TagValidator service
  - [x] 3.1 Create TagValidator class structure
    - Set up validate() method signature
    - Define ValidationResult and AutoFixSuggestion interfaces
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [x] 3.2 Implement missing tag detection
    - Compare source and target tags
    - Generate error for missing tags
    - Create auto-fix suggestion to insert missing tags
    - _Requirements: 8.2_
  
  - [ ]* 3.3 Write property test for missing tag detection
    - **Property 16: Missing Tag Detection**
    - **Validates: Requirements 8.2**
    - Generate random source/target pairs with missing tags
    - Verify error generation with correct missing tag list
    - _Requirements: 8.2_
  
  - [x] 3.4 Implement extra tag detection
    - Compare target and source tags
    - Generate error for extra tags
    - Create auto-fix suggestion to remove extra tags
    - _Requirements: 8.3_
  
  - [ ]* 3.5 Write property test for extra tag detection
    - **Property 17: Extra Tag Detection**
    - **Validates: Requirements 8.3**
    - Generate random source/target pairs with extra tags
    - Verify error generation with correct extra tag list
    - _Requirements: 8.3_
  
  - [x] 3.6 Implement tag order validation
    - Compare tag sequences
    - Generate warning for order mismatch
    - Create auto-fix suggestion to reorder
    - _Requirements: 8.4_
  
  - [ ]* 3.7 Write property test for tag order validation
    - **Property 18: Tag Order Validation**
    - **Validates: Requirements 8.4**
    - Generate random source/target pairs with same tags, different order
    - Verify warning generation
    - _Requirements: 8.4_
  
  - [x] 3.8 Implement validation clearing logic
    - Return empty issues array when tags match perfectly
    - _Requirements: 8.5_
  
  - [ ]* 3.9 Write property test for validation clearing
    - **Property 19: Validation Clearing**
    - **Validates: Requirements 8.5**
    - Generate random matching source/target pairs
    - Verify no errors or warnings returned
    - _Requirements: 8.5_
  
  - [x] 3.10 Implement generateAutoFix() method
    - Match issue to appropriate auto-fix suggestion
    - Return AutoFixSuggestion with apply function
    - _Requirements: 15.4, 15.5_
  
  - [ ]* 3.11 Write property tests for auto-fix
    - **Property 26: Auto-Fix Application**
    - **Validates: Requirements 15.4**
    - **Property 27: Bulk Auto-Fix**
    - **Validates: Requirements 15.5**
    - Generate random validation errors
    - Apply auto-fix and verify error resolution
    - Test bulk fix for multiple errors
    - _Requirements: 15.4, 15.5_

- [x] 4. Checkpoint - Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement TagNavigator service
  - [x] 5.1 Create TagNavigator class
    - Implement getTagIndices() to find all tag positions
    - _Requirements: 3.1, 3.2_
  
  - [x] 5.2 Implement navigation methods
    - Write focusNextTag() with wrap-around
    - Write focusPreviousTag() with wrap-around
    - _Requirements: 3.1, 3.2_
  
  - [ ]* 5.3 Write property test for tag navigation
    - **Property 5: Tag Navigation Wrapping**
    - **Validates: Requirements 3.1, 3.2**
    - Generate random token sequences
    - Verify navigation wraps correctly at boundaries
    - _Requirements: 3.1, 3.2_

- [~] 6. Create TagCapsule component
  - [x] 6.1 Implement TagCapsule component structure
    - Define props interface
    - Set up basic rendering with span element
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 6.2 Implement visual styling logic
    - Apply color scheme based on isSource prop
    - Apply shape styles based on tag type
    - Apply validation state styling
    - Apply selection styling
    - _Requirements: 1.4, 1.5, 1.6, 1.7_
  
  - [x] 6.3 Add interaction handlers
    - Implement onClick for selection
    - Implement onContextMenu for context menu
    - Implement onDragStart and onDragEnd for drag-and-drop
    - Set contentEditable to false
    - _Requirements: 2.1, 2.5, 7.1_
  
  - [x] 6.4 Add accessibility attributes
    - Set role="button"
    - Set tabIndex={0}
    - Set aria-label with tag info
    - Add title attribute for tooltip
    - _Requirements: 1.8, 12.1_
  
  - [ ]* 6.5 Write property test for accessibility attributes
    - **Property 28: Accessibility Attributes**
    - **Validates: Requirements 12.1**
    - Generate random tag tokens
    - Verify aria-label contains type, number, and content
    - _Requirements: 12.1_
  
  - [ ]* 6.6 Write unit tests for TagCapsule
    - Test rendering with different tag types
    - Test styling for source vs target
    - Test validation state styling
    - Test selection state
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 7. Create TagInsertionUI component
  - [x] 7.1 Implement TagInsertionUI component
    - Define props interface
    - Render dropdown with source tag list
    - Render "Insert All Tags" button
    - Handle visibility based on isVisible prop
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [x] 7.2 Implement tag insertion handlers
    - Call onInsertTag with tag index on click
    - Call onInsertAllTags on "Insert All" click
    - _Requirements: 11.4, 11.5_
  
  - [ ]* 7.3 Write unit tests for TagInsertionUI
    - Test rendering with source tags
    - Test "Insert All" button functionality
    - Test individual tag insertion
    - Test visibility control
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 8. Create TagContextMenu component
  - [x] 8.1 Implement TagContextMenu component
    - Define props interface
    - Render menu at specified position
    - Include "View Full Content", "Copy Tag", "Delete Tag" options
    - Conditionally include "Jump to Pair" for paired tags
    - _Requirements: 10.1, 10.2, 10.7_
  
  - [x] 8.2 Implement menu action handlers
    - Call appropriate callback on menu item click
    - Close menu after action
    - _Requirements: 10.3, 10.4, 10.5, 10.6_
  
  - [ ]* 8.3 Write property test for context menu options
    - **Property 21: Standalone Tag Context Menu**
    - **Validates: Requirements 10.7**
    - Generate standalone and paired tags
    - Verify "Jump to pair" only shown for paired tags
    - _Requirements: 10.7_
  
  - [ ]* 8.4 Write unit tests for TagContextMenu
    - Test menu rendering at position
    - Test menu options for paired tags
    - Test menu options for standalone tags
    - Test action callbacks
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 9. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 10. Refactor EditorRow to use new tag components
  - [x] 10.1 Integrate TagManager service
    - Create TagManager instance
    - Replace inline tag operations with TagManager methods
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 7.3_
  
  - [x] 10.2 Replace inline tag rendering with TagCapsule
    - Update renderTokensToDOM to use TagCapsule component
    - Pass appropriate props (isSource, validationState, etc.)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 10.3 Add tag selection state management
    - Add selectedTagIndex state
    - Implement tag selection handlers
    - Ensure only one tag selected at a time
    - _Requirements: 2.1, 2.3, 2.4_
  
  - [ ]* 10.4 Write property tests for selection state
    - **Property 3: Tag Selection State Management**
    - **Validates: Requirements 2.1, 2.3, 2.4**
    - Test single selection constraint
    - Test deselection on outside click
    - _Requirements: 2.1, 2.3, 2.4_
  
  - [x] 10.5 Integrate TagValidator service
    - Create TagValidator instance
    - Replace validateSegmentTags with TagValidator.validate
    - Store validation results and auto-fix suggestions in segment
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 14.3_
  
  - [ ]* 10.6 Write property test for validation result storage
    - **Property 23: Validation Result Storage**
    - **Validates: Requirements 14.3**
    - Generate random segments with validation issues
    - Verify qaIssues array is populated correctly
    - _Requirements: 14.3_
  
  - [x] 10.7 Integrate TagNavigator service
    - Create TagNavigator instance
    - Add keyboard handlers for Ctrl+Left/Right Arrow
    - Update focus on navigation
    - _Requirements: 3.1, 3.2_
  
  - [x] 10.8 Add TagInsertionUI to EditorRow
    - Render TagInsertionUI when segment is active
    - Implement tag insertion handlers using TagManager
    - Add keyboard shortcuts (Ctrl+Shift+0-9)
    - _Requirements: 4.1, 4.2, 11.1, 11.2, 11.4, 11.5_
  
  - [ ]* 10.9 Write property test for tag insertion error handling
    - **Property 8: Tag Insertion Error Handling**
    - **Validates: Requirements 4.3**
    - Test insertion with invalid tag index
    - Verify warning and unchanged tokens
    - _Requirements: 4.3_
  
  - [~] 10.10 Add TagContextMenu to EditorRow
    - Track context menu state (visible, position, tag)
    - Show menu on tag right-click
    - Implement menu action handlers
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [ ]* 10.11 Write property tests for context menu actions
    - **Property 20: Jump to Paired Tag**
    - **Validates: Requirements 10.6**
    - Generate paired tags and test jump functionality
    - _Requirements: 10.6_

- [~] 11. Implement tag drag-and-drop
  - [~] 11.1 Add drag state management to EditorRow
    - Track dragging tag index
    - Track drop position
    - _Requirements: 7.1, 7.2_
  
  - [~] 11.2 Implement drag handlers
    - Handle onDragStart to set drag data
    - Handle onDragOver to show drop indicators
    - Handle onDrop to move tag
    - _Requirements: 7.3, 7.4_
  
  - [~] 11.3 Add drop position validation
    - Validate drop position before applying
    - Revert to original position if invalid
    - _Requirements: 7.4_
  
  - [ ]* 11.4 Write property test for invalid drop handling
    - **Property 14: Invalid Drop Position Handling**
    - **Validates: Requirements 7.4**
    - Test drops at invalid positions
    - Verify tag remains at original position
    - _Requirements: 7.4_
  
  - [~] 11.5 Trigger validation after tag movement
    - Call TagValidator after moveTag
    - Update segment qaIssues
    - _Requirements: 7.5_
  
  - [ ]* 11.6 Write property test for validation trigger
    - **Property 15: Validation Trigger on Tag Movement**
    - **Validates: Requirements 7.5**
    - Move tags and verify validation is called
    - _Requirements: 7.5_

- [~] 12. Implement tag copy-paste enhancements
  - [~] 12.1 Update handleCopy to preserve tag structure
    - Extract tags with full content
    - Set clipboard data with both plain text and HTML
    - _Requirements: 6.1, 6.3_
  
  - [~] 12.2 Update handlePaste to parse tags
    - Parse clipboard text for tags
    - Insert tags as TagCapsules
    - Handle invalid tag syntax gracefully
    - _Requirements: 6.2, 6.4, 6.5_
  
  - [ ]* 12.3 Write property test for copy-paste round trip
    - **Property 11: Tag Copy-Paste Round Trip**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - Generate random token sequences
    - Copy and paste, verify identical structure
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 12.4 Write property test for invalid paste handling
    - **Property 12: Invalid Tag Paste Handling**
    - **Validates: Requirements 6.5**
    - Generate invalid tag syntax
    - Verify pasted as plain text
    - _Requirements: 6.5_

- [~] 13. Implement tag deletion with warnings
  - [~] 13.1 Update tag deletion to check for paired tags
    - Use TagManager.findPairedTag before deletion
    - Generate warning if pair exists
    - _Requirements: 5.3, 5.4_
  
  - [ ]* 13.2 Write property test for paired tag deletion warning
    - **Property 10: Paired Tag Deletion Warning**
    - **Validates: Requirements 5.3, 5.4**
    - Delete paired tags and verify warning generation
    - _Requirements: 5.3, 5.4_

- [~] 14. Implement auto-fix UI
  - [~] 14.1 Add auto-fix buttons to QA issues display
    - Render "Fix" button for each issue with suggestion
    - Render "Fix All" button when multiple suggestions exist
    - _Requirements: 15.1, 15.2, 15.3, 15.5_
  
  - [~] 14.2 Implement auto-fix handlers
    - Apply single fix on "Fix" button click
    - Apply all fixes on "Fix All" button click
    - Re-validate after applying fixes
    - _Requirements: 15.4, 15.5_

- [~] 15. Add tag signature comparison utility
  - [~] 15.1 Update computeTagsSignature if needed
    - Ensure signature includes tag order
    - _Requirements: 14.4_
  
  - [ ]* 15.2 Write property test for tag signature comparison
    - **Property 24: Tag Signature Comparison**
    - **Validates: Requirements 14.4**
    - Generate token sequences with same/different tags
    - Verify signature equality matches tag equality
    - _Requirements: 14.4_

- [~] 16. Implement TagManager event emission
  - [ ]* 16.1 Write property test for event emission
    - **Property 25: Tag Manager Event Emission**
    - **Validates: Requirements 14.5**
    - Perform tag operations and verify events emitted
    - _Requirements: 14.5_

- [~] 17. Add property test for tag content editability
  - [ ]* 17.1 Write property test for contentEditable
    - **Property 4: Tag Content Editability**
    - **Validates: Requirements 2.5**
    - Verify all tag capsules have contentEditable=false
    - _Requirements: 2.5_

- [~] 18. Final checkpoint - Integration testing
  - [ ]* 18.1 Write integration tests for complete workflows
    - Test tag insertion → validation → auto-fix workflow
    - Test tag drag-and-drop → validation workflow
    - Test tag copy-paste → validation workflow
    - Test keyboard navigation → selection → context menu workflow
    - _Requirements: All_
  
  - [~] 18.2 Ensure all tests pass
    - Run full test suite
    - Fix any failing tests
    - Verify property tests run with 100+ iterations
  
  - [~] 18.3 Manual testing and polish
    - Test with real translation segments
    - Verify visual appearance matches design
    - Test accessibility with keyboard and screen reader
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end workflows
- Checkpoints ensure incremental validation throughout implementation
