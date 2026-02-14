# HANDOFF 操作系统（单入口）

最后更新：2026-02-14

> 目标：让任何新 agent / 新对话只读这一个文件，就能自动理解项目文档体系并开始工作。  
> 使用方式：直接说“先读 `DOCS/HANDOFF.md` 再开始任务”。

## 1. 单入口规则

1. 新会话只需要先读本文件。
2. 本文件负责分发后续必读文档与执行顺序。
3. 若本文件与其他文档冲突：以代码为准，并在交付前修正文档。

## 2. 标准阅读链路（必须按顺序）

1. `DOCS/CURRENT_STATUS.md`
作用：获取当前阶段、门禁结果、阻塞项、近期优先级。

2. `DOCS/DEVELOPMENT_GUIDE.md`
作用：获取当前功能开发阶段的硬约束（必须遵守的规则）。

3. `DOCS/PROJECT_MAP_QUICKSTART.md`
作用：按任务快速定位入口文件与调用链。

4. `DOCS/PROJECT_STRUCTURE.md`
作用：确认分层边界与目录职责，避免跨层改动。

5. `DOCS/ARCHITECTURE.md`
作用：理解当前实现边界与中长期演进方向（区分 As-Is / To-Be）。

6. `DOCS/DATABASE_SCHEMA.md`（仅当触达数据层时必读）
作用：确认 schema 与迁移事实，避免文档/迁移脚本漂移。

7. `DOCS/ROADMAP.md`（可选）
作用：看阶段性方向，不作为实时执行面板。

8. `DOCS/archive/*`（按需）
作用：只用于历史背景，不作为当前规范依据。

## 3. 决策优先级（冲突时）

1. 代码与测试结果（最高优先级）
2. `DOCS/CURRENT_STATUS.md`（当前状态）
3. `DOCS/DEVELOPMENT_GUIDE.md` + `DOCS/architecture/GATE05_GUARDRAILS.json`（硬规则）
4. 其他 active 文档
5. `DOCS/archive/*`（仅历史）

## 4. 任务寻路表（常用）

1. 改 UI / 交互：先看 `PROJECT_MAP_QUICKSTART` 的 renderer/hook 索引，再看对应组件与 hooks。
2. 改 IPC：先看 `shared/ipc.ts`，再看 `main/ipc/*` 与 `preload/api/*`。
3. 改主流程：先看 `ProjectService`，再看 `services/modules/*`。
4. 改数据库：先看 `DATABASE_SCHEMA.md`，再看 `packages/db/src/migration/runMigrations.ts` 与 repos。
5. 改架构边界：必须同时检查 `DEVELOPMENT_GUIDE.md` 与 `GATE05_GUARDRAILS.json`。

## 5. 开工前输出要求（agent）

agent 在开始编码前应先给出 4 点确认：

1. 当前阶段与门禁状态（来自 `CURRENT_STATUS.md`）。
2. 本次任务会触达的层与文件范围。
3. 需要遵守的硬规则（来自 `DEVELOPMENT_GUIDE.md`）。
4. 预期验证方式（至少包含相关 lint/typecheck/test 或 gate）。

## 6. 收工前文档更新要求

出现以下任一情况，必须同步更新文档：

1. 门禁状态变化：更新 `CURRENT_STATUS.md`。
2. 新增/修改架构硬约束：更新 `DEVELOPMENT_GUIDE.md` 与 `GATE05_GUARDRAILS.json`。
3. 结构或入口变化：更新 `PROJECT_MAP_QUICKSTART.md` / `PROJECT_STRUCTURE.md`。
4. 路线方向调整：更新 `ROADMAP.md`。

## 7. 快速指令模板（给你使用）

你每次开新会话可直接发这句：

`请先阅读 DOCS/HANDOFF.md，并按其中的标准阅读链路完成上下文建立，再开始处理我的需求。`
