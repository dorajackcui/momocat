# HANDOFF（完整版交接系统）

最后更新：2026-02-14

> 这是完整交接文档。  
> 日常新会话建议先读轻量版：`DOCS/HANDOFF_LITE.md`。

## 1. 使用场景

1. 新 agent / 新对话需要建立完整项目上下文。
2. 任务涉及跨层改动、架构边界、或多人并行 worktree。

## 2. 双入口策略

1. 快速起步（默认）：`DOCS/HANDOFF_LITE.md`
2. 深度上下文（复杂任务）：`DOCS/HANDOFF.md`（本文件）

## 3. 标准阅读链路（完整版）

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

7. `DOCS/WORKTREE_PROTOCOL.md`（并行模式必读）

8. `DOCS/worktrees/<branch>.md`（并行模式必读）

## 4. 冲突优先级

1. 代码与测试结果
2. `DOCS/CURRENT_STATUS.md`
3. `DOCS/DEVELOPMENT_GUIDE.md` + `DOCS/architecture/GATE05_GUARDRAILS.json`
4. 其他 Active 文档
5. `DOCS/archive/*`（仅历史参考）

## 5. 并行 worktree 约定（摘要）

1. 每个分支必须有任务卡：`DOCS/worktrees/<branch>.md`。
2. 全局状态只写 `CURRENT_STATUS`；分支细节只写任务卡。
3. 合并前按协议执行验证并更新交接信息。

## 6. 开工前输出要求

agent 开始编码前需明确：

1. 当前阶段与门禁状态。
2. 本次触达层与文件范围。
3. 本次硬规则约束。
4. 验证命令与通过标准。

## 7. 收工前文档更新要求

1. 全局状态变化：更新 `DOCS/CURRENT_STATUS.md`。
2. 分支进展变化：更新 `DOCS/worktrees/<branch>.md`。
3. 规则/边界变化：更新相应规范文档。

## 8. 你可直接复用的指令

1. 快速模式：  
`请先读 DOCS/HANDOFF_LITE.md，再开始任务。`

2. 并行 worktree 模式：  
`请先读 DOCS/HANDOFF_LITE.md，然后只读 DOCS/worktrees/<branch>.md 和关联文件，按 DOCS/WORKTREE_PROTOCOL.md 执行。`

3. 深度模式：  
`请先读 DOCS/HANDOFF.md，并按标准阅读链路建立完整上下文后再开始。`
