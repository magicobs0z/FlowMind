import json
import logging
import re
import uuid

from .models import (
    AgentContract, AgentRole, Blueprint, BlueprintPhase,
    ContractChangeRequest, TaskDAG, TaskNode, NodeType,
)

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════
# 第一层：项目经理核心提示词
#
# Flow 是用户唯一的对话入口。用户只跟这段提示词背后的智能体对话。
# 系统背后是 1 个还是 N 个 Agent，对用户完全透明。
#
# 提示词设计思路：
#   1) 元认知约束 — 批判性思考、结构化输出、主动索要信息
#   2) 能力自检 — 判断任务复杂度，决定走内部消化还是调度协议
#   3) 简单任务流程 — PM 内部角色切换，用户无感知
#   4) 复杂任务流程 — 规划 → 拆解 → 调度 → 协调 → 归并
# ═══════════════════════════════════════════════════════════════════════
PROMANAGER_CORE_PROMPT = """你是一个资深项目经理，代号 Flow。你是用户唯一的对话入口。

【核心原则 — 必须遵守】
- 先讨论，再行动。收到需求后，先与用户交流确认，不要直接开始写代码
- 你就是用户的 AI 助手，像 Claude/ChatGPT 一样输出自然语言回复
- 用户可能只是讨论想法、问问题，不一定每次都需要写代码
- 只有在明确确认需要写代码时，才调用编码能力
- 保持对话自然流畅，先理解需求，与用户达成共识
- 避免过分的夸赞，保持客观中立
- 你的回答不一定是对的，用户的判断也不一定是对的
- 反复推敲需求，优先保证准确性
- 必要时主动索要补充信息或证据
- 回答时保持结构化输出，条理清晰

【能力边界】
你能独立完成简单的编码任务（修改单个函数、修复单文件 Bug、添加少量代码），
也能为复杂需求（多模块开发、跨文件重构）编排多 Agent 团队。
你是用户唯一的对话入口，可以像聊天助手一样自由交流。

【工作流程】

步骤1: 讨论需求（始终从这里开始）
- 接收用户的自然语言需求
- 如果是模糊的、不完整的想法 → 主动提问澄清，与用户讨论
- 如果用户只是在聊天、提问、讨论想法 → 用自然语言回复即可，不需要编码
- 如果用户明确表达了编码需求 → 进入步骤2
- 【重要】始终用自然语言回复用户，不要一上来就输出代码

步骤2: 复杂度自检
逐项评估：
a) 涉及文件数 ≤ 2？
b) 变更是否局限在单个函数/方法内？
c) 不需要新建模块或架构调整？
d) 不需要跨文件协调？

若全部满足 → 标记为「简单任务」，走内部流程（步骤3a）
否则 → 标记为「复杂任务」，走调度协议（步骤3b）

步骤3a: 简单任务 — 内部消化流程
1. 先向用户说明你的方案，获得确认后再开始
2. 生成修改代码
3. 向用户展示修改结果和代码

步骤3b: 复杂任务 — 多 Agent 调度协议
1. 规划阶段（Product Manager）：将需求拆解为阶段蓝图（Blueprint）
2. 分解阶段（Project Manager）：将蓝图拆解为 DAG 任务节点
3. 调度阶段（Scheduler）：通过调度中心拉起所需 Agent 实例
4. 协调阶段（Coordinator）：监控进度，处理依赖和冲突
5. 归并阶段（Merger）：将所有结果合并后反馈用户

【输出规范】
- 像人类一样自然对话，不是机器人式地输出结构
- 保持结构化但不要太正式
- 复杂任务输出 JSON 格式的 Blueprint 和 DAG"""

# ═══════════════════════════════════════════════════════════════════════
# 第二层：可注入角色片段
#
# 这些不是常驻提示词。它们是被调度时才会拼接的「角色插件」。
# 工程师、测试员、审查员没有独立的 Agent 实例，它们只是 PM
# 在需要时通过 Contract 拉起的一个「带了角色提示词的 LLM 调用」。
# 用完即销毁，不保留状态。
# ═══════════════════════════════════════════════════════════════════════

ENGINEER_ROLE_FRAGMENT = """你现在是一名高级软件工程师，被项目经理 Flow 临时调度执行此任务。

【行为约束】
- 你的任务范围由契约严格定义
- 保持批判性思考：你的代码可能包含未发现的 bug
- 输出必须使用 WholeFile 格式（全文件替换）
- 若任务简单明确，直接输出完整文件内容，无需额外解释
- 如果任务没有指定文件列表，直接根据任务描述创建所需的代码文件，不要询问需要修改哪些文件

【WholeFile 输出格式 — 必须严格遵守】
对于每个要创建或修改的文件，必须严格按照以下格式输出：

```
path/to/file.py
```python
// 完整的文件内容放这里
// 不要省略、不要截断
// 不要用 SEARCH/REPLACE，直接输出整个文件
```

**格式铁律**：
1. 文件名必须单独放在代码块**外面、代码块前面**第一行
2. 文件名必须是相对路径，不要包含绝对路径
3. 下一行开始用 ```language 标记代码块起始
4. 文件内容完整放在代码块内
5. 代码块结束用 ```
6. 每个文件一个独立的文件名+代码块组合
7. 不要把文件名包在代码块内部！这是错误的

正确示例（创建新文件）：
src/models/user.py
```python
from datetime import datetime

class User:
    def __init__(self, id: int, username: str, email: str):
        self.id = id
        self.username = username
        self.email = email
        self.created_at = datetime.now()
```

【核心原则】
- 避免过分的夸赞，保持客观中立
- 反复推敲，优先保证准确性
- 保持结构化输出
"""

TESTER_ROLE_FRAGMENT = """你现在是一名软件测试工程师，被项目经理 Flow 临时调度执行此任务。

【行为约束】
- 不要过度自信——测试用例可能有遗漏
- 覆盖正常路径和边界情况
- 优先保证测试的准确性和可重复性
- 如果被测代码有歧义，主动索要澄清
- 使用 pytest 框架，测试文件命名为 test_*.py

【核心原则】
- 保持批判性思考
- 输出结构化、可执行的测试用例
"""

REVIEWER_ROLE_FRAGMENT = """你现在是一名代码审查员，被项目经理 Flow 临时调度执行此任务。

【行为约束】
- 审查时保持客观中立，不预设立场
- 你的判断不一定正确，需明确给出置信度
- 从正确性、安全性、性能、可维护性、契约合规性 5 个维度审查
- 输出 JSON 格式的结构化审查报告

【核心原则】
- 避免过分的夸赞
- 优先保证准确性
"""

# ────────────────────────────────────────────
# 向后兼容：保留旧常量名供外部引用
# ────────────────────────────────────────────
PLANNER_SYSTEM_PROMPT = PROMANAGER_CORE_PROMPT
TASK_BREAKDOWN_PROMPT = """请将以下蓝图阶段拆解为可执行的任务 DAG。

每个任务节点需要包含：
- id: 唯一标识符
- type: code / test / review / merge
- depends_on: 前置依赖节点 ID 列表
- instruction: 具体的编码指令（必须包含具体字段名、类型、约束，不能泛泛而谈）
- files: 预计涉及的文件
- model_hint: fast / strong

输出格式（JSON）：
{
  "nodes": [
    {
      "id": "task-1",
      "type": "code",
      "depends_on": [],
      "instruction": "创建 User 模型，包含 username(str, unique)、password_hash(str)、email(str) 字段，使用 SQLAlchemy ORM",
      "files": ["src/models/user.py"],
      "model_hint": "fast"
    }
  ]
}

"type" 可选值: code(编码), test(测试), review(审查), merge(合并)
"model_hint" 可选值: fast(简单任务), strong(复杂任务)

【重要约束】
- files 中的路径必须使用完整的项目相对路径（如 src/models/user.py），不要省略目录前缀
- 节点总数不得超过 10 个（含所有类型）。
- 合并同阶段内的同类操作（如不要将 "运行测试" 和 "重新运行测试" 拆成两个节点）。
- 依赖关系要准确：test 依赖对应 code，review 依赖对应 test。
- 一个节点可以涉及多个文件（如多个模型定义放一个节点），不要为每个文件建一个节点。
- instruction 必须具体到字段名、函数名、协议等细节。禁止使用"定义数据模型和结构"这种模糊描述。
"""

BLUEPRINT_PROMPT = """你是一名产品经理。请根据用户的需求，输出 JSON 格式的项目规划。

{
  "project_name": "项目名称",
  "description": "项目概述",
  "phases": [
    {
      "name": "阶段名称",
      "description": "阶段描述",
      "sub_phases": [
        {"name": "子阶段名称", "description": "子阶段描述"}
      ]
    }
  ],
  "language": "python",
  "framework": ""
}

请基于用户需求输出合理、可执行的阶段划分。
不要询问文件，不要列文件清单，直接输出 JSON 规划。
"""

# 暴露角色片段映射表，供 ContractGenerator 使用
ROLE_FRAGMENTS = {
    "engineer": ENGINEER_ROLE_FRAGMENT,
    "tester": TESTER_ROLE_FRAGMENT,
    "reviewer": REVIEWER_ROLE_FRAGMENT,
}


class BasePlanningAgent:
    def __init__(self, model_name: str = "openai/GLM-4-Flash-250414",
                 worker_pool=None, knowledge_service=None):
        self.model_name = model_name
        self.worker_pool = worker_pool
        self.knowledge_service = knowledge_service

    async def _call_llm(self, instruction: str,
                        system_prompt: str,
                        max_reflections: int = 1,
                        timeout: int = 120) -> str:
        if not self.worker_pool:
            return ""
        contract = AgentContract(
            contract_id=f"plan_{uuid.uuid4().hex[:8]}",
            agent_role=AgentRole.PROJECT_MANAGER,
            instruction=instruction,
            system_prompt_extra=system_prompt,
            model_name=self.model_name,
            max_reflections=max_reflections,
            timeout_seconds=timeout,
        )
        try:
            handle = await self.worker_pool.acquire(contract, timeout=30)
            try:
                result = await self.worker_pool.dispatch(handle, contract)
                output = result.get("full_diff", "")
                if result.get("success"):
                    return output
                return result.get("error_message", "")
            finally:
                await self.worker_pool.release(handle.worker_id)
        except Exception as e:
            logger.warning("LLM call failed in planning agent: %s", e)
            return ""

    def _extract_json(self, text: str) -> dict | None:
        try:
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                return json.loads(json_match.group())
        except (json.JSONDecodeError, AttributeError):
            pass
        return None


# ═══════════════════════════════════════════════════════════════════════
# FlowAgent — 统一项目经理智能体
#
# 这是用户唯一的对话入口。FlowAgent 内部实现了：
#   - 复杂度自检（纯规则，不消耗 LLM）
#   - 简单任务：直接构造指令 → 调用 AiderWorker → 返回结果
#   - 复杂任务：规划蓝图 → 拆解 DAG → 返回调度方案
#
# 旧的 ProductManagerAgent / ProjectManagerAgent 保留为内部能力，
# 不直接暴露给用户。
# ═══════════════════════════════════════════════════════════════════════
class FlowAgent(BasePlanningAgent):
    """项目经理智能体 — 用户唯一的对话入口。代号 Flow。

    上下文管理策略：
    - 对话历史持久化，只有手动调用 reset 才清空
    - LLM 可通过 TodoService 获取项目整体状态（任务、文件、进度）
    - 自动上下文压缩：当前上下文占用达到 75% 窗口后，触发压缩；
      添加新内容后预计超过 80%，也触发压缩。
    """

    # 默认的自检规则（单位：字符）
    SIMPLE_MAX_LENGTH = 300

    # 纯聊天模式匹配（非编码类输入）
    CHAT_PATTERNS = [
        r"^(你好|嗨|hi|hello|hey|早上好|下午好|晚上好|哈[喽罗]|在吗)",
        r"^(我是|你叫|你是谁|你叫什么|你是.+(吗|么))",
        r"^(再见|拜拜|bye|goodbye|回头聊|明天见)",
        r"^(谢谢|感谢|多谢|thank)",
        r"^(你[感觉|觉得|认为].+[吗么])",
        r"[?？]$",                     # 问句结尾
    ]

    def __init__(self, model_name: str = "openai/GLM-4-Flash-250414",
                 worker_pool=None, knowledge_service=None,
                 event_bus=None, cap_mgr=None,
                 todo_service=None,
                 code_worker_pool=None):
        super().__init__(model_name, worker_pool, knowledge_service)
        self.event_bus = event_bus
        self.cap_mgr = cap_mgr  # CapabilityManager 实例
        self.todo_service = todo_service  # TodoService 实例（注入后可查询项目状态）
        # 对话历史持久化
        self._conversation_history: list[dict] = []
        # 上下文窗口配置（默认 GLM-4-Flash 是 128k tokens）
        self._max_context_tokens = 128 * 1024
        # 触发阈值
        self._threshold_soft_pct = 75
        self._threshold_hard_pct = 80
        # 估算系数：~4字符 ≈ 1 token
        self._char_per_token = 4
        # 可注入独立代码执行池（AiderWorker pool），用于 _simple_execute 写回代码
        self._code_worker_pool = code_worker_pool

    # ── 公开入口 ────────────────────────────────────────────────

    async def process_request(self, requirement: str,
                              repo_url: str = "",
                              repo_path: str = "") -> dict:
        """统一入口：接收用户需求，自检后走内部执行或调度协议。

        上下文管理：
        - 自动注入 TodoService 项目状态供 LLM 查询
        - 上下文占用 ≥75% 时自动压缩对话历史
        - 只有调用 reset_conversation() 才会清空对话历史
        """
        await self._emit("flow.request_received",
                         requirement=requirement[:100])

        # 步骤0: 检测是否为纯聊天输入
        if self._detect_chat(requirement):
            logger.info("flow: routing to chat mode for '%s'", requirement[:60])
            result = await self._chat_response(requirement, repo_path)

            # 记录对话历史
            summary_text = result.get("summary", "") or ""
            self._record_conversation(requirement, summary_text[:500])
            return result

        # 步骤1: 理解需求 — 通过 knowledge_service 获取上下文
        context = ""
        if self.knowledge_service:
            docs = self.knowledge_service.retrieve(requirement, top_k=3)
            if docs:
                context = self.knowledge_service.format_context(docs, 1000)

        # 注入 MCP / Skill / Rule 能力上下文到 PM 提示词
        if self.cap_mgr:
            cap_ctx = self.cap_mgr.format_prompt_context()
            if cap_ctx:
                context = (context + "\n\n" + cap_ctx).strip()

        # 注入 TodoService 项目状态（供 LLM 了解整体进度和任务列表）
        project_ctx = self.get_project_context()
        if project_ctx:
            context = (context + "\n\n" + project_ctx).strip()

        # 上下文压缩检查：在调用 LLM 前检查是否需要压缩
        promp, _ = await self._maybe_compress(
            PROMANAGER_CORE_PROMPT, requirement)

        # 步骤2: 复杂度自检
        complexity = self._assess_complexity(requirement, context)
        logger.info("flow: complexity='%s' for request (len=%d, history=%d)",
                    complexity, len(requirement),
                    len(self._conversation_history))

        result = None
        if complexity == "simple":
            result = await self._simple_execute(requirement, repo_url,
                                                 repo_path, context)
        else:
            result = await self._complex_schedule(requirement, repo_url,
                                                  context)

        # 记录对话历史（存储完整摘要/响应内容）
        summary_text = result.get("summary", "") or ""
        reply_summary = (
            f"mode={result.get('mode', '')}, "
            f"status={result.get('status', '')}"
        )
        if summary_text:
            reply_summary = summary_text[:300] + "\n\n" + reply_summary
        if "dag" in result:
            node_count = result["dag"].get("node_count", 0)
            reply_summary += f", nodes={node_count}"
        self._record_conversation(requirement, reply_summary)

        return result

    # ── 复杂度自检（纯规则，零 LLM 开销） ──────────────────────

    def _assess_complexity(self, requirement: str,
                           context: str = "") -> str:
        """基于规则的复杂度自检。

        判定为「简单」的条件（同时满足）：
        1. 需求文本较短（≤ SIMPLE_MAX_LENGTH 字符）
        2. 包含简单关键词，不含复杂关键词
        3. 上下文没有指明这是大型项目
        """
        req_lower = requirement.lower()

        # 复杂关键词 — 任意一个命中即标记为复杂
        complex_kw = [
            "新建项目", "多模块", "数据库设计", "架构", "重构",
            "refactor", "多个文件", "分布式", "并行", "全栈",
            "前端", "后端", "完整", "系统设计", "新建模块",
            "数据库", "微服务", "部署", "配置", "测试框架",
            "电商", "管理平台", "仪表盘", "工作流", "权限",
            "用户体系", "包含.*模块", "包括.*模块", "多用户",
            "审批", "上报", "报表", "数据分析", "批量",
        ]
        for kw in complex_kw:
            if kw.lower() in req_lower:
                return "complex"

        # 需求过长 → 复杂
        if len(requirement) > self.SIMPLE_MAX_LENGTH:
            return "complex"

        # 简单关键词 — 任一命中且不触发复杂规则 → 简单
        simple_kw = [
            "修改", "修复", "改", "fix", "change", "update",
            "添加一个函数", "add a function", "重命名", "rename",
            "删除", "delete", "remove", "重构函数", "提取",
            "创建", "编写", "实现", "生成", "写一个", "新建",
            "定义", "加上", "补充", "在.*中创建",
        ]
        for kw in simple_kw:
            if kw.lower() in req_lower:
                return "simple"

        # 短需求默认简单，长需求默认复杂
        if len(requirement) < 100:
            return "simple"
        return "complex"

    def _detect_chat(self, requirement: str) -> bool:
        """检测输入是否为纯聊天内容（非编码需求）。"""
        for pat in self.CHAT_PATTERNS:
            if re.search(pat, requirement.strip()):
                return True
        # 如果完全没匹配 coding 关键词，也当作聊天
        coding_kw = ["创建", "编写", "实现", "生成", "修改", "修复",
                     "写一个", "新建", "定义", "重构", "删除", "添加",
                     "fix", "create", "implement", "generate", "refactor",
                     "写", "改", "建"]
        req_lower = requirement.lower()
        for kw in coding_kw:
            if kw in req_lower:
                return False
        # 没有任何编码关键词 → 大概率是聊天
        return True

    async def _chat_response(self, requirement: str, repo_path: str = "") -> dict:
        """纯聊天模式：调用 LLM 回复用户，不执行任何编码。"""
        await self._emit("flow.chat_started", requirement=requirement[:100])

        # 只注入最近 2 轮历史的简短摘要，避免 LLM 重复历史内容
        history_parts = []
        if self._conversation_history:
            last_entries = self._conversation_history[-2:]
            for i, entry in enumerate(last_entries):
                user_part = entry.get("user", "")[:120]
                asst_part = entry.get("assistant", "")[:200]
                if user_part or asst_part:
                    history_parts.append(
                        f"用户: {user_part}\nFlow: {asst_part}"
                    )

        instruction = requirement
        if history_parts:
            instruction = (
                "简短历史:\n" + "\n\n".join(history_parts) +
                "\n\n---\n\n" + requirement
            )

        prompt = PROMANAGER_CORE_PROMPT + "\n\n【注意】本次用户不是在提编码需求，而是在和你聊天对话。请用自然语言回复，不要提出编码方案。"

        tokens_sent = 0
        tokens_recv = 0
        summary = ""

        pool = self._code_worker_pool or self.worker_pool
        if pool:
            contract = AgentContract(
                contract_id=f"chat_{uuid.uuid4().hex[:8]}",
                agent_role=AgentRole.PROJECT_MANAGER,
                instruction=instruction,
                system_prompt_extra=prompt,
                model_name=self.model_name,
                max_reflections=1,
                timeout_seconds=60,
                repo_path=repo_path or "",
            )
            try:
                handle = await pool.acquire(contract, timeout=30)
                try:
                    result = await pool.dispatch(handle, contract)
                    summary = (result.get("agent_message", "")
                               or result.get("full_diff", "")
                               or "")
                    tokens_sent = (result.get("total_tokens_sent", 0)
                                   or result.get("tokens_sent", 0)
                                   or 0)
                    tokens_recv = (result.get("total_tokens_received", 0)
                                   or result.get("tokens_received", 0)
                                   or 0)
                finally:
                    await pool.release(handle.worker_id)
            except Exception as e:
                logger.warning("Chat LLM call failed: %s", e)

        if not summary:
            summary = "你好！我是 Flow，你的 AI 项目助手。有什么可以帮你的吗？"

        self._record_conversation(requirement, summary[:500])
        return {
            "status": "completed",
            "mode": "chat",
            "summary": summary.strip(),
            "tokens_sent": tokens_sent,
            "tokens_received": tokens_recv,
            "result": {},
        }

    # ── 对话历史管理 ──────────────────────────────────────────

    def reset_conversation(self) -> None:
        """手动清除整个对话历史和上下文。只有显式调用才会触发。"""
        self._conversation_history.clear()
        logger.info("flow: conversation history reset")

    def get_project_context(self) -> str:
        """从 TodoService 拉取项目状态，供 LLM 在对话中查询。"""
        if not self.todo_service:
            return ""
        try:
            return self.todo_service.format_project_context()
        except Exception as e:
            logger.warning("Failed to get project context: %s", e)
            return ""

    def _estimate_tokens(self, *texts: str) -> int:
        """简单估算 token 数：~4 字符 ≈ 1 token。"""
        total_chars = sum(len(t) for t in texts if t)
        return max(1, total_chars // self._char_per_token)

    def _context_pct(self, *texts: str) -> float:
        """当前上下文占窗口的百分比。"""
        tokens = self._estimate_tokens(*texts)
        return min(tokens / self._max_context_tokens * 100, 100)

    async def _maybe_compress(self, system_prompt: str,
                                instruction: str) -> tuple[str, str]:
        """检查是否需要压缩上下文。

        规则：
        1. 当前上下文占用 ≥ 75% 窗口 → 立即压缩
        2. 添加本次 instruction 后 ≥ 80% 窗口 → 先压缩再添加

        压缩方式：将对话历史摘要为一段简短文字。
        """
        all_texts = [system_prompt]
        for entry in self._conversation_history:
            all_texts.append(entry.get("user", ""))
            all_texts.append(entry.get("assistant", ""))
        all_texts.append(instruction)

        current_pct = self._context_pct(*all_texts)
        projected_pct = self._context_pct(
            system_prompt,
            *(entry.get("user", "") + entry.get("assistant", "")
              for entry in self._conversation_history),
            instruction,
        )

        need_compress = (current_pct >= self._threshold_soft_pct or
                         projected_pct >= self._threshold_hard_pct)

        if not need_compress or not self._conversation_history:
            return system_prompt, instruction

        logger.info("flow: context compression triggered "
                    "(current=%.1f%%, projected=%.1f%%, history=%d entries)",
                    current_pct, projected_pct, len(self._conversation_history))

        # 生成摘要
        history_text = []
        for i, entry in enumerate(self._conversation_history):
            history_text.append(
                f"[第{i+1}轮]\n用户: {entry.get('user', '')[:300]}\n"
                f"助手: {entry.get('assistant', '')[:300]}"
            )
        summary_prompt = (
            f"请将以下多轮对话历史压缩为一段不超过 300 字的摘要，"
            f"保留关键决策、任务分配和输出文件信息：\n\n"
            f"{chr(10).join(history_text[-6:])}"  # 只摘最后6轮
        )

        summary = await self._call_llm(
            summary_prompt,
            "你是一个对话摘要器，请简短总结对话。",
            max_reflections=1, timeout=60,
        )
        summary = (summary or "").strip()[:500]

        # 替换历史为摘要
        if summary:
            self._conversation_history = [
                {"user": "对话历史摘要", "assistant": summary}
            ]
            # 注入摘要到指令中
            instruction = (
                f"【对话历史摘要】\n{summary}\n\n"
                f"--- 当前指令 ---\n{instruction}"
            )
            logger.info("flow: context compressed to summary (%d chars)",
                        len(summary))

        return system_prompt, instruction

    def _record_conversation(self, user_msg: str, assistant_reply: str) -> None:
        """记录一轮对话到持久化历史。"""
        self._conversation_history.append({
            "user": user_msg,
            "assistant": assistant_reply,
        })

    # ── 简单任务：内部消化 ──────────────────────────────────────

    async def _simple_execute(self, requirement: str,
                               repo_url: str,
                               repo_path: str,
                               context: str) -> dict:
        """简单任务：PM 使用 AiderWorker 直接写代码到工作区。"""
        await self._emit("flow.simple_started",
                         requirement=requirement[:100])

        # ── 注入对话历史（短期记忆）— 只保留最近 2 轮简短摘要 ──
        history_parts = []
        if self._conversation_history:
            last_entries = self._conversation_history[-2:]
            for i, entry in enumerate(last_entries):
                user_part = entry.get("user", "")[:200]
                asst_part = entry.get("assistant", "")[:300]
                if user_part or asst_part:
                    history_parts.append(
                        f"之前: {user_part}\n回应: {asst_part}"
                    )

        instruction = f"用户需求：{requirement}"
        if history_parts:
            instruction = (
                "对话背景:\n" + "\n\n".join(history_parts)
                + "\n\n---\n\n"
                + instruction
            )
        if context:
            instruction += f"\n\n【相关项目知识】\n{context}"

        # Engineer WholeFile 格式系统提示词
        system_prompt = ENGINEER_ROLE_FRAGMENT

        # 优先使用代码执行池（AiderWorker），回退到 LLM 池
        pool = self._code_worker_pool or self.worker_pool
        if not pool:
            return {"status": "failed", "mode": "simple",
                    "error": "no worker pool available"}

        contract = AgentContract(
            contract_id=f"flow_{uuid.uuid4().hex[:8]}",
            agent_role=AgentRole.ENGINEER,
            instruction=instruction,
            system_prompt_extra=system_prompt,
            model_name=self.model_name,
            max_reflections=2,
            timeout_seconds=120,
            repo_path=repo_path or "",
        )

        try:
            handle = await pool.acquire(contract, timeout=30)
            try:
                result = await pool.dispatch(handle, contract)
                success = result.get("success", False)
                await self._emit("flow.simple_completed",
                                 success=success)
                # 提取 Agent 的自然语言响应作为摘要
                agent_msg = result.get("agent_message", "")
                summary = agent_msg[:800] if agent_msg else ""
                # 如果没有自然语言响应，生成简短摘要
                if not summary:
                    edits = result.get("file_edits", [])
                    file_list = ", ".join(e.get("path", "") for e in edits[:5])
                    summary = f"已完成代码生成。修改了 {len(edits)} 个文件：{file_list}" if edits else "任务已完成。"
                return {
                    "status": "completed" if success else "failed",
                    "mode": "simple",
                    "result": result,
                    "summary": summary,
                }
            finally:
                await pool.release(handle.worker_id)
        except Exception as e:
            logger.error("flow simple execute failed: %s", e)
            await self._emit("flow.simple_failed", error=str(e))
            return {"status": "failed", "mode": "simple", "error": str(e)}

    # ── 复杂任务：调度协议 ──────────────────────────────────────

    async def _complex_schedule(self, requirement: str,
                                 repo_url: str,
                                 context: str) -> dict:
        """复杂任务：规划蓝图 → 拆解 DAG → 返回调度方案。"""
        await self._emit("flow.complex_started",
                         requirement=requirement[:100])

        # 步骤1: 规划蓝图
        blueprint = await self._create_blueprint(requirement, context)
        if not blueprint:
            return {"status": "failed", "mode": "complex",
                    "error": "PM blueprint creation failed"}

        await self._emit("flow.blueprint_created",
                         project=blueprint.project_name,
                         phases=len(blueprint.phases))

        # 步骤2: 拆解 DAG
        dag = await self._breakdown(blueprint, repo_url=repo_url)
        if not dag:
            return {"status": "failed", "mode": "complex",
                    "error": "PM DAG breakdown failed"}

        # 注入原始需求上下文到 DAG
        dag.requirement_context = requirement[:1000]

        await self._emit("flow.dag_created",
                         node_count=len(dag.nodes))

        return {
            "status": "planned",
            "mode": "complex",
            "blueprint": {
                "project_name": blueprint.project_name,
                "description": blueprint.description,
                "phases": [
                    {"name": p.name, "description": p.description}
                    for p in blueprint.phases
                ],
                "language": blueprint.language,
                "framework": blueprint.framework,
            },
            "dag": {
                "dag_id": dag.dag_id,
                "repo_url": dag.repo_url,
                "node_count": len(dag.nodes),
                "nodes": [
                    {
                        "id": n.id,
                        "type": n.type.value,
                        "depends_on": n.depends_on,
                        "instruction": n.instruction,
                        "files": n.files,
                        "model_hint": n.model_hint,
                    }
                    for n in dag.nodes
                ],
                "requirement_context": dag.requirement_context,
            },
        }

    # ── 内部能力：蓝图规划（原 ProductManagerAgent） ────────────

    async def _create_blueprint(self, requirement: str,
                                 context: str = "") -> Blueprint | None:
        instruction = f"需求描述：{requirement}\n"
        if context:
            instruction += f"\n相关项目知识：\n{context}\n"

        # 注入 TodoService 项目状态
        proj_ctx = self.get_project_context()
        if proj_ctx:
            instruction += f"\n当前项目状态：\n{proj_ctx}\n"

        prompt, instruction = await self._maybe_compress(
            BLUEPRINT_PROMPT, instruction)

        output = await self._call_llm(
            instruction, prompt, max_reflections=2, timeout=180
        )
        if not output:
            return self._rule_based_blueprint(requirement)

        parsed = self._extract_json(output)
        if parsed:
            return self._parse_blueprint(parsed)
        return self._rule_based_blueprint(requirement)

    def _parse_blueprint(self, data: dict) -> Blueprint:
        phases = []
        for p in data.get("phases", []):
            subs = [
                BlueprintPhase(name=s.get("name", ""),
                               description=s.get("description", ""))
                for s in p.get("sub_phases", [])
            ]
            phases.append(BlueprintPhase(
                name=p.get("name", ""),
                description=p.get("description", ""),
                sub_phases=subs,
            ))
        return Blueprint(
            project_name=data.get("project_name", "unnamed"),
            description=data.get("description", ""),
            phases=phases,
            language=data.get("language", "python"),
            framework=data.get("framework", ""),
        )

    def _rule_based_blueprint(self, requirement: str) -> Blueprint:
        return Blueprint(
            project_name="project",
            description=requirement[:200],
            phases=[
                BlueprintPhase(name="数据模型",
                               description="定义数据模型和结构"),
                BlueprintPhase(name="业务逻辑",
                               description="实现核心业务逻辑"),
                BlueprintPhase(name="API 接口",
                               description="实现 API 端点"),
                BlueprintPhase(name="测试",
                               description="编写测试用例"),
            ],
        )

    # ── 内部能力：DAG 拆解（原 ProjectManagerAgent） ────────────

    async def _breakdown(self, blueprint: Blueprint,
                          repo_url: str = "") -> TaskDAG | None:
        phases_text = "\n".join(
            f"- {p.name}: {p.description}"
            + ("\n  " + "\n  ".join(
                f"  - {s.name}: {s.description}" for s in p.sub_phases)
               if p.sub_phases else "")
            for p in blueprint.phases
        )
        instruction = (
            f"项目：{blueprint.project_name}\n"
            f"描述：{blueprint.description}\n"
            f"语言：{blueprint.language}  框架：{blueprint.framework}\n\n"
            f"阶段蓝图：\n{phases_text}\n\n"
            f"请将上述阶段拆解为可执行的编码/测试/审查任务 DAG。"
        )

        # 注入 TodoService 项目状态
        proj_ctx = self.get_project_context()
        if proj_ctx:
            instruction += f"\n\n当前项目状态：\n{proj_ctx}"

        prompt, instruction = await self._maybe_compress(
            TASK_BREAKDOWN_PROMPT, instruction)

        output = await self._call_llm(
            instruction, prompt,
            max_reflections=2, timeout=180,
        )
        if not output:
            return self._rule_based_dag(blueprint, repo_url)

        parsed = self._extract_json(output)
        if parsed and "nodes" in parsed:
            return self._parse_dag(blueprint.project_name, parsed, repo_url)
        return self._rule_based_dag(blueprint, repo_url)

    def _parse_dag(self, name: str, data: dict,
                   repo_url: str) -> TaskDAG:
        nodes = []
        for n in data.get("nodes", []):
            try:
                nt = NodeType(n.get("type", "code"))
            except ValueError:
                nt = NodeType.CODE
            nodes.append(TaskNode(
                id=n.get("id", f"task_{len(nodes)}"),
                type=nt,
                depends_on=n.get("depends_on", []),
                instruction=n.get("instruction", ""),
                files=n.get("files", []),
                model_hint=n.get("model_hint", ""),
            ))

        # 安全兜底：截断超过 10 个的节点
        MAX_NODES = 10
        if len(nodes) > MAX_NODES:
            logger.warning("LLM generated %d nodes, truncating to %d",
                          len(nodes), MAX_NODES)
            nodes = nodes[:MAX_NODES]

        return TaskDAG(
            dag_id=name.lower().replace(" ", "-"),
            repo_url=repo_url,
            nodes=nodes,
        )

    def _rule_based_dag(self, blueprint: Blueprint,
                        repo_url: str) -> TaskDAG:
        nodes = []
        for i, phase in enumerate(blueprint.phases):
            nid = phase.name.lower().replace(" ", "-")
            nodes.append(TaskNode(
                id=nid,
                type=NodeType.CODE,
                instruction=f"实现 {phase.name}：{phase.description}",
                depends_on=[blueprint.phases[i - 1].name.lower().replace(" ", "-")]
                if i > 0 else [],
            ))
            nodes.append(TaskNode(
                id=f"test-{nid}",
                type=NodeType.TEST,
                instruction=f"测试 {phase.name}",
                depends_on=[nid],
                auto_test=True,
                test_command="pytest",
            ))
            nodes.append(TaskNode(
                id=f"review-{nid}",
                type=NodeType.REVIEW,
                instruction=f"审查 {phase.name}",
                depends_on=[f"test-{nid}"],
            ))
        return TaskDAG(
            dag_id=blueprint.project_name.lower().replace(" ", "-"),
            repo_url=repo_url,
            nodes=nodes,
        )

    # ── 工具方法 ──────────────────────────────────────────────

    async def _emit(self, event_type: str, **data):
        if self.event_bus:
            from .models import SchedulerEvent
            try:
                await self.event_bus.publish(SchedulerEvent(
                    event_type=event_type,
                    dag_id="flow",
                    data=data,
                ))
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════════════
# 旧类保留（向后兼容）
# 内部委托给 FlowAgent，外部代码无需改动
# ═══════════════════════════════════════════════════════════════════════

class ProductManagerAgent(BasePlanningAgent):
    """（已弃用 — 请使用 FlowAgent）"""

    async def create_blueprint(self, requirement: str) -> Blueprint | None:
        flow = FlowAgent(
            model_name=self.model_name,
            worker_pool=self.worker_pool,
            knowledge_service=self.knowledge_service,
        )
        return await flow._create_blueprint(requirement)

    def _parse_blueprint(self, data: dict) -> Blueprint:
        # 兼容旧测试代码
        flow = FlowAgent()
        return flow._parse_blueprint(data)

    def _rule_based_blueprint(self, requirement: str) -> Blueprint:
        flow = FlowAgent()
        return flow._rule_based_blueprint(requirement)


class ProjectManagerAgent(BasePlanningAgent):
    """（已弃用 — 请使用 FlowAgent）"""

    async def breakdown(self, blueprint: Blueprint,
                        existing_dag: TaskDAG | None = None,
                        contract_changes: list[ContractChangeRequest] | None = None,
                        repo_url: str = "") -> TaskDAG | None:
        if contract_changes:
            return await self._adjust_dag(existing_dag, contract_changes, repo_url)

        flow = FlowAgent(
            model_name=self.model_name,
            worker_pool=self.worker_pool,
            knowledge_service=self.knowledge_service,
        )
        return await flow._breakdown(blueprint, repo_url)

    async def _adjust_dag(self, dag: TaskDAG | None,
                          changes: list[ContractChangeRequest],
                          repo_url: str) -> TaskDAG | None:
        """DAG 动态调整（复杂任务中的协调阶段使用）。"""
        if not dag:
            return None

        new_nodes = list(dag.nodes)
        for change in changes:
            if change.change_type == "extend_files":
                for n in new_nodes:
                    if n.id == change.node_id:
                        new_files = change.proposed_changes.get("files", [])
                        n.files = list(set(n.files + new_files))
                        n.read_only_files = list(set(
                            n.read_only_files
                            + change.proposed_changes.get("read_only_files", [])
                        ))

            elif change.change_type == "add_dependency":
                new_nodes.append(TaskNode(
                    id=f"{change.node_id}_extra",
                    type=NodeType.CODE,
                    depends_on=[change.node_id],
                    instruction=change.proposed_changes.get("instruction",
                                                             "complementary task"),
                    files=change.proposed_changes.get("files", []),
                ))

            elif change.change_type == "request_clarification":
                logger.info("clarification requested for %s: %s",
                            change.node_id, change.reason)

        return TaskDAG(
            dag_id=dag.dag_id,
            repo_url=repo_url or dag.repo_url,
            nodes=new_nodes,
        )

    def _parse_dag(self, name: str, data: dict, repo_url: str) -> TaskDAG:
        flow = FlowAgent()
        return flow._parse_dag(name, data, repo_url)

    def _rule_based_dag(self, blueprint: Blueprint, repo_url: str) -> TaskDAG:
        flow = FlowAgent()
        return flow._rule_based_dag(blueprint, repo_url)