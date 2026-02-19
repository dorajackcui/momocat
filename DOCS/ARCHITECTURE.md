# Simple CAT Tool 架构说明

最后更新：2026-02-19

> 文档定位：描述“当前实现边界 + 演进目标”。  
> 若与代码冲突，以代码为准；优先参考：`DOCS/PROJECT_STRUCTURE.md`、`DOCS/DATABASE_SCHEMA.md`、`DOCS/DEVELOPMENT_GUIDE.md`。

## 1. 当前实现（As-Is）

### 1.1 分层

- `renderer`（React）
  - 只通过 `services/apiClient.ts` 访问 `window.api`，不直接触达 `ipcRenderer`。
- `preload`
  - 通过 typed bridge 暴露 `DesktopApi`，契约定义在 `apps/desktop/src/shared/ipc.ts`。
- `main`
  - `ProjectService` 作为应用层门面。
  - 业务能力按模块拆分：`ProjectFileModule`、`TMModule`、`TBModule`、`AIModule`。
  - 领域服务：`SegmentService`、`TMService`、`TBService`。
  - IPC 按领域拆分注册：`ipc/projectHandlers.ts`、`tmHandlers.ts`、`tbHandlers.ts`、`aiHandlers.ts`、`dialogHandlers.ts`。
- `packages`
  - `@cat/core`：Token/Segment/Tag 模型与算法。
  - `@cat/db`：SQLite 迁移与 Repo 层。

### 1.2 数据与边界

- 默认离线优先：SQLite（`@cat/db`）为主存储。
- Segment/TM/TB 均以 Token 序列为核心数据结构。
- TM 查询链路（As-Is）：
  - `TMRepo.searchConcordance` 使用 `tm_fts` + `bm25` 作为候选召回主路径，并在 CJK 连续文本场景增加 `LIKE` 回退。
  - Concordance 与编辑器 TM fuzzy 匹配共享同一候选查询，当前统一候选上限为 `10`。
  - `TMService.findMatches` 在 100% 命中后执行 fuzzy 复合打分（Levenshtein + bigram Dice + bonus），阈值 `70`，最终返回 Top `10`。
  - 渲染层 `TMPanel` 对 TM 卡片做防御性截断，最多显示 `5` 条（TB 不受该上限约束）。
- 架构守卫（Gate-05）限制：
  - `ProjectService` 只做编排。
  - `CATDatabase` 不新增跨 repo 编排。
  - 校验脚本：`scripts/gate-architecture-check.mjs`。

## 2. 核心原则

- Token-Based：保证标签与不可译片段安全。
- Offline-First：本地数据库可独立运行。
- Contract-First：Renderer/Main 通过共享 IPC 类型约束。
- Correctness-First：涉及确认、传播、导入补偿的链路优先保证一致性。

## 3. 演进目标（To-Be）

- Worker-Isolated：将更重的解析/批处理持续迁移到隔离执行路径，降低主线程压力。
- Provider-Pluggable：AI/TM/TB 能力逐步走接口抽象，便于替换实现。
- Filter 扩展：在保持导入/导出可逆的前提下扩展更多文件格式。

## 4. 关键调用链（摘要）

1. Renderer 调 `apiClient`。
2. Preload 通过 typed IPC bridge 转发。
3. Main handler 调 `ProjectService`。
4. `ProjectService` 分发到对应 module/service。
5. Adapter/Repo 落到 `@cat/db` 与 SQLite。
