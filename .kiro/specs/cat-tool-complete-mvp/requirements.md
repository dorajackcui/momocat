# Requirements Document: CAT Tool - Current State & Next Steps

## Introduction

This specification documents the current state of the Simple CAT Tool and defines requirements for the next development phase (v0.3). The tool is a Computer-Assisted Translation (CAT) application built with Electron, React, and TypeScript, using a token-based architecture to ensure tag safety during translation workflows.

## Current Implementation Status (v0.2 Complete)

The system has successfully completed v0.1 (MVP) and v0.2 (Professional Threshold) with the following infrastructure:

**✅ Completed Core Infrastructure:**
- Token-based architecture with full tokenizer implementation
- Database schema v6 with Project → File → Segment hierarchy
- Multi-TM architecture (Working TM + Main TM with mounting system)
- Complete service layer (ProjectService, SegmentService, TMService)
- Spreadsheet filter (CSV/XLSX import/export with column selector)
- QA validation system with tag integrity checking
- TM fuzzy matching with Levenshtein distance
- Concordance search with FTS5 full-text indexing
- Propagation system with undo support
- Complete UI implementation (Dashboard, ProjectDetail, Editor, TM panels)

**✅ Completed Features:**
- Project and file management with multi-file support
- Token-aware segment editing
- Real-time QA validation with export blocking
- 100% and fuzzy TM matching (70-99% similarity)
- TM import wizard for building Main TMs
- Concordance search across all mounted TMs
- Automatic propagation of confirmed translations
- TM Manager for creating and mounting TMs

This spec now focuses on v0.3 enhancements: pre-translation pipeline, batch QA framework, and terminology management.

## Glossary

- **CAT_Tool**: The Computer-Assisted Translation application system
- **Token**: An atomic unit representing text, tags, whitespace, or locked content in a segment
- **Segment**: A translatable unit containing source and target Token sequences
- **TM**: Translation Memory system that stores and retrieves previous translations
- **Working_TM**: Project-specific TM automatically created and populated during translation
- **Main_TM**: Shared TM mounted to projects for reusing translations across projects
- **Tag**: Inline markup element (e.g., `<b>`, `</b>`) that must be preserved during translation
- **Tag_Signature**: Computed hash of tag structure used for validation
- **Fuzzy_Match**: TM match with similarity between 70% and 99%
- **Concordance**: Full-text search across TM entries for finding translation patterns
- **QA_Validation**: Quality assurance checks ensuring translation integrity
- **Filter**: Import/export module for specific file formats (CSV, XLSX)
- **Round_Trip**: Process of importing, editing, and exporting without data loss
- **Virtual_Scrolling**: UI technique for rendering only visible items in large lists
- **Propagation**: Automatic application of translations to identical segments

## Completed Requirements (v0.1 & v0.2)

### ✅ Requirement 1: File Import System (COMPLETED)

**User Story:** As a translator, I want to import translation files from CSV and Excel formats, so that I can work with content from various sources.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ CSV file parsing with SpreadsheetFilter
- ✅ XLSX file parsing with column selector UI
- ✅ Header detection and column mapping
- ✅ Error handling for missing required columns
- ✅ Tag tokenization with support for {}, <>, and %s patterns
- ✅ Project and file creation with proper database relationships
- ✅ Target translation preservation with status detection

### ✅ Requirement 2: File Export System (COMPLETED)

**User Story:** As a translator, I want to export completed translations back to CSV and Excel formats, so that I can deliver work in the original format.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ CSV export with proper serialization
- ✅ XLSX export with workbook creation
- ✅ Tag structure reconstruction in target
- ✅ Column order and header preservation
- ✅ Round-trip preservation (import → export → import)
- ✅ QA validation blocking on export
- ✅ File save to user-specified location

### ✅ Requirement 3: Segment List UI (COMPLETED)

**User Story:** As a translator, I want to view all segments in a scrollable list, so that I can navigate and select segments for translation.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ Virtual scrolling list for all segments
- ✅ Efficient rendering for 100+ segments
- ✅ Display of segment ID, source, target, and status
- ✅ Visual error indicators for QA issues
- ✅ Segment activation on click
- ✅ Status filtering functionality
- ✅ Smooth performance with 10,000+ segments

### ✅ Requirement 4: Token-Aware Editor (COMPLETED)

**User Story:** As a translator, I want to edit translations with visual tag protection, so that I can modify text without breaking markup structure.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ Source Token display with tag capsules
- ✅ Target Token editing with tag capsules
- ✅ Tag capsule protection (non-editable)
- ✅ Tag pair integrity during deletion
- ✅ Automatic status change to "draft" on edit
- ✅ Ctrl+Enter confirmation and navigation
- ✅ Immediate database persistence

### ✅ Requirement 5: Segment Navigation (COMPLETED)

**User Story:** As a translator, I want to navigate between segments efficiently, so that I can maintain translation flow.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ Ctrl+Down for next segment
- ✅ Ctrl+Up for previous segment
- ✅ Auto-navigation on confirmation
- ✅ Scroll-to-visible on navigation
- ✅ Boundary handling (first/last segment)

### ✅ Requirement 6: QA Validation Integration (COMPLETED)

**User Story:** As a translator, I want real-time validation of tag integrity, so that I can catch errors immediately during translation.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ Real-time tag integrity validation
- ✅ Error display in QA panel
- ✅ Visual error indicators on segments
- ✅ Confirmation blocking on errors
- ✅ Export validation and blocking
- ✅ Automatic error clearing on fix

### ✅ Requirement 7: TM Match Display (COMPLETED)

**User Story:** As a translator, I want to see TM matches for the active segment, so that I can reuse previous translations.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ TM query on segment activation
- ✅ 100% matches displayed at top
- ✅ Fuzzy matches (70-99%) with similarity percentages
- ✅ TM source indication (Working/Main)
- ✅ "No matches found" message
- ✅ Sub-500ms query response time
- ✅ Loading indicators

### ✅ Requirement 8: TM Match Application (COMPLETED)

**User Story:** As a translator, I want to apply TM matches with one click, so that I can quickly populate translations.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ One-click TM match application
- ✅ Tag structure preservation
- ✅ Status change to "draft" on application
- ✅ Tag signature validation for 100% matches
- ✅ Fuzzy match application with tag flexibility
- ✅ Visual feedback on application

### ✅ Requirement 9: Concordance Search (COMPLETED)

**User Story:** As a translator, I want to search for terms across all TM entries, so that I can find translation patterns and terminology.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ FTS5-based search across TM entries
- ✅ Source and target display with highlighting
- ✅ Up to 50 results ordered by relevance
- ✅ One-click result application
- ✅ "No results found" message
- ✅ Minimum 2-character search term
- ✅ Worker thread execution (non-blocking)

### ✅ Requirement 10: Status Management (COMPLETED)

**User Story:** As a translator, I want automatic status transitions, so that segment states reflect my work progress accurately.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ "new" status on import
- ✅ "new" → "draft" on first edit
- ✅ "confirmed" → "draft" on edit
- ✅ "draft" → "confirmed" on Ctrl+Enter
- ✅ TM entry upsert on confirmation
- ✅ Propagation to identical segments
- ✅ Undo functionality for propagation

### ✅ Requirement 11: Performance Requirements (COMPLETED)

**User Story:** As a translator, I want the tool to handle large projects smoothly, so that I can work efficiently with thousands of segments.

#### Implementation Status: COMPLETE

All acceptance criteria have been met:
- ✅ 10,000 segment project loads within 2 seconds
- ✅ 60 FPS scrolling performance
- ✅ Sub-100ms segment activation
- ✅ Sub-500ms TM query response (p95)
- ✅ Worker threads for concordance search
- ✅ 1,000+ segments/second import throughput
- ✅ 1,000+ segments/second export throughput

### ✅ Requirement 12: Data Integrity (COMPLETED)

**User Story:** As a translator, I want my work to be saved reliably, so that I never lose translation progress.

#### Implementation Status: COMPLETE

All acceptance criteria have been implemented:
- ✅ Sub-100ms database persistence
- ✅ Transaction-based writes
- ✅ Crash-resistant data preservation
- ✅ Propagation undo information storage
- ✅ Token serialization round-trip preservation
- ✅ Deterministic tag signature computation
- ✅ Concurrent update handling

---

## New Requirements (v0.3 - Efficiency Leap)

### Requirement 13: Pre-Translation Pipeline

**User Story:** As a translator, I want automatic pre-translation of segments using TM and MT, so that I can focus on reviewing rather than translating from scratch.

#### Acceptance Criteria

1. WHEN a file is imported, THE CAT_Tool SHALL offer to run pre-translation on all "new" segments
2. WHEN pre-translation runs, THE CAT_Tool SHALL first attempt TM matching for each segment
3. WHEN a 100% TM match is found, THE CAT_Tool SHALL apply it and set status to "translated"
4. WHEN a fuzzy TM match (≥85%) is found, THE CAT_Tool SHALL apply it and set status to "draft"
5. WHEN no TM match is found, THE CAT_Tool SHALL optionally call MT provider and set status to "draft"
6. WHEN pre-translation completes, THE CAT_Tool SHALL display a summary (segments filled, TM hits, MT calls)
7. WHILE pre-translation runs, THE CAT_Tool SHALL show progress and allow cancellation

### Requirement 14: Batch QA Framework

**User Story:** As a translator, I want comprehensive QA checks beyond tag validation, so that I can ensure translation quality across multiple dimensions.

#### Acceptance Criteria

1. WHEN running batch QA, THE CAT_Tool SHALL check for number consistency between source and target
2. WHEN running batch QA, THE CAT_Tool SHALL check for punctuation consistency (trailing periods, commas)
3. WHEN running batch QA, THE CAT_Tool SHALL check for whitespace issues (leading/trailing spaces, double spaces)
4. WHEN running batch QA, THE CAT_Tool SHALL check for length violations (target >150% of source length)
5. WHEN QA issues are found, THE CAT_Tool SHALL display them in a filterable QA report panel
6. WHEN viewing QA report, THE CAT_Tool SHALL allow jumping to affected segments
7. WHEN QA rules are configurable, THE CAT_Tool SHALL allow enabling/disabling specific checks

### Requirement 15: Terminology Management (TB)

**User Story:** As a translator, I want to manage terminology databases and see term suggestions during translation, so that I can maintain consistent terminology.

#### Acceptance Criteria

1. WHEN creating a termbase, THE CAT_Tool SHALL allow specifying source and target languages
2. WHEN adding terms, THE CAT_Tool SHALL store source term, target term, and optional definition
3. WHEN a segment is activated, THE CAT_Tool SHALL search for matching terms in the source text
4. WHEN terms are found, THE CAT_Tool SHALL highlight them in the source and display suggestions in a TB panel
5. WHEN a user clicks a term suggestion, THE CAT_Tool SHALL insert the target term at cursor position
6. WHEN importing termbases, THE CAT_Tool SHALL support CSV format (source, target, definition columns)
7. WHEN exporting termbases, THE CAT_Tool SHALL generate CSV files with all terms

### Requirement 16: Copy Source to Target

**User Story:** As a translator, I want to quickly copy source content to target, so that I can efficiently handle segments that don't require translation.

#### Acceptance Criteria

1. WHEN a user presses Ctrl+Shift+C, THE CAT_Tool SHALL copy all source tokens to target
2. WHEN copying source to target, THE CAT_Tool SHALL preserve all tags in their original positions
3. WHEN source is copied, THE CAT_Tool SHALL set segment status to "draft"
4. WHEN source contains locked tokens, THE CAT_Tool SHALL copy them as locked tokens in target

### Requirement 17: Insert All Tags

**User Story:** As a translator, I want to quickly insert all missing tags into target, so that I can fix tag validation errors efficiently.

#### Acceptance Criteria

1. WHEN a user presses Ctrl+Shift+T, THE CAT_Tool SHALL insert all missing tags from source into target at cursor position
2. WHEN inserting tags, THE CAT_Tool SHALL maintain tag order from source
3. WHEN all tags are inserted, THE CAT_Tool SHALL clear tag validation errors
4. WHEN target already contains all tags, THE CAT_Tool SHALL show a message "All tags present"

### Requirement 18: Performance Optimization for Large Projects

**User Story:** As a translator, I want the tool to handle 50,000+ segment projects smoothly, so that I can work on large-scale translation projects.

#### Acceptance Criteria

1. WHEN a project contains 50,000 segments, THE CAT_Tool SHALL load the segment list within 5 seconds
2. WHEN scrolling through large projects, THE CAT_Tool SHALL maintain 60 FPS performance
3. WHEN running TM queries on large TM databases (100,000+ entries), THE CAT_Tool SHALL return results within 1 second
4. WHEN importing large files (10,000+ segments), THE CAT_Tool SHALL show progress and allow cancellation
5. WHEN exporting large projects, THE CAT_Tool SHALL use streaming to avoid memory issues
6. WHEN database grows large (>1GB), THE CAT_Tool SHALL maintain query performance through proper indexing

---

## Future Considerations (v0.4+)

The following features are planned for future versions but not included in v0.3:

- **Multi-format support**: DOCX, Markdown, JSON, XML
- **Plugin system**: Custom MT providers, QA rules, file filters
- **Collaboration features**: Cloud sync, multi-user editing, comments
- **Advanced TM features**: Context matching, metadata filtering, TM maintenance
- **Machine translation integration**: OpenAI, DeepL, Google Translate APIs
- **Revision history**: Track all changes to segments with timestamps
- **Project templates**: Reusable project configurations with pre-configured TMs and QA rules

