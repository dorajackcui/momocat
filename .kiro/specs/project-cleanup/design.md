# 项目清理设计

## 清理策略

### 1. 文档系统整合
**问题**：存在三套文档系统
- `DOCS/` - 核心架构文档
- `.trae/documents/` - 旧的任务文档
- `.kiro/specs/` - Kiro 规范文档

**方案**：
- 保留 `DOCS/` 作为核心架构文档
- 保留 `.kiro/specs/` 作为功能规划文档
- 删除 `.trae/` 整个目录

### 2. 版本文档清理
**问题**：已完成版本的执行计划文档占用空间

**方案**：
- 删除 `v0.1_EXECUTION_PLAN.md`
- 删除 `v0.1.1_EXECUTION_PLAN.md`
- 删除 `v0.2_EXECUTION_PLAN.md`
- 在 `ROADMAP.md` 中保留版本历史摘要

### 3. 临时文件清理
**问题**：开发过程中产生的临时文件和缓存

**方案**：
- 删除 `.DS_Store`（macOS 系统文件）
- 删除 `cat_v1.db.backup`（旧备份）
- 删除 `sample_translated.xlsx`（测试文件）
- 删除 `.cat_data/`（运行时数据）
- 删除 `.electron-gyp/`、`.npm/`（构建缓存）

### 4. 文档更新
**更新 README.md**：
- 添加完整的功能列表
- 更新项目结构说明
- 添加文档链接

**精简 ROADMAP.md**：
- 移除冗余描述
- 保持版本历史清晰
- 突出当前状态和下一步计划

## 文件结构（清理后）

```
simple-cat-tool/
├── .kiro/
│   └── specs/                    # Kiro 功能规范
│       ├── cat-tool-complete-mvp/
│       ├── cat-tag-system-refactor/
│       └── project-cleanup/
├── DOCS/                         # 核心架构文档
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── DEVELOPMENT_GUIDE.md
│   ├── ROADMAP.md
│   └── MISTAKE_NOTEBOOK.md
├── apps/desktop/                 # 主应用
├── packages/                     # 共享包
│   ├── core/
│   └── db/
├── projects/                     # 项目数据目录（空）
├── .gitignore
├── README.md
└── package.json
```

## 维护原则

1. **单一真相源**：每个信息只在一个地方维护
2. **文档分层**：架构文档（DOCS/）vs 功能规范（.kiro/specs/）
3. **版本管理**：已完成版本的详细文档可删除，保留摘要
4. **自动忽略**：通过 .gitignore 防止临时文件进入版本控制
