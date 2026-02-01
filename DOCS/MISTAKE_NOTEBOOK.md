# Simple CAT Tool - 错题本 (Mistake Notebook)

为了确保项目的稳健性，记录在 v0.1 重构过程中遇到的关键错误及解决方案。

## 1. 架构与编译 (Architecture & Build)

### ❌ 错误：跨包引用导致编译失败
- **现象**：`apps/desktop` 无法找到 `@cat/db` 的类型或产物。
- **根因**：TypeScript Project References 要求被引用的项目必须开启 `composite: true`。
- **修正**：在 `packages/core/tsconfig.json` 和 `packages/db/tsconfig.json` 中开启 `composite: true`。
- **教训**：Monorepo 中包之间的依赖关系必须在 TS 配置层面严格闭环。

### ❌ 错误：ESM 模块冲突 (SyntaxError)
- **现象**：Electron 主进程报错 `Cannot use import statement outside a module`。
- **根因**：子包配置为 ESM，但 Electron 主进程以 CJS 方式 `require` 它们。
- **修正**：在 `electron.vite.config.ts` 中使用 `externalizeDepsPlugin({ exclude: ['@cat/core', '@cat/db'] })`，强制 Vite 处理这些子包源码。
- **教训**：不要信任默认的外部化逻辑，本地 Workspace 包应优先参与打包编译。

## 2. Electron 运行时 (Electron Runtime)

### ❌ 错误：阻塞式 UI 导致崩溃 (prompt)
- **现象**：`Uncaught (in promise) Error: prompt() is and will not be supported`。
- **根因**：在渲染进程中使用了原生 `prompt()`，这在现代 Electron/沙盒环境中被禁用。
- **修正**：移除 `prompt()`，改用默认值或自定义 React Modal。
- **教训**：**绝对禁止**在 Electron 项目中使用 `alert/confirm/prompt`。

### ❌ 错误：数据库路径不可写
- **现象**：`SqliteError: unable to open database file (SQLITE_CANTOPEN)`。
- **根因**：默认的 `app.getPath('userData')` 在某些开发环境下权限不足或目录未创建。
- **修正**：开发模式下显式使用 `app.setPath('userData', ...)` 将数据重定向到项目根目录下的 `.cat_data`。
- **教训**：数据存储路径必须具备明确的“预创建”逻辑。

## 3. 业务逻辑 (Business Logic)

### ❌ 错误：SQL 语法 typo
- **现象**：批量导入句段时静默失败。
- **根因**：`bulkInsertSegments` 的 SQL 语句中多写了一个括号 `((...)`。
- **修正**：修正 SQL 模板字符串。
- **教训**：数据库操作必须伴随明确的 `console.log` 追踪插入数量，不能只看 SQL 是否执行。

### ❌ 错误：缺乏交互反馈
- **现象**：导入大文件后界面无反应，用户以为死机。
- **根因**：缺乏 Loading 状态和自动跳转逻辑。
- **修正**：新增 `Processing...` 遮罩层，并实现导入成功后自动进入 Editor 的逻辑。
- **教训**：任何耗时超过 500ms 的操作都必须有视觉反馈。

---
*更新日期：2026-02-01*
