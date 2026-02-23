# 当前开发状态（更新于 2026-02-23）

> 这是“执行面板”文档：记录当前阶段、门禁状态、近期优先级。  
> 需要实时准确，过时信息优先改这里。

## 1. 当前阶段

1. 阶段：`Feature-First`（功能开发优先）。
2. 本轮已完成一次“渐进式分阶段重构”，策略仍是“兼容优先、避免大爆炸重写”。
3. 对外契约保持兼容：`ProjectService`、IPC channel、`apiClient` 方法签名未做破坏性改动。

## 2. 门禁状态（本地核验）

核验日期：2026-02-23

1. `npm run gate:check`：通过（含 `typecheck` / `gate:arch` / `gate:style` / `gate:file-size` / `lint` / `gate:smoke:large-file`）。
2. `gate:file-size` 已接入：`warn >= 450`，`block >= 600`，当前仅 `EditorRow.tsx` 在 allowlist。
3. root lint 当前为 `0 error`，存在历史 warning（apps/core/db 均有存量 warning）。

## 3. 本轮重构完成项（2026-02-23）

1. AI 主模块垂直拆分完成（façade 保留）：
   - `AIModule` 改为委托式门面。
   - 新增 `AISettingsService`、`AITranslationOrchestrator`、`AITextTranslator`、`SegmentPagingIterator`。
2. 编辑器容器拆分完成（UI 结构先行）：
   - `Editor.tsx` 拆为 `EditorHeader`、`EditorFilterBar`、`EditorListPane`、`EditorSidebar`。
   - 新增 `useEditorLayout`、`useConcordanceShortcut`、`useEditorBatchActions`。
3. `useEditor` 领域化拆分完成（返回 shape 保持兼容）：
   - 新增 `useEditorDataLoader`、`useSegmentPersistence`、`useSegmentQaWorkflow`、`useActiveSegmentMatches`。
4. TM 模块用例拆分完成（façade 保留）：
   - `TMModule` 改为门面，内部拆为 `TMQueryService`、`TMImportService`、`TMBatchOpsService`。
5. DB migration pipeline 化完成：
   - `runMigrations.ts` 改为 step runner。
   - 迁移拆分为 `migrations/v003.ts ... v014.ts` + `types.ts` + `utils.ts`。
6. core 标签职责拆分已落地第一步：
   - `TagManager` 压缩为轻量事件门面。
   - 纯函数操作下沉到 `packages/core/src/tag/operations.ts`。
7. 门禁补强完成：
   - 新增 `scripts/gate-file-size.mjs`，并接入 `npm run gate:check`。
   - `EditorRow.tsx` 已修复风格门禁阻断项（`gate:style` 通过）。

## 4. 当前风险与后续优先级

1. 高行数存量仍在：`EditorRow.tsx`（allowlist）、`AITranslationOrchestrator.ts`、`useProjectAI.ts`、`packages/core/src/index.ts`。
2. 建议下一优先级：
   - 按既定方案继续 Phase 6（`@cat/core` 入口/子模块职责进一步收敛）。
   - 推进 Phase 7 的测试文件按功能拆分（`AIModule` / `TMModule` / `TagManager`）。
3. 功能开发新增要求不变：触达 `ProjectService` / `CATDatabase` / IPC 必须补测试。

## 5. 使用方式（给 agent）

1. 开工前先读 `DOCS/HANDOFF_LITE.md`，再按其链路读取本文件。
2. 设计/编码时执行 `DOCS/DEVELOPMENT_GUIDE.md`。
3. 定位代码入口看 `DOCS/PROJECT_MAP_QUICKSTART.md`。
4. 完成后更新本文件中的门禁状态和优先级。
