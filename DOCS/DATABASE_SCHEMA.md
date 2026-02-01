# Simple CAT Tool 数据库 Schema 设计文档 (v0.1)

本文档详细描述了 Simple CAT Tool 当前的数据库设计。在 v0.1 阶段，我们采用 SQLite 作为存储引擎，重点保证数据的一致性、级联删除逻辑以及基础的查询性能。

## 1. 核心设计思路

*   **关系型结构**：采用 `Project -> File -> Segment` 的三级层级结构，通过外键关联。
*   **级联删除 (Cascading)**：启用 `PRAGMA foreign_keys = ON`，当删除项目时自动删除其关联的文件，删除文件时自动删除其关联的句段，防止数据孤岛。
*   **JSON 序列化存储**：对于结构复杂的 `Tokens`（分词结果）和扩展性强的 `Meta`（元数据），采用 JSON 字符串存储，兼顾关系型数据库的严谨与非关系型数据的灵活性。
*   **冗余统计 (Denormalization)**：在 `files` 表中冗余存储 `totalSegments` 和 `confirmedSegments`，以提升列表页面的进度展示速度，避免每次都进行全表聚合计算。

---

## 2. 表结构详解

### 2.1 schema_version (版本管理)
用于管理数据库迁移。
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| version | INTEGER | 当前数据库架构的版本号 |

### 2.2 projects (项目表)
存储翻译项目的元数据。
| 字段 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| id | INTEGER | PRIMARY KEY | 项目唯一标识 (自增) |
| name | TEXT | NOT NULL | 项目名称 |
| srcLang | TEXT | NOT NULL | 源语言代码 (如 en-US) |
| tgtLang | TEXT | NOT NULL | 目标语言代码 (如 zh-CN) |
| createdAt | DATETIME | DEFAULT NOW | 创建时间 |
| updatedAt | DATETIME | DEFAULT NOW | 最后更新时间 |

### 2.3 files (文件表)
存储项目中导入的原始文件信息。
| 字段 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| id | INTEGER | PRIMARY KEY | 文件唯一标识 (自增) |
| projectId | INTEGER | FOREIGN KEY | 所属项目 ID (级联删除) |
| name | TEXT | NOT NULL | 原始文件名 |
| totalSegments | INTEGER | DEFAULT 0 | 总句段数 (冗余统计) |
| confirmedSegments | INTEGER | DEFAULT 0 | 已确认句段数 (冗余统计) |
| createdAt | DATETIME | DEFAULT NOW | 导入时间 |
| updatedAt | DATETIME | DEFAULT NOW | 最后更新时间 |

### 2.4 segments (句段表)
翻译的核心单元，存储原文、译文及其状态。
| 字段 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| segmentId | TEXT | PRIMARY KEY | 唯一 UUID |
| fileId | INTEGER | FOREIGN KEY | 所属文件 ID (级联删除) |
| projectId | INTEGER | FOREIGN KEY | 所属项目 ID (级联删除) |
| orderIndex | INTEGER | NOT NULL | 在原始文件中的物理顺序 |
| sourceTokensJson | TEXT | NOT NULL | 源句分词结果 (JSON) |
| targetTokensJson | TEXT | NOT NULL | 译文分词结果 (JSON) |
| status | TEXT | NOT NULL | 状态: `new`, `draft`, `confirmed` 等 |
| tagsSignature | TEXT | NOT NULL | 占位符指纹 (用于匹配验证) |
| matchKey | TEXT | NOT NULL | 标准化原文 (用于模糊匹配) |
| srcHash | TEXT | NOT NULL | 原文+指纹的哈希 (用于 100% 匹配) |
| metaJson | TEXT | NOT NULL | 扩展信息 (JSON，如备注、行号) |
| updatedAt | DATETIME | DEFAULT NOW | 最后修改时间 |

---

## 3. 索引设计 (Performance)

为了保证大数据量下的响应速度，我们建立了以下索引：
1.  **idx_segment_file_order**: `segments(fileId, orderIndex)` - 保证编辑器加载句段时按原始顺序快速排序。
2.  **idx_segment_file_srcHash**: `segments(fileId, srcHash)` - 用于在同一文件中快速查找重复句段。
3.  **idx_file_project**: `files(projectId)` - 快速检索项目下的所有文件。

---

## 4. 潜在的扩展与修改风险 (v0.2+)

由于你提到 v0.2 后修改会很困难，以下是目前设计的潜在风险点供 Review：

1.  **TM (翻译记忆) 的存储位置**：
    *   *现状*：目前 TM 隐含在 `segments` 表中。
    *   *挑战*：如果 v0.2 引入跨项目的全局 TM，我们需要单独的 `tm_entries` 表，现在的 `srcHash` 和 `matchKey` 设计需要与之兼容。
2.  **版本控制 (Revision History)**：
    *   *现状*：目前 `segments` 只存储最新状态。
    *   *挑战*：如果需要查看翻译历史，需要引入 `segment_versions` 表，这会改变 `segments` 与 `target` 的 1:1 关系。
3.  **多人协作与同步**：
    *   *现状*：目前的 ID 是自增整数（Project/File）。
    *   *挑战*：如果未来支持云同步，整数 ID 极易产生冲突，可能需要全面迁移到 UUID。
4.  **Token 结构变更**：
    *   *现状*：JSON 存储。
    *   *挑战*：虽然 JSON 灵活，但无法直接在数据库层面对 Token 进行查询（例如：“查找所有包含 <b> 标签的译文”）。如果这类查询需求很多，可能需要将标签提取到关联表。

## 5. 结论

当前 Schema 能够完美支撑单机 MVP 版本。如果确信未来会走向**云端同步**或**深度数据挖掘**，建议在 v0.1 结束前考虑将 Project/File ID 改为 UUID。
