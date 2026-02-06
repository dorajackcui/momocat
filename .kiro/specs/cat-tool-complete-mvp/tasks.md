# Implementation Plan: CAT Tool - Current State & v0.3 Roadmap

## Overview

This document tracks the implementation status of the CAT Tool and defines the roadmap for v0.3 (Efficiency Leap). 

**Current Status: v0.2 COMPLETE ✅**

All v0.1 (MVP) and v0.2 (Professional Threshold) features have been successfully implemented and are in production use. The system now has:
- Complete token-based architecture
- Multi-TM system with fuzzy matching
- Full UI implementation with virtual scrolling
- QA validation with export blocking
- Concordance search with FTS5
- Propagation with undo support

**Next Phase: v0.3 (Efficiency Leap)**

Focus areas:
1. Pre-translation pipeline (TM → MT → Draft)
2. Batch QA framework (numbers, punctuation, whitespace, length)
3. Terminology management (TB)
4. Editor productivity features (copy source, insert tags)
5. Performance optimization for 50,000+ segments

---

## Completed Tasks (v0.1 & v0.2)

### ✅ Phase 1: Core Infrastructure (COMPLETE)

- [x] 1. Set up testing infrastructure and generators
  - [x] Install `vitest` for unit testing
  - [x] Create Token array generators for tests
  - [x] Create segment and project generators
  - [x] Set up test scripts in package.json

- [x] 2. Implement Token Model
  - [x] 2.1 Create Token types and interfaces
  - [x] 2.2 Implement parseDisplayTextToTokens with pattern matching
  - [x] 2.3 Implement serializeTokensToDisplayText
  - [x] 2.4 Implement computeTagsSignature
  - [x] 2.5 Implement computeMatchKey
  - [x] 2.6 Implement computeSrcHash
  - [x] 2.7 Write comprehensive unit tests for tokenizer

- [x] 3. Implement Database Layer
  - [x] 3.1 Create schema v6 with Project → File → Segment hierarchy
  - [x] 3.2 Implement CATDatabase class with all CRUD operations
  - [x] 3.3 Add foreign key constraints and cascading deletes
  - [x] 3.4 Create indices for performance
  - [x] 3.5 Implement schema migration system
  - [x] 3.6 Write database tests

### ✅ Phase 2: File Import/Export (COMPLETE)

- [x] 4. Implement SpreadsheetFilter
  - [x] 4.1 Create CSV import function with column detection
  - [x] 4.2 Create XLSX import function with sheet selection
  - [x] 4.3 Create CSV export function with QA validation
  - [x] 4.4 Create XLSX export function
  - [x] 4.5 Implement round-trip preservation
  - [x] 4.6 Write import/export tests

- [x] 5. Create Column Selector UI
  - [x] 5.1 Build preview component showing first 10 rows
  - [x] 5.2 Add column mapping dropdowns
  - [x] 5.3 Add header detection checkbox
  - [x] 5.4 Integrate with import workflow

- [x] 6. Create IPC handlers for import/export
  - [x] 6.1 Add handlers for import:csv, import:xlsx
  - [x] 6.2 Add handlers for export:csv, export:xlsx
  - [x] 6.3 Add error handling and user feedback
  - [x] 6.4 Add progress reporting for large files

### ✅ Phase 3: QA System (COMPLETE)

- [x] 7. Implement QA Service
  - [x] 7.1 Enhance validateSegment function with tag comparison
  - [x] 7.2 Create validateProject function for batch validation
  - [x] 7.3 Implement QaIssue structure with severity levels
  - [x] 7.4 Add export blocking on validation errors
  - [x] 7.5 Write QA validation tests

- [x] 8. Create QA Panel UI
  - [x] 8.1 Build QA panel component
  - [x] 8.2 Display errors with icons and messages
  - [x] 8.3 Add collapsible behavior
  - [x] 8.4 Integrate with editor

### ✅ Phase 4: UI Implementation (COMPLETE)

- [x] 9. Implement Dashboard
  - [x] 9.1 Create project list with progress bars
  - [x] 9.2 Add create project modal
  - [x] 9.3 Add delete project functionality
  - [x] 9.4 Add project statistics display

- [x] 10. Implement ProjectDetail
  - [x] 10.1 Create file list component
  - [x] 10.2 Add file import button with column selector
  - [x] 10.3 Add file delete functionality
  - [x] 10.4 Display project-level progress

- [x] 11. Implement Segment List
  - [x] 11.1 Create virtual scrolling list
  - [x] 11.2 Add segment display with status badges
  - [x] 11.3 Add status filtering
  - [x] 11.4 Add error indicators
  - [x] 11.5 Implement segment selection

- [x] 12. Implement Editor
  - [x] 12.1 Create EditorRow component with token rendering
  - [x] 12.2 Add keyboard navigation (Ctrl+Up/Down)
  - [x] 12.3 Add confirmation (Ctrl+Enter)
  - [x] 12.4 Implement auto-save with debouncing
  - [x] 12.5 Add status management

### ✅ Phase 5: TM System (COMPLETE)

- [x] 13. Implement Multi-TM Architecture
  - [x] 13.1 Create tms, project_tms, tm_entries tables (schema v5)
  - [x] 13.2 Implement Working TM auto-creation
  - [x] 13.3 Implement TM mounting/unmounting
  - [x] 13.4 Add TM priority system

- [x] 14. Implement TMService
  - [x] 14.1 Create upsertFromConfirmedSegment function
  - [x] 14.2 Implement findMatches with 100% and fuzzy matching
  - [x] 14.3 Add Levenshtein distance calculation
  - [x] 14.4 Implement match ordering by similarity
  - [x] 14.5 Write TM service tests

- [x] 15. Create TM Panel UI
  - [x] 15.1 Build TM match display component
  - [x] 15.2 Add match application on click
  - [x] 15.3 Display similarity percentages
  - [x] 15.4 Show TM source (Working/Main)
  - [x] 15.5 Add loading and empty states

- [x] 16. Create TM Manager UI
  - [x] 16.1 Build TM list component
  - [x] 16.2 Add create TM functionality
  - [x] 16.3 Add delete TM functionality
  - [x] 16.4 Add TM mounting interface
  - [x] 16.5 Display TM statistics

- [x] 17. Implement TM Import Wizard
  - [x] 17.1 Create file selection step
  - [x] 17.2 Add column mapping step
  - [x] 17.3 Implement import with progress
  - [x] 17.4 Add overwrite option
  - [x] 17.5 Display import summary

### ✅ Phase 6: Concordance Search (COMPLETE)

- [x] 18. Implement FTS5 Search
  - [x] 18.1 Create tm_fts virtual table
  - [x] 18.2 Implement searchConcordance function
  - [x] 18.3 Add FTS synchronization on TM updates
  - [x] 18.4 Optimize search queries

- [x] 19. Create Concordance Panel UI
  - [x] 19.1 Build search input with debouncing
  - [x] 19.2 Display search results with highlighting
  - [x] 19.3 Add result application on click
  - [x] 19.4 Add loading and empty states
  - [x] 19.5 Implement minimum character validation

### ✅ Phase 7: Propagation System (COMPLETE)

- [x] 20. Implement Propagation
  - [x] 20.1 Create propagate function in SegmentService
  - [x] 20.2 Find identical segments by srcHash
  - [x] 20.3 Apply translations with draft status
  - [x] 20.4 Store undo information
  - [x] 20.5 Implement undoLastPropagation
  - [x] 20.6 Add propagation notifications

---

## New Tasks (v0.3 - Efficiency Leap)

### Phase 8: Pre-Translation Pipeline

- [ ] 21. Implement Pre-Translation Service
  - [ ] 21.1 Create PreTranslationService class
    - Design pipeline: TM lookup → MT fallback → status assignment
    - Implement batch processing with progress reporting
    - Add cancellation support
    - _Requirements: 13.1, 13.2, 13.7_

  - [ ] 21.2 Implement TM-based pre-translation
    - Query TM for each "new" segment
    - Apply 100% matches with "translated" status
    - Apply fuzzy matches (≥85%) with "draft" status
    - Track TM hit statistics
    - _Requirements: 13.3, 13.4_

  - [ ] 21.3 Implement MT provider interface
    - Define abstract MTProvider interface
    - Create mock MT provider for testing
    - Implement MT call with error handling
    - Set "draft" status for MT results
    - _Requirements: 13.5_

  - [ ] 21.4 Create pre-translation summary
    - Count segments filled by TM
    - Count segments filled by MT
    - Count segments remaining empty
    - Display processing time
    - _Requirements: 13.6_

  - [ ]* 21.5 Write unit tests for pre-translation
    - Test TM matching logic
    - Test MT fallback behavior
    - Test status assignment
    - Test cancellation

- [ ] 22. Create Pre-Translation UI
  - [ ] 22.1 Add pre-translation button to ProjectDetail
    - Show button after file import
    - Display confirmation dialog with options
    - Show progress modal during processing
    - _Requirements: 13.1, 13.7_

  - [ ] 22.2 Create pre-translation progress modal
    - Display current segment being processed
    - Show progress bar (segments processed / total)
    - Add cancel button
    - Update in real-time via IPC events
    - _Requirements: 13.7_

  - [ ] 22.3 Create pre-translation summary dialog
    - Display statistics (TM hits, MT calls, empty)
    - Show processing time
    - Add "View Results" button to open editor
    - _Requirements: 13.6_

- [ ] 23. Add IPC handlers for pre-translation
  - Add handler for pretranslate:start
  - Add handler for pretranslate:cancel
  - Add progress event emitter
  - Add error handling

### Phase 9: Batch QA Framework

- [ ] 24. Implement QA Rules
  - [ ] 24.1 Create QA rule interface
    - Define QARule abstract class
    - Implement rule registration system
    - Add rule enable/disable configuration
    - _Requirements: 14.7_

  - [ ] 24.2 Implement NumberConsistencyRule
    - Extract numbers from source and target
    - Compare number counts and values
    - Report missing or extra numbers
    - _Requirements: 14.1_

  - [ ] 24.3 Implement PunctuationConsistencyRule
    - Check trailing punctuation (. , ! ? : ;)
    - Compare source and target endings
    - Report mismatches
    - _Requirements: 14.2_

  - [ ] 24.4 Implement WhitespaceRule
    - Check for leading/trailing spaces
    - Check for double spaces
    - Check for tab characters
    - _Requirements: 14.3_

  - [ ] 24.5 Implement LengthViolationRule
    - Calculate source and target lengths
    - Check if target > 150% of source
    - Report violations with percentages
    - _Requirements: 14.4_

  - [ ]* 24.6 Write unit tests for QA rules
    - Test each rule with positive and negative cases
    - Test edge cases (empty strings, special characters)
    - Test rule configuration

- [ ] 25. Create QA Report UI
  - [ ] 25.1 Build QA report panel component
    - Display all QA issues in a table
    - Show segment ID, rule name, severity, message
    - Add filtering by rule type and severity
    - _Requirements: 14.5_

  - [ ] 25.2 Add segment navigation from QA report
    - Make segment IDs clickable
    - Jump to segment in editor on click
    - Highlight affected segment
    - _Requirements: 14.6_

  - [ ] 25.3 Add batch QA trigger
    - Add "Run QA" button to toolbar
    - Show progress during batch QA
    - Display report when complete
    - _Requirements: 14.5_

  - [ ] 25.4 Create QA settings panel
    - List all available QA rules
    - Add enable/disable checkboxes
    - Save configuration to database
    - _Requirements: 14.7_

### Phase 10: Terminology Management

- [ ] 26. Implement Termbase Data Model
  - [ ] 26.1 Create termbase schema
    - Add termbases table (id, name, srcLang, tgtLang)
    - Add terms table (id, termbaseId, source, target, definition)
    - Add project_termbases junction table
    - Create indices for term lookup
    - _Requirements: 15.1, 15.2_

  - [ ] 26.2 Implement TermbaseService
    - Create createTermbase function
    - Create addTerm function
    - Create searchTerms function (exact and fuzzy)
    - Create importTermbase function (CSV)
    - Create exportTermbase function (CSV)
    - _Requirements: 15.1, 15.2, 15.6, 15.7_

  - [ ]* 26.3 Write termbase service tests
    - Test term CRUD operations
    - Test term search (exact and fuzzy)
    - Test CSV import/export
    - Test termbase mounting

- [ ] 27. Implement Term Matching
  - [ ] 27.1 Create term matching algorithm
    - Tokenize source text into words
    - Search for each word in termbase
    - Support multi-word terms
    - Return matches with positions
    - _Requirements: 15.3_

  - [ ] 27.2 Integrate term matching with editor
    - Run term matching on segment activation
    - Highlight matched terms in source
    - Display matches in TB panel
    - _Requirements: 15.3, 15.4_

  - [ ]* 27.3 Write term matching tests
    - Test single-word term matching
    - Test multi-word term matching
    - Test case-insensitive matching
    - Test overlapping terms

- [ ] 28. Create Termbase UI
  - [ ] 28.1 Build TB panel component
    - Display matched terms with definitions
    - Show source and target terms
    - Add "Insert" button for each term
    - _Requirements: 15.4, 15.5_

  - [ ] 28.2 Implement term insertion
    - Insert target term at cursor position
    - Preserve surrounding text
    - Set segment status to "draft"
    - _Requirements: 15.5_

  - [ ] 28.3 Create TB Manager UI
    - List all termbases
    - Add create/delete termbase functionality
    - Add import/export buttons
    - Display term counts
    - _Requirements: 15.1, 15.6, 15.7_

  - [ ] 28.4 Create term editor dialog
    - Add form for source, target, definition
    - Support inline term addition
    - Add validation
    - _Requirements: 15.2_

### Phase 11: Editor Productivity Features

- [ ] 29. Implement Copy Source to Target
  - [ ] 29.1 Add copySourceToTarget function
    - Copy all source tokens to target
    - Preserve tag structures
    - Set status to "draft"
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ] 29.2 Add keyboard shortcut (Ctrl+Shift+C)
    - Register shortcut in editor
    - Call copySourceToTarget on trigger
    - Show visual feedback
    - _Requirements: 16.1_

  - [ ]* 29.3 Write copy source tests
    - Test token copying
    - Test tag preservation
    - Test status change
    - Test locked token handling

- [ ] 30. Implement Insert All Tags
  - [ ] 30.1 Add insertAllTags function
    - Find missing tags in target
    - Insert at cursor position
    - Maintain source tag order
    - Clear validation errors
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ] 30.2 Add keyboard shortcut (Ctrl+Shift+T)
    - Register shortcut in editor
    - Call insertAllTags on trigger
    - Show message if all tags present
    - _Requirements: 17.1, 17.4_

  - [ ]* 30.3 Write insert tags tests
    - Test tag insertion
    - Test tag ordering
    - Test error clearing
    - Test "all tags present" case

### Phase 12: Performance Optimization

- [ ] 31. Optimize Database Queries
  - [ ] 31.1 Add database query profiling
    - Log slow queries (>100ms)
    - Identify bottlenecks
    - _Requirements: 18.3_

  - [ ] 31.2 Optimize TM queries for large databases
    - Add covering indices
    - Implement query result caching
    - Use prepared statements
    - _Requirements: 18.3_

  - [ ] 31.3 Optimize segment loading
    - Implement cursor-based pagination
    - Add segment metadata caching
    - Reduce JSON parsing overhead
    - _Requirements: 18.1, 18.2_

  - [ ]* 31.4 Write performance benchmarks
    - Benchmark 50,000 segment project load
    - Benchmark TM queries on 100,000 entries
    - Benchmark scrolling performance
    - _Requirements: 18.1, 18.2, 18.3_

- [ ] 32. Optimize Import/Export
  - [ ] 32.1 Implement streaming import
    - Process files in chunks
    - Show progress for large files
    - Allow cancellation
    - _Requirements: 18.4_

  - [ ] 32.2 Implement streaming export
    - Write segments in batches
    - Avoid loading all segments into memory
    - Show progress
    - _Requirements: 18.5_

  - [ ]* 32.3 Write import/export performance tests
    - Test 10,000 segment import
    - Test 10,000 segment export
    - Measure memory usage
    - _Requirements: 18.4, 18.5_

- [ ] 33. Database Maintenance
  - [ ] 33.1 Implement VACUUM command
    - Add database optimization function
    - Run on application startup if needed
    - _Requirements: 18.6_

  - [ ] 33.2 Add index maintenance
    - Rebuild indices periodically
    - Update statistics
    - _Requirements: 18.6_

  - [ ] 33.3 Monitor database size
    - Display database size in settings
    - Warn if size exceeds threshold
    - _Requirements: 18.6_

### Phase 13: Testing & Documentation

- [ ] 34. Comprehensive Testing
  - [ ] 34.1 Write integration tests for v0.3 features
    - Test pre-translation end-to-end
    - Test batch QA workflow
    - Test termbase integration
    - Test editor productivity features

  - [ ] 34.2 Write performance tests
    - Test 50,000 segment project
    - Test large TM database (100,000 entries)
    - Test large termbase (10,000 terms)

  - [ ] 34.3 Update existing tests
    - Ensure all v0.1 and v0.2 tests still pass
    - Add missing test coverage
    - Fix flaky tests

- [ ] 35. Documentation
  - [ ] 35.1 Update user documentation
    - Document pre-translation feature
    - Document batch QA usage
    - Document termbase management
    - Document keyboard shortcuts

  - [ ] 35.2 Update developer documentation
    - Document new services and APIs
    - Update architecture diagrams
    - Document database schema changes

  - [ ] 35.3 Create video tutorials
    - Pre-translation workflow
    - QA report usage
    - Termbase creation and usage

---

## Task Conventions

- `[ ]` = Not started
- `[x]` = Completed
- `[ ]*` = Optional task (can be skipped if time-constrained)
- Each task includes requirement references for traceability
- Sub-tasks should be completed before marking parent task as done

## Estimated Timeline

- **Phase 8 (Pre-Translation)**: 2-3 weeks
- **Phase 9 (Batch QA)**: 2 weeks
- **Phase 10 (Terminology)**: 3-4 weeks
- **Phase 11 (Productivity)**: 1 week
- **Phase 12 (Performance)**: 2 weeks
- **Phase 13 (Testing & Docs)**: 1-2 weeks

**Total v0.3 Estimate**: 11-15 weeks

## Success Criteria

v0.3 will be considered complete when:
- [ ] All non-optional tasks are completed
- [ ] All tests pass (unit, integration, performance)
- [ ] Pre-translation can process 1,000 segments in <30 seconds
- [ ] Batch QA can check 10,000 segments in <10 seconds
- [ ] Termbase can match terms in <50ms per segment
- [ ] 50,000 segment projects load and scroll smoothly
- [ ] User documentation is complete and accurate
