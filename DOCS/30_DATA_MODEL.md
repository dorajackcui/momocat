# 30_DATA_MODEL

## Purpose
Document the persistent data model, migration execution model, and compatibility expectations for safe schema evolution.

## When to Read
Read before changing schema, migration steps, repositories, or SQL-level behavior.

## Source of Truth
- Migration runner: `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/packages/db/src/migration/runMigrations.ts`
- Migration steps: `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/packages/db/src/migration/migrations/*.ts`
- Repositories: `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/packages/db/src/repos/*.ts`

## Last Updated
2026-02-23

## Owner
Core maintainers of `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool`

## Schema Version
- Current target schema version: `v14`
- Version table: `schema_version`
- Runner behavior: execute migration steps in ascending order from current version to target

## Migration Runner Model
1. Ensure `schema_version` table exists.
2. Read current version.
3. Apply bootstrap path for legacy versions (`< v3`) via `v003` entrypoint.
4. Execute versioned steps (`v004 ... v014`) sequentially.
5. Each migration owns its own `up(db)` and version bump.

## Core Tables
### Project and file layer
- `projects`
- `files`
- `segments`

Key fields:
- `projects.aiModel`
- `projects.qaSettingsJson`
- `segments.qaIssuesJson`
- segment token/json payload columns and status/hash keys

### TM layer
- `tms`
- `project_tms`
- `tm_entries`
- `tm_fts` (FTS5)

### TB layer
- `term_bases`
- `project_term_bases`
- `tb_entries`

### App settings
- `app_settings`

## Critical Indexes
1. Segment lookup and order indexes (`fileId`, `orderIndex`, `srcHash`).
2. TM uniqueness and search indexes (`tmId+srcHash`, `matchKey`).
3. TB uniqueness and term lookup indexes (`tbId+srcNorm`, `srcTerm`).
4. Project mounting indexes for TM/TB priority and enabled-state retrieval.

## Compatibility Notes (v3 -> v14)
1. Empty database must upgrade directly to `v14` with no manual steps.
2. Historical databases from `v3+` must upgrade incrementally and safely.
3. Re-running migrations must be idempotent (no duplicate columns/indexes, no destructive side effects).
4. `v013` introduces/normalizes `projects.qaSettingsJson`.
5. `v014` introduces `segments.qaIssuesJson` cache column.

## Change Protocol
1. Add a new `migrations/vXXX.ts` with focused responsibility.
2. Register migration in `runMigrations.ts` in ascending order.
3. Cover at least:
- fresh DB upgrade
- old DB upgrade path
- idempotent re-run
4. Update this document in the same change.

## Related Code Entry Points
- `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/packages/db/src/index.ts`
- `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/packages/db/src/migration/types.ts`
- `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/packages/db/src/migration/utils.ts`
