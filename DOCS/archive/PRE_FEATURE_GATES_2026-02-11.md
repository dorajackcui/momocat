# 功能开发前硬门槛清单（2026-02-11）

> 文档目的：回答“重构是否会无限进行”  
> 结论：在进入新功能开发前，只收口**必须项**，其余重构延期到功能迭代中按需处理。  
> 使用方式：本清单通过后，立即切换到 feature 开发，不再新增架构整改范围。

## 当前阶段状态（2026-02-11）

1. 6 个 P0 Gate 已全部完成并通过 `npm run gate:check`。
2. 项目已进入“功能开发优先（Feature-First）”阶段。
3. 架构治理只允许作为“功能实现的配套改动”，不再单独扩张范围。

---

## 0. 先定边界（防止重构无穷）

1. 本清单仅包含 **6 个必须解决项（P0 Gate）**。
2. 每项必须有可验证的验收标准（DoD），通过即关闭，不做“顺手优化”。
3. 时间盒建议：`5-7 天`。到期后未完成项只允许保留 `1` 项进入 feature 期并带风险说明。

---

## 1. P0 Gate（进入功能开发前必须通过）

## Gate-01：去掉“全量拉取 1000000”式读法，建立可扩展分页/批处理基线

状态：`已完成（2026-02-11）`

### 为什么必须先做

当前多处使用 `getSegmentsPage(..., 0, 1000000)`，未来大项目会直接触发内存与响应问题。

### 涉及位置（当前已知）

- `apps/desktop/src/main/services/modules/ProjectFileModule.ts`
- `apps/desktop/src/main/services/modules/TMModule.ts`
- `apps/desktop/src/main/services/modules/AIModule.ts`

### DoD（完成标准）

1. 业务链路改为“迭代器/分页循环/流式处理”，禁止再出现 `1000000` 上限魔法值。
2. 新增一个大文件烟雾测试（至少覆盖：导出或批量匹配其中一条链路）。
3. 代码搜索 `rg "1000000" apps/desktop/src/main` 仅允许测试或常量定义出现。

### 本次落地结果（2026-02-11）

1. 已移除主链路 `1000000` 读取：
   - `apps/desktop/src/main/services/modules/ProjectFileModule.ts`
   - `apps/desktop/src/main/services/modules/TMModule.ts`
   - `apps/desktop/src/main/services/modules/AIModule.ts`
2. 已新增跨分页烟雾测试：
   - `apps/desktop/src/main/services/modules/TMModule.test.ts`（`scans segments page by page for large files`）
3. 已验证：
   - `rg -n "1000000" apps/desktop/src/main`（无命中）
   - `npm run typecheck --workspace=apps/desktop`（通过）
   - `npx vitest run apps/desktop/src/main/services/modules/TMModule.test.ts -t "uses segment confirmation flow|rejects when TM is not mounted|scans segments page by page"`（通过）
   - `npx vitest run apps/desktop/src/main/services/modules/AIModule.test.ts apps/desktop/src/main/services/modules/ProjectFileModule.test.ts`（通过）

> 说明：`TMModule.test.ts` 中 2 条依赖本机 `better-sqlite3` 二进制的集成用例在当前环境受 Node ABI 不匹配影响，属于测试环境问题，不是本次分页改动回归。

---

## Gate-02：统一契约来源，避免类型漂移

状态：`已完成（2026-02-11）`

### 为什么必须先做

`shared/ipc.ts`、`main/services/ports.ts`、`packages/db/types.ts` 同时维护类型，长期会改漏。

### DoD（完成标准）

1. 明确“唯一事实来源”（建议 `shared contract` + 映射层）。
2. 至少收敛 TM/TB/Project 三条主链路的重复 DTO。
3. 增加契约一致性测试（编译期或单测）防止跨层字段漂移。

### 本次落地结果（2026-02-11）

1. 已明确契约来源并完成收敛：
   - TM/TB/Project 记录类 DTO 的事实来源收敛到 `packages/db/src/types.ts`。
   - `apps/desktop/src/shared/ipc.ts` 与 `apps/desktop/src/main/services/ports.ts` 改为直接复用该来源。
2. 已收敛导入参数契约（避免 main/renderer 各自维护）：
   - `ImportOptions / TMImportOptions / TBImportOptions` 统一由 `apps/desktop/src/shared/ipc.ts` 提供。
   - `SpreadsheetFilter`、`TMModule`、`TBModule`、`ProjectService` 已切到共享契约类型。
3. 已新增契约一致性测试（覆盖 TM/TB/Project 三条主链路 + 导入参数）：
   - `apps/desktop/src/shared/contractConsistency.test.ts`
4. 已验证：
   - `npm run typecheck --workspace=apps/desktop`（通过）
   - `npx vitest run apps/desktop/src/shared/contractConsistency.test.ts apps/desktop/src/main/ipc/importJobHandlers.test.ts apps/desktop/src/main/ipc/handlerRegistration.test.ts`（通过）
   - `npm run gate:check`（通过，仍有历史 lint warning）

---

## Gate-03：导入链路统一后台任务模型（Job 化）

状态：`已完成（2026-02-11）`

### 为什么必须先做

当前 AI 有 Job 进度，TM/TB 导入是半同步风格；体验与错误恢复模型不一致，后续功能难复用。

### DoD（完成标准）

1. TM/TB 导入统一进入 Job 进度通道（与 AI 同一事件模型）。
2. UI 侧统一显示运行中/完成/失败，不再靠 scattered `alert` 作为主反馈。
3. 至少有一条导入失败路径能返回结构化错误（非纯字符串）。

### 本次落地结果（2026-02-11）

1. TM/TB 导入已切换为 Job 模式（返回 `jobId` + 统一 `onJobProgress`）：
   - `apps/desktop/src/main/ipc/tmHandlers.ts`
   - `apps/desktop/src/main/ipc/tbHandlers.ts`
   - `apps/desktop/src/main/JobManager.ts`
2. 导入进度已通过同一事件模型上报，导入结果和失败信息进入 Job 事件：
   - `apps/desktop/src/shared/ipc.ts`（`JobProgressEvent` 新增 `result/error`）
   - `apps/desktop/src/main/services/ProjectService.ts`
   - `apps/desktop/src/main/services/modules/TMModule.ts`
   - `apps/desktop/src/main/services/modules/TBModule.ts`
3. UI 侧已改为统一显示运行中/完成/失败（不再依赖导入完成弹窗）：
   - `apps/desktop/src/renderer/src/components/TMImportWizard.tsx`
   - `apps/desktop/src/renderer/src/components/TBImportWizard.tsx`
   - `apps/desktop/src/renderer/src/components/TMManager.tsx`
   - `apps/desktop/src/renderer/src/components/TBManager.tsx`
4. 已满足“结构化错误”要求：
   - 导入失败时返回 `{ code, message, details }`（例如 `TM_IMPORT_FAILED` / `TB_IMPORT_FAILED`）。
5. 已验证：
   - `npm run typecheck --workspace=apps/desktop`（通过）
   - `npx vitest run apps/desktop/src/main/ipc/importJobHandlers.test.ts apps/desktop/src/main/ipc/handlerRegistration.test.ts`（通过）
   - `npm run gate:check`（通过，仍有历史 lint warning）

---

## Gate-04：建立统一错误反馈层（替换散落 `alert/confirm`）

状态：`已完成（2026-02-11）`

### 为什么必须先做

当前大量 `alert/confirm` 分散在组件与 hooks，中长期会阻碍交互演进与自动化测试。

### DoD（完成标准）

1. 引入统一 `Notification/Dialog Service`（最小可用版本即可）。
2. `ProjectDetail`、`Editor`、`TMManager`、`TBManager` 这四处主入口完成迁移。
3. 保留 `alert/confirm` 的位置需有注释说明原因与迁移计划。

### 本次落地结果（2026-02-11）

1. 已新增统一反馈服务：
   - `apps/desktop/src/renderer/src/services/feedbackService.ts`
2. 已完成四个主入口迁移：
   - `apps/desktop/src/renderer/src/components/ProjectDetail.tsx`
   - `apps/desktop/src/renderer/src/components/Editor.tsx`
   - `apps/desktop/src/renderer/src/components/TMManager.tsx`
   - `apps/desktop/src/renderer/src/components/TBManager.tsx`
3. 已同步清理 hooks 的散落调用（降低回退风险）：
   - `apps/desktop/src/renderer/src/hooks/useProjects.ts`
   - `apps/desktop/src/renderer/src/hooks/projectDetail/useProjectFileImport.ts`
   - `apps/desktop/src/renderer/src/hooks/projectDetail/useProjectAI.ts`
4. 已验证：
   - `rg -n --pcre2 "(^|[^.\\w])(alert|confirm)\\(" apps/desktop/src/renderer/src`（无命中）
   - `npm run typecheck --workspace=apps/desktop`（通过）
   - `npx vitest run apps/desktop/src/renderer/src/hooks/projectDetail/useProjectAI.test.ts`（通过）
   - `npm run gate:check`（通过，仍有历史 lint warning）

---

## Gate-05：限制“上帝入口”继续膨胀（ProjectService/CATDatabase）

状态：`已完成（2026-02-11）`

### 为什么必须先做

当前 `ProjectService` 与 `CATDatabase` 都是高聚合枢纽；如果继续直接堆方法，后续改动半径会越来越大。

### DoD（完成标准）

1. `ProjectService` 新增能力必须通过模块用例层（不允许继续平铺新逻辑）。
2. `CATDatabase` 禁止新增业务编排规则（只允许 repo 聚合与事务能力）。
3. 文档化一条强约束：新功能优先落在 `services/modules/*` 或 use-case 层。

### 本次落地结果（2026-02-11）

1. 已新增架构守卫配置（规则可审计）：
   - `DOCS/architecture/GATE05_GUARDRAILS.json`
2. 已新增门禁脚本并接入 `gate:check`：
   - `scripts/gate-architecture-check.mjs`
   - `package.json`：新增 `gate:arch`，并纳入 `gate:check`
3. `ProjectService` 约束已固化：
   - 非例外公开方法必须委托给 `projectModule/tmModule/tbModule/aiModule/segmentService`
   - 禁止在公开方法中引入业务控制流（`if/switch/for/while/try`）
4. `CATDatabase` 约束已固化：
   - 公共方法清单锁定（新增/删减方法会触发门禁失败）
   - 除遗留白名单方法外，禁止在单个公共方法里跨多个 repo 编排
5. 文档约束已落地：
   - `DOCS/DEVELOPMENT_GUIDE.md` 新增“7. 架构硬约束（Gate-05）”
6. 已验证：
   - `npm run gate:arch`（通过）
   - `npm run gate:check`（通过，仍有历史 lint warning）

---

## Gate-06：把工程门禁升级为“必过”而非“可参考”

状态：`已完成（2026-02-11）`

### 为什么必须先做

没有硬门禁，重构成果会在两三个功能迭代后快速回退。

### DoD（完成标准）

1. `typecheck + test + lint` 作为合并前必过项（本地脚本 + 文档明确）。
2. 增加一条“性能/稳定性烟雾检查”命令（如大文件导入/导出最小场景）。
3. 在 `DOCS/DEVELOPMENT_GUIDE.md` 写明 gate 流程与失败处理规则。

### 本次落地结果（2026-02-11）

1. 已新增门禁脚本（root）：
   - `gate:arch`
   - `gate:smoke:large-file`
   - `gate:check`
2. 已在开发指南加入 Gate 流程与失败处理规则：
   - `DOCS/DEVELOPMENT_GUIDE.md` 新增“6. Gate 门禁流程（持续执行）”
3. 已验证：
   - `npm run gate:check`（通过）

> 当前说明：lint 仍存在大量 warning（无 error），不阻塞门禁执行；后续可在功能迭代中逐步压降 warning 数量。

---

## 2. 不在本轮 gate 内（避免范围膨胀）

以下内容重要，但不阻塞进入功能开发：

1. Provider 插件化完整落地（AI/TM/TB 全抽象）。
2. 全量 UI 组件重写或视觉系统统一。
3. 所有历史 warning 清零。
4. 一次性重构全部大文件。

这些改造进入“功能迭代并行治理”，按业务触达范围逐步推进。

---

## 3. 历史执行顺序（已完成，留档）

1. Gate-01（分页/批处理基线）
2. Gate-06（工程门禁）
3. Gate-04（统一反馈层）
4. Gate-03（导入 Job 化）
5. Gate-02（契约收敛）
6. Gate-05（架构约束落地）

---

## 4. 退出条件（可以正式进入功能开发）

满足以下条件即宣布“重构阶段收口”：

1. 6 个 Gate 全部达到 DoD，或最多保留 1 项并记录风险与补齐日期。
2. 新功能分支不再接受“顺手重构”型需求，除非直接阻塞功能。
3. 每个新功能 PR 必须声明：是否触达 Gate 约束，若触达需补对应测试。

> 当前判定（2026-02-11）：退出条件已满足，可正式进入功能开发。

---

## 5. 功能开发阶段执行规则（从现在开始）

1. 新功能开发前与合并前都执行 `npm run gate:check`。
2. 非阻塞项（如历史 lint warning 清理、完整插件化）进入“并行治理 backlog”，不阻塞功能交付。
3. 触达 `ProjectService` 或 `CATDatabase` 时，必须通过 `npm run gate:arch` 且补充对应测试。
4. 禁止“顺手重构”扩大改动面；如确需扩面，必须在 PR 中说明收益、风险和回补计划。

---

## 6. 给当前阶段的一句话策略

**先修“会放大未来成本的结构性问题”，再开发功能；修到可控即停，不追求一次性完美架构。**
