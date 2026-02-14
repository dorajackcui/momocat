# WORKTREE_PROTOCOL（并行开发协议）

最后更新：2026-02-14

> 目标：让多 worktree 并行开发时，任务边界、交接、回收都可控。

## 1. 适用范围

1. 同时存在 2 个及以上并行开发分支。
2. 同一阶段内多个 agent 分工实现不同子任务。

## 2. 基本原则

1. 分支只做单一目标，避免跨任务混改。
2. 每个 worktree 必须有独立任务卡：`DOCS/worktrees/<branch>.md`。
3. 全局事实写 `DOCS/CURRENT_STATUS.md`；分支细节写任务卡。
4. 合并前必须通过约定验证（至少 `gate:check` 或明确豁免）。

## 3. 分支与任务卡规则

1. 分支命名遵循仓库约定（例如 `codex/<topic>`）。
2. 创建分支后立即创建任务卡：`DOCS/worktrees/<branch>.md`。
3. 任务卡使用模板：`DOCS/worktrees/TEMPLATE.md`。
4. 任务卡必须包含：目标、范围、风险、验证、待交接项。

## 4. 文档职责分离

1. `DOCS/CURRENT_STATUS.md`  
只记录“全局”门禁状态、全局阻塞、全局优先级。

2. `DOCS/worktrees/<branch>.md`  
记录“分支”上下文、变更、验证结果、下一位接手者信息。

3. `DOCS/HANDOFF_LITE.md` / `DOCS/HANDOFF.md`  
只定义流程，不记录具体分支细节。

## 5. 开始任务流程（并行模式）

1. 读 `DOCS/HANDOFF_LITE.md`。
2. 读 `DOCS/WORKTREE_PROTOCOL.md`。
3. 读或创建 `DOCS/worktrees/<branch>.md`。
4. 在任务卡写明“本次计划改动范围”后再开始编码。

## 6. 收工交接流程

1. 更新任务卡中的“已完成 / 未完成 / 风险 / 验证结果”。
2. 若影响全局状态，同步更新 `DOCS/CURRENT_STATUS.md`。
3. 在任务卡记录下一位接手者最小启动信息（入口文件 + 待办）。

## 7. 冲突处理

1. 同文件多分支冲突时，以“目标分支任务卡中的范围定义”判定优先级。
2. 无法快速判定时，先缩小改动面，拆出共享前置改动再继续并行。
3. 禁止在未更新任务卡的情况下直接推进高风险改动。
