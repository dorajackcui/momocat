# Bug 修复：编辑器白屏问题

## 问题 1：初次进入编辑器白屏

### 问题描述
上传 Excel 文件后，点击进入编辑器时出现白屏，没有任何内容显示。

### 根本原因
在 `apps/desktop/src/renderer/src/components/EditorRow.tsx` 文件中，`restoreCursorPosition` 函数在被调用之前还没有定义，导致 JavaScript 运行时错误。

### 具体问题
```typescript
// ❌ 错误：在定义之前就被使用
const handleInsertTag = useCallback((tagIndex: number) => {
  // ...
  setTimeout(() => {
    restoreCursorPosition(newCursorPosition);  // 这里调用了
  }, 0);
}, [sourceTags, segment.targetTokens, segment.segmentId, onChange, restoreCursorPosition]);

// 函数定义在后面
const restoreCursorPosition = useCallback((position: number) => {
  // ...
}, []);
```

此外，`restoreCursorPosition` 函数被定义了两次，导致重复声明错误。

### 修复方案
将 `restoreCursorPosition` 函数的定义移到所有使用它的函数之前，并删除重复的定义。

---

## 问题 2：删除标签时白屏

### 问题描述
能够打开编辑器，但尝试删除某个标签（tag）时，应用再次白屏。

### 根本原因
在 `renderTokens` 函数中，传递给 `TagCapsule` 的 `onDelete` 回调使用了错误的索引：
- `currentTagIndex` 是标签在所有标签中的序号（0, 1, 2...）
- 但 `deleteTag` 方法需要的是 token 在整个 tokens 数组中的索引

### 具体问题
```typescript
// ❌ 错误：使用 tag 索引而不是 token 索引
const renderTokens = useCallback((tokens: Token[], isSource: boolean) => {
  let tagIndex = 0;
  return tokens.map((token, idx) => {
    if (token.type === 'tag') {
      const currentTagIndex = tagIndex;
      tagIndex++;
      return (
        <TagCapsule
          index={currentTagIndex}
          onDelete={(index) => {
            // index 是 tag 索引（0, 1, 2...）
            // 但 deleteTag 需要 token 索引（可能是 0, 2, 4...）
            const newTokens = tagManagerRef.current.deleteTag(segment.targetTokens, index);
            // ...
          }}
        />
      );
    }
  });
}, []);
```

**示例说明**：
假设 tokens 数组是：`[text, tag, text, tag, text]`
- 第一个 tag 的 `currentTagIndex` = 0，token 索引 = 1 ✅
- 第二个 tag 的 `currentTagIndex` = 1，token 索引 = 3 ❌

当删除第二个 tag 时，传入的是 1，但实际应该删除索引 3 的 token。

### 修复方案
在 `renderTokens` 函数中，保存实际的 token 索引 `idx`，并在 `onDelete` 回调中使用它。

```typescript
// ✅ 正确：使用 token 索引
const renderTokens = useCallback((tokens: Token[], isSource: boolean) => {
  let tagIndex = 0;
  return tokens.map((token, idx) => {
    if (token.type === 'tag') {
      const currentTagIndex = tagIndex;
      const tokenIndex = idx; // 保存实际的 token 索引
      tagIndex++;
      return (
        <TagCapsule
          index={currentTagIndex}
          onDelete={(index) => {
            // 使用 tokenIndex 而不是 index
            const newTokens = tagManagerRef.current.deleteTag(segment.targetTokens, tokenIndex);
            // ...
          }}
        />
      );
    }
  });
}, []);
```

---

## 影响范围
- 文件：`apps/desktop/src/renderer/src/components/EditorRow.tsx`
- 影响功能：
  - 编辑器渲染
  - 标签插入
  - 标签删除
  - 光标位置恢复

## 测试验证
1. 启动应用：`npm run dev`
2. 创建项目并上传 Excel 文件
3. 点击文件进入编辑器 ✅
4. 尝试删除标签（点击标签上的删除按钮）✅
5. 验证标签被正确删除，编辑器不会白屏 ✅

## 预防措施
1. **函数定义顺序**：在组件中，将工具函数定义在使用它们的函数之前
2. **索引类型区分**：明确区分不同类型的索引（tag 索引 vs token 索引）
3. **类型安全**：使用 TypeScript 的类型系统来区分不同的索引类型
4. **代码审查**：在涉及数组操作时，仔细检查索引的含义

## 相关概念

### Temporal Dead Zone (TDZ)
- `const` 和 `let` 声明的变量在声明之前不能被访问
- 即使在同一作用域内，也必须先声明后使用

### 索引混淆问题
在处理过滤或映射后的数组时，要特别注意：
- **逻辑索引**：元素在子集中的位置（如第几个 tag）
- **物理索引**：元素在原始数组中的位置（如第几个 token）

## 修复日期
2026-02-06

## 修复人员
Kiro AI Assistant
