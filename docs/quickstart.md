# FlowMind-V2 快速入门

## 环境准备

### 1. 激活虚拟环境

```powershell
d:\AI\FlowMind-V2\.venv\Scripts\Activate.ps1
```

### 2. 配置 API Key（每次新终端都需要）

```powershell
$env:OPENAI_API_KEY="c46843aa1f0947b39cdfd1fcb4564af4.HX72k6kchXRdywkn"
$env:OPENAI_API_BASE="https://open.bigmodel.cn/api/paas/v4/"
```

### 3. 设置 PYTHONPATH

```powershell
$env:PYTHONPATH="FlowMind;FlowMind\backend"
```

---

## 方式一：TUI 交互式测试（推荐）

最直观的测试方式，支持流式输出和实时事件展示。

```powershell
$env:OPENAI_API_KEY="c46843aa1f0947b39cdfd1fcb4564af4.HX72k6kchXRdywkn"
$env:OPENAI_API_BASE="https://open.bigmodel.cn/api/paas/v4/"
python scripts/tui_test.py
```

运行后可以看到实时流式输出：

```
┌─────────────────────────────────────────────┐
│  FlowMind — Agent 能力测试工具              │
│              工作区: output/agentTest        │
└─────────────────────────────────────────────┘

需求 > 帮我创建一个 hello.py，输出 Hello World

⏳ 实时活动          ┌── 💬 实时输出 ──────────┐
  📨 解析完成        │ 好的，我来创建一个简单  │
  🔧 开始编码        │ 的 hello.py 文件...    │
  🤖 LLM 思考中      │                        │
  📄 LLM 完成        │                        │
  🏁 流程完成        └────────────────────────┘
───────────────── 输出在生成过程中实时渲染 ──────

Agent 响应 ─────────────────────
好的，我来创建一个简单的 hello.py 文件...
─────────────────────────────

📄 生成文件 (1):
  • hello.py

状态: ✅ 成功  模式: simple  文件: 1  Token: ↑1234 ↓567
```

**特性**：
- **流式输出**：LLM 输出在生成过程中实时渲染，不等全部完成
- **纯聊天支持**：输入 `你好` → 自然对话，不触发编码
- **短期记忆**：自动记住对话历史，只有重启 TUI 才清空
- **Token 统计**：每次调用显示 ↑输入 ↓输出 Token 数

---

## 方式二：编写 Python 脚本

```python
import asyncio, os, sys

sys.path.insert(0, "FlowMind")
sys.path.insert(0, "FlowMind/backend")

from scripts.test_multi_agent_e2e import InProcWorkerPool, DirectLLMPool
from FlowMind.backend.scheduler.scheduler_core import SchedulerCore

async def main():
    sc = SchedulerCore(repo_path="./output/agentTest")
    result = await sc.submit_task(
        requirement="创建一个 calculator.py，实现加减乘除",
        repo_path="./output/agentTest",
    )
    print(result.get("summary", ""))  # Agent 的自然语言响应
    print("文件:", [e.get("path") for e in result.get("result", {}).get("file_edits", [])])

asyncio.run(main())
```

---

## 方式三：E2E 调度测试

完整的多 Agent DAG 调度测试：

```powershell
$env:OPENAI_API_KEY="c46843aa1f0947b39cdfd1fcb4564af4.HX72k6kchXRdywkn"
$env:OPENAI_API_BASE="https://open.bigmodel.cn/api/paas/v4/"
$env:PYTHONPATH="FlowMind;FlowMind\backend"

python scripts/test_multi_agent_e2e.py
```

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **FlowAgent** | 用户唯一的对话入口，像 Claude 一样自然交互 |
| **聊天/编码分类** | 自动检测问候/闲聊 → 对话模式；编码需求 → 执行模式 |
| **简单任务** | 单文件、单函数修改，FlowAgent 内消化 |
| **复杂任务** | 多文件、跨模块，自动拆解为 DAG 调度 |
| **短期记忆** | 自动保存对话历史，跨轮次上下文持续 |
| **流式输出** | TUI 中实时展示 LLM 输出文本和事件进度 |
| **多 Agent** | 复杂任务并行调度 CODE/TEST/REVIEW，事件面板显示角色标签 |

## 常用命令

| 命令 | 说明 |
|------|------|
| `python scripts/tui_test.py` | 启动 TUI 交互测试 |
| `python scripts/test_multi_agent_e2e.py` | E2E 调度测试 |
| `exit` / `quit` / `q` | 退出 TUI 对话 |