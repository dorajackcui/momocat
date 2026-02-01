# Simple CAT Tool 开发规范指南 (专业演进版)

## 1. 核心开发原则 (Golden Rules)
*   **Token-Aware Logic**: 禁止在业务逻辑中将 Segment 视为纯字符串。必须处理 `Token[]` 序列。
*   **Reversible Filters**: 任何导入过滤器必须考虑导出时的保真度。优先实现 XLIFF 1.2 过滤器。
*   **Worker for Heavy Lifting**: 凡是可能导致 UI 掉帧（超过 16ms）的操作，必须放入 Worker 线程。
*   **Database is Truth**: SQLite 数据库是唯一可信的数据源，JSON 快照仅作为前端渲染缓存。

## 2. 目录结构规范
*   `src/main/services/`: 核心业务逻辑（Project, Segment, TM, TB）。
*   `src/main/filters/`: 文件导入导出解析器。
*   `src/workers/`: 密集计算任务处理。
*   `src/renderer/src/components/editor/`: Token-aware 编辑器相关组件。

## 3. 数据模型规范
*   **UUID**: 所有 Segment 使用 UUID 标识。
*   **Hashing**: 使用归一化后的文本生成 Hash，用于重复句识别与传播。

## 4. 样式与 UI
*   使用 **Tailwind CSS** 进行样式开发。
*   编辑器必须实现 **Tag 胶囊化展示**，禁止用户部分删除 Tag 内容。

## 5. 新功能开发流程
1.  **Schema First**: 在 `types.ts` 中定义或更新数据模型。
2.  **Worker/Service Logic**: 实现后端 Service 或 Worker 逻辑。
3.  **IPC Contract**: 定义强类型的 IPC 接口。
4.  **Hook & UI**: 封装 Hook 并开发前端 UI。
