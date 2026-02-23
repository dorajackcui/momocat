# 20_ENGINEERING_RUNBOOK

## Purpose
Define execution workflow, quality gates, and failure handling so contributors can ship changes safely and consistently.

## When to Read
Read before coding, before opening PRs, and whenever gate/test failures occur.

## Source of Truth
- Package scripts: `package.json`
- Architecture guard config: `DOCS/architecture/GATE05_GUARDRAILS.json`
- Current project status and priorities: `DOCS/40_STATUS_AND_ROADMAP.md`

## Last Updated
2026-02-23

## Owner
Core maintainers of `simple-cat-tool`

## Workflow Rules
1. Start from `DOCS/00_START_HERE.md`.
2. Keep changes scoped: feature + direct blockers + required tests.
3. Preserve public contracts unless a migration plan is explicitly documented.
4. Update docs in the same change when behavior, boundaries, or process changes.

## Gates and Checks
Primary command:

```bash
npm run gate:check
```

Current `gate:check` chain:
1. `npm run typecheck --workspace=apps/desktop`
2. `npm run gate:arch`
3. `npm run gate:style`
4. `npm run gate:file-size`
5. `npm run lint`
6. `npm run gate:smoke:large-file`

## Required Test Policy
1. If you touch `ProjectService`, IPC contracts, or `CATDatabase` behavior, add or update tests in the same change.
2. If you touch migrations, run migration tests and include compatibility notes.
3. If you touch AI/TM/editor boundaries, run targeted test suites before merge.

## PR Checklist
1. Scope is clear and minimal.
2. Gate command passes.
3. Touched boundary tests pass.
4. Public contract impact is documented (or explicitly “none”).
5. Documentation update is included.

## Documentation Update Policy
1. Keep architecture facts only in `DOCS/10_ARCHITECTURE.md`.
2. Keep data model facts only in `DOCS/30_DATA_MODEL.md`.
3. Keep live status only in `DOCS/40_STATUS_AND_ROADMAP.md`.
4. Keep historical retrospective content only in `DOCS/90_HISTORY_CONSOLIDATED.md`.

## Failure Playbooks
### Gate failure triage order
1. `typecheck`
2. `gate:arch`
3. `gate:style`
4. `gate:file-size`
5. `lint`
6. `gate:smoke:large-file`

### `gate:arch` failed
1. Compare changed callsites with guardrail definitions.
2. Decide whether to refactor code back into allowed boundary or update guardrail config intentionally.
3. Add tests for the new boundary.

### `gate:file-size` failed
1. Confirm line count and threshold.
2. Split by responsibility using internal services/hooks.
3. Avoid adding temporary allowlist entries unless explicitly approved.

### Lint warnings growth
1. Block net-new warning growth in touched files.
2. If unavoidable, document rationale and follow-up issue.

### DB migration issues
1. Re-run migration tests.
2. Verify idempotency and v3->latest upgrade path.
3. Update `DOCS/30_DATA_MODEL.md` in same change.

## Operational Conventions
1. Use `rg` for search and `rg --files` for discovery.
2. Prefer non-interactive commands for reproducibility.
3. Keep changelogs concise and test-backed.
