# Worktree 任务卡（main）

## 1. 基本信息

- Branch: `main`
- Owner/Agent: Codex (GPT-5)
- 创建时间: 2026-02-14
- 关联需求/Issue: QA 系统是否需要从单文件硬编码拆分为可扩展架构

## 2. 任务目标

- 本分支唯一目标：评估当前 QA 系统的耦合点与拆分必要性，给出可执行改造方案（不直接做大规模重构）。
- 不在本分支处理的内容：与 QA 无关的功能开发、跨模块顺手重构。

## 3. 改动范围（预期）

- 计划修改文件/目录：
  - `DOCS/worktrees/main.md`（本任务卡）
  - 如进入实现阶段，再单独补充具体代码文件范围
- 禁止触达边界（如有）：
  - 未确认方案前不改 `ProjectService`/`CATDatabase`/IPC 契约

## 4. 风险与约束

- 风险点：若直接拆分核心 QA 逻辑，可能影响导出校验与编辑器过滤行为。
- 必须遵守的规则（引用文档）：
  - `DOCS/HANDOFF_LITE.md`
  - `DOCS/WORKTREE_PROTOCOL.md`
  - `DOCS/DEVELOPMENT_GUIDE.md`

## 5. 验证计划

- 计划执行命令：
  - 评估阶段：无
  - 实现阶段（若进入）：`npm run typecheck --workspace=apps/desktop`、`npm run lint --workspace=apps/desktop`、相关单测、`npm run gate:check`
- 验证通过标准：
  - 评估结论具备可落地的分拆路径与回归控制策略

## 6. 执行记录

- 已完成：
  - 已读取 `DOCS/HANDOFF_LITE.md`、`DOCS/WORKTREE_PROTOCOL.md`、`DOCS/CURRENT_STATUS.md`
  - 已创建本任务卡并明确范围
  - 已确认 QA 规则与调用链分布：`packages/core/src/index.ts`、`packages/core/src/TagValidator.ts`、`apps/desktop/src/renderer/src/hooks/useEditor.ts`、`apps/desktop/src/main/services/modules/ProjectFileModule.ts`、`apps/desktop/src/main/services/modules/AIModule.ts`
  - 已实现项目级 QA 设置面板（规则勾选 + 即时 QA 开关）并持久化
  - 已实现文件级 `Run QA` 按钮，按项目配置执行 QA 规则
  - 已将 Editor 的 confirm 即时 QA 改为受项目配置控制
- 未完成：
  - 环境恢复后执行全量 gate 验证
- 关键决策：
  - 结论：需要拆分，但采用“小步分层抽离”，避免一次性大重构

## 7. 验证结果

- 实际执行命令：
  - 文档读取与代码检索（`rg`、`sed`）
  - `npm run typecheck --workspace=apps/desktop`（失败：`tsc: command not found`）
  - `npm run lint --workspace=apps/desktop`（失败：`eslint: command not found`）
  - `npm run lint --workspace=packages/core`（失败：`eslint: command not found`）
- 结果摘要：
  - 翻译项目页新增 `QA Settings` 按钮与配置弹窗（可选规则 + 即时 QA 开关）
  - 文件操作新增一键 `Run QA`，返回错误/警告统计与示例条目
  - `confirm` 即时 QA 已支持按项目配置开启/关闭与规则选择

## 8. 交接信息

- 下一步建议：
  - 安装依赖后补跑 `typecheck/lint/test/gate:check`
  - 可继续扩展每条 QA 规则的阻断级别与执行顺序
  - 可评估将“导出阻断”也改为按项目 QA 设置统一策略
- 下一位接手者最小入口文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/TagValidator.ts`
  - `apps/desktop/src/renderer/src/hooks/useEditor.ts`
  - `apps/desktop/src/main/services/modules/ProjectFileModule.ts`
  - `apps/desktop/src/main/services/modules/AIModule.ts`
- 备注：
  - 本轮已落地功能改造；尚未完成 gate 验证（本机缺少命令依赖）
