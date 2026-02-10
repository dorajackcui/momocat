# 项目整改计划（2026-02-10）

> 文档定位：针对当前代码审查结论的执行清单  
> 来源：本轮全项目 review（模块化/可维护性/可扩展性）  
> 目标：将“发现的问题”转化为可落地整改步骤，并纳入迭代节奏

---

## 1. 整改目标

1. 修复会影响结果正确性的高优先问题（P1）。
2. 收敛架构和类型边界，降低后续功能迭代的改动半径（P2）。
3. 清理遗留无效模块与流程噪音，保持代码库可读性（P3）。
4. 建立稳定工程质量门禁（typecheck/test/lint），避免技术债继续累积。

---

## 2. 优先级总览

## P1（本周必须完成）

1. `AIModule` 翻译链路提前中断问题（连续空源段触发 `break`）。
2. `useEditor` 保存链路“发出即不管”，失败无回滚无提示。

## P2（本迭代完成）

1. Main/Preload IPC 单点大入口拆分（按领域注册）。
2. 领域契约漂移与 `any` 收敛（TM/TB/Repo/Adapter/IPC）。
3. 主线程同步 I/O 迁移到 Worker/异步管线。
4. lint 流程修复为可执行的 workspace 级门禁。

## P3（跟随重构完成）

1. 清理遗留 no-op 模块（`useTM`）或明确废弃策略。

---

## 3. 分项整改步骤

## 3.1 P1-01：修复 AI 翻译提前中断

### 问题

- 文件：`apps/desktop/src/main/services/modules/AIModule.ts`
- 现状：连续 3 个空源段时直接 `break`，后续有效段落不会再翻译。

### 步骤

1. 将“连续空源段”的处理从 `break` 改为 `continue`，不提前终止全文件扫描。
2. 保留空段过滤逻辑，但确保仅影响当前段，不影响后续段。
3. 为“前段为空、后段有效”补充单测。

### 验收标准

1. 构造包含连续空段 + 后续有效段的文件时，后续有效段能够被翻译。
2. `npm test` 全通过，新增测试覆盖该场景。

---

## 3.2 P1-02：修复编辑器保存链路的可靠性

### 问题

- 文件：`apps/desktop/src/renderer/src/hooks/useEditor.ts`
- 现状：编辑时直接更新本地状态并异步调用保存，失败后用户无感知，状态可能漂移。

### 步骤

1. 增加统一的 `persistSegmentUpdate` 方法，封装保存、错误处理与状态策略。
2. 对关键动作（输入变更、应用 TM、应用术语）增加失败兜底：
   - 记录错误状态（例如 per-segment `saveError`）。
   - 提供最小用户可见反馈（toast/inline 状态）。
3. 为 `persistSegmentUpdate` 增加单元测试（成功、失败、并发覆盖）。
4. 评估是否引入 debounce + 批量提交，降低高频输入压测风险。

### 验收标准

1. 断网/后端报错时，用户可见保存失败提示。
2. 同一段连续编辑不会产生不可见失败。
3. `typecheck + test` 通过。

---

## 3.3 P2-01：拆分 IPC 注册单点

### 问题

- 文件：`apps/desktop/src/main/index.ts`、`apps/desktop/src/preload/index.ts`
- 现状：大量通道集中在单文件，新增能力需要多处手工同步。

### 步骤

1. 新建按领域拆分的注册模块：
   - `ipc/projectHandlers.ts`
   - `ipc/tmHandlers.ts`
   - `ipc/tbHandlers.ts`
   - `ipc/aiHandlers.ts`
   - `ipc/dialogHandlers.ts`
2. `main/index.ts` 仅负责组合注册和应用生命周期。
3. Preload 层同步按领域分组，避免超长单对象。
4. 为关键通道补最小契约测试（至少 smoke test）。

### 验收标准

1. `main/index.ts` 不再包含完整业务通道实现。
2. 新增 IPC 仅需改动对应领域模块 + 契约类型。

---

## 3.4 P2-02：类型契约收敛（去 `any` 与模型对齐）

### 问题

- 涉及：`services/adapters/*`、`packages/db/src/index.ts`、`TMService`、`ProjectService`、`ipc.ts`。
- 现状：关键边界仍有 `any` 和占位字段（如 `TMEntry.projectId` 与多 TM 结构语义不一致）。

### 步骤

1. 先定义稳定 DTO/Record 类型：
   - `TMRecord/MountedTMRecord`
   - `TBRecord/MountedTBRecord`
   - `ProjectListRecord/ProjectFileRecord`
2. Adapter 与 Repo 方法签名改为明确返回类型，不再返回 `any[]`。
3. 处理 `TMEntry.projectId` 漂移：
   - 方案 A：在核心模型中标注为历史兼容字段（可选）。
   - 方案 B：拆出 `TMEntryStored`（数据库层）与 `TMEntryDomain`（业务层）。
4. 清理 `TMService` 中 `(cand as any).tmId` 这类隐式假设。

### 验收标准

1. 关键服务层（TM/TB/Project/Adapter）无新增 `any`。
2. 通道契约变更可在编译期暴露，而非运行期崩溃。

---

## 3.5 P2-03：主线程同步 I/O 下沉

### 问题

- 涉及：`ProjectFileModule`、`SpreadsheetFilter`、导入导出链路。
- 现状：存在 `readFileSync/writeFileSync/copyFileSync/rmSync/unlinkSync`，大文件时会阻塞 main 线程。

### 步骤

1. 文件解析与导入统一进入 worker（TM/TB/Project file import 对齐）。
2. 主进程仅保留任务编排、进度分发、错误聚合。
3. 迁移同步 fs API 到 `fs/promises`（非性能关键可保留少量同步，但需注明理由）。
4. 对 10w+ 行样本做一次导入压测并记录基线。

### 验收标准

1. 导入/导出期间 UI 无明显卡死。
2. 大文件导入时 progress 事件持续可见。

---

## 3.6 P2-04：修复 lint 门禁

### 问题

- 根因：root 运行 `npm run lint --workspaces`，但 `packages/core`、`packages/db` 无 lint script；当前 desktop lint 错误数高。

### 步骤

1. 为 `packages/core` 和 `packages/db` 增加最小 lint 脚本（或从 root 排除并说明策略）。
2. 优先修复“error 级”问题：
   - `no-undef`
   - `no-unused-vars`
   - `no-require-imports`
   - `react-hooks/exhaustive-deps`
3. 统一格式化策略（先 `prettier --write`，再 eslint）。
4. 将 lint 纳入 CI 必过项。

### 验收标准

1. `npm run lint` 在 monorepo 根目录可稳定通过。
2. 不再出现 workspace 缺少脚本导致的流程失败。

---

## 3.7 P3-01：清理遗留 no-op 模块

### 问题

- 文件：`apps/desktop/src/renderer/src/hooks/useTM.ts`
- 现状：模块对外存在，但内部基本 no-op，增加误导与维护噪音。

### 步骤

1. 确认无调用方后删除该 hook。
2. 若需保留兼容，增加 `@deprecated` 标记并在文档中明确迁移入口。

### 验收标准

1. 代码中不存在“名义可用、实际无效”的遗留接口。

---

## 4. 建议执行顺序（两周）

1. 第 1-2 天：完成 P1-01、P1-02（先正确性）。
2. 第 3-5 天：完成 P2-04（lint 门禁）+ P2-02（类型收敛第一批）。
3. 第 6-8 天：完成 P2-01（IPC 拆分）。
4. 第 9-10 天：推进 P2-03（I/O 下沉）并做压测。
5. 第 11 天：完成 P3-01 清理。
6. 第 12-14 天：回归测试与文档更新（Tracker/Roadmap/Development Guide）。

---

## 5. 统一验收命令

```bash
npm run typecheck --workspace=apps/desktop
npm test
npm run lint
```

---

## 6. 文档联动

整改执行时，请同步更新以下文档：

1. `DOCS/REFACTOR_PROGRESS_TRACKER_2026-02-10.md`（状态与勾选项）
2. `DOCS/ROADMAP.md`（里程碑与节奏）
3. `DOCS/DEVELOPMENT_GUIDE.md`（沉淀新规范）

