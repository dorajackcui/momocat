# 代码审查报告：解耦与模块化评估（2026-02-09）

## 范围
- 渲染层：编辑器、项目详情、TM/TB 管理页
- 主进程：IPC 注册、Project/Segment/TM/TB 服务
- AI：配置、连通性测试、文件翻译链路
- 数据层：SQLite 封装与迁移逻辑

## 结论（先说重点）
当前代码已经有 `packages/core` / `packages/db` 的分层雏形，但业务编排仍明显集中在少数“大类/大组件”中。  
要实现你说的“后续可替换其他项目 TM/TB 服务、AI 服务、数据库实现”，目前最大的阻力是：
- 业务能力没有稳定“端口接口（Port）”
- 基础设施实现（SQLite/OpenAI/IPC 字符串通道）直接暴露到上层
- UI 直接依赖具体 API 形状与流程细节

---

## Findings（按严重级别）

### [P1] `ProjectService` 成为跨域“超级服务”，导致 TM/TB/AI/文件处理无法独立替换
- 证据：
  - `apps/desktop/src/main/services/ProjectService.ts:28`（单类集中管理）
  - `apps/desktop/src/main/services/ProjectService.ts:39`（构造函数直接创建依赖）
  - `apps/desktop/src/main/services/ProjectService.ts:273`（TM 导入）
  - `apps/desktop/src/main/services/ProjectService.ts:452`（TB 导入）
  - `apps/desktop/src/main/services/ProjectService.ts:603`（导出）
  - `apps/desktop/src/main/services/ProjectService.ts:643`（AI 设置）
  - `apps/desktop/src/main/services/ProjectService.ts:681`（AI 文件翻译）
  - `apps/desktop/src/main/services/ProjectService.ts:768`（AI 测试翻译）
- 问题：
  - 一个类同时承担 Project/File/Segment/TM/TB/Import/Export/AI 多领域职责，模块边界不清。
  - 未来替换 TM/TB/AI 任一模块时，都会改动这个中心类，回归风险高。
- 建议方向（不改代码，仅方案）：
  - 拆成应用用例层：`ProjectAppService`、`TmAppService`、`TbAppService`、`AiAppService`、`FilePipelineService`。
  - `ProjectService` 仅保留“组合/协调”职责，避免直接实现外部集成细节。

### [P1] 数据层 `CATDatabase` 过度集中，DB 实现与业务语义强耦合
- 证据：
  - `packages/db/src/index.ts:5` 到 `packages/db/src/index.ts:1073`（单类覆盖迁移+所有仓储）
  - `packages/db/src/index.ts:72`（迁移逻辑）
  - `packages/db/src/index.ts:503`（项目仓储）
  - `packages/db/src/index.ts:737`（TB 仓储）
  - `packages/db/src/index.ts:903`（TM 仓储）
  - `packages/db/src/index.ts:721`（app settings）
- 问题：
  - 同一类里混合 schema migration、仓储查询、业务统计、TM/TB 索引维护，替换数据库或拆出外部 TM/TB 服务成本很高。
  - `TMService/TBService/SegmentService` 都依赖具体 `CATDatabase` 类型，而不是接口。
- 建议方向：
  - 引入端口接口：`ProjectRepo`、`SegmentRepo`、`TmRepo`、`TbRepo`、`SettingsRepo`。
  - `CATDatabase` 拆分成多个 SQLite adapter，逐步消除“单点大类”。

### [P1] 依赖注入缺失，替换外部 TM/TB/AI 服务需要大范围改构造逻辑
- 证据：
  - `apps/desktop/src/main/index.ts:126`（只创建 `ProjectService`）
  - `apps/desktop/src/main/services/ProjectService.ts:44`（内部 `new TMService(this.db)`）
  - `apps/desktop/src/main/services/ProjectService.ts:45`（内部 `new TBService(this.db)`）
  - `apps/desktop/src/main/services/ProjectService.ts:46`（内部 `new SegmentService(this.db, this.tmService)`）
  - `apps/desktop/src/main/services/ProjectService.ts:41`（内部 `new SpreadsheetFilter()`）
- 问题：
  - 没有组合根（Composition Root）去注入抽象依赖，导致“换实现=改业务类源码”。
- 建议方向：
  - 在 `main/index.ts` 组装依赖图；服务构造函数仅接收接口。
  - 先做最小端口：`ITmProvider`、`ITbProvider`、`IAiProvider`、`ISpreadsheetFilter`。

### [P2] IPC 与 Preload 契约“字符串 + any”偏多，模块改造时接口脆弱
- 证据：
  - `apps/desktop/src/main/index.ts:130` 到 `apps/desktop/src/main/index.ts:375`（大量 string channel）
  - `apps/desktop/src/preload/index.ts:24`、`apps/desktop/src/preload/index.ts:30`、`apps/desktop/src/preload/index.ts:34`、`apps/desktop/src/preload/index.ts:40`、`apps/desktop/src/preload/index.ts:59`、`apps/desktop/src/preload/index.ts:71`（`any` 参数/返回）
  - `apps/desktop/src/renderer/src/env.d.ts:7` 到 `apps/desktop/src/renderer/src/env.d.ts:77`（大量 `Promise<any>`）
- 问题：
  - 缺少强类型契约层，替换 TM/TB/AI 实现时容易出现运行时断裂而非编译期发现。
- 建议方向：
  - 抽出共享 IPC contract（channel + request/response type），主进程与渲染层共用。
  - 分域命名空间：`project.*`、`segment.*`、`tm.*`、`tb.*`、`ai.*`。

### [P2] 渲染层存在“跨域巨型组件”，UI 与业务流程绑定过深
- 证据：
  - `apps/desktop/src/renderer/src/components/ProjectDetail.tsx:29` 到 `apps/desktop/src/renderer/src/components/ProjectDetail.tsx:940`（单文件同时承载文件管理 + AI + TM + TB）
  - `apps/desktop/src/renderer/src/components/ProjectDetail.tsx:66`（统一加载多域数据）
  - `apps/desktop/src/renderer/src/components/ProjectDetail.tsx:299`（AI settings 保存）
  - `apps/desktop/src/renderer/src/components/ProjectDetail.tsx:380`（AI 翻译任务）
  - `apps/desktop/src/renderer/src/components/ProjectDetail.tsx:122` / `:140`（TM/TB 挂载逻辑）
- 问题：
  - 后续替换 TM/TB/AI 接入时，UI 组件会被迫同步重构，影响范围大。
- 建议方向：
  - 按域拆 container：`ProjectFilesPane`、`ProjectTmPane`、`ProjectTbPane`、`ProjectAiPane`。
  - 使用 domain hooks 隔离流程：`useProjectFiles`, `useProjectTM`, `useProjectTB`, `useProjectAI`。

### [P2] TM 导入算法在主线程与 Worker 双处维护，容易漂移
- 证据：
  - `apps/desktop/src/main/services/ProjectService.ts:347` 到 `apps/desktop/src/main/services/ProjectService.ts:444`
  - `apps/desktop/src/main/tmImportWorker.ts:41` 到 `apps/desktop/src/main/tmImportWorker.ts:133`
- 问题：
  - 同一业务规则复制两份，未来扩展（如引入外部 TM API）时需要双改，容易行为不一致。
- 建议方向：
  - 提取纯函数导入 pipeline（可在主线程/Worker 复用），I/O 通过适配器注入。

### [P2] Segment 更新链路缺少事务边界，跨模块一致性有风险
- 证据：
  - `apps/desktop/src/main/services/SegmentService.ts:36`（先写 segment）
  - `apps/desktop/src/main/services/SegmentService.ts:48`（再写 TM）
  - `apps/desktop/src/main/services/SegmentService.ts:49`（再做 propagation）
  - `apps/desktop/src/main/services/SegmentService.ts:123`（注释明确“生产应使用事务”）
- 问题：
  - 如果中途异常，会出现 segment 已确认但 TM/传播未完成的部分提交状态。
- 建议方向：
  - 将“确认 -> TM 更新 -> 传播”封装为原子用例（至少单库事务内一致）。

### [P2] AI 供应商实现硬编码在业务服务中，不具备 Provider 可替换能力
- 证据：
  - `apps/desktop/src/main/services/ProjectService.ts:666`（`/v1/models`）
  - `apps/desktop/src/main/services/ProjectService.ts:942`（`/v1/chat/completions`）
  - `apps/desktop/src/main/services/ProjectService.ts:699`（默认模型硬编码）
  - `apps/desktop/src/main/services/ProjectService.ts:643` / `:652`（Key 读取/写入直接耦合 DB setting）
- 问题：
  - 当前是“ProjectService + OpenAI + DB setting”的固定组合，接入其他 AI 服务需侵入修改主业务类。
- 建议方向：
  - 定义 `IAiProvider`（`testConnection`, `translate`, `translateWithTags`），再用 `OpenAIProvider` 适配。

### [P3] 测试覆盖集中在局部逻辑，缺少关键模块边界的回归保护
- 证据：
  - 仅见 `packages/db/src/index.test.ts`、`apps/desktop/src/main/services/TBService.test.ts` 等
  - 缺失 `ProjectService`、`SegmentService`、`TMService`、IPC 契约层的系统性测试
- 问题：
  - 模块拆分/替换时最容易受影响的编排层缺少保护网，重构风险放大。
- 建议方向：
  - 增加应用服务层 contract test（mock repos/providers）和 IPC contract test。

---

## 与你目标的匹配评估

你的目标是“编辑器、TM、TB、AI、database 各自解耦，可替换接入外部 TM/TB 服务”。  
按当前代码形态，我的判断是：
- 编辑器模块化：**中等**（有 `useEditor`，但仍直连全局 API，且类型边界偏弱）
- TM/TB 模块化：**偏低**（服务依赖 `CATDatabase` 细节，入口被 `ProjectService` 集中）
- AI 模块化：**偏低**（OpenAI 强绑定在 `ProjectService`）
- Database 模块化：**偏低**（`CATDatabase` 超大单类）

---

## 建议的分阶段改造路线（仅供评审）

1. 先建“端口层”而不改业务行为：
   - `ITmProvider` / `ITbProvider` / `IAiProvider`
   - `IProjectRepo` / `ISegmentRepo` / `ISettingsRepo`
2. 把 `ProjectService` 拆成多个应用服务，但先保持现有 IPC 不变（降低迁移风险）。
3. 增加 IPC contract typing，移除 `any` 核心路径。
4. 最后再替换具体实现（例如接入其他项目的 TM/TB 服务）。

---

## 本次审查说明
- 本次仅做代码审查与架构评估，未修改业务代码。
- 审查重点是“可解耦、可替换、可扩展”，不是功能正确性的全量验证。
