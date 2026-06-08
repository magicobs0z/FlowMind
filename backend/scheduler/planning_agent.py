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
- 避免过分的夸赞，保持客观中立
- 你的回答不一定是对的，用户的判断也不一定是对的
- 反复推敲需求，优先保证准确性
- 必要时主动索要补充信息或证据
- 回答时保持结构化输出，条理清晰

【能力边界】
你能独立完成简单的编码任务（修改单个函数、修复单文件 Bug、添加少量代码），
也能为复杂需求（多模块开发、跨文件重构）编排多 Agent 团队。

【工作流程】

步骤1: 理解需求
- 接收用户的自然语言需求
- 如有歧义，主动提问澄清
- 确认涉及的文件和范围

步骤2: 复杂度自检
逐项评估：
a) 涉及文件数 ≤ 2？
b) 变更是否局限在单个函数/方法内？
c) 不需要新建模块或架构调整？
d) 不需要跨文件协调？

若全部满足 → 标记为「简单任务」，走内部流程（步骤3a）
否则 → 标记为「复杂任务」，走调度协议（步骤3b）

步骤3a: 简单任务 — 内部消化流程
不需要告知用户你正在切换角色。直接按以下顺序执行：
1. 分析现有代码逻辑
2. 生成修改代码
3. 验证修改的正确性
4. 向用户展示修改结果

步骤3b: 复杂任务 — 多 Agent 调度协议
1. 规划阶段（Product Manager）：将需求拆解为阶段蓝图（Blueprint）
2. 分解阶段（Project Manager）：将蓝图拆解为 DAG 任务节点
3. 调度阶段（Scheduler）：通过调度中心拉起所需 Agent 实例
4. 协调阶段（Coordinator）：监控进度，处理依赖和冲突
5. 归并阶段（Merger）：将所有结果合并后反馈用户

【输出规范】
- 保持结构化，条理清晰
- 复杂任务输出 JSON 格式的 Blueprint 和 DAG
"""

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
- 输出必须是有效的 SEARCH/REPLACE 格式
- 若任务简单明确（单函数修改），直接输出修改，无需拆解步骤
- 如果任务没有指定文件列表，直接根据任务描述创建所需的代码文件，不要询问需要修改哪些文件

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
- instruction: 具体的编码指令
- files: 预计涉及的文件
- model_hint: fast / strong

输出格式（JSON）：
{
  "nodes": [
    {
      "id": "task-1",
      "type": "code",
      "depends_on": [],
      "instruction": "创建 User 模型，包含 id/name/email 字段",
      "files": ["models/user.py"],
      "model_hint": "fast"
    }
  ]
}

"type" 可选值: code(编码), test(测试), review(审查), merge(合并)
"model_hint" 可选值: fast(简单任务), strong(复杂任务)

【重要约束】
- 节点总数不得超过 10 个（含所有类型）。
- 合并同阶段内的同类操作（如不要将 "运行测试" 和 "重新运行测试" 拆成两个节点）。
- 依赖关系要准确：test 依赖对应 code，review 依赖对应 test。
- 一个节点可以涉及多个文件（如多个模型定义放一个节点），不要为每个文件建一个节点。
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
    def __init__(self, model_name: str = "openai/GLM-4-FlashX",
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
    """项目经理智能体 — 用户唯一的对话入口。代号 Flow。"""

    # 默认的自检规则（单位：字符）
    SIMPLE_MAX_LENGTH = 300

    def __init__(self, model_name: str = "openai/GLM-4-FlashX",
                 worker_pool=None, knowledge_service=None,
                 event_bus=None):
        super().__init__(model_name, worker_pool, knowledge_service)
        self.event_bus = event_bus

    # ── 公开入口 ────────────────────────────────────────────────

    async def process_request(self, requirement: str,
                              repo_url: str = "",
                              repo_path: str = "") -> dict:
        """统一入口：接收用户需求，自检后走内部执行或调度协议。

        返回:
            simple 模式: {"status": "completed"|"failed", "mode": "simple", "result": {...}}
            complex 模式: {"status": "planned"|"failed", "mode": "complex",
                           "blueprint": {...}, "dag": {...}}
        """
        await self._emit("flow.request_received",
                         requirement=requirement[:100])

        # 步骤1: 理解需求 — 通过 knowledge_service 获取上下文
        context = ""
        if self.knowledge_service:
            docs = self.knowledge_service.retrieve(requirement, top_k=3)
            if docs:
                context = self.knowledge_service.format_context(docs, 1000)

        # 步骤2: 复杂度自检
        complexity = self._assess_complexity(requirement, context)
        logger.info("flow: complexity='%s' for request (len=%d)",
                    complexity, len(requirement))

        if complexity == "simple":
            return await self._simple_execute(requirement, repo_url,
                                              repo_path, context)
        else:
            return await self._complex_schedule(requirement, repo_url,
                                                context)

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
        ]
        for kw in simple_kw:
            if kw.lower() in req_lower:
                return "simple"

        # 短需求默认简单，长需求默认复杂
        if len(requirement) < 100:
            return "simple"
        return "complex"

    # ── 简单任务：内部消化 ──────────────────────────────────────

    async def _simple_execute(self, requirement: str,
                               repo_url: str,
                               repo_path: str,
                               context: str) -> dict:
        """简单任务：PM 直接调用 AiderWorker 执行，用户无感知。"""
        await self._emit("flow.simple_started",
                         requirement=requirement[:100])

        instruction = f"用户需求：{requirement}\n\n请分析现有代码并实现所需修改。"
        if context:
            instruction += f"\n\n【相关项目知识】\n{context}"

        # 注入 PM 核心提示词 + Engineer 角色片段
        system_prompt = (
            f"{PROMANAGER_CORE_PROMPT}\n\n"
            f"【本次任务角色】\n{ENGINEER_ROLE_FRAGMENT}"
        )

        contract = AgentContract(
            contract_id=f"flow_{uuid.uuid4().hex[:8]}",
            agent_role=AgentRole.PROJECT_MANAGER,
            instruction=instruction,
            system_prompt_extra=system_prompt,
            model_name=self.model_name,
            max_reflections=2,
            timeout_seconds=120,
        )

        if not self.worker_pool:
            return {"status": "failed", "mode": "simple",
                    "error": "no worker pool available"}

        try:
            handle = await self.worker_pool.acquire(contract, timeout=30)
            try:
                result = await self.worker_pool.dispatch(handle, contract)
                success = result.get("success", False)
                await self._emit("flow.simple_completed",
                                 success=success)
                return {
                    "status": "completed" if success else "failed",
                    "mode": "simple",
                    "result": result,
                }
            finally:
                await self.worker_pool.release(handle.worker_id)
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
            },
        }

    # ── 内部能力：蓝图规划（原 ProductManagerAgent） ────────────

    async def _create_blueprint(self, requirement: str,
                                 context: str = "") -> Blueprint | None:
        instruction = f"需求描述：{requirement}\n"
        if context:
            instruction += f"\n相关项目知识：\n{context}\n"

        prompt = BLUEPRINT_PROMPT
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

        output = await self._call_llm(
            instruction, TASK_BREAKDOWN_PROMPT,
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