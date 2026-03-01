# 40_STATUS_AND_ROADMAP

## Purpose

Provide a single live source for current execution status, risk posture, and roadmap direction.

## When to Read

Read at task start, before planning scope, and before merge.

## Source of Truth

- Validation commands and outputs in local environment
- Guard scripts in `package.json` and `scripts`

## Last Updated

2026-03-01

## Owner

Core maintainers of `simple-cat-tool`

## Live Status Contract

This is the only active documentation page that may contain live gate status and live risk status.

## Current Phase

- Phase: `Feature-First`
- Strategy: incremental refactor + compatibility-first delivery

## Current Gate Status (Local Verification)

Verification date: 2026-03-01

- `npm run gate:check`: passing
- Included chain: `typecheck`, `gate:arch`, `gate:style`, `gate:file-size`, `lint`, `gate:smoke:large-file`
- Notes: lint currently has historical warnings; no lint errors in latest verification.
- `gate:file-size` current warnings: `packages/core/src/index.ts` only.

## Current Top Risks

1. Remaining large-file hotspot in `packages/core/src/index.ts` (core model + algorithm + export surface mixed).
2. Historical warning backlog still exists in some workspaces.
3. Boundary drift risk whenever IPC/service/database contracts change without paired tests.

## Latest Completed Milestone (2026-03-01)

1. AI orchestrator large-file split completed with compatibility facade:
   - `AITranslationOrchestrator.ts` reduced below file-size warning threshold,
   - workflows split into `fileTranslationWorkflow`, `dialogueTranslationWorkflow`, `segmentTranslationWorkflow`, `translationTargetScope`.
2. Project AI hook large-file split completed:
   - `useProjectAI.ts` kept as stable facade export,
   - internals moved to `hooks/projectDetail/ai/*`.
3. Editor filter hook large-file split completed:
   - `useEditorFilters.ts` kept as stable facade export,
   - storage/searchable/menu logic moved to focused modules under `hooks/editor/*`.
4. Added refactor regression coverage:
   - `AITranslationWorkflows.test.ts`,
   - `useProjectAI.behavior.test.ts`,
   - `useEditorFilters.behavior.test.ts`.

## Roadmap

### Now (1-2 iterations)

1. Keep gate and architecture guard consistency for all boundary changes.
2. Continue reducing the remaining `packages/core/src/index.ts` hotspot without contract breakage.
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
