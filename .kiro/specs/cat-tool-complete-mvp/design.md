# Design Document: CAT Tool Complete MVP

## Overview

This design document specifies the implementation approach for completing the Simple CAT Tool MVP. The system builds upon existing infrastructure (token model, database schema v6, TM system, services) to deliver a fully functional Computer-Assisted Translation tool.

The design follows a token-based architecture where all text content is represented as Token sequences rather than plain strings. This ensures tag safety throughout the translation workflow - tags cannot be accidentally broken or corrupted during editing, import, or export operations.

### Key Design Principles

1. **Token-First Architecture**: All text manipulation operates on Token arrays, never plain strings
2. **Offline-First**: SQLite is the source of truth; all operations work without network connectivity
3. **Worker-Based Heavy Operations**: File parsing, TM queries, and concordance search run in Worker threads
4. **Virtual Rendering**: UI renders only visible segments to handle 10,000+ segment projects
5. **Immediate Persistence**: All user edits persist to database within 100ms
6. **Service Layer Pattern**: Business logic encapsulated in service classes (ProjectService, SegmentService, TMService)

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    React UI Layer                        │
│  (SegmentList, TokenEditor, TMPanel, ConcordancePanel)  │
└─────────────────────────────────────────────────────────┘
                          ↕ IPC
┌─────────────────────────────────────────────────────────┐
│                  Electron Main Process                   │
│              (IPC Handlers, JobManager)                  │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                         │
│  (ProjectService, SegmentService, TMService, QAService) │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                   Data Access Layer                      │
│              (SQLite Database, Token Model)              │
└─────────────────────────────────────────────────────────┘
```

## Architecture

### Component Overview

The system consists of five major subsystems:

1. **Filter System**: Import/export modules for CSV and XLSX formats
2. **UI System**: React components for segment display and editing
3. **QA System**: Validation engine with real-time error detection
4. **TM Integration**: UI components for displaying and applying TM matches
5. **Concordance System**: Search interface with FTS5-backed queries

### Token Model (Existing)

The Token model is the foundation of tag safety. Each Token has a type and content:

```typescript
type TokenType = 'text' | 'tag' | 'ws' | 'locked';

interface Token {
  type: TokenType;
  content: string;
  tagId?: string;      // For tag tokens: unique identifier
  tagType?: 'open' | 'close' | 'self';  // For tag tokens
}
```

**Token Parsing**: Raw strings are parsed into Token arrays by detecting tag patterns (`<...>`). Tags are assigned unique IDs to track pairs.

**Token Serialization**: Token arrays are serialized back to strings by concatenating content fields, preserving exact tag structure.

**Tag Signature**: Computed by extracting tag tokens, sorting by tagId, and hashing the structure. Used for validation and 100% match detection.

### Database Schema (Existing - v6)

```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  srcLang TEXT NOT NULL,
  tgtLang TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- Files table
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  name TEXT NOT NULL,
  totalSegments INTEGER DEFAULT 0,
  confirmedSegments INTEGER DEFAULT 0,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

-- Segments table
CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  fileId TEXT NOT NULL,
  segmentId TEXT NOT NULL,
  srcTokens TEXT NOT NULL,  -- JSON array of Tokens
  tgtTokens TEXT NOT NULL,  -- JSON array of Tokens
  status TEXT DEFAULT 'new',
  srcHash TEXT,             -- For 100% match detection
  matchKey TEXT,            -- Normalized source for fuzzy matching
  tagSignature TEXT,        -- For tag validation
  FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE
);

-- TMs table
CREATE TABLE tms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  srcLang TEXT NOT NULL,
  tgtLang TEXT NOT NULL,
  isWorking INTEGER DEFAULT 0
);

-- TM entries table
CREATE TABLE tm_entries (
  id TEXT PRIMARY KEY,
  tmId TEXT NOT NULL,
  srcTokens TEXT NOT NULL,
  tgtTokens TEXT NOT NULL,
  srcHash TEXT NOT NULL,
  matchKey TEXT NOT NULL,
  tagSignature TEXT,
  FOREIGN KEY (tmId) REFERENCES tms(id) ON DELETE CASCADE
);

-- Project-TM junction table
CREATE TABLE project_tms (
  projectId TEXT NOT NULL,
  tmId TEXT NOT NULL,
  PRIMARY KEY (projectId, tmId),
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (tmId) REFERENCES tms(id) ON DELETE CASCADE
);

-- FTS5 virtual table for concordance
CREATE VIRTUAL TABLE tm_fts USING fts5(
  entryId UNINDEXED,
  srcText,
  tgtText,
  content=tm_entries,
  content_rowid=id
);
```

## Components and Interfaces

### 1. Filter System

#### CSV Filter

**Purpose**: Import and export CSV files following the spreadsheet protocol.

**Spreadsheet Protocol**:
- Required columns: `id`, `source`
- Optional columns: `target`, `status`
- First row contains headers (case-insensitive matching)
- Delimiter: comma (`,`)
- Quoting: RFC 4180 standard (double quotes, escaped as `""`)

**Import Process**:
```typescript
interface CSVImportOptions {
  filePath: string;
  projectName: string;
  srcLang: string;
  tgtLang: string;
}

interface CSVImportResult {
  projectId: string;
  fileId: string;
  segmentCount: number;
  errors: string[];
}

async function importCSV(options: CSVImportOptions): Promise<CSVImportResult>
```

**Import Steps**:
1. Parse CSV file using a CSV parsing library (e.g., `papaparse`)
2. Detect headers by reading first row
3. Map columns to protocol fields (id → segmentId, source → srcTokens, etc.)
4. Validate required columns exist
5. For each data row:
   - Parse source content into Token array using `parseTokens(source)`
   - Parse target content into Token array (if present)
   - Compute srcHash, matchKey, tagSignature
   - Create segment record
6. Create project and file records
7. Insert all records in a single transaction
8. Return result with projectId and counts

**Export Process**:
```typescript
interface CSVExportOptions {
  projectId: string;
  outputPath: string;
}

async function exportCSV(options: CSVExportOptions): Promise<void>
```

**Export Steps**:
1. Run QA validation on all segments
2. If errors exist, throw error with details
3. Query all segments for project
4. For each segment:
   - Serialize srcTokens to string using `serializeTokens(tokens)`
   - Serialize tgtTokens to string
   - Build CSV row with id, source, target, status
5. Write CSV file with headers
6. Save to outputPath

#### XLSX Filter

**Purpose**: Import and export Excel workbooks following the spreadsheet protocol.

**Import Process**:
```typescript
interface XLSXImportOptions {
  filePath: string;
  projectName: string;
  srcLang: string;
  tgtLang: string;
  sheetIndex?: number;  // Default: 0 (first sheet)
}

async function importXLSX(options: XLSXImportOptions): Promise<CSVImportResult>
```

**Import Steps**:
1. Parse XLSX file using `xlsx` library
2. Extract first worksheet (or specified sheet)
3. Read first row as headers
4. Map columns to protocol fields
5. Follow same validation and tokenization as CSV import
6. Create project, file, and segment records in transaction

**Export Process**:
```typescript
interface XLSXExportOptions {
  projectId: string;
  outputPath: string;
  sheetName?: string;  // Default: "Translations"
}

async function exportXLSX(options: XLSXExportOptions): Promise<void>
```

**Export Steps**:
1. Run QA validation on all segments
2. If errors exist, throw error with details
3. Query all segments for project
4. Build worksheet data array with headers and rows
5. Create workbook using `xlsx` library
6. Write to outputPath

#### Filter Service Integration

**IPC Handlers**:
```typescript
// In main process
ipcMain.handle('import:csv', async (event, options: CSVImportOptions) => {
  return await importCSV(options);
});

ipcMain.handle('import:xlsx', async (event, options: XLSXImportOptions) => {
  return await importXLSX(options);
});

ipcMain.handle('export:csv', async (event, options: CSVExportOptions) => {
  return await exportCSV(options);
});

ipcMain.handle('export:xlsx', async (event, options: XLSXExportOptions) => {
  return await exportXLSX(options);
});
```

### 2. UI System

#### Segment List Component

**Purpose**: Display all segments in a virtual scrolling list for performance with large projects.

**Component Interface**:
```typescript
interface SegmentListProps {
  projectId: string;
  activeSegmentId: string | null;
  statusFilter: SegmentStatus | 'all';
  onSegmentSelect: (segmentId: string) => void;
}

interface SegmentListItem {
  id: string;
  segmentId: string;
  srcText: string;      // Serialized for display
  tgtText: string;      // Serialized for display
  status: SegmentStatus;
  hasErrors: boolean;
}
```

**Virtual Scrolling Implementation**:
- Use `react-window` or `react-virtual` library
- Render only visible rows plus 10-row buffer above/below
- Fixed row height: 80px
- Estimated total height: rowCount × 80px
- Scroll to active segment when selection changes

**Data Loading**:
- Load all segment metadata on project open (id, segmentId, status, hasErrors)
- Store in React state or context
- Apply status filter in memory (fast array filter)
- Pass filtered array to virtual list

**Visual Design**:
- Each row shows: segment ID (left), source text (truncated), target text (truncated), status badge (right)
- Active segment: highlighted background (blue-100)
- Error segments: red border and error icon
- Status badges: color-coded (new=gray, draft=yellow, confirmed=green)

#### Token Editor Component

**Purpose**: Display and edit Token sequences with visual tag protection.

**Component Interface**:
```typescript
interface TokenEditorProps {
  tokens: Token[];
  readOnly: boolean;
  onChange: (tokens: Token[]) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}
```

**Tag Capsule Rendering**:
- Text tokens: rendered as editable `<span contentEditable>`
- Tag tokens: rendered as non-editable `<span>` with distinct styling
  - Background: gray-200
  - Border: 1px solid gray-400
  - Padding: 2px 6px
  - Border radius: 4px
  - Content: tag name (e.g., "b", "/b")
- Whitespace tokens: rendered as editable spaces
- Locked tokens: rendered as non-editable capsules (similar to tags)

**Editing Behavior**:
- User can type in text token spans
- User can delete text tokens
- User cannot edit tag capsule content
- User cannot partially delete tags (delete key removes entire capsule)
- Backspace at tag boundary removes entire tag capsule
- Arrow keys navigate between tokens

**Implementation Approach**:
- Use `contentEditable` div with custom key handlers
- Render tokens as inline spans
- Intercept keyboard events to prevent tag corruption
- On input change, parse contentEditable content back to Token array
- Detect tag boundaries using data attributes on spans

#### Segment Editor Container

**Purpose**: Orchestrate segment editing, status management, and navigation.

**Component Interface**:
```typescript
interface SegmentEditorProps {
  segmentId: string;
  onNavigate: (direction: 'next' | 'prev') => void;
}

interface SegmentEditorState {
  srcTokens: Token[];
  tgtTokens: Token[];
  status: SegmentStatus;
  validationErrors: ValidationError[];
}
```

**Behavior**:
1. Load segment data on mount (via IPC)
2. Display source tokens in read-only TokenEditor
3. Display target tokens in editable TokenEditor
4. On target change:
   - Update local state immediately
   - Debounce database save (100ms)
   - Set status to "draft" if not already
   - Trigger QA validation
5. On Ctrl+Enter:
   - Validate segment (check for errors)
   - If valid: set status to "confirmed", trigger TM upsert, navigate next
   - If invalid: show error message, prevent confirmation
6. On Ctrl+Up/Down: call onNavigate callback

**Status Flow**:
```
new → (first edit) → draft → (Ctrl+Enter) → confirmed
confirmed → (edit) → draft
```

#### QA Panel Component

**Purpose**: Display validation errors and warnings for the active segment.

**Component Interface**:
```typescript
interface QAPanelProps {
  errors: ValidationError[];
}

interface ValidationError {
  type: 'tag_mismatch' | 'missing_tag' | 'extra_tag';
  message: string;
  severity: 'error' | 'warning';
}
```

**Visual Design**:
- Panel positioned below editor
- Each error: icon (red X or yellow !), message text
- Collapsible when no errors
- Expanded automatically when errors appear

### 3. QA System Integration

#### QA Service (Existing - Enhance)

**Purpose**: Validate segment integrity, focusing on tag structure.

**Validation Functions**:
```typescript
interface QAService {
  validateSegment(srcTokens: Token[], tgtTokens: Token[]): ValidationError[];
  validateProject(projectId: string): ProjectValidationResult;
}

interface ProjectValidationResult {
  totalSegments: number;
  errorSegments: number;
  errors: Array<{ segmentId: string; errors: ValidationError[] }>;
}
```

**Tag Validation Logic**:
1. Extract tag tokens from source and target
2. Compute tag signatures for both
3. Compare signatures:
   - If identical: pass
   - If different: identify missing/extra tags
4. Return ValidationError array

**Real-Time Validation**:
- Trigger on every target token change
- Run in main process (fast enough for real-time)
- Return errors to renderer via IPC response
- Update QA panel immediately

**Export-Time Validation**:
- Run `validateProject()` before export
- If any errors exist, throw error with segment IDs
- Display error dialog in UI with list of problematic segments
- Prevent export until errors are fixed

### 4. TM Integration UI

#### TM Match Panel Component

**Purpose**: Display TM matches for the active segment and allow one-click application.

**Component Interface**:
```typescript
interface TMMatchPanelProps {
  segmentId: string;
  onApplyMatch: (match: TMMatch) => void;
}

interface TMMatch {
  id: string;
  srcTokens: Token[];
  tgtTokens: Token[];
  similarity: number;  // 70-100
  tmName: string;      // "Working TM" or Main TM name
  isWorking: boolean;
}
```

**Data Loading**:
1. On segment activation, send IPC request: `tm:findMatches`
2. TMService queries database:
   - Check for 100% match via srcHash
   - Run fuzzy matching via Levenshtein on matchKey
   - Return matches sorted by similarity (100% first, then descending)
3. Receive matches in renderer, update panel state

**Visual Design**:
- Panel positioned on right side of editor
- Section for 100% matches (green background)
- Section for fuzzy matches (yellow background)
- Each match shows:
  - Similarity percentage (e.g., "95%")
  - TM source badge (e.g., "Working TM", "Main TM")
  - Source text (truncated)
  - Target text (truncated)
  - "Apply" button
- Loading state: spinner while querying
- Empty state: "No matches found" message

**Apply Match Behavior**:
1. User clicks "Apply" button
2. Copy match tgtTokens to segment target
3. Update editor state immediately
4. Set segment status to "draft"
5. Persist to database
6. Trigger QA validation
7. Show brief success feedback (e.g., green flash on editor)

#### TM Service Enhancement (Existing - Add IPC Handler)

**IPC Handler**:
```typescript
ipcMain.handle('tm:findMatches', async (event, segmentId: string) => {
  const segment = await SegmentService.getById(segmentId);
  const matches = await TMService.findMatches(
    segment.srcTokens,
    segment.fileId  // To get project TMs
  );
  return matches;
});
```

### 5. Concordance System UI

#### Concordance Panel Component

**Purpose**: Provide full-text search across TM entries with result application.

**Component Interface**:
```typescript
interface ConcordancePanelProps {
  projectId: string;
  onApplyResult: (result: ConcordanceResult) => void;
}

interface ConcordanceResult {
  id: string;
  srcText: string;
  tgtText: string;
  srcTokens: Token[];
  tgtTokens: Token[];
  tmName: string;
}
```

**Search Implementation**:
1. User types search term in input field
2. Debounce input (300ms)
3. If term length < 2, show prompt message
4. Send IPC request: `concordance:search`
5. Main process queries FTS5 table:
   ```sql
   SELECT entryId, srcText, tgtText
   FROM tm_fts
   WHERE tm_fts MATCH ?
   ORDER BY rank
   LIMIT 50
   ```
6. Join with tm_entries to get Token data
7. Return results to renderer
8. Highlight search term in displayed text

**Visual Design**:
- Panel positioned as modal or side panel
- Search input at top
- Results list below (scrollable)
- Each result shows:
  - Source text with search term highlighted (yellow background)
  - Target text
  - TM source badge
  - "Apply" button
- Loading state: spinner while searching
- Empty state: "No results found" or "Enter at least 2 characters"

**Apply Result Behavior**:
1. User clicks "Apply" button on a result
2. Copy result tgtTokens to active segment target
3. Update editor state
4. Set segment status to "draft"
5. Persist to database
6. Close concordance panel (optional)
7. Show success feedback

**Worker Thread Implementation**:
- FTS5 queries can be slow on large TM databases
- Run search in Worker thread to prevent UI blocking
- Use JobManager (existing infrastructure)
- Job type: `concordance-search`
- Job payload: `{ searchTerm: string, projectId: string }`
- Job result: `ConcordanceResult[]`

## Data Models

### Token Model (Existing)

Already defined in core package. No changes needed.

### Segment Model (Existing)

Already defined in database schema. No changes needed.

### TM Match Model

```typescript
interface TMMatch {
  id: string;
  srcTokens: Token[];
  tgtTokens: Token[];
  similarity: number;
  tmName: string;
  isWorking: boolean;
  srcHash: string;
  tagSignature: string;
}
```

### Concordance Result Model

```typescript
interface ConcordanceResult {
  id: string;
  srcText: string;
  tgtText: string;
  srcTokens: Token[];
  tgtTokens: Token[];
  tmName: string;
  highlightRanges: Array<{ start: number; end: number }>;  // For highlighting
}
```

### Validation Error Model

```typescript
interface ValidationError {
  type: 'tag_mismatch' | 'missing_tag' | 'extra_tag' | 'tag_order';
  message: string;
  severity: 'error' | 'warning';
  details?: {
    expected?: string[];
    actual?: string[];
    missing?: string[];
    extra?: string[];
  };
}
```

### Import/Export Models

```typescript
interface ImportOptions {
  filePath: string;
  projectName: string;
  srcLang: string;
  tgtLang: string;
  format: 'csv' | 'xlsx';
  sheetIndex?: number;  // For XLSX
}

interface ImportResult {
  projectId: string;
  fileId: string;
  segmentCount: number;
  errors: string[];
  warnings: string[];
}

interface ExportOptions {
  projectId: string;
  outputPath: string;
  format: 'csv' | 'xlsx';
  sheetName?: string;  // For XLSX
}

interface ExportResult {
  success: boolean;
  filePath: string;
  segmentCount: number;
  errors: string[];
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

1. **UI rendering properties** (3.3, 3.4, 4.1, 4.2) can be consolidated into comprehensive rendering tests
2. **Status transition properties** (4.5, 10.2, 10.3, 10.4) overlap and can be combined into state machine properties
3. **Navigation properties** (5.1, 5.2) are inverse operations and can be tested together
4. **TM match display properties** (7.2, 7.3, 7.4) can be combined into a single ordering property
5. **Export validation properties** (2.6, 6.5, 6.6) overlap and can be consolidated
6. **Tag preservation properties** (2.3, 8.2) are similar and can be unified

The following properties represent the minimal set needed for comprehensive validation, eliminating logical redundancy while maintaining complete coverage.

### Import/Export Properties

**Property 1: CSV Import Parsing**
*For any* valid CSV file following the spreadsheet protocol (with id and source columns), importing the file should create segment records with correctly tokenized source content and proper database relationships.
**Validates: Requirements 1.1, 1.3, 1.5, 1.6**

**Property 2: XLSX Import Parsing**
*For any* valid XLSX file following the spreadsheet protocol (with id and source columns), importing the file should create segment records with correctly tokenized source content from the first worksheet.
**Validates: Requirements 1.2, 1.3, 1.5, 1.6**

**Property 3: Import Error Handling**
*For any* spreadsheet file missing required columns (id or source), importing should return a descriptive error and create no database records.
**Validates: Requirements 1.4**

**Property 4: Target Preservation on Import**
*For any* spreadsheet file containing target translations, importing should preserve the target content exactly as Token sequences with appropriate status.
**Validates: Requirements 1.7**

**Property 5: CSV Export Serialization**
*For any* project with segments, exporting to CSV should produce a file with id, source, target, and status columns where all Token sequences are correctly serialized.
**Validates: Requirements 2.1, 2.3**

**Property 6: XLSX Export Serialization**
*For any* project with segments, exporting to XLSX should produce a workbook with segments in the first worksheet where all Token sequences are correctly serialized.
**Validates: Requirements 2.2, 2.3**

**Property 7: Round-Trip Preservation**
*For any* valid spreadsheet file (CSV or XLSX), importing then exporting then re-importing should produce equivalent segment data (same Token sequences, same metadata).
**Validates: Requirements 2.4, 2.5**

**Property 8: Export Validation Blocking**
*For any* project containing segments with QA validation errors, attempting to export should fail with error details and no file should be created.
**Validates: Requirements 2.6, 6.5, 6.6**

### Token and Tag Properties

**Property 9: Token Serialization Round-Trip**
*For any* Token array, serializing to string then parsing back to Tokens should produce an equivalent Token array with identical types, content, and tag IDs.
**Validates: Requirements 12.5**

**Property 10: Tag Signature Determinism**
*For any* Token array containing tags, computing the tag signature multiple times should always produce the same hash value.
**Validates: Requirements 12.6**

**Property 11: Tag Tokenization**
*For any* string containing well-formed HTML-like tags (e.g., `<b>`, `</b>`, `<img/>`), parsing should produce Token arrays where tags are identified as 'tag' type tokens with correct tagType (open/close/self).
**Validates: Requirements 1.5**

**Property 12: Tag Pair Integrity During Editing**
*For any* Token array with matched tag pairs, performing delete operations should never result in unpaired tags (orphaned open or close tags).
**Validates: Requirements 4.4**

**Property 13: Tag Capsule Protection**
*For any* tag Token in the editor, attempting to edit the tag content should leave the tag unchanged.
**Validates: Requirements 4.3**

### Segment Status Properties

**Property 14: Status State Machine**
*For any* segment, the status transitions should follow the state machine:
- new → (first edit) → draft
- draft → (confirm) → confirmed
- confirmed → (edit) → draft
No other transitions should be possible.
**Validates: Requirements 4.5, 10.1, 10.2, 10.3, 10.4**

**Property 15: Segment Persistence**
*For any* segment modification, the changes should be persisted to the database and retrievable via query within a reasonable time.
**Validates: Requirements 4.7**

### Navigation Properties

**Property 16: Bidirectional Navigation**
*For any* segment position in a list (not at boundaries), navigating next then previous should return to the original segment.
**Validates: Requirements 5.1, 5.2**

**Property 17: Smart Confirmation Navigation**
*For any* project with mixed segment statuses, confirming a segment should navigate to the next segment with status "new" or "draft", skipping confirmed segments.
**Validates: Requirements 5.3**

### QA Validation Properties

**Property 18: Tag Integrity Validation**
*For any* source and target Token arrays, if the tag signatures differ, validation should return errors identifying missing or extra tags.
**Validates: Requirements 6.1, 6.2, 6.3**

**Property 19: Confirmation Blocking on Errors**
*For any* segment with validation errors, attempting to confirm the segment should fail and status should remain unchanged.
**Validates: Requirements 6.4**

**Property 20: Error Clearing on Fix**
*For any* segment with validation errors, modifying the target to fix the errors should result in validation passing and error indicators being cleared.
**Validates: Requirements 6.7**

### TM Properties

**Property 21: TM Match Ordering**
*For any* segment with TM matches, the match panel should display 100% matches first (sorted by TM priority), followed by fuzzy matches in descending similarity order (99% to 70%).
**Validates: Requirements 7.2, 7.3**

**Property 22: TM Source Indication**
*For any* TM match displayed, the UI should clearly indicate whether the match comes from Working_TM or a Main_TM.
**Validates: Requirements 7.4**

**Property 23: TM Match Application**
*For any* TM match, applying the match should copy the match's target Token array to the segment target, preserving all tag structures exactly.
**Validates: Requirements 8.1, 8.2**

**Property 24: TM Match Status Transition**
*For any* segment, applying a TM match should set the segment status to "draft".
**Validates: Requirements 8.3**

**Property 25: 100% Match Validation**
*For any* 100% TM match, applying the match should only succeed if the tag signatures of source and match source are identical.
**Validates: Requirements 8.4**

**Property 26: Fuzzy Match Permissiveness**
*For any* fuzzy TM match (70-99% similarity), applying the match should succeed even if tag signatures differ.
**Validates: Requirements 8.5**

**Property 27: TM Upsert on Confirmation**
*For any* segment, confirming the segment should create or update a TM entry in the Working_TM with the segment's source and target Token arrays.
**Validates: Requirements 10.5**

### Concordance Properties

**Property 28: Concordance Search Results**
*For any* search term (≥2 characters), the concordance search should return TM entries where either source or target text contains the search term, limited to 50 results ordered by relevance.
**Validates: Requirements 9.1, 9.2, 9.3**

**Property 29: Concordance Result Application**
*For any* concordance search result, applying the result should copy the result's target Token array to the active segment target.
**Validates: Requirements 9.4**

### Propagation Properties

**Property 30: Propagation to Identical Segments**
*For any* confirmed segment, propagation should update all other segments in the project with identical source Token arrays (same srcHash) to have the same target Token array.
**Validates: Requirements 10.6**

**Property 31: Propagation Undo**
*For any* propagation operation, undo data should be stored before changes are applied, and invoking undo should restore all affected segments to their pre-propagation state.
**Validates: Requirements 10.7, 12.4**

### UI Rendering Properties

**Property 32: Segment List Display**
*For any* project, the segment list should display all segments with their ID, source text (serialized), target text (serialized), and status indicator visible.
**Validates: Requirements 3.1, 3.3**

**Property 33: Error Indicator Display**
*For any* segment with QA validation errors, the segment list should display a visual error indicator on that segment.
**Validates: Requirements 3.4**

**Property 34: Status Filtering**
*For any* status filter selection, the segment list should display only segments matching that status, and the count should equal the number of segments with that status in the database.
**Validates: Requirements 3.6**

**Property 35: Segment Activation**
*For any* segment in the list, clicking the segment should activate it in the editor, displaying its source and target Token arrays.
**Validates: Requirements 3.5**

**Property 36: Token Editor Rendering**
*For any* Token array, the editor should render text tokens as editable spans and tag tokens as non-editable visual capsules with distinct styling.
**Validates: Requirements 4.1, 4.2**

### Edge Cases

The following edge cases should be explicitly tested as examples rather than properties:

- **Navigation Boundaries**: When at the first segment, pressing Ctrl+Up should remain on first segment. When at the last segment, pressing Ctrl+Down should remain on last segment. (Requirements 5.5, 5.6)

- **Empty TM Results**: When no TM matches are found, display "No matches found" message. (Requirement 7.5)

- **Empty Concordance Results**: When no search results are found, display "No results found" message. (Requirement 9.5)

- **Short Search Terms**: When search term is less than 2 characters, display prompt to enter more characters. (Requirement 9.6)


## Error Handling

### Import Errors

**Missing Required Columns**:
- Error Type: `ImportValidationError`
- Message: "Missing required columns: {column_names}"
- Recovery: Display error dialog, allow user to select different file
- Prevention: Validate headers before processing rows

**Invalid File Format**:
- Error Type: `FileFormatError`
- Message: "Unable to parse file: {reason}"
- Recovery: Display error dialog with details, allow retry
- Prevention: Check file extension and magic bytes before parsing

**Malformed Token Content**:
- Error Type: `TokenizationError`
- Message: "Invalid tag structure in segment {id}: {details}"
- Recovery: Log warning, import segment with tags as plain text
- Prevention: Robust tag parsing with fallback to text tokens

**Database Constraint Violations**:
- Error Type: `DatabaseError`
- Message: "Failed to create project: {reason}"
- Recovery: Rollback transaction, display error, allow retry
- Prevention: Validate data before insertion, use transactions

### Export Errors

**QA Validation Failures**:
- Error Type: `ExportBlockedError`
- Message: "Export blocked: {count} segments have validation errors"
- Details: List of segment IDs with error descriptions
- Recovery: Display error dialog with segment list, allow user to fix errors
- Prevention: Run validation before export, provide clear error indicators

**File Write Failures**:
- Error Type: `FileSystemError`
- Message: "Failed to write file: {reason}"
- Recovery: Display error dialog, allow user to select different path
- Prevention: Check write permissions before export, handle disk full errors

**Serialization Errors**:
- Error Type: `SerializationError`
- Message: "Failed to serialize segment {id}: {reason}"
- Recovery: Log error, skip segment, continue export with warning
- Prevention: Validate Token arrays before serialization

### UI Errors

**Segment Load Failures**:
- Error Type: `SegmentLoadError`
- Message: "Failed to load segment: {reason}"
- Recovery: Display error message in editor, allow retry
- Prevention: Validate segment IDs before loading

**TM Query Failures**:
- Error Type: `TMQueryError`
- Message: "Failed to query TM: {reason}"
- Recovery: Display error in TM panel, allow retry
- Prevention: Validate query parameters, handle database errors gracefully

**Concordance Search Failures**:
- Error Type: `SearchError`
- Message: "Search failed: {reason}"
- Recovery: Display error in search panel, allow retry
- Prevention: Validate search terms, handle FTS5 errors gracefully

**Database Connection Failures**:
- Error Type: `DatabaseConnectionError`
- Message: "Database connection lost: {reason}"
- Recovery: Attempt reconnection, display error if fails, prevent data loss
- Prevention: Use connection pooling, handle SQLite locking errors

### Validation Errors

**Tag Mismatch**:
- Error Type: `TagMismatchError`
- Message: "Tag structure mismatch: source has {src_tags}, target has {tgt_tags}"
- Details: List of missing and extra tags
- Recovery: Display in QA panel, highlight affected tags in editor
- Prevention: Real-time validation during editing

**Missing Tags**:
- Error Type: `MissingTagError`
- Message: "Missing tags in target: {tag_list}"
- Recovery: Display in QA panel, suggest adding missing tags
- Prevention: Real-time validation, tag insertion helpers

**Extra Tags**:
- Error Type: `ExtraTagError`
- Message: "Extra tags in target: {tag_list}"
- Recovery: Display in QA panel, suggest removing extra tags
- Prevention: Real-time validation, prevent tag insertion without source match

### Error Logging

All errors should be logged with:
- Timestamp
- Error type and message
- Stack trace (for unexpected errors)
- Context (segment ID, project ID, user action)
- User-facing message (sanitized, no sensitive data)

Logs should be written to:
- Console (development mode)
- File: `~/.cat-tool/logs/app.log` (production mode)
- Electron crash reporter (for fatal errors)

## Testing Strategy

### Dual Testing Approach

This project requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide input space.

### Property-Based Testing

**Library Selection**: Use `fast-check` for TypeScript/JavaScript property-based testing.

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Seed-based reproducibility for failed tests
- Shrinking enabled to find minimal failing examples
- Timeout: 30 seconds per property test

**Test Tagging**:
Each property test must include a comment referencing the design document property:
```typescript
// Feature: cat-tool-complete-mvp, Property 9: Token Serialization Round-Trip
test('Token serialization round-trip', () => {
  fc.assert(
    fc.property(tokenArrayArbitrary, (tokens) => {
      const serialized = serializeTokens(tokens);
      const deserialized = parseTokens(serialized);
      expect(deserialized).toEqual(tokens);
    }),
    { numRuns: 100 }
  );
});
```

**Generators (Arbitraries)**:

For effective property testing, we need generators for:

1. **Token Arrays**:
   ```typescript
   const tokenArbitrary = fc.oneof(
     fc.record({ type: fc.constant('text'), content: fc.string() }),
     fc.record({ 
       type: fc.constant('tag'), 
       content: fc.oneof(fc.constant('<b>'), fc.constant('</b>'), fc.constant('<i>'), fc.constant('</i>')),
       tagId: fc.uuid(),
       tagType: fc.oneof(fc.constant('open'), fc.constant('close'), fc.constant('self'))
     }),
     fc.record({ type: fc.constant('ws'), content: fc.constant(' ') })
   );
   
   const tokenArrayArbitrary = fc.array(tokenArbitrary, { minLength: 0, maxLength: 50 });
   ```

2. **Spreadsheet Files**:
   ```typescript
   const csvRowArbitrary = fc.record({
     id: fc.string({ minLength: 1, maxLength: 20 }),
     source: fc.string({ minLength: 1, maxLength: 200 }),
     target: fc.option(fc.string({ maxLength: 200 })),
     status: fc.option(fc.oneof(fc.constant('new'), fc.constant('draft'), fc.constant('confirmed')))
   });
   
   const csvFileArbitrary = fc.array(csvRowArbitrary, { minLength: 1, maxLength: 100 });
   ```

3. **Segments**:
   ```typescript
   const segmentArbitrary = fc.record({
     id: fc.uuid(),
     segmentId: fc.string({ minLength: 1, maxLength: 20 }),
     srcTokens: tokenArrayArbitrary,
     tgtTokens: tokenArrayArbitrary,
     status: fc.oneof(fc.constant('new'), fc.constant('draft'), fc.constant('confirmed'))
   });
   ```

4. **Projects**:
   ```typescript
   const projectArbitrary = fc.record({
     id: fc.uuid(),
     name: fc.string({ minLength: 1, maxLength: 50 }),
     srcLang: fc.oneof(fc.constant('en'), fc.constant('es'), fc.constant('fr'), fc.constant('de')),
     tgtLang: fc.oneof(fc.constant('en'), fc.constant('es'), fc.constant('fr'), fc.constant('de')),
     segments: fc.array(segmentArbitrary, { minLength: 1, maxLength: 100 })
   });
   ```

### Unit Testing

**Focus Areas**:
- Specific examples demonstrating correct behavior
- Edge cases (empty inputs, boundary conditions, special characters)
- Error conditions (invalid inputs, missing data, constraint violations)
- Integration points between components (IPC handlers, service calls)

**Balance**:
- Avoid writing too many unit tests for scenarios covered by property tests
- Focus unit tests on concrete examples that illustrate requirements
- Use unit tests for UI interaction testing (click handlers, keyboard shortcuts)
- Use unit tests for error handling paths

**Example Unit Tests**:

```typescript
// Edge case: Empty segment list
test('Empty project displays empty state', () => {
  const project = createProject({ segments: [] });
  render(<SegmentList projectId={project.id} />);
  expect(screen.getByText('No segments found')).toBeInTheDocument();
});

// Error condition: Missing required columns
test('Import fails with missing source column', async () => {
  const csvContent = 'id,target\n1,Hello';
  await expect(importCSV({ content: csvContent })).rejects.toThrow('Missing required columns: source');
});

// Integration: IPC handler
test('import:csv IPC handler calls importCSV service', async () => {
  const mockImport = jest.spyOn(ImportService, 'importCSV');
  await ipcMain.emit('import:csv', {}, { filePath: 'test.csv' });
  expect(mockImport).toHaveBeenCalledWith({ filePath: 'test.csv' });
});
```

### Test Organization

**Directory Structure**:
```
packages/core/
  src/
    tokens/
      tokenizer.ts
      tokenizer.test.ts        # Unit tests
      tokenizer.property.test.ts  # Property tests
    services/
      SegmentService.ts
      SegmentService.test.ts
      SegmentService.property.test.ts

apps/desktop/
  src/
    components/
      SegmentList/
        SegmentList.tsx
        SegmentList.test.tsx    # Unit tests (React Testing Library)
      TokenEditor/
        TokenEditor.tsx
        TokenEditor.test.tsx
```

**Test Suites**:
- `npm test`: Run all tests (unit + property)
- `npm run test:unit`: Run only unit tests
- `npm run test:property`: Run only property tests
- `npm run test:watch`: Run tests in watch mode (development)
- `npm run test:coverage`: Generate coverage report

### Performance Testing

While not part of the core property/unit testing strategy, performance requirements (Requirement 11) should be validated through:

**Benchmarks**:
- Load time for 10,000 segment project
- Scrolling frame rate measurement
- TM query response time (p95, p99)
- Import/export throughput

**Tools**:
- `benchmark.js` for microbenchmarks
- Chrome DevTools Performance profiler for UI performance
- Custom timing instrumentation for IPC round-trips

**Acceptance Criteria**:
- Run benchmarks on CI for regression detection
- Fail build if performance degrades by >20%
- Document baseline performance metrics

### Integration Testing

**End-to-End Scenarios**:
1. Import CSV → Edit segments → Export CSV → Verify round-trip
2. Import XLSX → Apply TM matches → Confirm segments → Verify TM entries created
3. Import file → Introduce tag errors → Attempt export → Verify blocked
4. Import file → Confirm segments → Search concordance → Apply results → Verify updates

**Tools**:
- Playwright or Electron Spectron for E2E testing
- Test against real SQLite database (not mocked)
- Use temporary directories for test files

**Frequency**:
- Run E2E tests on CI before merge
- Run locally before releases
- Keep E2E test count small (5-10 critical paths)

### Test Coverage Goals

**Minimum Coverage**:
- Core logic (tokenizer, services): 90%
- UI components: 80%
- IPC handlers: 85%
- Overall project: 85%

**Coverage Exclusions**:
- Type definitions
- Configuration files
- Development utilities
- Electron main process boilerplate

**Coverage Reporting**:
- Generate HTML coverage reports
- Upload to coverage service (Codecov, Coveralls)
- Display coverage badge in README
- Block PRs that decrease coverage by >2%

