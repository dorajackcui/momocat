# 开发指南（更新于 2026-02-17）

本指南是当前功能开发阶段的执行规范。以下规则来自重构期 gate 与整改文档，仍然必须遵守。

## 阅读策略（避免文档负担）

1. 默认不要求每次执行前通读本文件；先按 `DOCS/HANDOFF_LITE.md` 开工。
2. 仅在以下场景再回到本文件逐条核对：触达核心边界、`gate:check` 失败、需要调整规则。
3. 若本文件与代码行为冲突，以代码与测试结果为准，并在同次改动修正文档。

## 0. 当前阶段定义

1. 当前阶段为“功能开发优先（Feature-First）”。
2. 架构治理只允许作为功能改动配套，不允许独立扩面。
3. 任何触达核心边界的改动都必须通过 gate 门禁并补测试。

## 1. 必须遵守的硬性准则（来自重构期沉淀）

1. Gate 先行：
   `npm run gate:check` 不通过时，不进入新功能开发，不合并变更。

2. 架构边界不破坏：
   `ProjectService` 只做编排，业务逻辑放 `services/modules/*`；
   `CATDatabase` 仅保留 repo 聚合和事务入口，不新增跨 repo 业务编排。

3. 契约单一来源：
   Renderer/Main IPC 类型统一由 `apps/desktop/src/shared/ipc.ts` 维护，禁止多处重复定义。

4. 正确性优先于“代码好看”：
   涉及确认链路、批量处理、导入导出时，必须先保证事务一致性、失败语义和可恢复性。

5. 导入失败必须可观测：
   导入补偿不能静默失败；cleanup 失败必须可追踪（日志/结构化错误/组合错误）。

6. 禁止“全量魔法值读法”：
   禁止回退到 `1000000` 这类全量拉取，统一使用分页/批处理。

7. 用户可见失败反馈：
   编辑保存、导入、批处理等异步动作必须给出可见错误反馈，不允许“发出即不管”。

8. 禁止顺手重构扩面：
   PR 只做“功能本身 + 直接阻塞问题 + 必要测试”；扩面必须在 PR 里显式说明收益/风险/回补计划。

## 2. 分层约定

### 2.1 主进程

- `services/modules/*`：按业务能力拆分模块（文件、TM、TB、AI）。
- `services/adapters/*`：基础设施适配层（当前为 SQLite）。
- `services/ports.ts`：模块依赖抽象端口。
- `ProjectService`：应用层门面，仅编排。

### 2.2 渲染层

- 页面容器负责编排，复杂业务放入 hooks。
- 统一通过 `apiClient` 调主进程，不在组件中直接访问 `window.api`。

### 2.3 共享契约

- IPC 请求/响应类型统一定义在 `apps/desktop/src/shared/ipc.ts`。
- preload 与 renderer 必须复用同一套类型。

## 3. 测试与门禁

### 3.1 必过命令

```bash
npm run gate:check
```

`gate:check` 当前包含：

1. `npm run typecheck --workspace=apps/desktop`
2. `npm run gate:arch`
3. `npm run gate:style`
4. `npm run lint`
5. `npm run gate:smoke:large-file`

### 3.2 失败处理规则

1. 任一 gate 失败，先修 gate，再继续功能开发。
2. 禁止跳过 smoke/gate 直接合并；如需豁免，必须在 PR 明确风险与回补时间。
3. lint 当前允许 warning 基线，但新增 warning 需在同 PR 解释并控制范围。

## 5. 渲染层视觉规范（语义化主题）

1. 视觉 token 与基础语义类集中维护于：
   - `apps/desktop/src/renderer/src/index.css`
   - `apps/desktop/tailwind.config.js`
2. 渲染组件优先复用 `apps/desktop/src/renderer/src/components/ui/*`（Button/Card/Input/Modal 等）。
3. 业务组件中禁止直接写硬编码颜色类（如 `bg-gray-*`/`text-blue-*`），由 `npm run gate:style` 强制校验。
4. 状态色策略：主交互走 `brand`，状态反馈走 `success`/`warning`/`danger`/`info`。

## 4. 文档联动要求

1. 开发前先读：`DOCS/HANDOFF_LITE.md`（复杂任务再读 `DOCS/HANDOFF.md`）。
2. 若改动边界/规则：同步更新本文件与 `DOCS/architecture/GATE05_GUARDRAILS.json`。
3. 文档与代码冲突时，以代码为准，并在本次改动补齐文档。
