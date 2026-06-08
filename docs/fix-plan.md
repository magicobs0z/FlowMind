# FlowMind 后续修复与开发计划

> 基于 2026-06-08 E2E 测试结果编制

## 测试回顾

- **需求**: 登录页面系统（前后端分离，FastAPI + React）
- **执行模式**: 复杂模式（DAG 调度）
- **节点数**: 12（6 批次）
- **总耗时**: ~75s
- **生成代码**: `data_model.py`（21行） + `test_cases.py`（11行）
- **状态**: ⚠️ 管线打通但质量不足，无法投入生产

---

## P0 — 阻塞性问题（必须修复）

### P0-1: LLM 输出格式不一致

**问题**: GLM-4-FlashX 生成 SEARCH/REPLACE 块时可能缺少 `=======` 分隔行、输出位置错误等。

**当前修复**: 已修改 `editblock_coder.py` 解析器容错（允许 `=======` 位置缺失）。

**仍需改进**:
- [ ] 添加 LLM 输出预校验层，格式错误时自动重试
- [ ] 提供更强力的输出格式示例（few-shot）
- [ ] 添加重试逻辑（当前仅 3 次 reflection，可增加或循环）

**涉及文件**: `lib/aider-main/aider/coders/editblock_coder.py` → `FlowMind/aider/coders/editblock_coder.py`

---

### P0-2: Blueprint 阶段 PM 输出代码而非 JSON

**问题**: Worker #1（PM 角色）在处理复杂度自检后，输出 SEARCH/REPLACE 代码而不是 JSON 规划。原因是 `BLUEPRINT_PROMPT` 与 aider 系统提示词中对 SEARCH/REPLACE 格式的强调产生冲突。

**根因**: PM 角色使用 EditBlockCoder，其系统提示词强制要求 SEARCH/REPLACE 输出。

**修复方案**:
- [ ] PM 角色使用 AskCoder（只输出文字/JSON，不生成 SEARCH/REPLACE）
- [ ] 或使用单独的 non-coder LLM 调用链路
- [ ] 在 `contract_generator.py` 中根据角色选择 Coder 类型

**涉及文件**: `FlowMind/backend/scheduler/planning_agent.py`, `FlowMind/backend/aider_worker/worker.py`

---

### P0-3: 上下文窗口不足

**问题**: Worker #4 发送 16,173 tokens 仍失败，因为系统提示词过于冗长。aider 的 system_reminder 在每次请求中重复发送完整 SEARCH/REPLACE 规则，浪费大量上下文。

**当前状态**: token 预算远超实际代码生成需求。

**修复方案**:
- [ ] 精简系统提示词，移除冗余的 SEARCH/REPLACE 规则重复
- [ ] 仅在新对话首轮发送完整规则，后续轮次只发送缩略版
- [ ] 控制 `repo_content_prefix` 内容量
- [ ] 考虑使用支持更大上下文的模型

**涉及文件**: `FlowMind/aider/coders/editblock_prompts.py`, `FlowMind/aider/coders/base_coder.py`

---

### P0-4: 代码与需求不匹配

**问题**: 模型生成通用 User/Product/Order 模型而不是登录系统所需的用户模型。DAG 节点描述过于通用。

**根因**: DAG 节点的 `instruction` 字段描述不够具体（"定义数据模型和结构"vs"创建用户模型包含 username、password_hash 字段"）。

**修复方案**:
- [ ] DAG 节点 instruction 必须包含具体字段名和约束
- [ ] 在 Contract 中添加更详细的需求上下文
- [ ] 在 Engineer 提示词中注入全局需求摘要

**涉及文件**: `FlowMind/backend/scheduler/contract_generator.py`, `FlowMind/backend/scheduler/planning_agent.py`

---

## P1 — 重要改进

### P1-1: 沙箱 diff 未正确合并到主仓库

**问题**: Worker #3 生成了 `data_model.py` 并在沙箱中提交，但链式 diff 合并到默认分支后，文件并未出现在成果报告中。

**根因**: `GitBranchManager` 的 diff 合并逻辑与主仓库分支状态不一致。

**修复方案**:
- [ ] 调试 `GitBranchManager.apply_diff_to_branch()` 的 diff 路径计算
- [ ] 添加合并验证（合并后检查文件是否存在）

**涉及文件**: `FlowMind/backend/scheduler/git_branch_manager.py`

---

### P1-2: Test 和 Review 节点空过

**问题**: test 和 review 节点没有实际执行代码审查或测试运行，直接显示"无变更，自动通过"。

**修复方案**:
- [ ] Review 节点应实际读取生成代码进行审查
- [ ] Test 节点应运行 `pytest` 或 `unittest`
- [ ] 将审查/测试结果记录到事件总线和持久化

**涉及文件**: `FlowMind/backend/scheduler/reviewer_agent.py`, `FlowMind/backend/scheduler/tester_agent.py`

---

### P1-3: 无重试/降级机制

**问题**: 节点失败直接跳过，无指数退避重试。

**修复方案**:
- [ ] 在 `SchedulerCore` 中添加重试策略（最多 3 次，指数退避）
- [ ] 节点降级：Engineer 失败 → 用更简单的模型重试

**涉及文件**: `FlowMind/backend/scheduler/scheduler_core.py`

---

### P1-4: 产物检查路径硬编码

**问题**: 测试脚本的产物检查路径是硬编码的 `backend/main.py` 等，与模型实际生成路径不匹配。

**修复方案**:
- [ ] 产物检查改为扫描目标目录中新增的文件
- [ ] 基于 git diff 自动发现生成了哪些文件

**涉及文件**: `scripts/run_demo_login.py`

---

## P2 — 增强功能

### P2-1: 换用更强模型

目前使用 GLM-4-FlashX 免费 API，输出质量和格式遵守度有限。建议更换：
- DeepSeek-V3（性价比高）
- GPT-4o（质量稳定）
- Claude Sonnet 4（代码生成最佳）

### P2-2: 真实分布式 Worker

当前使用 InProcWorkerPool（进程内模拟），生产环境需要：
- gRPC Worker 服务的自动发现与健康检查
- Worker 负载均衡
- Worker 故障转移

### P2-3: 完整监控

- Prometheus 指标采集（已有 `metrics.py` 代码）
- 前端 Dashboard
- 告警规则

### P2-4: 多租户

- 租户隔离
- 配额管理
- 审计日志

---

## 修复优先级建议

```
迭代 1 (P0):  LLM 格式问题 + Blueprint + 上下文优化
迭代 2 (P0):  代码质量 + 需求匹配度
迭代 3 (P1):  diff 合并 + test/review 实际运行
迭代 4 (P1):  重试机制 + 产物检查
迭代 5+ (P2): 换模型 + 分布式部署 + 监控
```

## 测试验证标准

每个 P0 修复完成后需要：
1. 运行 `python scripts/run_demo_login.py` 全流程
2. 检查产物检查报告确认文件生成
3. 检查节点执行记录确认 diff > 0
4. 检查代码内容是否与需求匹配

## 完整 E2E 通过条件

```
✅ DAG 节点全部 success（diff > 0）
✅ 生成文件 > 3 个
✅ 代码与需求相关
✅ test 节点实际运行测试
✅ review 节点实际审查
✅ 产物检查报告与实际内容匹配
✅ 总耗时 < 180s
```
