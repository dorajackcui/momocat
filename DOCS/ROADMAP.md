# Simple CAT Tool 发展路线图 (专业演进版)

## v0.1 可用性地基 (MVP)
详细执行案见：[v0.1_EXECUTION_PLAN.md](file:///Users/zhiyangcui/Documents/trae_projects/simple-cat-tool/DOCS/v0.1_EXECUTION_PLAN.md)

- [ ] **Epic A: 项目骨架与运行闭环**
- [ ] **Epic B: Token/Segment Schema**
- [ ] **Epic C: 存储层 (SQLite)**
- [ ] **Epic D: SpreadsheetFilter (Excel/CSV)**
- [ ] **Epic E: UI (虚拟列表 + Token 编辑器)**
- [ ] **Epic F: 最小 QA (Tag 校验)**

## v0.2 专业能力门槛
- [ ] **Tag 校验与签名**：确保导出时 Tag 完整性，QA 规则检查 (Error)。
- [ ] **TM 引擎增强**：100% 匹配、重复句自动传播 (Propagation)。
- [ ] **Concordance 搜索**：按 matchKey 进行语境检索。

## v0.3 效率飞跃
- [ ] **预翻译 Pipeline**：TM -> MT -> Draft 自动填充。
- [ ] **批量 QA 框架**：数字、术语、标点一致性检查。
- [ ] **术语库 (TB)**：管理功能 + 编辑器实时高亮建议。

## v0.4 生态与性能
- [ ] **多格式支持**：DOCX (基础版)、Markdown、CSV。
- [ ] **插件化 Provider**：MT 引擎、分词器、QA 扩展。
- [ ] **万级段落优化**：5-10 万段高性能滚动与查询索引。

---

### 实现原则
1. **地基先行**：先定义 Schema，再写逻辑，不要用 string 顶替。
2. **Worker 优先**：重任务一律进 Worker。
3. **数据为本**：Schema 迁移与备份回滚从第一版就开始。
