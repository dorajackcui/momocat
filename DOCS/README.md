# DOCS 文档导航

最后更新：2026-02-17

本目录已按“规范 / 状态 / 导航 / 历史”分层。默认以代码为准，文档用于快速定位、统一约束、同步进度。

## 交接入口（Handoff）

新 agent / 新会话统一从这里开始：

1. `DOCS/HANDOFF_LITE.md`（默认，1 分钟快速起步）
2. `DOCS/HANDOFF.md`（复杂任务时使用）

## 最小阅读路径（默认）

1. 读 `DOCS/HANDOFF_LITE.md`。
2. 读 `DOCS/CURRENT_STATUS.md`。
3. 开始实现；仅在需要定位代码时再查 `DOCS/PROJECT_MAP_QUICKSTART.md`。

## 当前有效（Active）

- `DOCS/HANDOFF_LITE.md`
  - 轻量交接入口（新对话默认）
- `DOCS/HANDOFF.md`
  - 完整交接系统（深度上下文）
- `DOCS/CURRENT_STATUS.md`
  - 当前阶段、门禁结果、阻塞项、近期优先级（实时执行面板）
- `DOCS/PROJECT_MAP_QUICKSTART.md`
  - 新人/回坑快速定位（按任务找文件 + 关键调用链）
- `DOCS/DEVELOPMENT_GUIDE.md`
  - 功能开发硬性准则（由重构期 gate 沉淀）
- `DOCS/PROJECT_STRUCTURE.md`
  - Monorepo 结构与分层职责
- `DOCS/DATABASE_SCHEMA.md`
  - 当前数据库结构（以 `packages/db/src/migration/runMigrations.ts` 为准）
- `DOCS/ARCHITECTURE.md`
  - 当前实现边界 + 中长期演进方向
- `DOCS/ROADMAP.md`
  - 当前版本阶段目标与里程碑
- `DOCS/architecture/GATE05_GUARDRAILS.json`
  - 架构守卫配置（由 `npm run gate:arch` 校验）

## 历史归档（Archive）

以下文档保留历史背景，不作为当前规范：

- `DOCS/archive/BUG_FIX_EDITOR_WHITE_SCREEN.md`
- `DOCS/archive/MISTAKE_NOTEBOOK.md`
- `DOCS/archive/PRE_FEATURE_GATES_2026-02-11.md`
- `DOCS/archive/REFACTOR_PROGRESS_TRACKER_2026-02-10.md`
- `DOCS/archive/REMEDIATION_PLAN_2026-02-10.md`
- `DOCS/archive/REVIEW_MODULARIZATION_2026-02-09.md`

## 使用建议

1. 默认按“最小阅读路径”执行，不做全量通读。
2. 复杂任务再升级到 `DOCS/HANDOFF.md` 扩展链路。
3. 历史背景只在需要时查看 `DOCS/archive/*`。
