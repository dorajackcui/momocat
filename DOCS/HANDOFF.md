# HANDOFF（完整版交接系统）

最后更新：2026-02-17

> 这是完整交接文档。  
> 日常新会话建议先读轻量版：`DOCS/HANDOFF_LITE.md`。
> 若任务不复杂，不需要阅读本文件。

## 1. 使用场景

1. 任务涉及跨层改动或架构边界。
2. 需要做架构决策或改动公共契约（IPC/数据库/核心服务）。
3. `HANDOFF_LITE` 无法覆盖当前问题（例如冲突判断、规则歧义）。

## 2. 双入口策略

1. 快速起步（默认）：`DOCS/HANDOFF_LITE.md`。
2. 深度上下文（复杂任务）：只补读本文件列出的“扩展材料”。

## 3. 扩展阅读链路（仅复杂任务）

1. `DOCS/CURRENT_STATUS.md`  
   当前阶段、门禁状态、全局阻塞。

2. `DOCS/DEVELOPMENT_GUIDE.md`  
   当前开发阶段硬规则。

3. `DOCS/PROJECT_MAP_QUICKSTART.md`  
   任务到代码入口的快速映射。

4. `DOCS/PROJECT_STRUCTURE.md`  
   目录与分层边界。

5. `DOCS/ARCHITECTURE.md`  
   As-Is / To-Be 边界与演进方向。

6. `DOCS/DATABASE_SCHEMA.md`（触达数据层时必读）

## 4. 冲突优先级

1. 代码与测试结果
2. `DOCS/CURRENT_STATUS.md`
3. `DOCS/DEVELOPMENT_GUIDE.md` + `DOCS/architecture/GATE05_GUARDRAILS.json`
4. 其他 Active 文档
5. `DOCS/archive/*`（仅历史参考）

## 5. 额外输出要求（在 LITE 基础上补充）

复杂任务开始编码前，额外补充：

1. 关键边界假设（哪些模块不能动，哪些契约必须保持兼容）。
2. 回归风险点（本次最可能引入回归的位置）。
3. 验证通过标准（不仅命令，还包括行为标准）。

## 6. 收工前文档更新要求（复杂任务）

1. 全局状态变化：更新 `DOCS/CURRENT_STATUS.md`。
2. 规则/边界变化：更新相应规范文档。

## 8. 渲染层风格统一入口（新增）

1. 主题与语义 token：
   - `apps/desktop/src/renderer/src/index.css`
   - `apps/desktop/tailwind.config.js`
2. UI 基件目录：
   - `apps/desktop/src/renderer/src/components/ui`
3. 风格门禁：
   - `scripts/gate-style-classes.mjs`
   - `npm run gate:style`（已并入 `npm run gate:check`）

## 7. 你可直接复用的指令

1. 快速模式：  
   `请先读 DOCS/HANDOFF_LITE.md，再开始任务。`

2. 深度模式：  
   `请先读 DOCS/HANDOFF.md，并按标准阅读链路建立完整上下文后再开始。`
