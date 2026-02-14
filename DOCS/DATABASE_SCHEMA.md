# 数据库 Schema（当前版，更新于 2026-02-14）

> 单一真相来源：`packages/db/src/migration/runMigrations.ts`

本文档只描述当前有效结构（截至 schema v11），不保留历史假设。

## 1. 版本信息

- 版本表：`schema_version`
- 当前目标版本：`v11`
- 迁移入口：`runMigrations(db)`

## 2. 核心业务表

### 2.1 项目与文件

- `projects`
  - `id` (PK)
  - `uuid` (UNIQUE)
  - `name`, `srcLang`, `tgtLang`
  - `projectType` (`translation` / `review` / `custom`)
  - `aiPrompt` (nullable)
  - `aiTemperature` (nullable)
  - `createdAt`, `updatedAt`

- `files`
  - `id` (PK)
  - `uuid` (UNIQUE)
  - `projectId` (FK -> `projects.id`, `ON DELETE CASCADE`)
  - `name`
  - `totalSegments`, `confirmedSegments`
  - `importOptionsJson` (nullable)
  - `createdAt`, `updatedAt`

- `segments`
  - `segmentId` (PK)
  - `fileId` (FK -> `files.id`, `ON DELETE CASCADE`)
  - `orderIndex`
  - `sourceTokensJson`, `targetTokensJson`
  - `status`, `tagsSignature`, `matchKey`, `srcHash`
  - `metaJson`
  - `updatedAt`

### 2.2 TM（翻译记忆）

- `tms`
  - `id` (PK)
  - `name`, `srcLang`, `tgtLang`
  - `type` (`working` / `main`)
  - `createdAt`, `updatedAt`

- `project_tms`
  - 复合主键：`(projectId, tmId)`
  - `projectId` (FK -> `projects.id`, `ON DELETE CASCADE`)
  - `tmId` (FK -> `tms.id`, `ON DELETE CASCADE`)
  - `priority`, `permission`, `isEnabled`

- `tm_entries`
  - `id` (PK)
  - `tmId` (FK -> `tms.id`, `ON DELETE CASCADE`)
  - `srcHash`, `matchKey`, `tagsSignature`
  - `sourceTokensJson`, `targetTokensJson`
  - `originSegmentId` (nullable)
  - `usageCount`
  - `createdAt`, `updatedAt`

- `tm_fts`（FTS5）
  - 字段：`tmId`, `srcText`, `tgtText`, `tmEntryId`

### 2.3 TB（术语库）

- `term_bases`
  - `id` (PK)
  - `name`, `srcLang`, `tgtLang`
  - `createdAt`, `updatedAt`

- `project_term_bases`
  - 复合主键：`(projectId, tbId)`
  - `projectId` (FK -> `projects.id`, `ON DELETE CASCADE`)
  - `tbId` (FK -> `term_bases.id`, `ON DELETE CASCADE`)
  - `priority`, `isEnabled`

- `tb_entries`
  - `id` (PK)
  - `tbId` (FK -> `term_bases.id`, `ON DELETE CASCADE`)
  - `srcTerm`, `tgtTerm`, `srcNorm`
  - `note` (nullable)
  - `usageCount`
  - `createdAt`, `updatedAt`

### 2.4 应用设置

- `app_settings`
  - `key` (PK)
  - `value` (nullable)
  - `updatedAt`

## 3. 关键索引

- `idx_files_project` on `files(projectId)`
- `idx_segments_file_order` on `segments(fileId, orderIndex)`
- `idx_segments_file_srcHash` on `segments(fileId, srcHash)`
- `idx_tm_entries_tm_srcHash_unique` (UNIQUE) on `tm_entries(tmId, srcHash)`
- `idx_tm_entries_tm_matchKey` on `tm_entries(tmId, matchKey)`
- `idx_project_tms_project` on `project_tms(projectId, isEnabled, priority)`
- `idx_project_tbs_project` on `project_term_bases(projectId, isEnabled, priority)`
- `idx_tb_entries_tb_src_unique` (UNIQUE) on `tb_entries(tbId, srcNorm)`
- `idx_tb_entries_tb_src` on `tb_entries(tbId, srcNorm)`
- `idx_tb_entries_tb_src_term` on `tb_entries(tbId, srcTerm)`

## 4. 当前设计约束说明

1. 统计字段（`totalSegments` / `confirmedSegments`）在 `files` 中冗余维护。
2. TM 以 `tmId + srcHash` 作为唯一键，覆盖写入时会累加 `usageCount`。
3. TB 以 `tbId + srcNorm` 作为唯一键，用于规范化去重。
4. schema 文档更新滞后时，以迁移脚本和 repo 实现为准。

## 5. 相关代码

- 迁移：`packages/db/src/migration/runMigrations.ts`
- 聚合入口：`packages/db/src/index.ts`
- 仓储实现：`packages/db/src/repos/*.ts`
