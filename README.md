# Simple CAT Tool

一个专业级的计算机辅助翻译（CAT）工具，基于 Electron、React 和 TypeScript 构建。

## 特性

### 核心功能
- ✅ **Token-based 架构**：安全处理标签和占位符
- ✅ **多 TM 系统**：Working TM + Main TM 挂载
- ✅ **模糊匹配**：70-99% 相似度匹配（Levenshtein 算法）
- ✅ **Concordance 搜索**：FTS5 全文索引语境检索
- ✅ **QA 验证**：Tag 完整性检查
- ✅ **自动传播**：重复句自动填充（带撤销）
- ✅ **虚拟滚动**：支持 10,000+ 段落流畅编辑

### 项目管理
- ✅ 项目-文件-段落三层架构
- ✅ 多文件项目支持
- ✅ 导入/导出（CSV/XLSX，支持列选择器）
- ✅ TM 导入向导

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
├── apps/desktop/          # Electron 主应用
│   ├── src/main/         # 主进程（服务层）
│   ├── src/preload/      # 预加载脚本（IPC 桥接）
│   └── src/renderer/     # 渲染进程（UI 层）
├── packages/
│   ├── core/             # 核心业务逻辑
│   └── db/               # 数据库层（SQLite）
├── out/                  # 编译输出目录
├── projects/             # 用户项目数据目录
└── DOCS/                 # 架构与开发文档
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

**v0.2** - 专业能力门槛 ✅

下一步：v0.3 - 效率飞跃（预翻译、术语库、批量 QA）

## License

MIT
