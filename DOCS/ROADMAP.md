# Simple CAT Tool 发展路线图

## v0.1 可用性地基 (MVP) ✅ 已完成
- [x] 项目骨架与运行闭环
- [x] Token/Segment Schema
- [x] 存储层 (SQLite)
- [x] SpreadsheetFilter (Excel/CSV)
- [x] UI (虚拟列表 + Token 编辑器)
- [x] 最小 QA (Tag 校验)

## v0.1.1 多文件架构 ✅ 已完成
- [x] Project → File → Segment 三层架构
- [x] 多文件项目支持
- [x] ProjectDetail 视图

## v0.2 专业能力门槛 ✅ 已完成
- [x] Tag 校验与签名
- [x] TM 引擎增强（100% 匹配、重复句自动传播）
- [x] Concordance 搜索
- [x] 多 TM 架构（Working TM + Main TM）
- [x] 模糊匹配（Levenshtein 距离，70-99% 相似度）
- [x] TM 导入向导

## v0.3 效率飞跃 🚀 进行中
详细规划见 `.kiro/specs/cat-tool-complete-mvp/`

- [ ] 预翻译 Pipeline（TM -> MT -> Draft 自动填充）
- [ ] 批量 QA 框架（数字、术语、标点一致性检查）
- [ ] 术语库 (TB)（管理功能 + 编辑器实时高亮建议）
- [ ] 编辑器生产力（复制源文本、插入所有标签）
- [ ] 性能优化（支持 50,000+ 段落项目）

## v0.4 生态与性能 📅 计划中
- [ ] 多格式支持（DOCX、Markdown、JSON、XML）
- [ ] 插件化 Provider（MT 引擎、分词器、QA 扩展）
- [ ] 协作功能（云同步、多用户编辑、评论系统）
- [ ] 高级 TM 功能（上下文匹配、元数据过滤、TM 维护工具）

---

## 📊 当前状态

**版本**: v0.2 ✅  
**下一步**: v0.3 (效率飞跃)  
**详细文档**: `.kiro/specs/cat-tool-complete-mvp/`

### 核心功能清单

✅ Token-based 架构  
✅ 多 TM 系统（Working TM + Main TM）  
✅ 模糊匹配（70-99% 相似度）  
✅ Concordance 搜索（FTS5 全文索引）  
✅ QA 验证系统（Tag 完整性检查）  
✅ 传播功能（带撤销支持）  
✅ 完整 UI（Dashboard、Editor、TM 面板）  
✅ 虚拟滚动（支持 10,000+ 段落）  
✅ 导入/导出（CSV/XLSX，列选择器）  
✅ TM 导入向导  
✅ 项目-文件-段落三层架构
