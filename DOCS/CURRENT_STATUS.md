# 当前开发状态（更新于 2026-02-21）

> 这是“执行面板”文档：记录当前阶段、门禁状态、近期优先级。  
> 需要实时准确，过时信息优先改这里。

## 1. 当前阶段

1. 阶段：`Feature-First`（功能开发优先）。
2. 约束：只允许“功能实现 + 必要配套治理”，不做独立大重构。
3. 规则来源：`DOCS/DEVELOPMENT_GUIDE.md`。

## 2. 门禁状态（本地核验）

核验日期：2026-02-21

1. `npm run typecheck --workspace=apps/desktop`：通过。
2. `npm run lint --workspace=apps/desktop`：通过（`0 error / 7 warnings`，均为历史存量 warning）。
3. `npm run gate:check`：未通过（`gate:style` 阻断，当前命中 `apps/desktop/src/renderer/src/components/EditorRow.tsx` 的硬编码颜色类）。

最新同步：

- 已修复 `gate:arch` 漂移：`DOCS/architecture/GATE05_GUARDRAILS.json` 已补齐 `getProjectTypeByFileId`。
- 已完成首轮 warning 压降：`apps/desktop` 从 `555` 降到 `0`。
- 编辑器已支持“单段 AI 翻译”（与批量翻译使用同一套 Prompt/TM/TB/Tag 校验规则），并在 `EditorRow` 增加半透明按钮；当同时存在 Insert Tag 与 AI 按钮时采用纵向排列避免遮挡。
- 编辑器已新增“单段 AI 微调”（2026-02-19）：
  - 仅当目标列已有译文且当前行为 active 时显示魔法棒按钮，点击后出现右侧半透明悬浮输入框，回车提交微调提示词。
  - 新增 IPC 契约 `ai-refine-segment`（`shared/ipc.ts` + `shared/ipcChannels.ts` + `preload/api/aiApi.ts` + `main/ipc/aiHandlers.ts` 全链路打通）。
  - `AIModule.aiRefineSegment` 将“源文 + 当前译文 + 微调指示”拼入 prompt（translation 模板新增 `Current Translation` / `Refinement Instruction` 区块），并继续复用 TM/TB 引用注入与 Tag 校验重试。
  - 状态回写策略与单段 AI 翻译一致：`review` 项目写回 `reviewed`，其余项目写回 `translated`。
- 已完成 TM 匹配链路升级（2026-02-19）：
  - `TMRepo.searchConcordance` 统一上限为 `10`，并保留 `bm25` + CJK `LIKE` 回退（同样作用于 Concordance 面板）。
  - `TMService.findMatches` 改为复合相似度（Levenshtein + bigram Dice + 轻量 bonus），最小阈值保持 `70`，最终返回 Top `10`。
  - `TMPanel` 对 TM 结果增加 UI 防御上限，最多展示 `5` 条（TB 行为不变）。
- 已完成“对话式批量 AI 翻译”（2026-02-21）：
  - 作用范围：仅 `translation` 项目生效；`review/custom` 链路保持不变。
  - 触发方式：文件列表新增手动入口 `AI Dialogue`；原 `AI Translate` 保留。
  - IPC/契约：`aiTranslateFile` 新增可选参数 `mode`（`default` | `dialogue`），Renderer/Preload/Main 全链路打通。
  - 分组策略：批量模式下将 `meta.context` 视为 `speaker`，同 `speaker` 连续空 target 段落按组发送；遇到不可翻译段会断组。
  - 上下文策略：翻译当前组时附带上一组（speaker + 原文 + 译文）以增强一致性。
  - 容错策略：组翻译采用结构化 JSON 返回校验 + Tag 校验；组失败自动降级为逐段翻译，确保任务可完成。
- 已完成 AI 翻译链路稳态修复（2026-02-21）：
  - 主进程已为 `aiTranslateSegment` / `aiRefineSegment` 增加同段互斥锁；同一 `segmentId` 并发请求会快速失败，避免后返回覆盖先返回。
  - `useProjectAI` 已修复 job 事件竞态：未知 `jobId` 也会先 upsert，再由 `startAITranslateFile` 回填 `fileId`，避免 UI 卡在 `Queued/Running`。
  - dialogue 批量翻译进度语义已修复：进度只在段落实际处理完成后递增，不再在组开始前“提前计数”。
  - `AIModule` 已做文件级最小拆分：`services/modules/ai/dialogueTranslation.ts`、`services/modules/ai/promptReferences.ts`、`services/modules/ai/types.ts`。
  - 相关回归测试通过：main 侧（44 tests）+ renderer 侧（14 tests）。
- 当前 warning 分布（root lint）：
  - `packages/core`: `24`
  - `packages/db`: `19`

## 3. 已收口基线（来自重构期）

1. P0 Gate（01-06）已完成并进入功能开发阶段（见 `DOCS/archive/PRE_FEATURE_GATES_2026-02-11.md`）。
2. 关键链路基线已建立：
- 批量处理分页基线
- IPC 契约收敛与一致性测试
- 导入 Job 化与统一进度事件
- 统一反馈层替代散落 `alert/confirm`
- 架构守卫 `gate:arch`

## 4. 当前优先级（建议）

1. 先恢复 Gate：修复 `EditorRow.tsx` 的 `gate:style` 阻断项，确保 `npm run gate:check` 重新通过。
2. Warning 治理策略：继续按模块压降 `packages/core` 与 `packages/db` 的剩余 warning。
3. 功能开发新增要求：触达 `ProjectService`/`CATDatabase`/IPC 时，必须补对应测试。
4. 继续保持门禁与代码一致：新增公共 API 时同步更新架构守卫清单。

## 5. 使用方式（给 agent）

1. 开工前先读 `DOCS/HANDOFF_LITE.md`，再按其链路读取本文件。
2. 设计/编码时执行 `DOCS/DEVELOPMENT_GUIDE.md`。
3. 定位代码入口看 `DOCS/PROJECT_MAP_QUICKSTART.md`。
4. 完成后更新本文件中的门禁状态和优先级。
