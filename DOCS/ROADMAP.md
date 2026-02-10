# Simple CAT Tool 路线图（更新于 2026-02-10）

## 当前里程碑

- 当前版本：`v0.3`（进行中）
- 当前主题：**正确性收口 + 解耦改造 + 类型收紧**
- 进度看板：`DOCS/REFACTOR_PROGRESS_TRACKER_2026-02-10.md`

---

## 已完成里程碑

### v0.1 可用性地基（已完成）

- [x] 项目骨架与运行闭环
- [x] Token/Segment Schema
- [x] SQLite 存储层
- [x] CSV/XLSX 导入导出基础能力
- [x] 双栏编辑器基础交互
- [x] 基础 Tag QA 校验

### v0.2 专业能力门槛（已完成）

- [x] 多文件项目（Project -> File -> Segment）
- [x] 多 TM 架构（Working TM + Main TM）
- [x] 100% 匹配 + 模糊匹配（Levenshtein）
- [x] Concordance 检索（FTS5）
- [x] TM 导入向导
- [x] TB 系统基础链路（管理、挂载、命中）

---

## v0.3（进行中）

### A. 正确性优先（高优先）

- [x] 段落确认链路事务化（confirmed + TM upsert + propagation）
- [x] 批量 TM 匹配改走统一确认流程
- [x] 文件导入失败补偿（清理 file 记录和拷贝文件）
- [ ] 批量匹配挂载边界校验（TM 必须已挂载到项目）
- [ ] 批量匹配失败语义定稿（全量原子 / 部分成功+失败明细）
- [ ] 导入补偿 cleanup 失败可观测化

### B. 架构与类型（中优先）

- [x] `ProjectDetail` 首轮容器化拆分（files/tm/tb + hooks）
- [x] preload/renderer IPC contract 首轮强类型化
- [ ] 主进程 `ports/adapters/repos` 核心链路去 `any`
- [ ] 编辑器与管理页核心链路去 `any`

### C. 体验与效率（中低优先）

- [ ] 编辑器候选请求竞态控制（防旧请求覆盖）
- [ ] 预翻译 pipeline（TM -> AI -> Draft）
- [ ] 批量 QA 框架（数字/术语/标点）

---

## v0.4（规划中）

- [ ] Provider 插件化（AI/TM/TB 接口可替换）
- [ ] 更多文件格式（DOCX/Markdown/JSON/XML）
- [ ] 协作能力（云同步/评论/多用户）
- [ ] 高级 TM 维护能力（上下文匹配、元数据过滤）

---

## 说明

1. 本路线图只保留“当前仍有效”的计划。
2. 历史评审意见见：`DOCS/REVIEW_MODULARIZATION_2026-02-09.md`。
3. 每次迭代优先更新进度看板，再回写路线图状态。
