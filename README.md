# Simple CAT Tool

一个专业级的计算机辅助翻译（CAT）工具，基于 Electron、React 和 TypeScript 构建。

## 特性

### 核心功能
- ✅ **Token-based 架构**：安全处理标签和占位符
- ✅ **多 TM 系统**：Working TM + Main TM 挂载
- ✅ **模糊匹配**：70-99% 相似度匹配（Levenshtein 算法）
- ✅ **Concordance 搜索**：FTS5 全文索引语境检索
- ✅ **TB 术语库系统**：项目级挂载、术语导入、编辑器实时术语命中
- ✅ **CAT 混合候选面板**：TM/TB 同列展示，双击直接应用
- ✅ **QA 验证**：Tag 完整性检查
- ✅ **自动传播**：重复句自动填充（带撤销）
- ✅ **虚拟滚动**：支持 10,000+ 段落流畅编辑

### 项目管理
- ✅ 项目-文件-段落三层架构
- ✅ 多文件项目支持
- ✅ 导入/导出（CSV/XLSX，支持列选择器）
- ✅ TM 导入向导
- ✅ TB 导入向导

## 项目进度

- ✅ **v0.2 已完成**：多 TM、Concordance、标签安全编辑、基础 QA、自动传播
- 🚧 **v0.3 进行中**：术语库（TB）主链路已落地（数据层 / IPC / 管理页 / 编辑器命中）
- 🧭 **下一步重点**：批量 QA、预翻译策略增强、更多自动化工作流

## 快速开始

### 环境要求
- Node.js (v18+)
- npm/yarn/pnpm

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发模式
npm run dev

# 构建生产版本
npm run build
```

## 项目结构

```
simple-cat-tool/
├── apps/desktop/                         # Electron 主应用
│   ├── src/main/                         # 主进程（服务层）
│   │   ├── services/
│   │   │   ├── ProjectService.ts         # 项目编排（文件、导入导出、TM/TB 管理、AI）
│   │   │   ├── SegmentService.ts         # 段落更新、确认、传播
│   │   │   ├── TMService.ts              # TM 入库与匹配
│   │   │   └── TBService.ts              # TB 术语匹配
│   │   ├── filters/                      # 文件过滤与解析（CSV/XLSX）
│   │   ├── tmImportWorker.ts             # TM 导入 Worker
│   │   └── index.ts                      # IPC 注册与应用启动
│   ├── src/preload/                      # IPC 桥接（window.api）
│   └── src/renderer/src/                 # 前端 UI
│       ├── components/
│       │   ├── Editor.tsx                # 双栏编辑器 + 右侧 CAT/TM/TB/Concordance 面板
│       │   ├── ProjectDetail.tsx         # 项目详情（文件、TM 挂载、TB 挂载）
│       │   ├── TMManager.tsx             # 全局 TM 资产管理
│       │   └── TBManager.tsx             # 全局 TB 资产管理
│       └── hooks/
│           └── useEditor.ts              # 编辑状态、TM/TB 命中、段落更新
├── packages/
│   ├── core/                             # 核心类型与算法（Token/Tag/TM/TB）
│   └── db/                               # SQLite 数据层（迁移 + 仓储）
├── DOCS/                                 # 架构与开发文档
├── out/                                  # 编译输出目录
└── .cat_data/                            # 本地运行数据（DB、项目文件缓存）
```

详细说明请查看 [项目结构文档](DOCS/PROJECT_STRUCTURE.md)。

## 文档

- [项目结构说明](DOCS/PROJECT_STRUCTURE.md) - 理解 Monorepo 架构
- [架构设计](DOCS/ARCHITECTURE.md) - 系统架构与设计原则
- [数据库 Schema](DOCS/DATABASE_SCHEMA.md) - 数据库设计详解
- [开发指南](DOCS/DEVELOPMENT_GUIDE.md) - 开发规范与最佳实践
- [路线图](DOCS/ROADMAP.md) - 版本规划与功能路线
- [错题本](DOCS/MISTAKE_NOTEBOOK.md) - 常见问题与解决方案

详细的功能规划和任务追踪请查看 `.kiro/specs/` 目录。

## 当前版本

**v0.3（进行中）**

已完成：术语库（TB）核心链路与 CAT 面板集成  
进行中：批量 QA 与预翻译效率能力

## License

MIT
