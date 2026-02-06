# Requirements Document: CAT Tool Tag System Refactor

## Introduction

This document specifies the requirements for refactoring the tag system in a Computer-Assisted Translation (CAT) tool editor. The current implementation provides basic tag display and editing functionality, but needs enhancement to match professional CAT tools like Phrase, memoQ, and Trados. The refactored system will provide improved visual differentiation, enhanced manipulation capabilities, real-time validation, and comprehensive accessibility support.

## Glossary

- **Tag**: A non-translatable markup element embedded in translatable text (e.g., `<bold>`, `{1}`, `%s`)
- **Paired_Tag**: A tag that has both opening and closing elements (e.g., `<bold>` and `</bold>`)
- **Standalone_Tag**: A self-contained tag without a pair (e.g., `{1}`, `<br/>`, `%s`)
- **Tag_Capsule**: The visual representation of a tag in the editor UI
- **Source_Segment**: The original text to be translated, containing source tags
- **Target_Segment**: The translated text, which should contain corresponding target tags
- **Tag_Validation**: The process of checking tag integrity between source and target segments
- **Tag_Signature**: A computed string representing the sequence and content of tags in a segment
- **QA_Issue**: A validation error or warning related to tag integrity
- **Token**: A parsed element of a segment, either text or tag type
- **Editor_Row**: The UI component displaying source and target segments side-by-side
- **Tag_Manager**: Service responsible for tag operations and state management
- **Tag_Context_Menu**: Right-click menu providing tag-specific actions
- **Tag_Insertion_UI**: Interface for inserting tags from source into target

## Requirements

### Requirement 1: Enhanced Tag Visual Display

**User Story:** As a translator, I want clear visual distinction between different tag types, so that I can quickly identify paired tags, standalone tags, and tag validation status.

#### Acceptance Criteria

1. WHEN a paired opening tag is displayed, THE Tag_Capsule SHALL render with a left-rounded border and display format `[N` where N is the tag number
2. WHEN a paired closing tag is displayed, THE Tag_Capsule SHALL render with a right-rounded border and display format `N]` where N is the tag number
3. WHEN a standalone tag is displayed, THE Tag_Capsule SHALL render with fully rounded borders and display format `⟨N⟩` where N is the tag number
4. WHEN a tag is in the source segment, THE Tag_Capsule SHALL use light blue background with dark blue text
5. WHEN a tag is in the target segment, THE Tag_Capsule SHALL use dark blue background with white text
6. WHEN a tag has validation errors, THE Tag_Capsule SHALL display a red border or background indicator
7. WHEN a tag has validation warnings, THE Tag_Capsule SHALL display a yellow border or background indicator
8. WHEN a user hovers over a tag, THE Tag_Capsule SHALL display a tooltip showing the full tag content and metadata
9. WHEN paired tags are present, THE Tag_Capsule SHALL use consistent numbering to show pairing relationships

### Requirement 2: Tag Selection and Focus

**User Story:** As a translator, I want to select and focus individual tags, so that I can perform operations on specific tags.

#### Acceptance Criteria

1. WHEN a user clicks on a tag, THE Editor SHALL select that tag and highlight it visually
2. WHEN a tag is selected, THE Editor SHALL display a focus indicator around the tag
3. WHEN a user clicks outside a selected tag, THE Editor SHALL deselect the tag
4. WHEN multiple tags exist, THE Editor SHALL allow only one tag to be selected at a time
5. WHEN a tag is selected, THE Editor SHALL prevent text editing within the tag capsule

### Requirement 3: Tag Keyboard Navigation

**User Story:** As a translator, I want to navigate between tags using keyboard shortcuts, so that I can work efficiently without using the mouse.

#### Acceptance Criteria

1. WHEN a user presses Ctrl+Right Arrow (or Cmd+Right Arrow on Mac), THE Editor SHALL move focus to the next tag in the target segment
2. WHEN a user presses Ctrl+Left Arrow (or Cmd+Left Arrow on Mac), THE Editor SHALL move focus to the previous tag in the target segment
3. WHEN focus is on the last tag and user presses Ctrl+Right Arrow, THE Editor SHALL wrap focus to the first tag
4. WHEN focus is on the first tag and user presses Ctrl+Left Arrow, THE Editor SHALL wrap focus to the last tag
5. WHEN no tags are present and user presses tag navigation shortcuts, THE Editor SHALL maintain cursor position without error

### Requirement 4: Tag Insertion from Source

**User Story:** As a translator, I want to insert tags from the source segment into the target segment, so that I can maintain tag integrity during translation.

#### Acceptance Criteria

1. WHEN a user presses Ctrl+Shift+1 through Ctrl+Shift+9, THE Editor SHALL insert the corresponding source tag at the cursor position
2. WHEN a user presses Ctrl+Shift+0, THE Editor SHALL insert all source tags at the cursor position in their original order
3. WHEN a tag insertion shortcut is pressed and the corresponding source tag does not exist, THE Editor SHALL display a warning message
4. WHEN a tag is inserted, THE Editor SHALL maintain the cursor position immediately after the inserted tag
5. WHEN inserting all tags, THE Editor SHALL preserve spacing between tags as they appear in the source

### Requirement 5: Tag Deletion with Confirmation

**User Story:** As a translator, I want to delete tags with appropriate confirmation, so that I can avoid accidentally removing important markup.

#### Acceptance Criteria

1. WHEN a user presses Backspace with cursor immediately after a standalone tag, THE Editor SHALL delete the tag without confirmation
2. WHEN a user presses Delete with cursor immediately before a standalone tag, THE Editor SHALL delete the tag without confirmation
3. WHEN a user presses Backspace with cursor immediately after a paired tag, THE Editor SHALL delete the tag and display a warning about the unpaired tag
4. WHEN a user presses Delete with cursor immediately before a paired tag, THE Editor SHALL delete the tag and display a warning about the unpaired tag
5. WHEN a user selects a tag and presses Delete or Backspace, THE Editor SHALL delete the selected tag

### Requirement 6: Tag Copy and Paste Operations

**User Story:** As a translator, I want to copy and paste tags between segments, so that I can reuse tag structures efficiently.

#### Acceptance Criteria

1. WHEN a user copies text containing tags, THE Editor SHALL preserve tag content in the clipboard
2. WHEN a user pastes text containing tags, THE Editor SHALL parse and render the tags correctly
3. WHEN a user copies only a tag, THE Editor SHALL copy the full tag content including markup
4. WHEN a user pastes tag content at cursor position, THE Editor SHALL insert the tag as a Tag_Capsule
5. WHEN clipboard contains invalid tag syntax, THE Editor SHALL paste as plain text

### Requirement 7: Tag Drag and Drop Reordering

**User Story:** As a translator, I want to reorder tags using drag and drop, so that I can adjust tag positions to match target language word order.

#### Acceptance Criteria

1. WHEN a user clicks and drags a tag, THE Editor SHALL display a drag preview of the tag
2. WHEN a tag is being dragged, THE Editor SHALL show valid drop positions with visual indicators
3. WHEN a user drops a tag at a valid position, THE Editor SHALL move the tag to that position
4. WHEN a user drops a tag at an invalid position, THE Editor SHALL return the tag to its original position
5. WHEN a tag is moved, THE Editor SHALL trigger validation to check tag integrity

### Requirement 8: Real-Time Tag Validation

**User Story:** As a translator, I want real-time validation of tag integrity, so that I can immediately see and fix tag errors.

#### Acceptance Criteria

1. WHEN a user modifies the target segment, THE Editor SHALL validate tag integrity within 300ms
2. WHEN tags are missing from the target, THE Editor SHALL display an error message listing the missing tags
3. WHEN extra tags are present in the target, THE Editor SHALL display an error message listing the extra tags
4. WHEN tags are in wrong order, THE Editor SHALL display a warning message about tag sequence
5. WHEN all tags are correct, THE Editor SHALL clear any previous validation messages
6. WHEN validation errors exist, THE Editor SHALL highlight affected tags with error styling

### Requirement 9: Tag Pairing Visualization

**User Story:** As a translator, I want to see which opening and closing tags are paired, so that I can ensure proper tag nesting.

#### Acceptance Criteria

1. WHEN a user hovers over a paired opening tag, THE Editor SHALL highlight the corresponding closing tag
2. WHEN a user hovers over a paired closing tag, THE Editor SHALL highlight the corresponding opening tag
3. WHEN a paired tag has no matching pair, THE Editor SHALL display a visual indicator on the unpaired tag
4. WHEN multiple nested pairs exist, THE Editor SHALL use different highlight colors for different nesting levels
5. WHEN a user clicks on a paired tag, THE Editor SHALL provide an option to jump to its pair

### Requirement 10: Tag Context Menu

**User Story:** As a translator, I want a context menu for tag operations, so that I can access tag-specific actions easily.

#### Acceptance Criteria

1. WHEN a user right-clicks on a tag, THE Editor SHALL display a context menu with tag-specific options
2. WHEN the context menu is displayed, THE Editor SHALL include options to view full tag content, copy tag, delete tag, and jump to paired tag
3. WHEN a user selects "View full content" from the context menu, THE Editor SHALL display a modal or tooltip with complete tag markup
4. WHEN a user selects "Copy tag" from the context menu, THE Editor SHALL copy the tag content to clipboard
5. WHEN a user selects "Delete tag" from the context menu, THE Editor SHALL remove the tag from the segment
6. WHEN a user selects "Jump to pair" on a paired tag, THE Editor SHALL move focus to the corresponding opening or closing tag
7. WHEN a user right-clicks on a standalone tag, THE Editor SHALL not display the "Jump to pair" option

### Requirement 11: Tag Insertion UI

**User Story:** As a translator, I want a visual interface for inserting tags, so that I can insert tags without memorizing keyboard shortcuts.

#### Acceptance Criteria

1. WHEN a target segment is active, THE Editor SHALL display a tag insertion toolbar or button
2. WHEN a user clicks the tag insertion button, THE Editor SHALL display a list of available source tags
3. WHEN the tag list is displayed, THE Editor SHALL show each tag with its number, type, and preview
4. WHEN a user clicks a tag in the list, THE Editor SHALL insert that tag at the current cursor position
5. WHEN a user clicks "Insert All Tags", THE Editor SHALL insert all source tags at the cursor position
6. WHEN no source tags exist, THE Editor SHALL disable the tag insertion UI

### Requirement 12: Tag Accessibility

**User Story:** As a translator using assistive technology, I want full keyboard access and screen reader support for tag operations, so that I can work with tags effectively.

#### Acceptance Criteria

1. WHEN a screen reader encounters a tag, THE Editor SHALL announce the tag type, number, and content
2. WHEN a tag is selected via keyboard, THE Editor SHALL announce the selection to screen readers
3. WHEN tag validation errors occur, THE Editor SHALL announce the errors to screen readers
4. WHEN a user navigates with keyboard only, THE Editor SHALL provide visible focus indicators on all interactive tag elements
5. WHEN high contrast mode is enabled, THE Editor SHALL maintain sufficient contrast for all tag visual elements
6. WHEN a user uses keyboard shortcuts, THE Editor SHALL provide audio or visual feedback for successful actions

### Requirement 13: Tag Performance Optimization

**User Story:** As a translator working with large segments, I want tag operations to remain responsive, so that my workflow is not interrupted by performance issues.

#### Acceptance Criteria

1. WHEN a segment contains up to 50 tags, THE Editor SHALL render all tags within 100ms
2. WHEN tag validation is triggered, THE Editor SHALL complete validation within 300ms for segments with up to 50 tags
3. WHEN a user types in a segment with tags, THE Editor SHALL maintain responsive input with no perceptible lag
4. WHEN multiple segments are visible, THE Editor SHALL use efficient rendering to avoid unnecessary re-renders
5. WHEN tag operations are performed, THE Editor SHALL debounce validation to avoid excessive computation

### Requirement 14: Tag Data Model Enhancement

**User Story:** As a developer, I want an enhanced tag data model, so that the system can support advanced tag features and maintain data integrity.

#### Acceptance Criteria

1. WHEN a tag is parsed, THE Token SHALL include metadata for tag type, pairing information, and validation state
2. WHEN paired tags are identified, THE Token SHALL store references to the paired tag's index
3. WHEN tag validation is performed, THE Segment SHALL store validation results in the qaIssues array
4. WHEN tags are compared, THE Tag_Manager SHALL use the Tag_Signature for efficient comparison
5. WHEN tag state changes, THE Tag_Manager SHALL emit events for UI updates

### Requirement 15: Tag Error Auto-Fix Suggestions

**User Story:** As a translator, I want automatic suggestions to fix tag errors, so that I can quickly resolve validation issues.

#### Acceptance Criteria

1. WHEN a missing tag error is detected, THE Editor SHALL provide a "Fix" button to insert the missing tag
2. WHEN an extra tag error is detected, THE Editor SHALL provide a "Fix" button to remove the extra tag
3. WHEN a tag order warning is detected, THE Editor SHALL provide a "Fix" button to reorder tags to match source
4. WHEN a user clicks a "Fix" button, THE Editor SHALL apply the suggested fix and re-validate
5. WHEN multiple errors exist, THE Editor SHALL provide a "Fix All" option to apply all suggested fixes
