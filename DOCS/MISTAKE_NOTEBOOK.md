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
*更新日期：2026-02-06*

## 4. 编辑器白屏问题系列 (EditorRow Component)

### ❌ 错误 1：函数定义顺序错误
- **现象**：上传 Excel 后进入编辑器白屏。
- **根因**：`restoreCursorPosition` 函数在被调用之前还没有定义（Temporal Dead Zone）。
- **修正**：将函数定义移到所有使用它的地方之前。
- **教训**：在 React 组件中，useCallback 定义的函数必须在使用它的其他 useCallback 之前声明。

### ❌ 错误 2：索引类型混淆
- **现象**：点击删除标签按钮时白屏。
- **根因**：传递给 `deleteTag` 的索引类型错误：
  - `currentTagIndex` 是标签在所有标签中的序号（0, 1, 2...）
  - 但 `deleteTag` 需要的是 token 在整个 tokens 数组中的索引
  - 例如：`[text, tag, text, tag]` 中第二个 tag 的 tagIndex=1，但 tokenIndex=3
- **修正**：在 `renderTokens` 中保存实际的 token 索引 `idx`，并在 `onDelete` 中使用它。
- **教训**：在处理过滤或映射后的数组时，要明确区分"逻辑索引"和"物理索引"。

### ❌ 错误 3：选中删除时的 DOM 同步问题 ⚠️ 关键错误
- **现象**：选中文本和 tag 一起按 Delete 键删除时白屏。
- **错误信息**：`NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`
- **根因**：React 虚拟 DOM 与实际 DOM 不同步
  1. 用户在 contenteditable 中选中内容并按 Delete
  2. 浏览器直接修改 DOM（删除节点）
  3. `handleInput` 事件触发，提取新内容并更新 React 状态
  4. React 尝试重新渲染，但 DOM 已经被浏览器改变
  5. React 找不到要删除的节点，抛出 `removeChild` 错误
- **修正**：
  1. 改进 React key 策略：使用 `tag-${tagIndex}-${content}` 而不是 `tag-${tokenIndex}`
  2. 在 `handleInput` 中保存和恢复选区
  3. 为文本节点也使用独立的计数器生成 key
- **教训**：
  - **contenteditable + React 是危险组合**：浏览器和 React 都想控制 DOM
  - **key 必须基于内容而非位置**：当数组元素改变时，位置索引会导致 React 混淆
  - **需要错误边界**：使用 ErrorBoundary 捕获渲染错误，避免整个应用崩溃

### 通用教训
1. **索引管理**：在数组操作中，始终明确索引的含义（是过滤后的索引还是原始索引）
2. **函数依赖**：useCallback 的依赖数组要完整，但不要包含非 memoized 的函数
3. **错误边界**：关键的用户交互代码必须有错误处理和日志
4. **React key**：在动态列表中，key 应该基于内容而不仅仅是位置
