# 40_STATUS_AND_ROADMAP

## Purpose
Provide a single live source for current execution status, risk posture, and roadmap direction.

## When to Read
Read at task start, before planning scope, and before merge.

## Source of Truth
- Validation commands and outputs in local environment
- Guard scripts in `package.json` and `scripts`

## Last Updated
2026-02-23

## Owner
Core maintainers of `simple-cat-tool`

## Live Status Contract
This is the only active documentation page that may contain live gate status and live risk status.

## Current Phase
- Phase: `Feature-First`
- Strategy: incremental refactor + compatibility-first delivery

## Current Gate Status (Local Verification)
Verification date: 2026-02-23

- `npm run gate:check`: passing
- Included chain: `typecheck`, `gate:arch`, `gate:style`, `gate:file-size`, `lint`, `gate:smoke:large-file`
- Notes: lint currently has historical warnings; no lint errors in latest verification.

## Current Top Risks
1. Large-file hotspots remain in a small set of modules (for example `EditorRow`, AI orchestrator, project AI hook, core index).
2. Historical warning backlog still exists in some workspaces.
3. Boundary drift risk whenever IPC/service/database contracts change without paired tests.

## Latest Completed Milestone (2026-02-23)
1. AI module vertically split with facade compatibility.
2. Editor container and `useEditor` domain split completed.
3. TM module split into query/import/batch services.
4. DB migration pipeline modularized (`v003 ... v014`).
5. TagManager responsibilities reduced via pure operation extraction.
6. File-size guard added to gate chain.

## Roadmap
### Now (1-2 iterations)
1. Keep gate and architecture guard consistency for all boundary changes.
2. Continue reducing large-file hotspots without contract breakage.
3. Prevent net-new lint warning growth in touched files.

### Next
1. Continue core package responsibility cleanup and export-surface clarity.
2. Split long tests into feature-focused suites for maintainability.
3. Improve observability for long-running jobs and failure diagnostics.

### Later
1. Deeper provider pluggability for AI/TM/TB integrations.
2. Additional import/export format expansion under reversible pipeline rules.
3. Advanced TM/TB operational tooling based on product demand.

## Update Rules
1. Update this file whenever gate status, risk posture, or roadmap direction changes.
2. Keep architecture and data details in their dedicated docs.
3. Keep this file concise and execution-oriented.
