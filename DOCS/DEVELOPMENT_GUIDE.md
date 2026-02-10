# 开发指南（更新于 2026-02-10）

本指南面向当前改造阶段，目标是：

1. 保证正确性（避免半状态）
2. 推进解耦（可替换 TM/TB/AI/DB）
3. 收紧类型边界（减少 `any`）

## 1. 关键原则

- **Correctness First**：先保证事务与异常补偿，再做结构美化。
- **Ports First**：主流程优先依赖 `ports.ts` 抽象，不直接依赖具体基础设施实现。
- **Typed Contract First**：renderer 与 main 的边界通过 shared IPC 类型约束。
- **Small Safe Steps**：每次改动优先小步可验证，附带测试。

## 2. 分层约定

### 2.1 主进程

- `services/modules/*`：按业务能力拆分模块（文件、TM、TB、AI）
- `services/adapters/*`：基础设施适配层（当前为 SQLite）
- `services/ports.ts`：模块依赖的抽象端口（逐步去 `any`）
- `ProjectService`：应用层编排入口，避免再次变成“超级类”

### 2.2 渲染层

- 页面容器负责编排，复杂业务放入 hooks
- 统一通过 `apiClient` 调主进程，不在组件中直接访问 `window.api`
- 领域拆分优先：`files/tm/tb/ai`

### 2.3 共享契约

- IPC 请求/响应类型统一定义在 `apps/desktop/src/shared/ipc.ts`
- preload 与 renderer 必须复用同一套类型，不允许重复定义

## 3. 正确性要求

1. 段落确认链路（状态更新 + TM + 传播）必须保持事务一致性。
2. 批量操作必须明确失败语义（全量原子 or 部分成功+明细）。
3. 导入链路必须有补偿逻辑，且 cleanup 失败要可观测。

## 4. 测试要求

### 必做

- 每次改动至少覆盖一个“成功路径”与一个“失败路径”。
- 涉及事务/补偿的改动必须新增回滚场景测试。

### 推荐命令

```bash
npx tsc -p apps/desktop/tsconfig.json --noEmit
npx vitest run
```

## 5. 文档维护约定

1. 改造进度统一记录在 `DOCS/REFACTOR_PROGRESS_TRACKER_2026-02-10.md`。
2. 路线调整同步更新 `DOCS/ROADMAP.md`。
3. 历史排障文档放入 `DOCS/archive/`，不作为当前规范。
