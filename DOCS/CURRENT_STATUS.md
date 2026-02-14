# 当前开发状态（更新于 2026-02-14）

> 这是“执行面板”文档：记录当前阶段、门禁状态、近期优先级。  
> 需要实时准确，过时信息优先改这里。

## 1. 当前阶段

1. 阶段：`Feature-First`（功能开发优先）。
2. 约束：只允许“功能实现 + 必要配套治理”，不做独立大重构。
3. 规则来源：`DOCS/DEVELOPMENT_GUIDE.md`。

## 2. 门禁状态（本地核验）

核验日期：2026-02-14

1. `npm run typecheck --workspace=apps/desktop`：通过。
2. `npm run lint --workspace=apps/desktop`：通过（`0 error / 0 warnings`）。
3. `npm run gate:check`：通过。

最新同步：

- 已修复 `gate:arch` 漂移：`DOCS/architecture/GATE05_GUARDRAILS.json` 已补齐 `getProjectTypeByFileId`。
- 已完成首轮 warning 压降：`apps/desktop` 从 `555` 降到 `0`。
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

1. Warning 治理策略：下一步按模块压降 `packages/core` 与 `packages/db` 的剩余 `43` 条 warning。
2. 功能开发新增要求：触达 `ProjectService`/`CATDatabase`/IPC 时，必须补对应测试。
3. 继续保持门禁与代码一致：新增公共 API 时同步更新架构守卫清单。

## 5. 使用方式（给 agent）

1. 开工前先读 `DOCS/HANDOFF.md`，再按其链路读取本文件。
2. 设计/编码时执行 `DOCS/DEVELOPMENT_GUIDE.md`。
3. 定位代码入口看 `DOCS/PROJECT_MAP_QUICKSTART.md`。
4. 完成后更新本文件中的门禁状态和优先级。
