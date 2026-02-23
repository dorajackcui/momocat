# 项目上手地图（快速定位版）

最后更新：2026-02-23

这份文档的目标不是“讲全”，而是帮你在改功能时 1-2 分钟内找到入口，不再迷路。

---

## 1) 30 秒全局图（先建立方向感）

```text
Renderer (React 组件 + Hooks)
  -> apiClient (window.api)
  -> Preload (typed bridge)
  -> IPC channel
  -> Main (ProjectService 编排)
  -> Modules (ProjectFile/TM/TB/AI) + SegmentService/TMService/TBService
  -> Adapters (Sqlite*Repository)
  -> @cat/db (CATDatabase + repos + migrations)
  -> SQLite + 本地项目文件(.cat_data/projects)
```

核心结论：
- UI 端只调用 `apiClient`，不直接碰 `ipcRenderer`。
- Main 端的总入口是 `ProjectService`，业务拆在 `modules/`。
- 领域模型在 `@cat/core`，数据落地在 `@cat/db`。

---

## 2) 目录地图（按“出了问题先看哪”）

### `apps/desktop/src/renderer/src`
- 你在改界面/交互/页面状态时先看这里。
- 关键入口：
  - `App.tsx`：页面视图切换（dashboard/projectDetail/editor/tms/tbs）
  - `components/ProjectDetail.tsx`：项目详情聚合页
  - `components/Editor.tsx`：编辑器主界面
  - `components/editor/EditorBatchActionBar.tsx`：编辑器批量功能栏（AI 批量翻译 / 文件级 QA / 非打印符号开关）
  - `hooks/useEditor.ts`：编辑器 controller 聚合入口（对外 API 兼容）
  - `hooks/editor/*`：编辑器子 hook（数据加载/持久化/QA/匹配/布局/批量动作）
  - `hooks/projectDetail/*`：项目详情数据、导入流程、AI 设置
  - `services/apiClient.ts`：renderer 到 preload 的唯一 API 边界

### `apps/desktop/src/preload`
- `index.ts`：`window.api` typed bridge，把 IPC 能力安全暴露给 renderer。

### `apps/desktop/src/main`
- `index.ts`：Electron 启动与模块装配（不再承载全部 IPC 实现）。
- `ipc/*.ts`：按领域拆分的 IPC 注册与 handler 实现（project/tm/tb/ai/dialog/import-job）。
- `services/ProjectService.ts`：应用服务编排入口（main 的总门面）。
- `services/modules/`：按业务拆分：
  - `ProjectFileModule`：项目/文件导入导出
  - `TMModule`：TM façade（管理、匹配、导入、批量应用、commit）
  - `TBModule`：TB 管理、匹配、导入
  - `AIModule`：AI façade（配置、测试翻译、单段翻译/微调、批量翻译）
  - `modules/ai/*`：AIModule 内部子模块（`AISettingsService` / `AITranslationOrchestrator` / `AITextTranslator` / `SegmentPagingIterator` + dialogue/prompt helpers）
  - `modules/tm/*`：TMModule 内部子模块（`TMQueryService` / `TMImportService` / `TMBatchOpsService`）
- `services/SegmentService.ts`：段落更新、确认后传播、事件广播。
- `filters/SpreadsheetFilter.ts`：CSV/XLSX 导入导出（文件过滤器）。
- `JobManager.ts`：长任务进度（AI 翻译 + TM/TB 导入）统一事件中心。

### `packages/core/src`
- 领域类型和算法（Token、Segment、TM/TB、Tag 编解码与校验）。
- `TagManager` 当前为轻量事件封装，标签纯函数操作在 `tag/operations.ts`。
- 你在改“标签安全、匹配 key、hash、文本与 token 转换”时看这里。

### `packages/db/src`
- SQLite 数据层（`CATDatabase` + repos + migrations）。
- 你在改“表结构、索引、查询语句、事务边界”时看这里。

### `DOCS/`
- `PROJECT_STRUCTURE.md`：结构分层说明（静态地图）
- `DATABASE_SCHEMA.md`：数据库表结构说明
- `DEVELOPMENT_GUIDE.md`：开发规范和边界约束
- 本文：快速定位地图（动态上手入口）

### 尽量不要当源码改的目录
- `out/`：构建产物
- `.cat_data/`：本地运行数据（数据库和项目文件缓存）

---

## 3) 关键功能链路图（真实调用路径）

### 3.1 创建项目

```text
Dashboard/CreateProjectModal
  -> useProjects.createProject
  -> apiClient.createProject
  -> ipc: "project-create"
  -> ProjectService.createProject
  -> ProjectFileModule.createProject
  -> SqliteProjectRepository -> CATDatabase.createProject
  -> ProjectRepo.createProject (+ 自动创建并挂载 Working TM)
```

### 3.2 导入项目文件（CSV/XLSX）

```text
ProjectDetail + useProjectFileImport
  -> openFileDialog + getFilePreview
  -> apiClient.addFileToProject
  -> ipc: "project-add-file"
  -> ProjectService.addFileToProject
  -> ProjectFileModule.addFileToProject
  -> SpreadsheetFilter.import (生成 Segment[])
  -> SqliteSegmentRepository -> CATDatabase.bulkInsertSegments
```

### 3.3 编辑器输入与确认（最关键链路）

```text
EditorRow 输入
  -> useEditor.handleTranslationChange
  -> apiClient.updateSegment
  -> ipc: "segment-update"
  -> ProjectService.updateSegment
  -> SegmentService.updateSegment
  -> SegmentRepo.updateSegmentTarget

确认段落(confirm):
  -> useEditor.confirmSegment (先走 TagValidator)
  -> SegmentService.updateSegment(status=confirmed)
  -> TMService.upsertFromConfirmedSegment (写入 Working TM)
  -> SegmentService.propagate (同 srcHash 段落自动传播为 draft)
  -> 事件广播 "segments-updated" 回到 renderer
```

### 3.4 TM/TB 管理与挂载

```text
TMManager/TBManager 或 ProjectDetail TM/TB Tab
  -> apiClient.*
  -> ipc: tm-* / tb-*
  -> ProjectService -> TMModule / TBModule
  -> TMRepo/TBRepo 持久化 + project_tms / project_term_bases 挂载关系
```

### 3.4.1 编辑器 TM 实时匹配（2026-02-19）

```text
Editor active segment 变化
  -> useEditor 调 apiClient.getMatches(projectId, segment)
  -> TMService.findMatches
     1) 先走 100% srcHash 命中
     2) 再走 fuzzy：TMRepo.searchConcordance 候选 + 复合相似度重排
  -> 返回 Top 10 TM 结果（threshold=70）
  -> TMPanel 仅展示前 5 条 TM（TB 结果不受此上限影响）
```

Concordance 搜索当前同样复用 `TMRepo.searchConcordance`，统一最多返回 10 条候选。

### 3.5 AI 流程

```text
ProjectAIPane (保存 prompt/temperature, test)
  -> useProjectAI -> apiClient.updateProjectAISettings / aiTestTranslate
  -> AIModule
  -> OpenAITransport (chat completions)

AI Translate Segment (EditorRow):
  -> useEditor.translateSegmentWithAI
  -> apiClient.aiTranslateSegment
  -> ipc "ai-translate-segment"
  -> ProjectService.aiTranslateSegment
  -> AIModule.aiTranslateSegment (主进程同段互斥锁兜底)
  -> SegmentService.updateSegment(status=translated/reviewed)

AI Refine Segment (EditorRow):
  -> useEditor.refineSegmentWithAI
  -> apiClient.aiRefineSegment
  -> ipc "ai-refine-segment"
  -> ProjectService.aiRefineSegment
  -> AIModule.aiRefineSegment (与单段翻译共享同段互斥锁)
  -> translation user prompt 追加:
     - Current Translation
     - Refinement Instruction
  -> SegmentService.updateSegment(status=translated/reviewed)

AI Translate File:
  -> apiClient.aiTranslateFile(fileId, { mode })
  -> ipc "ai-translate-file" 立即返回 jobId
  -> JobManager 推送 job-progress (renderer 对未知 jobId 先 upsert，避免时序竞态丢状态)
  -> AIModule.aiTranslateFile
     - mode=default: 逐段翻译空白 target
     - mode=dialogue(仅 translation): 按 speaker 连续段分组翻译，
       并注入上一组(原文+译文+speaker)上下文
     - dialogue 进度语义：仅在段落实际处理完成后递增
  -> SegmentService.updateSegment / updateSegmentsAtomically(status=translated)

Editor Batch Action Bar (translation only):
  -> Editor 顶部 sticky 区渲染 EditorBatchActionBar（纯 UI）
  -> AI Batch Translate:
     - 打开 ProjectAITranslateModal
     - 提交后调用 apiClient.aiTranslateFile(fileId, { mode, targetScope })
     - 由 onJobProgress 跟踪批量任务状态
  -> Batch QA:
     - 调用 apiClient.runFileQA(fileId)
     - 调用 useEditor.reloadEditorData() 刷新 QA 标记与段落状态
  -> Non-printing symbols:
     - 开关由 Editor 持有
     - EditorRow 显示并区分普通空格 / NBSP / NNBSP（法语场景）
```

补充行为（2026-02-21）：
- 微调按钮仅在 active 行且目标列已有文本时出现。
- 微调输入框为右侧半透明悬浮层，不挤占译文文本区域；提交快捷键为 Enter，取消为 Escape。
- 单段 AI 翻译与单段 AI 微调共享同一段落级并发锁（同一段同时只允许一个 AI 请求）。
- 同段并发锁已由主进程兜底：并发请求会快速失败，防止后返回覆盖先返回。
- 文件级批量翻译新增 `AI Dialogue` 手动入口（仅 `translation` 项目显示）。
- 对话模式当前将 `meta.context` 视为 `speaker`；组翻译失败会自动降级到逐段翻译。
- 编辑器批量功能区已组件化：`EditorBatchActionBar`（2026-02-23）。
- 编辑器新增非打印符号可视化开关（2026-02-23）：
  - 符号映射：普通空格 `·`、NBSP `⍽`、NNBSP `⎵`、Tab `⇥`。
  - 活动编辑行已修复光标错位：输入时会将可视符号反解回原始字符。

### 3.6 TM/TB 导入任务（Job 化）

```text
TMImportWizard / TBImportWizard
  -> apiClient.importTM / importTB
  -> ipc: tm-import / tb-import（立即返回 jobId）
  -> JobManager 推送统一 job-progress
  -> TMModule / TBModule 执行导入
  -> UI 基于 onJobProgress 渲染 running/success/failed
```

---

## 4) 按任务找文件（最实用索引）

### 4.1 想改“文件导入/导出逻辑”
- `apps/desktop/src/main/filters/SpreadsheetFilter.ts`
- `apps/desktop/src/main/services/modules/ProjectFileModule.ts`
- `apps/desktop/src/renderer/src/hooks/projectDetail/useProjectFileImport.ts`

### 4.2 想改“编辑器输入、确认、自动跳转”
- `apps/desktop/src/renderer/src/hooks/useEditor.ts`
- `apps/desktop/src/renderer/src/hooks/editor/useEditorDataLoader.ts`
- `apps/desktop/src/renderer/src/hooks/editor/useSegmentPersistence.ts`
- `apps/desktop/src/renderer/src/hooks/editor/useSegmentQaWorkflow.ts`
- `apps/desktop/src/renderer/src/hooks/editor/useActiveSegmentMatches.ts`
- `apps/desktop/src/renderer/src/components/Editor.tsx`
- `apps/desktop/src/renderer/src/components/EditorRow.tsx`
- `apps/desktop/src/renderer/src/components/editor/EditorBatchActionBar.tsx`
- `apps/desktop/src/main/services/SegmentService.ts`

### 4.3 想改“TM 匹配阈值/排序/模糊匹配”
- `apps/desktop/src/main/services/TMService.ts`
- `apps/desktop/src/main/services/modules/TMModule.ts`
- `apps/desktop/src/main/services/modules/tm/TMQueryService.ts`
- `apps/desktop/src/main/services/modules/tm/TMBatchOpsService.ts`
- `packages/db/src/repos/TMRepo.ts`

当前行为（2026-02-19）：
- `TMRepo.searchConcordance`：`bm25` 排序 + CJK `LIKE` 回退，统一上限 10（TM match 与 Concordance 共用）。
- `TMService.findMatches`：最小阈值 `70`，复合分（Levenshtein + bigram Dice + bonus）重排，最终 Top 10。
- `TMPanel`：仅渲染 Top 5 TM 卡片（TB 不截断）。

### 4.4 想改“TB 命中规则（词边界/CJK）”
- `apps/desktop/src/main/services/TBService.ts`
- `apps/desktop/src/main/services/modules/TBModule.ts`
- `packages/db/src/repos/TBRepo.ts`

### 4.5 想改“AI Prompt/温度/翻译容错”
- `apps/desktop/src/renderer/src/components/EditorRow.tsx`
- `apps/desktop/src/renderer/src/components/editor/EditorBatchActionBar.tsx`
- `apps/desktop/src/renderer/src/components/project-detail/ProjectFilesPane.tsx`
- `apps/desktop/src/renderer/src/hooks/useEditor.ts`
- `apps/desktop/src/renderer/src/hooks/projectDetail/useProjectAI.ts`
- `apps/desktop/src/main/services/modules/AIModule.ts`
- `apps/desktop/src/main/services/modules/ai/AISettingsService.ts`
- `apps/desktop/src/main/services/modules/ai/AITranslationOrchestrator.ts`
- `apps/desktop/src/main/services/modules/ai/AITextTranslator.ts`
- `apps/desktop/src/main/services/modules/ai/SegmentPagingIterator.ts`
- `apps/desktop/src/main/services/modules/ai/dialogueTranslation.ts`
- `apps/desktop/src/main/services/modules/ai/promptReferences.ts`
- `apps/desktop/src/main/services/modules/ai/types.ts`
- `apps/desktop/src/main/services/modules/ai-prompts/translationPromptTemplate.ts`
- `apps/desktop/src/main/services/providers/OpenAITransport.ts`

### 4.6 想改“IPC 契约/参数类型”
- `apps/desktop/src/shared/ipc.ts`
- `apps/desktop/src/shared/ipcChannels.ts`
- `apps/desktop/src/preload/api/createDesktopApi.ts`
- `apps/desktop/src/main/ipc/*.ts`

### 4.7 想改“数据库 schema 或 SQL”
- `packages/db/src/migration/runMigrations.ts`
- `packages/db/src/migration/migrations/*.ts`
- `packages/db/src/repos/*.ts`
- `DOCS/DATABASE_SCHEMA.md`

---

## 5) 推荐阅读顺序（30 分钟版）

1. `apps/desktop/src/renderer/src/App.tsx`
2. `apps/desktop/src/renderer/src/components/ProjectDetail.tsx`
3. `apps/desktop/src/renderer/src/components/Editor.tsx`
4. `apps/desktop/src/renderer/src/hooks/useEditor.ts`
5. `apps/desktop/src/main/index.ts`
6. `apps/desktop/src/main/services/ProjectService.ts`
7. `apps/desktop/src/main/services/modules/TMModule.ts`
8. `apps/desktop/src/main/services/modules/AIModule.ts`
9. `packages/core/src/index.ts`
10. `packages/db/src/index.ts`

读完这 10 个文件，基本能覆盖 80% 的开发定位需求。

---

## 6) 常见迷路点（避坑）

- 误区：在 renderer 里直接新增 `ipcRenderer.invoke`。  
  建议：统一走 `apiClient.ts` + `shared/ipc.ts`，保证类型契约集中。

- 误区：直接改 `CATDatabase` 暴露方法却不改 ports。  
  建议：先改 `ports.ts` 抽象，再改 adapter 和实现，避免层间漂移。

- 误区：只改 UI 状态，不核对 main 事件广播。  
  建议：涉及段落更新必须核对 `segments-updated` 订阅链路。

- 误区：改导出逻辑时忽略 Tag QA。  
  建议：导出前会做 `validateSegmentTags`，必要时检查 `forceExport` 分支。

---

## 7) 与其他文档的关系

- 要看“当前执行状态/阻塞项”：`DOCS/CURRENT_STATUS.md`
- 要看“完整结构定义”：`DOCS/PROJECT_STRUCTURE.md`
- 要看“数据库细节”：`DOCS/DATABASE_SCHEMA.md`
- 要看“开发约束”：`DOCS/DEVELOPMENT_GUIDE.md`
- 要看“版本阶段目标”：`DOCS/ROADMAP.md`
- 要看“历史门禁与整改背景”：`DOCS/archive/`

本文档定位是快速上手导航，不替代上述规范文档。
