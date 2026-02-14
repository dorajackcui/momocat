# Worktree 任务卡

## 1. 基本信息

- Branch: detached-3dae (HEAD 9af3bb4)
- Owner/Agent: Codex (GPT-5)
- 创建时间: 2026-02-15 00:02:45 +0900
- 关联需求/Issue: 支持的 model 增加时需多处修改，评估并落地集中化管理方案

## 2. 任务目标

- 本分支唯一目标：将支持模型定义改为集中配置，减少新增模型时的多点修改。
- 不在本分支处理的内容：与模型无关的重构、UI 风格改版、数据库结构扩展。

## 3. 改动范围（预期）

- 计划修改文件/目录：`packages/core/src/aiModelRegistry.ts`、`packages/core/src/index.ts`、`apps/desktop/src/main/services/modules/AIModule.ts`、`apps/desktop/src/renderer/src/hooks/projectDetail/useProjectAI.ts`、`packages/db/src/migration/runMigrations.ts`、`packages/core/src/index.test.ts`、`apps/desktop/src/main/services/modules/AIModule.test.ts`、`packages/db/src/migration/runMigrations.test.ts`。
- 禁止触达边界（如有）：`ProjectService` / `CATDatabase` / IPC 契约（除非本任务必需）。

## 4. 风险与约束

- 风险点：现有默认模型、模型路由、下拉选项与后端可用模型列表不一致。
- 必须遵守的规则（引用文档）：`DOCS/HANDOFF_LITE.md`、`DOCS/WORKTREE_PROTOCOL.md`。

## 5. 验证计划

- 依赖准备命令（agent 新开/接管 worktree 场景）：`npm run worktree:deps:link`（如需覆盖：`npm run worktree:deps:link:force`）。
- 计划执行命令：`npm run lint`、`npm run typecheck`、`npm test`（若存在）、`npm run gate:check`。
- 验证通过标准：改动相关检查通过；模型新增仅需改集中配置并可被 UI/逻辑读取。

## 6. 执行记录

- 已完成：读取 handoff/protocol；创建任务卡并写入计划范围；实现模型注册表集中化并替换调用点；补齐 core/AIModule/db migration 相关测试用例。
- 未完成：完整门禁验证（环境缺少依赖，命令无法执行）。
- 关键决策：新增 `packages/core/src/aiModelRegistry.ts` 作为模型唯一入口，其他层统一引用。

## 7. 验证结果

- 实际执行命令：`npm run typecheck`、`npm run lint`、`npm run typecheck --workspace=apps/desktop`、`npx vitest run apps/desktop/src/renderer/src/hooks/projectDetail/useProjectAI.test.ts apps/desktop/src/main/services/modules/AIModule.test.ts packages/db/src/index.test.ts`、`npm run gate:arch`。
- 结果摘要：均未完成有效验证。`typecheck/lint` 因 `tsc/eslint` 不存在失败；`vitest` 触发网络拉取失败（`connect EPERM`）；`gate:arch` 因缺少 `typescript` 包失败。

## 8. 交接信息

- 下一步建议：安装依赖后执行 `npm run gate:check` 进行完整门禁；新增模型时优先编辑 `packages/core/src/aiModelRegistry.ts`。
- 下一位接手者最小入口文件：`packages/core/src/aiModelRegistry.ts`
- 备注：当前 worktree 为 detached HEAD；本次改动未触达 `ProjectService`/`CATDatabase`/IPC 契约。
