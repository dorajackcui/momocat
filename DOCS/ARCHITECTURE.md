# Simple CAT Tool 架构蓝图 (V2 - 专业演进版)

> 文档定位：中长期架构蓝图（方向性文档）  
> 最后校准：2026-02-10  
> 适用范围：描述目标架构与演进方向，不作为当前实现的唯一事实来源。  
> 若与代码或其他文档冲突，请优先参考：  
> - `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/DOCS/REFACTOR_PROGRESS_TRACKER_2026-02-10.md`  
> - `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/DOCS/ROADMAP.md`  
> - `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/DOCS/PROJECT_STRUCTURE.md`  
> - `/Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/DOCS/DATABASE_SCHEMA.md`

本文档定义了从 MVP 向专业级 CAT 工具（如 memoQ, Smartcat）演进的系统架构。

## 1. 核心设计原则 (The Specter)
*   **Token-Based (基于令牌)**：Segment 存储必须是 Token 序列而非纯字符串，以保证 Tags 和不可译片段的安全。
*   **Offline-First (离线优先)**：SQLite 为真相，JSON 为缓存，支持本地项目库与本地 TM/TB。
*   **Worker-Isolated (计算隔离)**：Main 进程不处理重循环；解析、匹配、QA 等耗时操作全部进入 Workers，确保 UI 不卡顿。
*   **XLIFF-First (XLIFF 优先)**：以 XLIFF 1.2 为试金石，强制实现可逆的文件过滤体系。

## 2. 系统分层职责

### A. Renderer (UI 层)
*   **Editor**: Token-aware 编辑器，支持胶囊化 Tag 展示与保护。
*   **Panels**: 实时展示 TM 命中、术语高亮、QA Issues。
*   **State**: 通过自定义 Hooks 管理 `currentView` 和 `activeProject`。

### B. Main (应用服务层)
*   **ProjectService**: 项目生命周期、语言对、状态统计、快照管理。
*   **SegmentService**: 段落读写、状态流转（new/draft/confirmed）、锁定管理。
*   **TMService**: 模糊匹配查询、100% 匹配、自动传播 (Propagation)。
*   **TBService**: 术语库 CRUD、实时匹配算法。
*   **FilterRegistry**: 导入/导出过滤器注册中心。

### C. Workers (计算层)
*   **Heavy Tasks**: 大文件解析、批量预翻译、批量 QA、复杂相似度计算。
*   **Isolation**: 避免 IPC/主线程因长耗时任务阻塞。

## 3. 核心数据模型 (Token Spec)
所有 TM/TB/QA 均以 Tokens 为输入输出。Token 类型包括：
*   `text`: 可译文本。
*   `tag`: 内联标记（占位符、配对标签）。
*   `locked`: 不可译内容（如代码段）。

## 4. 关键流程：可逆合并 (Round-trip)
Filter 必须实现 `import` 与 `export`：
1.  **Import**: 输出标准化 Segments + Mapping（用于定位原文位置）。
2.  **Export**: 根据 Segments + Mapping 合并回原格式，确保格式保真。
