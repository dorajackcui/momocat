# 改造进度跟踪（2026-02-10）

> 关联审查文档：`DOCS/REVIEW_MODULARIZATION_2026-02-09.md`  
> 改造原则：先正确性，再架构整洁，再可维护性

---

## 1. 目标与范围

本跟踪文档用于持续管理以下改造目标：

1. 段落确认链路事务化（confirmed + TM upsert + propagation 原子性）
2. TM 批量匹配走统一确认流程（与单段确认语义一致）
3. 文件导入失败补偿（避免 DB 孤儿记录与磁盘残留）
4. IPC 类型契约收紧（减少 `any`）
5. 渲染层大组件拆分（`ProjectDetail` 容器化）

---

## 2. 当前状态总览

| 项目 | 状态 | 结论 |
|---|---|---|
| 1. 段落确认事务化 | 已完成 | 事务链路已落地，并有成功/失败回滚测试 |
| 2. TM 批量匹配统一流程 | 基本完成 | 已走 `SegmentService.updateSegment`，但仍有边界待补 |
| 3. 导入失败补偿 | 基本完成 | 已补清理逻辑与测试，但清理失败仍是“告警后继续抛原错” |
| 4. IPC 强类型契约 | 进行中 | preload + renderer 主链路已明显收敛，主进程端口层仍有 `any` |
| 5. `ProjectDetail` 拆分 | 首轮完成 | 已拆容器+hooks+子组件，仍可继续收敛局部状态和复用逻辑 |

---

## 3. 下一步建议（推荐执行顺序）

### A. 正确性收口（最高优先级）

1. `batchMatchFileWithTM` 增加“TM 已挂载到项目”校验  
   目的：防止通过 IPC 传入未挂载 TM 绕过项目边界。

2. 明确批量匹配失败语义（建议二选一并文档化）  
   - 方案 A：整体原子（全有或全无）  
   - 方案 B：逐段原子（允许部分成功，但返回失败明细）

3. 导入补偿增强为“可观测失败”  
   当前是尽力清理；建议在清理失败时抛出组合错误（主错误 + cleanup 错误），便于发现脏数据风险。

### B. 类型与边界收紧（第二优先级）

1. 收紧 `main/services/ports.ts` 中的 `any`  
2. 收紧 `adapters` 与 `repos` 中的 `any` 返回类型  
3. 将 `useEditor` 等核心 hook 的 `any[]` 候选结果改为明确类型

### C. 渲染层持续整洁化（第三优先级）

1. 继续拆分 `ProjectFilesPane` 中 AI 面板逻辑（可单独成 `ProjectAIPane`）  
2. 为 hooks 增加最小单测（尤其是异步状态机、订阅生命周期）  
3. 修复 `useEditor` 竞态（快速切段时旧请求覆盖新结果）

---

## 4. 待办清单（可直接勾选）

### 4.1 正确性（本周应完成）

- [ ] `TMModule.batchMatchFileWithTM` 校验 TM 挂载关系  
  目标文件：`apps/desktop/src/main/services/modules/TMModule.ts`
- [ ] 批量匹配失败语义定稿（原子/部分成功）并落地实现  
  目标文件：`apps/desktop/src/main/services/modules/TMModule.ts`
- [ ] 导入补偿在 cleanup 失败时提供组合错误  
  目标文件：`apps/desktop/src/main/services/modules/ProjectFileModule.ts`
- [ ] 增补对应测试  
  目标文件：`apps/desktop/src/main/services/modules/TMModule.test.ts`、`apps/desktop/src/main/services/modules/ProjectFileModule.test.ts`

### 4.2 类型契约（下周推进）

- [ ] 去除 `main/services/ports.ts` 中核心链路 `any`
- [ ] 去除 `renderer/hooks/useEditor.ts` 中核心链路 `any`
- [ ] 去除 `TM/TB Manager/Import Wizard` 中 `options: any` / `preview: any[][]`

### 4.3 渲染层拆分（持续项）

- [ ] 拆出 `ProjectAIPane`，降低 `ProjectFilesPane` 复杂度
- [ ] `useProjectAI` / `useProjectDetailData` 增加行为测试
- [ ] 编辑器匹配请求增加防抖/取消/请求序号保护

---

## 5. 验收标准（DoD）

### 正确性 DoD

- [ ] 关键链路异常时无半状态（符合定义的事务语义）
- [ ] 数据库无孤儿记录，磁盘无残留文件
- [ ] 批量匹配行为与文档定义一致，可通过测试稳定复现

### 工程质量 DoD

- [ ] `npx tsc -p apps/desktop/tsconfig.json --noEmit` 通过
- [ ] `npx vitest run` 全量通过
- [ ] 新增/变更行为有对应测试覆盖

---

## 6. 风险记录

1. 批量匹配若改为“整体原子”，大文件性能与锁持有时间可能增加。  
2. 若保留“部分成功”，必须返回失败明细并保证可重试。  
3. 导入补偿若只告警不失败，线上问题会延后暴露，排查成本高。

---

## 7. 进度日志（建议每日更新）

### 2026-02-10

- 已完成：
  - 段落确认事务化 + 回滚测试
  - 批量匹配走统一确认流程 + 行为集成测试
  - 导入失败补偿 + 失败测试
  - `ProjectDetail` 首轮容器化拆分
- 待完成：
  - 批量匹配挂载校验与失败语义定稿
  - 导入补偿“清理失败可观测化”
  - 核心链路 `any` 继续收敛

