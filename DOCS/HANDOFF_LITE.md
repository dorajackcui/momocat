# HANDOFF_LITE（快速入口）

最后更新：2026-02-17

> 目标：新 agent / 新对话 1 分钟内完成上下文建立。  
> 默认优先读本文件；需要深度背景时再读 `DOCS/HANDOFF.md`。

## 1. 默认只读（最小集合）

1. `DOCS/CURRENT_STATUS.md`  
获取当前门禁状态、阻塞项、优先级。

2. `DOCS/PROJECT_MAP_QUICKSTART.md`（按需）  
快速定位代码入口和调用链。

## 2. 必须遵守（硬规则）

1. `npm run gate:check` 不通过时，不合并。
2. 触达 `ProjectService` / `CATDatabase` / IPC 契约时，必须补测试。
3. 不做“顺手扩面重构”；只做当前任务直接相关改动。
4. 文档与代码冲突时，以代码为准，并在本次改动补文档。

## 3. 开工前最小输出（3 点）

1. 当前阶段与门禁状态（来自 `CURRENT_STATUS.md`）。
2. 本次会改哪些层和文件。
3. 本次验证命令（lint/typecheck/test/gate）。

## 4. 收工前要更新什么

1. 全局状态变化：更新 `DOCS/CURRENT_STATUS.md`。
2. 若改了规则/边界：更新 `DOCS/DEVELOPMENT_GUIDE.md` 和相关文档。
