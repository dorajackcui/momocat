# 项目结构说明（更新于 2026-02-14）

本项目为 npm workspaces Monorepo，核心分为 `apps/`（应用）和 `packages/`（共享库）。

## 顶层结构

```text
simple-cat-tool/
├── apps/
│   └── desktop/
├── packages/
│   ├── core/
│   └── db/
├── DOCS/
│   ├── archive/
│   └── *.md
├── .cat_data/          # 本地运行数据（开发模式）
├── out/                # 构建产物
└── package.json
```

## `apps/desktop`（Electron 应用）

### 主进程 `apps/desktop/src/main`

- `index.ts`: Electron 启动与 IPC 注册
- `JobManager.ts`: 后台任务进度事件管理
- `tmImportWorker.ts`: TM 导入 Worker
- `filters/SpreadsheetFilter.ts`: CSV/XLSX 导入导出实现
- `services/`
  - `ProjectService.ts`: 应用服务入口（编排模块）
  - `SegmentService.ts`: 段落确认/传播链路
  - `TMService.ts`: TM 匹配与入库逻辑
  - `TBService.ts`: TB 匹配逻辑
  - `ports.ts`: 服务层抽象端口定义
  - `modules/`: 按业务拆分模块（`ProjectFileModule`/`TMModule`/`TBModule`/`AIModule`）
  - `adapters/`: SQLite 端口适配器
  - `providers/`: 外部能力提供者（当前为 `OpenAITransport`）

### 预加载层 `apps/desktop/src/preload`

- `index.ts`: `window.api` typed bridge

### 渲染层 `apps/desktop/src/renderer/src`

- `components/`: 页面与业务组件
  - `ProjectDetail.tsx` + `components/project-detail/*`
  - `Editor.tsx`, `EditorRow.tsx`, `TMPanel.tsx`, `ConcordancePanel.tsx`
  - `TMManager.tsx`, `TBManager.tsx`, 导入向导等
- `hooks/`
  - `useEditor.ts`, `useProjects.ts`
  - `hooks/projectDetail/*`（详情页拆分后的 hooks）
- `services/apiClient.ts`: renderer 统一 API 边界
- `env.d.ts`: 渲染进程全局类型声明

### 共享契约 `apps/desktop/src/shared`

- `ipc.ts`: preload / renderer 的 typed IPC contract

## `packages/core`（核心类型与算法）

- Token/Tag 模型
- Tag 编解码与验证（`TagCodec` / `TagValidator` / `TagManager`）
- TM/TB 匹配相关公共算法

## `packages/db`（数据库层）

- `index.ts`: `CATDatabase` 聚合入口
- `migration/runMigrations.ts`: schema 迁移（当前至 v11）
- `repos/*`: Project/Segment/TM/TB/Settings 仓储实现

## 运行数据与构建

- `.cat_data/`: 开发模式 userData（数据库与项目文件缓存）
- `out/`: 构建产物目录，不手工编辑

## 文档约定

- 当前有效文档入口：`DOCS/README.md`
- 历史排障与复盘文档：`DOCS/archive/`
