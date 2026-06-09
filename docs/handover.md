# FlowMind 系统交接文档

> **交接日期**: 2026-06-09
> **项目根目录**: `/d/AI/FlowMind-V2`
> **项目代码**: `FlowMind/`（Git 仓库，远程: `https://github.com/magicobs0z/FlowMind.git` main 分支）
> **原仓库存档**: `archive-original` 分支

---

## 一、建议阅读顺序

按优先级排列，从必须读到参考阅读：

### 第一梯队 — 必须读（理解系统）

| # | 文件 | 为什么读 |
|---|------|----------|
| 1 | [docs/01_flowagent_architecture.md](file:///d:/AI/FlowMind-V2/docs/01_flowagent_architecture.md) | **全面架构文档**：FlowAgent 设计原则、架构图、聊天检测、短期记忆、复杂度评估、流式输出、线程安全桥接 |
| 2 | [docs/quickstart.md](file:///d:/AI/FlowMind-V2/docs/quickstart.md) | **快速入门**：环境配置、TUI 测试、Python 脚本、核心概念 |
| 3 | [FlowMind/backend/scheduler/planning_agent.py](file:///d:/AI/FlowMind-V2/FlowMind/backend/scheduler/planning_agent.py) | FlowAgent — 聊天检测 + 需求拆解 + DAG 规划的核心逻辑 |
| 4 | [FlowMind/backend/scheduler/scheduler_core.py](file:///d:/AI/FlowMind-V2/FlowMind/backend/scheduler/scheduler_core.py) | SchedulerCore — DAG 执行引擎 |
| 5 | [FlowMind/backend/aider_worker/worker.py](file:///d:/AI/FlowMind-V2/FlowMind/backend/aider_worker/worker.py) | AiderWorker — 代码生成 Worker 实现 + 线程事件发布 |

### 第二梯队 — 理解测试入口 & 关键机制

| # | 文件 | 说明 |
|---|------|------|
| 6 | [docs/handover.md](file:///d:/AI/FlowMind-V2/docs/handover.md) | **本文档**：交接说明、待办任务优先级 |
| 7 | [scripts/tui_test.py](file:///d:/AI/FlowMind-V2/scripts/tui_test.py) | **流式 TUI 测试工具**（交互式测试 Agent 能力，推荐入口） |
| 8 | [FlowMind/backend/scheduler/event_bus.py](file:///d:/AI/FlowMind-V2/FlowMind/backend/scheduler/event_bus.py) | EventBus — 线程安全事件桥接 + 流式事件发布 |
| 9 | [FlowMind/backend/aider_worker/headless_io.py](file:///d:/AI/FlowMind-V2/FlowMind/backend/aider_worker/headless_io.py) | HeadlessIO — _StreamCapture 流式 LLM 输出捕获 |
| 10 | [FlowMind/backend/scheduler/contract_generator.py](file:///d:/AI/FlowMind-V2/FlowMind/backend/scheduler/contract_generator.py) | DAG 节点 → Contract 的角色/提示词组装 |
| 11 | [FlowMind/backend/aider_worker/headless_coder.py](file:///d:/AI/FlowMind-V2/FlowMind/backend/aider_worker/headless_coder.py) | 无头 Coder 封装（覆写关键方法） |

### 第三梯队 — 理解已被修改的底层库

| # | 文件 | 修改内容 |
|---|------|----------|
| 12 | [FlowMind/aider/coders/editblock_coder.py](file:///d:/AI/FlowMind-V2/FlowMind/aider/coders/editblock_coder.py) | SEARCH/REPLACE 解析器容错（允许缺少 `=======`） |
| 13 | [FlowMind/aider/coders/editblock_prompts.py](file:///d:/AI/FlowMind-V2/FlowMind/aider/coders/editblock_prompts.py) | 移除"询问文件"指令 |

### 第四梯队 — 参考

| # | 文件 | 说明 |
|---|------|------|
| 14 | [docs/useful_modle.md](file:///d:/AI/FlowMind-V2/docs/useful_modle.md) | 免费 API 凭证（GLM-4-FlashX） |
| 15 | [FlowMind/.env.bat](file:///d:/AI/FlowMind-V2/FlowMind/.env.bat) | 环境激活脚本 |
| 16 | [docs/04_e2e_test_report.md](file:///d:/AI/FlowMind-V2/docs/04_e2e_test_report.md) | 历史测试报告 |

---

## 二、系统当前状态

### 已实现功能

| 模块 | 状态 |
|------|------|
| FlowAgent（PM Agent） | ✅ 聊天检测 + 复杂度自检 + 双模式（聊天/简单/复杂） |
| 聊天/编码分类 | ✅ `_detect_chat()` 自动区分问候闲聊 vs 编码需求 |
| 短期记忆（对话历史） | ✅ 自动注入最近 2 轮简短摘要，仅手动 reset 清空 |
| 先讨论再行动 | ✅ 系统提示词重构，Agent 像 Claude 一样自然交互 |
| DAG 解析器 | ✅ 拓扑排序 + 批次调度 |
| AiderWorker | ✅ 沙箱隔离 + 代码生成 + diff 收集 + 文件同步回工作区 |
| Agent 自然语言响应 | ✅ 从 `coder.partial_response_content` 提取 agent_message |
| **流式 LLM 输出** | ✅ **实时捕获**：_StreamCapture → publish_sync() → TUI 实时渲染 |
| Git 分支管理 | ✅ 任务分支 + diff 合并 + 链式提交 |
| 持久化（SQLite） | ✅ 5 张表（tasks/milestones/contracts/events/tokens） |
| **线程安全事件** | ✅ EventBus publish_sync() + 桥接任务 20Hz 轮询 |
| 流式 TUI | ✅ Rich Live + AgentStreamDisplay（实时文本）+ 多 Agent 角色标签 |
| 鉴权 | ✅ JWT + API Key（`FlowMind/backend/scheduler/auth.py`） |
| 限流 | ✅ 滑动窗口（`rate_limiter.py`） |
| 日志 | ✅ 结构化日志 + trace_id（`logging.py`） |
| 通知 | ✅ Console/Webhook/DingTalk（`notification.py`） |
| 指标 | ✅ Prometheus（`metrics.py`） |
| 压力测试 | ✅ 框架代码（`stress_test.py`） |

### 测试通过的功能

- ✅ 导入验证：6 个核心模块全部可导入
- ✅ 聊天/编码自动分类
- ✅ 流式 LLM 输出实时渲染

### 未解决的关键问题

| 问题 | 严重性 | 影响 |
|------|--------|------|
| Blueprint 阶段 PM 输出代码而非 JSON | P0 | DAG 靠规则兜底，质量差 |
| LLM 输出格式不一致 | P0 | 70% 代码生成因格式失败 |
| 上下文窗口不足 | P0 | 系统提示词吃掉大量 token |
| 代码与需求不匹配 | P0 | 生成通用模型而非登录系统 |
| Test/Review 节点空过 | P1 | 无实际质量验证 |
| 沙箱 diff 合并不对 | P1 | 代码未正确纳入产物报告 |

---

## 三、环境配置

### API Key 配置（每次打开新终端都需要）

```powershell
$env:OPENAI_API_KEY="c46843aa1f0947b39cdfd1fcb4564af4.HX72k6kchXRdywkn"
$env:OPENAI_API_BASE="https://open.bigmodel.cn/api/paas/v4/"
```

### PYTHONPATH 配置

```powershell
$env:PYTHONPATH="FlowMind;FlowMind\backend"
```

### 完整运行命令

```powershell
$env:OPENAI_API_KEY="c46843aa1f0947b39cdfd1fcb4564af4.HX72k6kchXRdywkn"
$env:OPENAI_API_BASE="https://open.bigmodel.cn/api/paas/v4/"
$env:PYTHONPATH="FlowMind;FlowMind\backend"
python scripts/tui_test.py
```

---

## 四、Git 仓库情况

```
FlowMind/.git   ← Git 仓库根目录
```

| 分支/Tag | 内容 | 说明 |
|----------|------|------|
| `main` | 当前项目代码 | 新架构（`FlowMind/` 内完整项目） |
| `V1` | 锁定 main 当前 commit | 占位分支（与 main 同步） |
| `v1-archive` (tag) | 原仓库存档 | 旧版本代码，从历史 commit 取回 |

---

## 五、下一次任务优先做什么

### 🥇 最优选择：修复 P0-2（Blueprint）

**原因**：Blueprint 是 DAG 质量的入口，当前 PM 输出 SEARCH/REPLACE 代码而非 JSON 规划，导致 DAG 完全由规则兜底。修复后 DAG 节点描述会更精准，后续所有节点产出的代码质量都会提升。

**具体步骤**：
1. [ ] 在 `worker.py` 中让 PM 角色使用 `AskCoder` 或 `WholeFileCoder`（它们输出文字而非 SEARCH/REPLACE）
2. [ ] 在 `contract_generator.py` 中增加 `CoderType` 字段，按角色选择 coder
3. [ ] 运行 `python scripts/tui_test.py` 验证 PM 输出 JSON
4. [ ] 检查 DAG 节点数量和文件路径质量

### 🥈 次优选择：修复 P0-1（LLM 输出格式）

**原因**：当前 `editblock_coder.py` 的容错修复只处理了 `=======` 位置缺失一种情况，仍有其他格式错误导致代码丢失。

**具体步骤**：
1. [ ] 在 `AiderWorker.execute()` 中增加 LLM 输出预校验
2. [ ] 格式错误时自动重试（非 reflection 方式）
3. [ ] 在提示词示例中增加 `=======` 位置的新建文件示例

### 🥉 第三选择：修复 P0-3（上下文窗口）

**原因**：Worker #4 发送 16k tokens 仍未成功生成代码，极度浪费。

**具体步骤**：
1. [ ] 精简 `editblock_prompts.py` 的 system_reminder（移除重复的 shell 命令提示等）
2. [ ] 首轮发完整规则，后续轮次只发缩略版
3. [ ] 控制 `repo_content_prefix` 的文件摘要量

### ✅ 验证标准

每次修复后必须运行以下命令并确认结果：

```powershell
$env:OPENAI_API_KEY="c46843aa1f0947b39cdfd1fcb4564af4.HX72k6kchXRdywkn"
$env:OPENAI_API_BASE="https://open.bigmodel.cn/api/paas/v4/"
$env:PYTHONPATH="FlowMind;FlowMind\backend"
python scripts/tui_test.py
```

通过条件：
- ✅ 纯聊天（你好）→ 自然回复，不触发编码
- ✅ 简单编码 → 实时流式输出，正确生成文件
- ✅ Token 始终显示 ↑输入 ↓输出
- ✅ 无崩溃异常