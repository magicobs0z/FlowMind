import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .models import TaskDAG as TaskDAGModel, TaskNode as TaskNodeModel, NodeType, BudgetConfig
from .scheduler_core import SchedulerCore

logger = logging.getLogger(__name__)


class TaskNodeSchema(BaseModel):
    id: str
    type: str = "code"
    depends_on: list[str] = []
    instruction: str = ""
    files: list[str] = []
    read_only_files: list[str] = []
    model_hint: str = ""
    system_prompt_extra: str = ""
    auto_lint: bool = False
    lint_command: str = ""
    auto_test: bool = False
    test_command: str = ""
    max_reflections: int = 3
    timeout_seconds: int = 120


class TaskDAGSchema(BaseModel):
    dag_id: str = ""
    repo_url: str
    base_commit: str = ""
    nodes: list[TaskNodeSchema]
    parallel_policy: str = "max"


class DecisionSchema(BaseModel):
    dag_id: str
    node_id: str
    action: str
    payload: dict = {}


class RequirementSchema(BaseModel):
    requirement: str
    repo_url: str = ""
    budget_usd: float = 0.0


class InterruptSchema(BaseModel):
    """Worker 中断请求的决策。"""
    interrupt_id: str
    approve: bool = True
    resolution: str = ""


class FlowRequestSchema(BaseModel):
    """统一任务入口请求体 — 用户只需提供需求文本。"""
    requirement: str
    repo_url: str = ""
    repo_path: str = ""


class BudgetSchema(BaseModel):
    dag_id: str
    max_cost_usd: float = 0.0
    notify_on: float = 0.0
    enabled: bool = True


class TodoUpdateSchema(BaseModel):
    task_id: str
    status: str = ""
    progress: float | None = None
    note: str = ""


class TodoBlockSchema(BaseModel):
    task_id: str
    reason: str


class TodoMilestoneSchema(BaseModel):
    title: str
    tasks: list[dict] = []


def create_router(scheduler: SchedulerCore) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    @router.post("/dags")
    async def submit_dag(dag_schema: TaskDAGSchema):
        dag_id = dag_schema.dag_id or f"dag_{uuid.uuid4().hex[:8]}"
        nodes = []
        for ns in dag_schema.nodes:
            try:
                node_type = NodeType(ns.type)
            except ValueError:
                node_type = NodeType.CODE
            nodes.append(TaskNodeModel(
                id=ns.id,
                type=node_type,
                depends_on=ns.depends_on,
                instruction=ns.instruction,
                files=ns.files,
                read_only_files=ns.read_only_files,
                model_hint=ns.model_hint,
                system_prompt_extra=ns.system_prompt_extra,
                auto_lint=ns.auto_lint,
                lint_command=ns.lint_command,
                auto_test=ns.auto_test,
                test_command=ns.test_command,
                max_reflections=ns.max_reflections,
                timeout_seconds=ns.timeout_seconds,
            ))

        dag = TaskDAGModel(
            dag_id=dag_id,
            repo_url=dag_schema.repo_url,
            base_commit=dag_schema.base_commit,
            nodes=nodes,
            parallel_policy=dag_schema.parallel_policy,
        )

        try:
            result = await scheduler.submit(dag)
            return JSONResponse(result, status_code=202)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.get("/dags")
    async def list_dags():
        return scheduler.get_all_dags()

    @router.get("/dags/{dag_id}")
    async def get_dag(dag_id: str):
        state = scheduler.get_state(dag_id)
        if not state:
            raise HTTPException(status_code=404, detail="DAG not found")
        serialized = {
            "dag_id": state.dag_id,
            "status": state.status,
            "repo_url": state.repo_url,
            "base_commit": state.base_commit,
            "node_count": len(state.nodes),
            "nodes": {},
        }
        for nid, task in state.nodes.items():
            sn = {
                "node_id": task.node_id,
                "status": task.status.value,
                "node_type": task.node_type.value,
                "depends_on": task.depends_on,
                "retry_count": task.retry_count,
                "max_retries": task.max_retries,
                "worker_id": task.worker_id,
                "branch_name": task.branch_name,
                "error_message": task.error_message,
                "token_usage": None,
            }
            if task.token_usage:
                sn["token_usage"] = {
                    "tokens_sent": task.token_usage.tokens_sent,
                    "tokens_received": task.token_usage.tokens_received,
                    "cost_usd": task.token_usage.cost_usd,
                }
            if task.result:
                review = task.result.get("_review")
                if review:
                    sn["review"] = {
                        "approved": review.get("approved"),
                        "summary": review.get("summary", ""),
                        "issue_count": len(review.get("issues", [])),
                    }
                verification = task.result.get("_verification")
                if verification:
                    sn["verification"] = {
                        "passed": verification.get("passed", False),
                        "check_count": len(verification.get("checks", [])),
                    }
                merge_results = task.result.get("_merge_results")
                if merge_results:
                    sn["merge_results"] = merge_results
            serialized["nodes"][nid] = sn
        return serialized

    @router.get("/dags/{dag_id}/cost")
    async def get_cost(dag_id: str):
        report = scheduler.get_cost_report(dag_id)
        return {
            "dag_id": dag_id,
            "total_tokens_sent": report.total_tokens_sent,
            "total_tokens_received": report.total_tokens_received,
            "total_cost_usd": report.total_cost_usd,
            "node_usages": {
                nid: {
                    "tokens_sent": nu.tokens_sent,
                    "tokens_received": nu.tokens_received,
                    "cost_usd": nu.cost_usd,
                }
                for nid, nu in report.node_usages.items()
            },
        }

    @router.get("/dags/{dag_id}/events")
    async def get_dag_events(dag_id: str):
        state = scheduler.get_state(dag_id)
        if not state:
            raise HTTPException(status_code=404, detail="DAG not found")
        events = []
        for nid, task in state.nodes.items():
            if task.result:
                verification = task.result.get("_verification")
                if verification:
                    for check in verification.get("checks", []):
                        events.append({
                            "node_id": nid,
                            "type": f"check.{check['type']}",
                            "passed": check["passed"],
                            "timestamp": None,
                        })
                review = task.result.get("_review")
                if review:
                    events.append({
                        "node_id": nid,
                        "type": "review",
                        "approved": review.get("approved"),
                        "summary": review.get("summary", ""),
                    })
                merge_results = task.result.get("_merge_results")
                if merge_results:
                    for mr in merge_results:
                        events.append({
                            "node_id": mr.get("node_id", nid),
                            "type": "merge",
                            "success": mr.get("success"),
                            "conflict_files": mr.get("conflict_files", []),
                        })
        return {"dag_id": dag_id, "events": events}

    @router.post("/decisions")
    async def submit_decision(decision: DecisionSchema):
        state = scheduler.get_state(decision.dag_id)
        if not state:
            raise HTTPException(status_code=404, detail="DAG not found")
        task = scheduler.get_task(decision.dag_id, decision.node_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        action = decision.action
        payload = decision.payload
        logger.info("decision for %s/%s: action=%s payload=%s",
                    decision.dag_id, decision.node_id, action, payload)

        valid_actions = {
            "retry", "skip", "terminate", "force_accept",
            "modify_contract", "accept_theirs", "accept_ours",
        }
        if action not in valid_actions:
            raise HTTPException(
                status_code=400,
                detail=f"unknown action: {action}. valid: {sorted(valid_actions)}",
            )

        if action == "retry":
            updated_contract = payload.get("contract") if isinstance(payload, dict) else None
            ok = await scheduler.retry_task(
                decision.dag_id, decision.node_id, updated_contract
            )
            if not ok:
                raise HTTPException(status_code=400, detail="retry failed")

        elif action == "skip":
            task.status = "skipped"
            import asyncio
            asyncio.ensure_future(scheduler._check_dag_completion(decision.dag_id))

        elif action == "terminate":
            task.status = "terminated"
            import asyncio
            asyncio.ensure_future(scheduler._check_dag_completion(decision.dag_id))

        elif action == "force_accept":
            task.status = "succeeded"
            task.error_message = ""
            import asyncio
            asyncio.ensure_future(scheduler._check_dag_completion(decision.dag_id))

        elif action == "modify_contract":
            contract_changes = payload.get("contract", {}) if isinstance(payload, dict) else {}
            await scheduler.retry_task(
                decision.dag_id, decision.node_id, contract_changes
            )

        elif action in ("accept_theirs", "accept_ours"):
            ok = await scheduler.resolve_merge_conflict(
                decision.dag_id, decision.node_id, action
            )
            if not ok:
                raise HTTPException(status_code=400, detail="conflict resolution failed")

        return {"status": "accepted", "action": action}

    @router.post("/plan")
    async def plan_from_requirement(req: RequirementSchema):
        result = await scheduler.submit_requirement(
            requirement=req.requirement,
            repo_url=req.repo_url,
            budget_usd=req.budget_usd,
        )
        if result.get("status") == "failed":
            raise HTTPException(status_code=500, detail=result.get("error", "plan failed"))
        return JSONResponse(result, status_code=202)

    @router.post("/flow")
    async def submit_flow_request(req: FlowRequestSchema):
        """统一任务入口 — 用户只调这一个接口。

        内部流程（对调用方透明）：
        - 简单任务 → 直接执行
        - 复杂任务 → 规划 → 拆解 → 调度
        """
        result = await scheduler.submit_task(
            requirement=req.requirement,
            repo_url=req.repo_url,
            repo_path=req.repo_path,
        )
        if result.get("status") == "failed":
            status_code = 500
        elif result.get("mode") == "simple":
            status_code = 200
        else:
            status_code = 202
        return JSONResponse(result, status_code=status_code)

    @router.post("/budget")
    async def set_budget(budget: BudgetSchema):
        config = BudgetConfig(
            dag_id=budget.dag_id,
            max_cost_usd=budget.max_cost_usd,
            notify_on=budget.notify_on or budget.max_cost_usd * 0.8,
            enabled=budget.enabled,
        )
        scheduler.cost_monitor.set_budget(budget.dag_id, config)
        return {"status": "ok", "dag_id": budget.dag_id}

    @router.get("/budget/{dag_id}")
    async def get_budget(dag_id: str):
        config = scheduler.cost_monitor.get_budget(dag_id)
        if not config:
            raise HTTPException(status_code=404, detail="no budget config for this DAG")
        return {
            "dag_id": config.dag_id,
            "max_cost_usd": config.max_cost_usd,
            "notify_on": config.notify_on,
            "enabled": config.enabled,
            "exceeded": scheduler.cost_monitor.is_budget_exceeded(dag_id),
        }

    @router.get("/knowledge/docs")
    async def list_knowledge_tags():
        return {"tags": scheduler.knowledge_service.get_all_tags()}

    @router.post("/knowledge/docs")
    async def add_knowledge_doc(doc: dict):
        doc_id = scheduler.knowledge_service.add_doc(
            title=doc.get("title", ""),
            content=doc.get("content", ""),
            tags=doc.get("tags"),
            source=doc.get("source", ""),
        )
        return {"doc_id": doc_id}

    @router.post("/knowledge/retrieve")
    async def retrieve_knowledge(query: str = "", tags: list[str] = []):
        docs = scheduler.knowledge_service.retrieve(query, top_k=5, tags=tags or None)
        return {
            "results": [
                {"doc_id": d.doc_id, "title": d.title,
                 "content": d.content[:300], "tags": d.tags}
                for d in docs
            ],
        }

    # ── Human-in-the-loop 端点 ──────────────────────────────

    @router.post("/interrupts/resolve")
    async def resolve_interrupt(req: InterruptSchema):
        """人类处理 Worker 中断请求。"""
        import uuid as _uuid
        if req.approve:
            ok = await scheduler.approve_interrupt(
                req.interrupt_id, req.resolution,
            )
        else:
            ok = await scheduler.reject_interrupt(
                req.interrupt_id, req.resolution,
            )
        if not ok:
            raise HTTPException(status_code=404, detail="interrupt not found")
        return {"status": "resolved", "interrupt_id": req.interrupt_id,
                "approved": req.approve}

    @router.get("/interrupts")
    async def list_interrupts():
        """列出所有待处理的中断请求。"""
        pending = [
            {
                "interrupt_id": rid,
                "dag_id": r.dag_id,
                "node_id": r.node_id,
                "reason": r.reason.value,
                "question": r.question,
                "options": r.options,
                "status": r.status,
                "created_at": r.created_at,
            }
            for rid, r in scheduler._interrupts.items()
            if r.status == "pending"
        ]
        return {"pending": pending, "total": len(pending)}

    @router.get("/suspended")
    async def list_suspended_dags():
        """列出所有被挂起的 DAG。"""
        return {
            "suspended": list(scheduler._suspended_dags.keys()),
        }

    # ── TODO 监控端点 ─────────────────────────────────────

    @router.get("/todo/milestones")
    async def list_todo_milestones():
        """所有里程碑及进度。"""
        milestones = scheduler.todo.get_all_milestones()
        return {
            "milestones": [
                {
                    "milestone_id": ms.milestone_id,
                    "title": ms.title,
                    "status": ms.status,
                    "progress": ms.progress,
                    "task_count": len(ms.tasks),
                    "updated_at": ms.updated_at,
                }
                for ms in milestones
            ],
            "total": len(milestones),
        }

    @router.get("/todo/tasks")
    async def list_todo_tasks(milestone_id: str = "",
                               status: str = "",
                               agent_id: str = ""):
        """所有任务（可筛选）。"""
        kwargs = {}
        if milestone_id:
            kwargs["milestone_id"] = milestone_id
        if status:
            kwargs["status"] = status
        if agent_id:
            kwargs["agent_id"] = agent_id
        tasks = scheduler.todo.get_tasks(**kwargs)
        return {
            "tasks": [
                {
                    "task_id": t.task_id,
                    "description": t.description,
                    "agent_role": t.agent_role,
                    "agent_id": t.agent_id,
                    "milestone_id": t.milestone_id,
                    "status": t.status,
                    "progress": t.progress,
                    "node_id": t.node_id,
                    "files": t.files,
                    "note": t.note,
                    "blocked_reason": t.blocked_reason,
                    "updated_at": t.updated_at,
                }
                for t in tasks
            ],
            "total": len(tasks),
        }

    @router.get("/todo/agents")
    async def list_todo_agents():
        """所有 Agent 实时状态。"""
        agents = scheduler.todo.get_all_agents()
        return {
            "agents": [
                {
                    "agent_id": a.agent_id,
                    "role": a.role,
                    "current_task": a.current_task,
                    "status": a.status,
                    "last_heartbeat": a.last_heartbeat,
                }
                for a in agents
            ],
            "total": len(agents),
        }

    @router.get("/todo/progress")
    async def get_todo_progress():
        """全局进度摘要。"""
        return scheduler.todo.get_project_progress()

    @router.post("/todo/milestones")
    async def create_todo_milestone(req: TodoMilestoneSchema):
        """创建里程碑（项目经理调用）。"""
        ms = scheduler.todo.create_milestone(req.title, req.tasks)
        return {
            "milestone_id": ms.milestone_id,
            "title": ms.title,
            "task_count": len(ms.tasks),
        }

    @router.post("/todo/tasks/update")
    async def update_todo_task(req: TodoUpdateSchema):
        """更新任务状态（Agent 调用）。"""
        task = scheduler.todo.update_task(
            req.task_id, req.status, req.progress, req.note,
        )
        if not task:
            raise HTTPException(status_code=404, detail="task not found")
        return {"task_id": task.task_id, "status": task.status,
                "progress": task.progress}

    @router.post("/todo/tasks/block")
    async def block_todo_task(req: TodoBlockSchema):
        """报告任务阻塞。"""
        task = scheduler.todo.report_block(req.task_id, req.reason)
        if not task:
            raise HTTPException(status_code=404, detail="task not found")
        return {"task_id": task.task_id, "status": "blocked",
                "reason": req.reason}

    return router


async def websocket_handler(websocket: WebSocket,
                            scheduler: SchedulerCore):
    await scheduler.event_bus.register_ws(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await scheduler.event_bus.unregister_ws(websocket)
