# DOCS 文档导航

最后更新：2026-02-10

本目录已按“当前有效 / 历史归档”做清理，避免后续改造时被旧信息误导。

## 当前有效（Active）

- `DOCS/REFACTOR_PROGRESS_TRACKER_2026-02-10.md`
  - 改造总看板（优先级、待办、DoD、风险、每日进度）
- `DOCS/ROADMAP.md`
  - 中短期路线图（与当前改造状态同步）
- `DOCS/PROJECT_STRUCTURE.md`
  - 当前目录结构与分层职责
- `DOCS/DATABASE_SCHEMA.md`
  - 当前数据库 Schema（以 `packages/db/src/migration/runMigrations.ts` 为准）
- `DOCS/DEVELOPMENT_GUIDE.md`
  - 当前开发规范（事务、类型边界、测试要求）
- `DOCS/ARCHITECTURE.md`
  - 架构蓝图与长期方向（高层设计）
- `DOCS/REVIEW_MODULARIZATION_2026-02-09.md`
  - 审查快照（历史评估基线，非实时状态）

## 历史归档（Archive）

- `DOCS/archive/BUG_FIX_EDITOR_WHITE_SCREEN.md`
- `DOCS/archive/MISTAKE_NOTEBOOK.md`

这些文档保留排障历史，不作为当前设计或流程规范。

## 使用建议

1. 日常开发优先看 `REFACTOR_PROGRESS_TRACKER_2026-02-10.md`。
2. 实现前看 `DEVELOPMENT_GUIDE.md`，避免新增技术债。
3. 结构或边界有疑问时看 `PROJECT_STRUCTURE.md` + `DATABASE_SCHEMA.md`。
4. 每次里程碑推进后同步更新 Tracker 和 Roadmap。
