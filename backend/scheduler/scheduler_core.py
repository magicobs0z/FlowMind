import asyncio
import logging
import uuid
from datetime import datetime, timezone

from .dag_parser import DAGParser
from .event_bus import EventBus
from .contract_generator import ContractGenerator
from .worker_pool import WorkerPool, WorkerPoolExhausted
from .git_branch_manager import GitBranchManager
from .verifier import Verifier, RetryController
from .merge_agent import MergeAgent
from .cost_monitor import CostMonitor
from .tester_agent import TesterAgent
from .reviewer_agent import ReviewerAgent
from .planning_agent import FlowAgent
from .knowledge_service import KnowledgeService
from .todo_service import TodoService
from .capabilities import MCPConnector, SkillRegistry, RuleEngine, Rule
from .models import (
    TaskDAG, TaskNode, DagState, TaskInstance, TaskStatus, SchedulerEvent,
    TokenUsage, MergeResult, NodeType, Blueprint, BudgetConfig,
    ContractChangeRequest, HumanInterruptRequest, ApprovalRequest,
    MergeConflictInfo, InterruptReason, CapabilityConfig, MCPServerConfig,
    SkillConfig, RuleConfig,
)
from .persistence import SQLitePersistence
from .notification import create_notification_service

logger = logging.getLogger(__name__)


class CapabilityManager:
    """MCP / Skill / Rule 三个能力模块的统一管理器。

    用法:
        cap_mgr = CapabilityManager.from_config(cap_config)
        await cap_mgr.mcp.call_tool("server-a", "tool-x", {...})
        await cap_mgr.skills.execute("code-review", {...})
        violations = cap_mgr.rules.evaluate({"node_type": "code", ...})
    """

    def __init__(self):
        self.mcp = MCPConnector()
        self.skills = SkillRegistry()
        self.rules = RuleEngine()

    @classmethod
    def from_config(cls, config: CapabilityConfig | None) -> "CapabilityManager":
        mgr = cls()
        if not config:
            return mgr
        for svr in config.mcp_servers:
            if svr.enabled:
                mgr.mcp.register_server(svr.name, svr.endpoint)
        for sk in config.skills:
            if sk.enabled:
                mgr.skills.register_builtin(sk.name, sk.description,
                                            sk.prompt_template, sk.tags)
        for r in config.rules:
            if r.enabled:
                mgr.rules.add_rule(Rule(
                    rule_id=r.rule_id, name=r.name,
                    description=r.description,
                    condition=r.condition,
                    action=r.action, priority=r.priority,
                ))
        return mgr

    def format_prompt_context(self) -> str:
        parts = []
        mcp_ctx = self.mcp.format_tools_context()
        if mcp_ctx:
            parts.append(mcp_ctx)
        skill_ctx = self.skills.format_skills_context()
        if skill_ctx:
            parts.append(skill_ctx)
        rule_ctx = self.rules.format_rules_context()
        if rule_ctx:
            parts.append(rule_ctx)
        return "\n\n".join(parts)


class SchedulerCore:
    def __init__(self, repo_path: str = "",
                 max_workers: int = 4,
                 worker_host: str = "localhost",
                 base_port: int = 50051,
                 db_path: str = "flowmind.db",
                 worker_pool=None,
                 code_worker_pool=None,
                 cap_config: CapabilityConfig | None = None):
        self.repo_path = repo_path
        self.dag_parser = DAGParser()
        self.event_bus = EventBus()
        self.contract_gen = ContractGenerator()
        # 外部注入的 worker_pool 优先（用于测试）；否则创建真实的 gRPC WorkerPool
        if worker_pool is not None:
            self.worker_pool = worker_pool
        else:
            self.worker_pool = WorkerPool(max_workers, worker_host, base_port)
        # code_worker_pool 用于 FlowAgent simple 模式直接生成代码（InProcWorkerPool 走 AiderWorker）
        if code_worker_pool is not None:
            self.code_worker_pool = code_worker_pool
        else:
            self.code_worker_pool = self.worker_pool

        self.git_mgr = GitBranchManager(repo_path) if repo_path else None
        self.verifier = Verifier()
        self.retry_ctrl = RetryController()
        self.merge_agent = MergeAgent(repo_path) if repo_path else None
        self.cost_monitor = CostMonitor(event_bus=self.event_bus)
        self.tester_agent = TesterAgent()
        self.reviewer_agent = ReviewerAgent()
        self.knowledge_service = KnowledgeService()
        self.cap_mgr = CapabilityManager.from_config(cap_config)
        self.todo = TodoService(event_bus=self.event_bus, db_path=db_path)
        self.flow_agent = FlowAgent(
            worker_pool=self.worker_pool,
            code_worker_pool=self.code_worker_pool,
            knowledge_service=self.knowledge_service,
            event_bus=self.event_bus,
            cap_mgr=self.cap_mgr,
            todo_service=self.todo,
        )
        self.persistence = SQLitePersistence(db_path)
        self.notification = create_notification_service()

        # 注入到 EventBus
        self.event_bus.set_persistence(self.persistence)
        self.event_bus.set_notification(self.notification)

        self._dag_states: dict[str, DagState] = {}
        self._task_events: dict[str, asyncio.Event] = {}
        self._pending_changes: dict[str, list[ContractChangeRequest]] = {}
        self._running = True
        self._loop_task: asyncio.Task | None = None
        self._batch_sem = asyncio.Semaphore(max_workers)

        # Human-in-the-loop 存储
        self._suspended_dags: dict[str, list[str]] = {}  # dag_id -> [interrupt_ids]
        self._interrupts: dict[str, HumanInterruptRequest] = {}
        self._approvals: dict[str, ApprovalRequest] = {}
        self._merge_conflicts: dict[str, MergeConflictInfo] = {}

    async def submit(self, dag: TaskDAG) -> dict:
        if dag.dag_id in self._dag_states:
            raise ValueError(f"DAG '{dag.dag_id}' already exists")

        submit_event = self.dag_parser.to_event(dag)
        await self.event_bus.publish(submit_event)

        state, ready_nodes = self.dag_parser.parse(dag)
        state.repo_path = self.repo_path  # 本地仓库路径
        state.requirement_context = dag.requirement_context
        self._dag_states[dag.dag_id] = state

        # 用 register_from_contract 注册每个节点，确保 task_id 格式为 {dag_id}:{node_id}
        milestone = self.todo.create_milestone(title=f"DAG: {dag.dag_id}", task_descriptions=[])
        for node in dag.nodes:
            self.todo.register_from_contract(
                dag_id=dag.dag_id, node_id=node.id,
                description=node.instruction or node.id,
                agent_role=node.type.value,
                files=node.files,
                milestone_id=milestone.milestone_id,
            )

        batches = self.dag_parser.compute_batches(state)
        state._batches = batches
        state._batch_index = 0

        if state.base_commit and self.cost_monitor.is_budget_exceeded(dag.dag_id):
            state.status = "blocked"
            await self.event_bus.dag_blocked(dag.dag_id, "budget exceeded")
            logger.warning("DAG %s blocked: budget exceeded", dag.dag_id)
            return {"dag_id": dag.dag_id, "status": "blocked", "reason": "budget_exceeded"}

        await self._dispatch_batch(dag.dag_id)

        logger.info("DAG %s submitted: %d nodes, %d batches",
                    dag.dag_id, len(state.nodes), len(batches))
        return {"dag_id": dag.dag_id, "node_count": len(state.nodes),
                "batch_count": len(batches), "status": "running"}

    async def submit_task(self, requirement: str,
                          repo_url: str = "",
                          repo_path: str = "") -> dict:
        """统一任务入口 — 用户只调用这一个方法。

        内部流程：
        1. FlowAgent 复杂度自检
        2. 简单 → 直接调用 AiderWorker 执行
        3. 复杂 → 规划蓝图 → 拆解 DAG → submit() 调度执行
        """
        await self.event_bus.publish(SchedulerEvent(
            event_type="flow.request", dag_id="flow",
            data={"requirement": requirement[:200]},
        ))

        # 委托 FlowAgent 处理
        result = await self.flow_agent.process_request(
            requirement, repo_url, repo_path,
        )

        if result.get("status") == "failed":
            await self.event_bus.publish(SchedulerEvent(
                event_type="flow.failed", dag_id="flow",
                data={"error": result.get("error", "flow agent failed")},
            ))
            return result

        # 聊天模式 → 直接返回
        if result.get("mode") == "chat":
            await self.event_bus.publish(SchedulerEvent(
                event_type="flow.completed", dag_id="flow",
                data={"mode": "chat", "success": True},
            ))
            return result

        # 简单任务 → 直接返回结果
        if result.get("mode") == "simple":
            await self.event_bus.publish(SchedulerEvent(
                event_type="flow.completed", dag_id="flow",
                data={"mode": "simple", "success": result.get("status") == "completed"},
            ))
            return result

        # 复杂任务 → 使用 FlowAgent 生成的 Blueprint + DAG 提交调度
        if result.get("mode") == "complex":
            dag_data = result.get("dag", {})
            bp = result.get("blueprint", {})

            # 检查是否有预算设置
            if bp and hasattr(self, 'cost_monitor'):
                dag_id = dag_data.get("dag_id", f"flow_{uuid.uuid4().hex[:8]}")
            else:
                dag_id = dag_data.get("dag_id", f"flow_{uuid.uuid4().hex[:8]}")

            # 构建 TaskDAG 对象
            nodes = []
            for n in dag_data.get("nodes", []):
                try:
                    nt = NodeType(n.get("type", "code"))
                except ValueError:
                    nt = NodeType.CODE
                nodes.append(TaskNode(
                    id=n.get("id", ""),
                    type=nt,
                    depends_on=n.get("depends_on", []),
                    instruction=n.get("instruction", ""),
                    files=n.get("files", []),
                    model_hint=n.get("model_hint", ""),
                ))

            dag = TaskDAG(
                dag_id=dag_id,
                repo_url=repo_url,
                nodes=nodes,
                requirement_context=dag_data.get("requirement_context", ""),
            )

            # 提交调度执行
            submit_result = await self.submit(dag)
            return {
                "status": submit_result.get("status", "running"),
                "mode": "complex",
                "dag_id": dag_id,
                "blueprint": bp,
                "node_count": len(nodes),
                **submit_result,
            }

        return result

    async def submit_requirement(self, requirement: str,
                                 repo_url: str = "",
                                 budget_usd: float = 0.0) -> dict:
        dag_id = f"plan_{datetime.now().strftime('%H%M%S')}"
        await self.event_bus.publish(SchedulerEvent(
            event_type="pm.started", dag_id=dag_id,
            data={"requirement": requirement[:200]},
        ))

        blueprint = await self.flow_agent._create_blueprint(requirement)
        if not blueprint:
            return {"dag_id": dag_id, "status": "failed",
                    "error": "PM agent failed to create blueprint"}

        await self.event_bus.publish(SchedulerEvent(
            event_type="pm.completed", dag_id=dag_id,
            data={"phases": len(blueprint.phases),
                  "project": blueprint.project_name},
        ))

        await self.event_bus.publish(SchedulerEvent(
            event_type="project_manager.started", dag_id=dag_id,
            data={"project": blueprint.project_name},
        ))

        dag = await self.flow_agent._breakdown(blueprint, repo_url=repo_url)
        if not dag:
            return {"dag_id": dag_id, "status": "failed",
                    "error": "PM agent failed to generate DAG"}

        dag.dag_id = dag_id
        await self.event_bus.publish(SchedulerEvent(
            event_type="project_manager.completed", dag_id=dag_id,
            data={"node_count": len(dag.nodes)},
        ))

        if budget_usd > 0:
            self.cost_monitor.set_budget(dag_id, BudgetConfig(
                dag_id=dag_id,
                max_cost_usd=budget_usd,
                notify_on=budget_usd * 0.8,
                enabled=True,
            ))

        if self.knowledge_service:
            self.knowledge_service.add_doc(
                title=f"需求:{blueprint.project_name}",
                content=requirement,
                tags=[dag_id, "requirement", blueprint.project_name],
                source="user_input",
            )

        result = await self.submit(dag)
        return {"dag_id": dag_id, "blueprint": {
            "project_name": blueprint.project_name,
            "phases": [p.name for p in blueprint.phases],
            "language": blueprint.language,
        }, **result}

    async def handle_contract_change(self, request: ContractChangeRequest):
        dag_id = request.dag_id
        self._pending_changes.setdefault(dag_id, []).append(request)

        await self.event_bus.contract_change_requested(
            dag_id, request.node_id, request.change_type,
            request.reason, request.proposed_changes,
        )

        changes = self._pending_changes[dag_id]
        if len(changes) >= 3:
            await self._batch_adjust_dag(dag_id)

    async def _batch_adjust_dag(self, dag_id: str):
        dag = self._dag_states.get(dag_id)
        if not dag:
            return

        dag_model = TaskDAG(
            dag_id=dag_id,
            repo_url=dag.repo_url,
            nodes=[TaskNode(id=nid, type=task.node_type,
                            depends_on=list(task.depends_on),
                            instruction=task.contract.get("instruction", ""),
                            files=task.contract.get("files", []))
                   for nid, task in dag.nodes.items()],
        )

        changes = self._pending_changes.pop(dag_id, [])
        for change in changes:
            if change.change_type == "extend_files":
                for task in dag.nodes.values():
                    if task.node_id == change.node_id:
                        new_files = change.proposed_changes.get("files", [])
                        existing = task.contract.get("files", [])
                        task.contract["files"] = list(set(existing + new_files))

        adjusted_dag = TaskDAG(
            dag_id=dag_id,
            repo_url=dag.repo_url,
            nodes=[TaskNode(id=nid, type=task.node_type,
                            depends_on=list(task.depends_on),
                            instruction=task.contract.get("instruction", ""),
                            files=task.contract.get("files", []))
                   for nid, task in dag.nodes.items()],
        )
        # 重新解析 DAG 以应用拓扑变化
        new_state, _ = self.dag_parser.parse(adjusted_dag)
        for nid, instance in new_state.nodes.items():
            if nid not in dag.nodes:
                dag.nodes[nid] = instance
                await self.event_bus.task_ready(dag_id, nid)
                logger.info("dynamic DAG: added node %s to DAG %s", nid, dag_id)

        batches = self.dag_parser.compute_batches(dag)
        logger.info("dynamic DAG: DAG %s recalculated -> %d batches", dag_id, len(batches))

    async def _dispatch_batch(self, dag_id: str):
        state = self._dag_states.get(dag_id)
        if not state:
            return

        # 检查 DAG 是否被挂起
        if dag_id in self._suspended_dags and self._suspended_dags[dag_id]:
            logger.info("DAG %s is suspended, skipping batch dispatch", dag_id)
            return

        batches = getattr(state, "_batches", [])
        batch_idx = getattr(state, "_batch_index", 0)

        if batch_idx >= len(batches):
            return

        batch = batches[batch_idx]
        state._batch_index = batch_idx + 1

        tasks = []
        for instance in batch:
            tn = state.nodes.get(instance.node_id)
            if not tn:
                continue
            tn.status = TaskStatus.READY
            await self.event_bus.task_ready(dag_id, instance.node_id)
            task = asyncio.ensure_future(self._execute_task(dag_id, instance.node_id))
            tasks.append(task)

        if tasks:
            done, _ = await asyncio.wait(tasks)
            for t in done:
                exc = t.exception()
                if exc:
                    logger.error("task in batch %d failed: %s", batch_idx, exc)

        state = self._dag_states.get(dag_id)
        if state:
            if state._batch_index < len(batches):
                await self._dispatch_batch(dag_id)
            else:
                await self._check_dag_completion(dag_id)

    async def _execute_task(self, dag_id: str, node_id: str):
        state = self._dag_states.get(dag_id)
        if not state:
            return
        task = state.nodes.get(node_id)
        if not task:
            return

        # 死循环防护：最大重试次数检查
        if task.retry_count >= task.max_retries * 2:
            logger.error("task %s exceeded max retries (%d), marking as failed",
                         node_id, task.retry_count)
            task.status = TaskStatus.FAILED
            task.error_message = "exceeded maximum retry limit"
            await self.event_bus.task_failed(dag_id, node_id, task.error_message)
            return

        if self.cost_monitor.is_budget_exceeded(dag_id):
            task.status = TaskStatus.BLOCKED
            task.error_message = "budget exceeded"
            logger.warning("task %s blocked: budget exceeded for DAG %s", node_id, dag_id)
            return

        # 任务超时控制
        timeout = task.contract.get("timeout_seconds", 120) + 30
        try:
            async with self._batch_sem:
                await asyncio.wait_for(
                    self._run_task(dag_id, node_id, state, task),
                    timeout=timeout,
                )
        except asyncio.TimeoutError:
            task.status = TaskStatus.FAILED
            task.error_message = f"task timed out after {timeout}s"
            logger.error("task %s timed out after %ds", node_id, timeout)
            await self.event_bus.task_failed(dag_id, node_id, task.error_message)
            return

        state = self._dag_states.get(dag_id)
        if state:
            newly_ready = self.dag_parser.advance(state, node_id)
            for ready_task in newly_ready:
                await self.event_bus.task_ready(dag_id, ready_task.node_id)
                asyncio.ensure_future(
                    self._execute_task(dag_id, ready_task.node_id)
                )

    async def _run_task(self, dag_id: str, node_id: str,
                        state: DagState, task: TaskInstance):
        now = datetime.now(timezone.utc)
        task.status = TaskStatus.RUNNING
        task.started_at = now

        await self.event_bus.task_started(dag_id, node_id, worker_id=task.worker_id or "",
                                       agent_role=task.node_type.value)

        # 标记任务为进行中，Agent 心跳
        task_id_key = f"{dag_id}:{node_id}"
        self.todo.update_task(task_id_key, status="in_progress", progress=0.1)
        if task.worker_id:
            self.todo.agent_working_on(
                task.worker_id,
                task.node_type.value,
                task_id_key,
            )

        try:
            if task.node_type == NodeType.TEST:
                await self._run_tester_task(dag_id, task, state)
            elif task.node_type == NodeType.REVIEW:
                await self._run_reviewer_task(dag_id, task, state)
            elif task.node_type == NodeType.MERGE:
                await self._run_merge_task(dag_id, task, state)
            elif task.node_type == NodeType.PLAN:
                logger.info("plan node %s: no-op in scheduler", node_id)
                task.status = TaskStatus.SUCCEEDED
                task.finished_at = now
            elif task.node_type == NodeType.MANUAL:
                task.status = TaskStatus.BLOCKED
                await self.event_bus.human_intervention(
                    dag_id, node_id, "manual_task",
                    instruction=task.contract.get("instruction", ""),
                )
            else:
                await self._run_engineer_task(dag_id, task, state)
        except WorkerPoolExhausted as e:
            task.status = TaskStatus.PENDING
            logger.warning("pool exhausted for %s, will retry: %s", node_id, e)
            await asyncio.sleep(2)
            asyncio.ensure_future(self._execute_task(dag_id, node_id))
        except Exception as e:
            logger.exception("task %s failed unexpectedly", node_id)
            task.status = TaskStatus.FAILED
            task.error_message = str(e)
            await self.event_bus.task_failed(dag_id, node_id, str(e))

    async def _run_engineer_task(self, dag_id: str, task: TaskInstance,
                                 state: DagState, is_retry: bool = False):
        node_id = task.node_id
        node_def = task.contract

        if self.git_mgr and not task.branch_name:
            base = node_def.get("base_commit", "") or state.base_commit
            task.branch_name = self.git_mgr.create_task_branch(dag_id, node_id, base)

        agent_contract = self.contract_gen.generate(task, state, repo_path=self.repo_path)

        # 注入全局需求摘要到 Engineer 提示词（P0-4）
        if state.requirement_context and task.node_type == NodeType.CODE:
            req_context = (
                f"\n\n[全局需求上下文]\n{state.requirement_context}\n\n"
                "请基于上述需求执行本节点任务，确保代码与整体需求一致。"
            )
            agent_contract.system_prompt_extra = (
                f"{agent_contract.system_prompt_extra}{req_context}"
            )

        knowledge_context = ""
        if self.knowledge_service:
            docs = self.knowledge_service.retrieve(
                agent_contract.instruction, top_k=2,
                tags=[dag_id],
            )
            if docs:
                knowledge_context = self.knowledge_service.format_context(docs, 1000)
                if knowledge_context:
                    agent_contract.system_prompt_extra = (
                        f"{agent_contract.system_prompt_extra}\n\n"
                        f"[项目知识上下文]\n{knowledge_context}"
                    )

        worker_contract = self.contract_gen.build_worker_contract(agent_contract)
        task.contract = {
            "instruction": worker_contract.instruction,
            "files": worker_contract.files,
            "read_only_files": worker_contract.read_only_files,
            "base_commit": worker_contract.base_commit,
            "model_hint": node_def.get("model_hint", ""),
            "max_reflections": worker_contract.max_reflections,
            "timeout_seconds": worker_contract.timeout_seconds,
            "auto_lint": worker_contract.auto_lint,
            "lint_command": worker_contract.lint_command,
            "auto_test": worker_contract.auto_test,
            "test_command": worker_contract.test_command,
        }

        handle = await self.worker_pool.acquire(agent_contract)
        task.worker_id = handle.worker_id

        result = await self.worker_pool.dispatch(handle, agent_contract)
        await self.worker_pool.release(handle.worker_id)

        task.result = result
        sent = result.get("total_tokens_sent", 0)
        recv = result.get("total_tokens_received", 0)
        cost = result.get("session_cost_usd", 0)
        task.token_usage = TokenUsage(sent, recv, cost)
        await self.event_bus.token_usage(dag_id, node_id, sent, recv, cost)
        self._record_cost(dag_id, node_id, sent, recv, cost)

        if not result.get("success", False):
            task.status = TaskStatus.FAILED
            task.error_message = result.get("error_message", "unknown error")
            await self.event_bus.task_failed(dag_id, node_id, task.error_message)
            # 标记任务失败
            self.todo.update_from_task_result(f"{dag_id}:{node_id}", False,
                                                task.error_message)
            return

        # 将 AiderWorker 生成的 diff 应用到任务分支
        if self.git_mgr and task.branch_name:
            full_diff = result.get("full_diff", "")
            if full_diff.strip():
                commit_sha = self.git_mgr.apply_diff_to_branch(
                    task.branch_name, full_diff
                )
                if commit_sha:
                    logger.info("applied diff to branch %s: commit=%s",
                                task.branch_name, commit_sha[:12])
                    result["head_commit"] = commit_sha

        task.status = TaskStatus.VERIFYING
        verification = self.tester_agent.run_verification(task, self.repo_path)
        task.result["_verification"] = verification

        if not verification["passed"] and self.retry_ctrl.should_retry(task):
            task.retry_count += 1
            task.status = TaskStatus.RETRYING
            v_result = __import__(
                ".verifier", fromlist=["VerificationResult"]
            ).VerificationResult(
                passed=verification["passed"],
                checks=verification["checks"],
            )
            plan = self.retry_ctrl.plan_retry(task, v_result)

            task.contract["instruction"] = plan.get("updated_instruction", "")
            task.contract["base_commit"] = plan.get("rollback_to", "")
            task.contract["timeout_seconds"] = plan.get("timeout_seconds", task.contract.get("timeout_seconds", 120))

            logger.info("retrying %s (%d/%d) timeout=%ds",
                        node_id, task.retry_count, task.max_retries,
                        plan.get("timeout_seconds", 120))
            self.todo.update_task(f"{dag_id}:{node_id}", status="in_progress",
                                   progress=0.1 + 0.5 * task.retry_count / task.max_retries,
                                   note=f"retry #{task.retry_count}")
            await self._run_engineer_task(dag_id, task, state, is_retry=True)
            return

        if not verification["passed"]:
            task.status = TaskStatus.BLOCKED
            task.error_message = f"verification failed after {task.retry_count} retries"
            task.result["_retry_history"] = {
                "dag_id": dag_id,
                "node_id": node_id,
                "node_type": task.node_type.value,
                "instruction": task.contract.get("instruction", ""),
                "retry_count": task.retry_count,
                "max_retries": task.max_retries,
                "last_verification": {
                    "passed": verification["passed"],
                    "checks": verification["checks"],
                },
            }
            await self.event_bus.human_intervention(
                dag_id, node_id, "retry_exhausted",
                error=task.error_message,
                retry_count=task.retry_count,
                max_retries=task.max_retries,
                checks=verification["checks"],
                instruction=task.contract.get("instruction", ""),
                prompt=(
                    f"节点 {node_id}（{task.node_type.value}）"
                    f"在 {task.retry_count}/{task.max_retries} 次重试后仍未通过校验。\n"
                    f"请选择处理方式：\n"
                    f"1. 继续（标记为成功，下游继续执行）\n"
                    f"2. 暂停（不再执行该 DAG 剩余节点）\n"
                    f"3. 重试（增加重试次数后再次尝试）"
                ),
            )
            return

        task.status = TaskStatus.SUCCEEDED
        task.finished_at = datetime.now(timezone.utc)
        await self.event_bus.task_succeeded(dag_id, node_id,
                                             tokens_sent=sent, tokens_received=recv)
        # 标记任务完成
        self.todo.update_from_task_result(f"{dag_id}:{node_id}", True)

        if self.merge_agent:
            merge_result = self.merge_agent.merge_node(state, node_id)
            if merge_result.success:
                task.status = TaskStatus.MERGED
                # 链式 diff：更新 head_commit 为 master HEAD，后续节点以此为 base
                try:
                    from git import Repo as GitRepo
                    master_commit = GitRepo(
                        self.repo_path).head.commit.hexsha
                    result["head_commit"] = master_commit
                    task.result = result
                    logger.info("chain diff: %s master HEAD=%s", node_id, master_commit[:12])
                except Exception:
                    pass
            else:
                task.status = TaskStatus.BLOCKED
                await self.event_bus.merge_conflict(dag_id, merge_result.conflict_files)
                await self.event_bus.human_intervention(
                    dag_id, node_id, "merge_conflict",
                    files=merge_result.conflict_files,
                )

    async def _run_tester_task(self, dag_id: str, task: TaskInstance,
                               state: DagState):
        task_id_key = f"{dag_id}:{task.node_id}"
        task.status = TaskStatus.VERIFYING
        verification = self.tester_agent.run_verification(task, self.repo_path)
        task.result = {"_verification": verification}
        task.finished_at = datetime.now(timezone.utc)

        if verification["passed"]:
            gen_result = await self.tester_agent.generate_regression_tests(
                task, self.repo_path, self.worker_pool
            )
            if gen_result.get("generated"):
                task.result["_regression_tests"] = gen_result
                task.token_usage = TokenUsage(
                    tokens_sent=gen_result.get("tokens_sent", 0),
                    tokens_received=gen_result.get("tokens_received", 0),
                )
                await self.event_bus.token_usage(
                    dag_id, task.node_id,
                    gen_result.get("tokens_sent", 0),
                    gen_result.get("tokens_received", 0),
                )
            task.status = TaskStatus.SUCCEEDED
            self.todo.update_from_task_result(task_id_key, True)
            await self.event_bus.task_succeeded(dag_id, task.node_id)
        else:
            task.status = TaskStatus.FAILED
            task.error_message = "tester: verification failed"
            self.todo.update_from_task_result(task_id_key, False, task.error_message)
            await self.event_bus.task_failed(dag_id, task.node_id, task.error_message)

    async def _run_reviewer_task(self, dag_id: str, task: TaskInstance,
                                 state: DagState):
        task_id_key = f"{dag_id}:{task.node_id}"
        dep_diffs = []
        for dep_id in task.depends_on:
            dep = state.nodes.get(dep_id)
            if dep and dep.result:
                diff = dep.result.get("full_diff", "")
                if diff:
                    dep_diffs.append(f"=== {dep_id} ===\n{diff}")

        full_diff = "\n\n".join(dep_diffs)
        task_context = {
            "task_id": task.task_id, "dag_id": dag_id,
            "instruction": task.contract.get("instruction", ""),
            "allowed_files": task.contract.get("files", []),
        }

        review = await self.reviewer_agent.review(
            full_diff, task_context, self.worker_pool
        )
        task.result = {"_review": review}

        if review.get("approved", False):
            task.status = TaskStatus.SUCCEEDED
            task.finished_at = datetime.now(timezone.utc)
            self.todo.update_from_task_result(task_id_key, True)
            await self.event_bus.task_succeeded(
                dag_id, task.node_id,
                review_summary=review.get("summary", ""),
            )
        else:
            task.status = TaskStatus.BLOCKED
            task.error_message = f"review rejected: {review.get('summary', '')}"
            self.todo.update_from_task_result(task_id_key, False, task.error_message)
            await self.event_bus.task_failed(dag_id, task.node_id, task.error_message)
            await self.event_bus.human_intervention(
                dag_id, task.node_id, "review_rejected", review=review,
            )
            await self.handle_contract_change(ContractChangeRequest(
                dag_id=dag_id, node_id=task.node_id,
                change_type="review_failed",
                reason=review.get("summary", ""),
                proposed_changes={"issues": review.get("issues", [])},
            ))

    async def _run_merge_task(self, dag_id: str, task: TaskInstance,
                              state: DagState):
        task_id_key = f"{dag_id}:{task.node_id}"
        if not self.merge_agent:
            task.status = TaskStatus.FAILED
            task.error_message = "no merge agent (repo_path not set)"
            self.todo.update_from_task_result(task_id_key, False, task.error_message)
            return

        results = self.merge_agent.merge_all_ready(state)
        has_conflict = any(not r.success for _, r in results)
        task.result = {
            "_merge_results": [
                {"node_id": nid, "success": r.success,
                 "conflict_files": r.conflict_files}
                for nid, r in results
            ],
        }

        if has_conflict:
            task.status = TaskStatus.BLOCKED
            task.error_message = "merge conflicts detected"
            self.todo.update_from_task_result(task_id_key, False, task.error_message)
            await self.event_bus.human_intervention(
                dag_id, task.node_id, "merge_conflict",
                results=task.result["_merge_results"],
            )
        else:
            task.status = TaskStatus.SUCCEEDED
            self.todo.update_from_task_result(task_id_key, True)
            await self.event_bus.task_succeeded(dag_id, task.node_id)

    async def _check_dag_completion(self, dag_id: str):
        state = self._dag_states.get(dag_id)
        if not state:
            return

        all_terminal = all(
            t.status in (TaskStatus.SUCCEEDED, TaskStatus.MERGED,
                          TaskStatus.FAILED, TaskStatus.BLOCKED)
            for t in state.nodes.values()
        )
        if not all_terminal:
            return

        has_failures = any(
            t.status in (TaskStatus.FAILED, TaskStatus.BLOCKED)
            for t in state.nodes.values()
        )

        # 更新 DAG 级别的 TODO 里程碑进度
        progress = self.todo.get_project_progress()
        logger.info("DAG %s completed: %d/%d tasks (progress=%.0f%%)",
                     dag_id, progress["completed"], progress["total"],
                     progress["progress"] * 100)

        if has_failures:
            state.status = "blocked"
            await self.event_bus.dag_blocked(dag_id, "some tasks failed or blocked")
        else:
            state.status = "completed"
            report = self.cost_monitor.get_dag_report(dag_id)
            await self.event_bus.dag_completed(
                dag_id,
                total_tokens_sent=report.total_tokens_sent,
                total_tokens_received=report.total_tokens_received,
                total_cost_usd=report.total_cost_usd,
            )

        # 持久化 DAG 最终状态
        self._save_dag_state(dag_id)

    def _record_cost(self, dag_id: str, node_id: str,
                     sent: int, recv: int, cost: float):
        self.cost_monitor.record_usage(SchedulerEvent(
            event_id=f"tu_{dag_id}_{node_id}",
            event_type="token.usage",
            dag_id=dag_id, node_id=node_id,
            data={"tokens_sent": sent, "tokens_received": recv, "cost_usd": cost},
        ))

    async def retry_task(self, dag_id: str, node_id: str,
                         updated_contract: dict | None = None):
        state = self._dag_states.get(dag_id)
        task = state.nodes.get(node_id) if state else None
        if not task:
            return False
        if updated_contract:
            task.contract.update(updated_contract)
        task.status = TaskStatus.RETRYING
        task.retry_count += 1
        task.error_message = ""
        task.branch_name = ""
        asyncio.ensure_future(self._execute_task(dag_id, node_id))
        return True

    async def resolve_merge_conflict(self, dag_id: str, node_id: str,
                                     strategy: str) -> bool:
        if not self.merge_agent:
            return False
        task = self.get_task(dag_id, node_id)
        if not task:
            return False
        merge_results = task.result.get("_merge_results", [])
        all_conflict_files = []
        for mr in merge_results:
            all_conflict_files.extend(mr.get("conflict_files", []))
        if not all_conflict_files:
            all_conflict_files = task.result.get("_merge_conflict_files", [])
        result = self.merge_agent.resolve_conflict(
            self.repo_path, all_conflict_files, strategy
        )
        if result.success:
            task.status = TaskStatus.MERGED
            asyncio.ensure_future(self._execute_task(dag_id, node_id))
        return result.success

    # ── Human-in-the-loop: DAG 挂起 / 恢复 ─────────────────────

    async def suspend_dag(self, dag_id: str, reason: str = "",
                          interrupt_id: str = ""):
        """挂起 DAG，暂停所有后续任务调度。"""
        self._suspended_dags.setdefault(dag_id, [])
        if interrupt_id and interrupt_id not in self._suspended_dags[dag_id]:
            self._suspended_dags[dag_id].append(interrupt_id)
        await self.event_bus.dag_suspended(dag_id, reason, interrupt_id)
        logger.info("DAG %s suspended: %s (interrupt=%s)", dag_id, reason, interrupt_id)

    async def resume_dag(self, dag_id: str, resolution: str = ""):
        """恢复挂起的 DAG，继续后续任务调度。"""
        self._suspended_dags.pop(dag_id, None)
        await self.event_bus.dag_resumed(dag_id, resolution)
        logger.info("DAG %s resumed: %s", dag_id, resolution)

        # 触发下一批次
        await self._dispatch_batch(dag_id)

    # ── Human-in-the-loop: Worker 中断处理 ─────────────────

    async def request_interrupt(self, dag_id: str, node_id: str,
                                interrupt_id: str, question: str,
                                reason: InterruptReason = InterruptReason.AMBIGUOUS_REQUIREMENT,
                                context: dict = None,
                                options: list[str] = None) -> HumanInterruptRequest:
        """Worker 触发中断请求，挂起 DAG 等待人类决策。"""
        req = HumanInterruptRequest(
            interrupt_id=interrupt_id,
            dag_id=dag_id,
            task_id=f"{dag_id}:{node_id}",
            node_id=node_id,
            reason=reason,
            question=question,
            context=context or {},
            options=options or [],
            created_at=str(datetime.now(timezone.utc)),
        )
        self._interrupts[interrupt_id] = req

        # 挂起 DAG
        await self.suspend_dag(dag_id, f"worker interrupt: {question[:80]}", interrupt_id)

        # 发出事件
        await self.event_bus.worker_interrupt(
            dag_id, node_id, interrupt_id, reason.value,
            question, context, options,
        )

        return req

    async def approve_interrupt(self, interrupt_id: str,
                                resolution: str = "",
                                resolved_by: str = "human") -> bool:
        """人类批准中断请求。"""
        req = self._interrupts.get(interrupt_id)
        if not req:
            return False

        req.status = "approved"
        req.resolution = resolution
        req.resolved_at = str(datetime.now(timezone.utc))
        req.resolved_by = resolved_by

        dag_id = req.dag_id

        # 恢复 DAG 执行
        await self.resume_dag(dag_id, resolution)

        # 如果中断节点正在等待，解除阻塞
        state = self._dag_states.get(dag_id)
        if state:
            task = state.nodes.get(req.node_id)
            if task:
                task.contract["_interrupt_resolution"] = resolution
                task.contract["_interrupt_approved"] = True
                task.status = TaskStatus.READY
                await self.event_bus.task_ready(dag_id, req.node_id)
                asyncio.ensure_future(
                    self._execute_task(dag_id, req.node_id)
                )

        return True

    async def reject_interrupt(self, interrupt_id: str,
                               resolution: str = "",
                               resolved_by: str = "human") -> bool:
        """人类拒绝中断请求，任务标记为失败。"""
        req = self._interrupts.get(interrupt_id)
        if not req:
            return False

        req.status = "rejected"
        req.resolution = resolution
        req.resolved_at = str(datetime.now(timezone.utc))
        req.resolved_by = resolved_by

        # 标记节点为失败
        state = self._dag_states.get(req.dag_id)
        if state:
            task = state.nodes.get(req.node_id)
            if task:
                task.status = TaskStatus.FAILED
                task.error_message = f"interrupt rejected: {resolution}"
                await self.event_bus.task_failed(req.dag_id, req.node_id, task.error_message)

        await self.resume_dag(req.dag_id, f"rejected: {resolution}")
        return True

    # ── Human-in-the-loop: 合并冲突 ─────────────────────────

    async def notify_merge_conflict(self, dag_id: str,
                                    source_branch: str,
                                    target_branch: str,
                                    conflict_files: list[str],
                                    conflict_diff: str = "") -> MergeConflictInfo:
        """记录合并冲突并发出事件，等待人类解决。"""
        info = MergeConflictInfo(
            dag_id=dag_id,
            source_branch=source_branch,
            target_branch=target_branch,
            conflict_files=conflict_files,
            conflict_diff=conflict_diff,
        )
        conflict_id = f"mc_{dag_id}_{len(self._merge_conflicts)}"
        self._merge_conflicts[conflict_id] = info

        await self.event_bus.merge_conflict(dag_id, conflict_files)
        await self.suspend_dag(dag_id, f"merge conflict: {conflict_files}")

        return info

    def get_state(self, dag_id: str) -> DagState | None:
        return self._dag_states.get(dag_id)

    def get_task(self, dag_id: str, node_id: str) -> TaskInstance | None:
        state = self._dag_states.get(dag_id)
        return state.nodes.get(node_id) if state else None

    def get_all_dags(self) -> dict[str, dict]:
        result = {}
        for dag_id, state in self._dag_states.items():
            result[dag_id] = {
                "dag_id": dag_id, "status": state.status,
                "repo_url": state.repo_url,
                "node_count": len(state.nodes),
                "nodes": {
                    nid: self._serialize_node(task)
                    for nid, task in state.nodes.items()
                },
            }
        return result

    def _serialize_node(self, task: TaskInstance) -> dict:
        sn = {
            "node_id": task.node_id, "status": task.status.value,
            "node_type": task.node_type.value,
            "depends_on": task.depends_on,
            "retry_count": task.retry_count,
            "max_retries": task.max_retries,
            "worker_id": task.worker_id,
            "branch_name": task.branch_name,
            "error_message": task.error_message,
        }
        if task.token_usage:
            sn["token_usage"] = {
                "tokens_sent": task.token_usage.tokens_sent,
                "tokens_received": task.token_usage.tokens_received,
                "cost_usd": task.token_usage.cost_usd,
            }
        return sn

    def get_cost_report(self, dag_id: str | None = None):
        if dag_id:
            return self.cost_monitor.get_dag_report(dag_id)
        return self.cost_monitor.get_all_reports()

    def get_blueprint(self, dag_id: str) -> dict | None:
        state = self._dag_states.get(dag_id)
        if state and hasattr(state, "_blueprint"):
            return state._blueprint
        return None

    async def shutdown(self):
        """优雅关闭：保存所有状态、等待进行中任务完成、释放资源。"""
        self._running = False
        if self._loop_task:
            self._loop_task.cancel()

        # 保存所有活跃 DAG 状态
        logger.info("Shutting down: saving %d active DAGs...", len(self._dag_states))
        for dag_id in list(self._dag_states.keys()):
            state = self._dag_states.get(dag_id)
            if state and state.status in ("running", "blocked"):
                state.status = "suspended"
                self._save_dag_state(dag_id)
                logger.info("Saved DAG %s as suspended", dag_id)

        # 等待进行中的任务完成（最多 30s）
        await asyncio.sleep(0.5)
        self.persistence.close()
        await self.worker_pool.close_all()
        logger.info("Scheduler shut down gracefully")

    # ── 持久化辅助 ────────────────────────────────────

    def _save_dag_state(self, dag_id: str):
        """保存 DAG 状态到持久化存储。"""
        try:
            state = self._dag_states.get(dag_id)
            if state:
                self.persistence.save_dag_state(state)
        except Exception:
            logger.exception("Failed to save DAG state: %s", dag_id)

    def _recover_unfinished_dags(self):
        """启动时恢复未完成的 DAG。"""
        try:
            dag_ids = self.persistence.load_unfinished_dags()
            if dag_ids:
                logger.info("Found %d unfinished DAGs, will attempt to resume",
                            len(dag_ids))
                for dag_id in dag_ids:
                    # 标记为 suspended，等待人工决策
                    self._suspended_dags.setdefault(dag_id, [])
                    self._suspended_dags[dag_id].append("startup_recovery")
        except Exception:
            logger.warning("Failed to recover unfinished DAGs")
