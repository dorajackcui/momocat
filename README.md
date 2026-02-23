# Simple CAT Tool

一个基于 Electron + React + TypeScript 的桌面 CAT（计算机辅助翻译）工具。

## 当前状态

- 当前主线：`v0.3` 进行中
- 当前重点：**正确性收口 + 解耦改造 + 类型契约收紧**
- 版本与状态：`DOCS/40_STATUS_AND_ROADMAP.md`

## 主要能力

- Token-based 编辑（标签/占位符安全）
- 多 TM 架构（Working TM + Main TM）
- 100% 匹配 + 模糊匹配
- Concordance（FTS5）
- TB 术语库（管理、挂载、编辑器命中）
- CSV/XLSX 导入导出（含列映射）
- AI 翻译与项目级 AI 设置

## 快速开始

### 环境

- Node.js 18+
- npm

### 运行

```bash
npm install
npm run dev
```

### 构建

```bash
npm run build
npm run pack
```

### 测试

```bash
npm test
```

## 项目结构（简版）

```text
apps/desktop/    # Electron 应用（main/preload/renderer）
packages/core/   # 核心类型与算法
packages/db/     # SQLite 数据层（迁移 + repos）
DOCS/            # 项目文档
```

详细结构见：`DOCS/10_ARCHITECTURE.md`

## 文档入口

- Start here: `DOCS/00_START_HERE.md`
- Architecture: `DOCS/10_ARCHITECTURE.md`
- Engineering runbook: `DOCS/20_ENGINEERING_RUNBOOK.md`
- Data model: `DOCS/30_DATA_MODEL.md`
- Status and roadmap: `DOCS/40_STATUS_AND_ROADMAP.md`
- Historical consolidation: `DOCS/90_HISTORY_CONSOLIDATED.md`

## 运行数据说明

- 开发模式下用户数据默认在：`.cat_data/`
- 该目录包含 SQLite 数据库与项目文件缓存

## License

MIT
