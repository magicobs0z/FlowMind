# FlowAgent 架构设计

## 概述

FlowAgent 是 FlowMind 多 Agent 调度系统的统一入口，负责接收用户需求、判断聊天/编码意图、进行复杂度评估，并根据评估结果选择执行模式（聊天回复 / 简单任务内部消化 / 复杂任务 DAG 调度）。

## 核心设计原则

### 1. 统一对话入口
- 用户仅需与 FlowAgent 交互，无需关心系统内部有多少个 Agent
- FlowAgent 内部按需调用其他角色（Engineer/Tester/Reviewer）

### 2. 先讨论再行动
- 收到需求后先与用户讨论确认，不要直接开始写代码
- 用户可能在聊天、提问、讨论想法，不一定每次都需要编码
- 聊天模式（`_detect_chat`）自动检测问候/闲聊，走纯 LLM 对话

### 3. 短期记忆（对话历史）
- 对话历史持久化保存在 `_conversation_history` 中
- 每次执行自动注入最近 **2 轮** 简短摘要作为上下文
- 只有显式调用 `reset_conversation()` 才清空记忆

### 4. 聊天/编码预分类
- 在复杂度评估之前先判断是否为纯聊天输入
- 纯聊天 → `_chat_response()` 调用 LLM 自然对话
- 编码需求 → 继续复杂度评估

### 5. 复杂度自评估
- 根据关键词匹配自动判断任务复杂度
- 避免对简单任务生成不必要的 DAG 开销

### 6. 双模式执行
- **简单模式**：FlowAgent 直接调用 AiderWorker 完成，用户无感知
- **复杂模式**：FlowAgent 规划 DAG，由 SchedulerCore 调度多 Agent 协作

### 7. 角色片段化
- 角色提示词（Engineer/Tester/Reviewer）不作为常驻属性
- 按需注入到对应节点的 `system_prompt_extra` 中

### 8. 流式输出
- 支持 EventBus 实时事件发布
- HeadlessIO 中 _StreamCapture 捕获 LLM 增量文本，通过 publish_sync() 实时推送
- TUI 中 Rich Live + AgentStreamDisplay 实时渲染 LLM 输出
- 线程安全：EventBus 提供 publish_sync() + 桥接任务，worker 线程事件不阻塞

### 9. 线程安全事件桥接
- `EventBus.publish_sync()` 线程安全调用（无锁，通过 `queue.Queue` 中转）
- `_bridge_events()` 后台 20Hz 轮询将线程事件迁移到 async 队列
- Worker 线程中的 AiderWorker 可安全发布 `worker.*` 事件

## 架构图

```
┌─────────────────────────────────────────────────┐
│                    用户                         │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│               FlowAgent (PM)                    │
│  ┌──────────────────────────────────────────┐  │
│  │  _detect_chat() ← 先判断是否纯聊天        │  │
│  │  ├── True  → _chat_response() 对话       │  │
│  │  └── False → 复杂度评估                  │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  PROMANAGER_CORE_PROMPT                  │  │
│  │  - 先讨论再行动                           │  │
│  │  - 像 Claude/ChatGPT 一样自然对话         │  │
│  │  - 能力自检与分派决策                     │  │
│  │  - 简单任务内部执行流程                   │  │
│  │  - 复杂任务 DAG 规划协议                  │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  _conversation_history                   │  │
│  │  (短期记忆 - 最近2轮简短摘要注入)         │  │
│  └──────────────────────────────────────────┘  │
│                  │                              │
│         ┌────────┴────────┐                     │
│         ▼                 ▼                     │
│  ┌──────────────┐  ┌───────────────────┐       │
│  │  复杂度自检   │  │  模式选择          │       │
│  └──────────────┘  └───────────────────┘       │
│                  │                              │
│    ┌─────────────┴──────────────┐              │
│    ▼                            ▼              │
│ ┌─────────────────┐    ┌─────────────────┐    │
│ │ 简单模式        │    │ 复杂模式        │    │
│ │ (内部消化)      │    │ (DAG 调度)      │    │
│ └─────────────────┘    └─────────────────┘    │
│    │                          │                │
│    │                          ▼                │
│    │               ┌────────────────────┐     │
│    │               │ _create_blueprint() │     │
│    │               │ _breakdown_to_dag() │     │
│    │               └────────────────────┘     │
│    │                          │                │
│    │                          ▼                │
│    │               ┌────────────────────┐     │
│    │               │ SchedulerCore      │     │
│    │               │ (DAG 调度执行)      │     │
│    │               └────────────────────┘     │
│    │                                           │
│    ▼                                           │
│ ┌───────────────────────────────────────────┐ │
│ │ _simple_execute()                         │ │
│ │ - 注入简短对话历史（最近2轮）              │ │
│ │ - 直接调用 AiderWorker                    │ │
│ │ - 注入角色片段 (默认 Engineer)           │ │
│ │ - 提取 agent_message 作为自然语言响应      │ │
│ └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 聊天检测

### 检测策略

```
1. 匹配 CHAT_PATTERNS 正则（问候语、感谢、告别、疑问句等）
2. 无编码关键词匹配 → 纯聊天
3. 包含编码关键词（创建/编写/实现等）→ 编码任务
```

在 `process_request()` 中，聊天检测在复杂度评估之前执行：

```python
if self._detect_chat(requirement):
    return await self._chat_response(requirement, repo_path)
```

### 聊天模式

`_chat_response()` 调用 DirectLLMPool → LLM 自然对话，不执行任何编码：
- 仅注入最近 2 轮简短历史摘要
- 系统提示词明确指示不编码
- 返回 `mode="chat"`，SchedulerCore 发布 `flow.completed` 事件

## 短期记忆（对话历史管理）

### 存储策略

```python
# _conversation_history: list[dict]
# 每轮格式: {"user": "用户消息", "assistant": "Flow响应"}
```

- 每次 `process_request()` 调用后自动记录（包括聊天模式和编码模式）
- 存储内容：用户需求（~500字）+ 完整 assistant 响应（含 agent_message）
- 只有调用 `reset_conversation()` 才清空

### 上下文注入

在 `_simple_execute()` 和 `_chat_response()` 中，对话历史被格式化为以下形式：

```
对话背景:
之前: ...(用户需求前200字)
回应: ...(Flow响应前300字)

---

用户需求：...
```

- 只保留最近 **2 轮**（防止 LLM 回显历史内容）
- 每轮截取 200/300 字符

## 线程安全事件桥接

### 背景

AiderWorker 在独立线程中执行（通过 `asyncio.to_thread`），无法直接调用 async 的 `EventBus.publish()`。

### 实现

```
Worker Thread               EventBus                        TUI
    │                           │                            │
    ├─ publish_sync(ev) ───────→▄ (queue.Queue)              │
    │                           │                            │
    │                           │ _bridge_events() 20Hz 轮询 │
    │                           ├─ publish(ev) ────────────→▄ (asyncio.Queue)
    │                           │                            │
    │                           │                            ├─ subscribe()
    │                           │                            │
    │                           │                            ▼
    │                           │                     AgentStreamDisplay
    │                           │                     (实时渲染流式文本)
```

- `publish_sync()`：将事件放入 `threading.Queue`，不阻塞
- `_bridge_events()`：后台 asyncio 任务，20Hz 轮询搬运事件
- `start_bridge()`：在 TUI BackendClient 启动时调用

## 复杂度评估算法

### 关键词匹配策略

使用纯规则式关键词匹配（零 LLM 开销），包含 30+ 关键词模式：

| 关键词类别 | 示例关键词 |
|-----------|-----------|
| 多模块/多文件 | `新建项目`, `多模块`, `多个文件`, `全栈` |
| 系统级架构 | `架构`, `重构`, `系统设计`, `微服务` |
| 数据库操作 | `数据库`, `数据库设计`, `数据模型` |
| 复杂业务 | `电商`, `管理平台`, `工作流`, `权限`, `审批` |
| 多阶段任务 | `批量`, `数据分析`, `完整` |

### 决策规则

```
1. 匹配任意复杂关键词 → complex
2. 需求长度 > 300 字符 → complex
3. 匹配简单关键词 → simple
4. 短需求 (< 100 字符) → simple
5. 否则 → complex
```

## 双模式执行流程

### 简单模式

```python
async def _simple_execute(requirement, repo_url, repo_path, context):
    # 1. 注入简短对话历史（最近2轮）
    history_parts = format_history(_conversation_history[-2:])
    instruction = "对话背景:\n...\n\n用户需求：{requirement}"
    
    # 2. 注入 Engineer 角色片段
    system_prompt = ENGINEER_ROLE_FRAGMENT
    
    # 3. 构建 Contract
    contract = AgentContract(
        instruction=instruction,
        system_prompt_extra=system_prompt,
        repo_path=repo_path,
        ...
    )
    
    # 4. 调用 AiderWorker（线程池执行，不阻塞事件循环）
    result = await pool.dispatch(handle, contract)
    
    # 5. 提取 agent_message 作为自然语言响应
    summary = result.get("agent_message", "")[:800]
    return {"summary": summary, "result": result, ...}
```

### 简单模式事件流

| 阶段 | 事件类型 | 数据 |
|------|---------|------|
| 收到需求 | `flow.request_received` | requirement |
| 开始编码 | `flow.simple_started` | complexity |
| 工作区准备 | `worker.sandbox_ready` | repo_path |
| LLM 执行中 | `worker.executing` | attempt |
| LLM 流式输出 | `worker.stream_chunk` | text, final | ← **实时流式**
| LLM 完成 | `worker.llm_completed` | file_count |
| 编码完成 | `flow.simple_completed` | success |

### 复杂模式

```python
async def _complex_schedule(requirement, repo_url, context):
    # 1. 生成 Blueprint (阶段规划)
    blueprint = await _create_blueprint(requirement)
    
    # 2. 拆解为 DAG
    dag = await _breakdown(blueprint, repo_url)
    
    # 3. 提交给 SchedulerCore 调度
    return {"blueprint": ..., "dag": ..., "mode": "complex"}
```

### 复杂模式事件流

| 阶段 | 事件类型 | 透传数据 |
|------|---------|---------|
| 任务就绪 | `task.ready` | - |
| 任务开始 | `task.started` | `agent_role` (CODE/TEST/REVIEW) |
| Token 消耗 | `token.usage` | tokens_sent, tokens_received |
| 任务成功 | `task.succeeded` | - |
| 任务失败 | `task.failed` | error |
| DAG 完成 | `dag.completed` | node_count |

## 提示词设计

### PROMANAGER_CORE_PROMPT (常驻)

包含以下关键指导：

1. **先讨论再行动**
   - 收到需求后先与用户交流确认，不要直接开始写代码
   - 用户可能只是聊天、提问、讨论想法

2. **自然语言交互**
   - 像 Claude/ChatGPT 一样输出自然语言回复
   - 不是机器人式输出
   - 只有在明确需要写代码时才调用编码能力

3. **能力自检**
   - 收到需求后，先讨论再判断复杂度
   - 简单任务：说明方案后内部消化
   - 复杂任务：生成 DAG

4. **简单任务流程**
   - 先向用户说明方案，获得确认后再开始
   - 生成修改代码
   - 向用户展示结果

5. **复杂任务协议**
   - 规划 → 拆解 → 调度 → 协调 → 归并
   - 输出 JSON 格式 DAG

### 角色片段（可注入）

| 角色 | 片段常量 | 注入位置 |
|-----|---------|---------|
| Engineer | `ENGINEER_ROLE_FRAGMENT` | `system_prompt_extra` |
| Tester | `TESTER_ROLE_FRAGMENT` | `system_prompt_extra` |
| Reviewer | `REVIEWER_ROLE_FRAGMENT` | `system_prompt_extra` |

## Agent 自然语言响应提取

AiderWorker 执行后，LLM 的完整自然语言响应从 `coder.partial_response_content` 提取：

```python
def _assemble_result(self, coder, sandbox_result, events):
    agent_msg = ""
    # 尝试顺序: io.last_assistant_content → coder.partial_response_content → events
    if io_obj and getattr(io_obj, "last_assistant_content", None):
        agent_msg = io_obj.last_assistant_content
    if not agent_msg:
        agent_msg = getattr(coder, "partial_response_content", "") or ""
    ...
    return {
        "agent_message": str(agent_msg) if agent_msg else "",
        ...
    }
```

该 `agent_message` 在 TUI 中以 Markdown 形式展示。

## 流式 LLM 输出捕获

### _StreamCapture

```python
# headless_io.py
class _StreamCapture:
    """捕获 LLM 流式输出，通过 EventBus 实时发布文本块。"""

    def __init__(self, event_bus=None):
        self.event_bus = event_bus

    def update(self, text, final=False):
        if self.event_bus:
            self.event_bus.publish_sync(SimpleNamespace(
                event_type="worker.stream_chunk",
                data={"text": text, "final": final},
            ))
```

- `HeadlessIO.get_assistant_mdstream()` 返回 `_StreamCapture` 实例
- aider coder 在流式模式下，每次有增量输出时调用 `stream.update(text, final)`
- 通过 `publish_sync()` 实时推送到 EventBus
- TUI 的 `AgentStreamDisplay` 接收并渲染

## 文件同步回工作区

AiderWorker 在沙箱（临时目录）中生成代码，执行完成后通过 `_sync_back_files()` 将文件同步回 `contract.repo_path`：

```python
@staticmethod
def _sync_back_files(sandbox_result, temp_dir, target_dir):
    for edit in sandbox_result.get("file_edits", []):
        rel_path = edit.get("path", "")
        src = os.path.join(temp_dir, rel_path)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(target_dir, rel_path))
```

## TUI 测试工具

位置: `scripts/tui_test.py`

### 功能

- **流式事件展示**：使用 Rich Live 实时显示 EventBus 事件
- **LLM 流式输出**：AgentStreamDisplay 实时渲染 LLM 输出文本
- **多 Agent 角色显示**：task.started 事件显示 CODE/TEST/REVIEW 角色标签
- **Token 统计**：每次调用的 Token 消耗
- **纯聊天支持**：问候/闲聊走聊天模式，不触发编码

### 启动

```powershell
$env:OPENAI_API_KEY="..."
$env:OPENAI_API_BASE="..."
python scripts/tui_test.py
```

## 向后兼容

为保持代码兼容性，保留了原有的两个类作为委托：

| 旧类 | 新实现 |
|-----|-------|
| `ProductManagerAgent` | 委托给 `FlowAgent` |
| `ProjectManagerAgent` | 委托给 `FlowAgent` |

## 关键文件

| 文件 | 核心内容 |
|-----|---------|
| `planning_agent.py` | FlowAgent + 聊天检测 + 对话历史 + 复杂度评估 |
| `scheduler_core.py` | 集成 FlowAgent + DAG 调度 + 事件发布 |
| `event_bus.py` | EventBus + publish_sync + 线程桥接 |
| `worker.py` | AiderWorker + agent_message + _sync_back_files + 线程事件 |
| `headless_io.py` | HeadlessIO + _StreamCapture 流式捕获 |
| `tui_test.py` | 流式 TUI + AgentStreamDisplay + 多 Agent 面板 |