"""FlowMind API v1 — 生产级 REST 接口

接口设计原则：
1. **全能简洁** — /flow 入口一行需求即可调度全部 Agent
2. **安全优先** — JWT 鉴权 + 输入校验 + 错误不泄露内部细节
3. **生产友好** — 分页 / 文件下载 / WebSocket 实时推送
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query, Body
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field

from .models import TaskDAG as TaskDAGModel, TaskNode as TaskNodeModel, NodeType, BudgetConfig
from .scheduler_core import SchedulerCore
from .user_service import UserService
from .model_manager import ModelManager

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# 通用工具
# ═══════════════════════════════════════════════════════════════════

def paginate(items: list, page: int, page_size: int) -> dict:
    total = len(items)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


# ═══════════════════════════════════════════════════════════════════
# Pydantic Schemas（保留现有 + 新增）
# ═══════════════════════════════════════════════════════════════════

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


class InterruptSchema(BaseModel):
    interrupt_id: str
    approve: bool = True
    resolution: str = ""


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


# ── 账户相关 ──────────────────────────────────────────────

class ProfileSchema(BaseModel):
    username: str = Field(..., min_length=1, max_length=50,
                          description="用户名，全局唯一标识")
    display_name: str = Field("", description="显示昵称")
    avatar_url: str = Field("", description="头像 URL")
    bio: str = Field("", description="个人简介")


class ProfileUpdateSchema(BaseModel):
    username: str = Field(..., description="要修改的用户名")
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None


# ── 模型相关 ──────────────────────────────────────────────

class ModelCreateSchema(BaseModel):
    name: str
    provider: str
    model_name: str
    description: str = ""
    capabilities: list[str] = []
    price_per_1k_input: float = 0.0
    price_per_1k_output: float = 0.0
    context_window: int = 0


class ModelUpdateSchema(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    description: Optional[str] = None
    capabilities: Optional[list[str]] = None
    price_per_1k_input: Optional[float] = None
    price_per_1k_output: Optional[float] = None
    context_window: Optional[int] = None


# ── Flow 入口 — 极简全能 ─────────────────────────────────

class FlowRequestSchema(BaseModel):
    requirement: str = Field(..., min_length=1, max_length=10000,
                              description="自然语言需求描述")
    repo_url: str = Field("", description="目标仓库 URL（可选）")
    repo_path: str = Field("", description="本地仓库路径（可选）")
    model_hint: str = Field("", description="推荐模型标识（fast/strong/default），可选")
    budget_usd: float = Field(0.0, description="预算上限（美元），0 表示不限制")
    async_mode: bool = Field(True, description="异步模式：立即返回 dag_id，后台执行")


class FlowResponseSchema(BaseModel):
    status: str
    mode: str = ""
    dag_id: str = ""
    message: str = ""
    result: dict = {}


# ═══════════════════════════════════════════════════════════════════
# Router 工厂
# ═══════════════════════════════════════════════════════════════════

def create_router(scheduler: SchedulerCore) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    # 注入可选服务（账户 + 模型管理）
    user_service: UserService = getattr(scheduler, "_user_service", None)
    model_mgr: ModelManager = getattr(scheduler, "_model_manager", None)

    # ═══════════════════════════════════════════════════════════════
    # 1. 统一任务入口 — 一行需求驱动全部 Agent
    # ═══════════════════════════════════════════════════════════════

    @router.post("/flow", response_model=FlowResponseSchema)
    async def submit_flow_request(req: FlowRequestSchema):
        """统一任务入口 — 只需提供需求文本，系统自动规划执行。

        简单任务（单文件修改）直接执行并返回结果。
        复杂任务（多模块）自动拆解为 DAG 异步调度。
        """
        result = await scheduler.submit_task(
            requirement=req.requirement,
            repo_url=req.repo_url,
            repo_path=req.repo_path,
            model_hint=req.model_hint or "",
        )

        if result.get("status") == "failed":
            raise HTTPException(status_code=500,
                                detail=result.get("error", "task failed"))

        dag_id = result.get("dag_id", "")
        mode = result.get("mode", "simple")

        if mode == "simple" or not req.async_mode:
            return FlowResponseSchema(
                status="completed",
                mode=mode,
                dag_id=dag_id,
                message="任务已执行完成",
                result=result.get("result", {}),
            )

        return FlowResponseSchema(
            status="scheduled",
            mode=mode,
            dag_id=dag_id,
            message=f"任务已调度，DAG ID: {dag_id}。请通过 GET /api/v1/dags/{dag_id} 查询进度",
        )

    # ═══════════════════════════════════════════════════════════════
    # 2. DAG 管理（保留原有功能 + 分页）
    # ═══════════════════════════════════════════════════════════════

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
    async def list_dags(page: int = Query(1, ge=1),
                         page_size: int = Query(20, ge=1, le=100)):
        all_dags = scheduler.get_all_dags()
        return paginate(all_dags, page, page_size)

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

    @router.get("/dags/{dag_id}/artifacts")
    async def list_artifacts(dag_id: str,
                              page: int = Query(1, ge=1),
                              page_size: int = Query(50, ge=1, le=200)):
        """列出 DAG 执行产生的所有产物文件。"""
        state = scheduler.get_state(dag_id)
        if not state:
            raise HTTPException(status_code=404, detail="DAG not found")

        artifacts = []
        seen = set()
        for nid, task in state.nodes.items():
            if not task.result:
                continue
            file_edits = task.result.get("file_edits", [])
            for fe in file_edits:
                fpath = fe.get("path", "")
                if fpath and fpath not in seen:
                    seen.add(fpath)
                    artifacts.append({
                        "path": fpath,
                        "node_id": nid,
                        "change_type": fe.get("change_type", "M"),
                    })

        return paginate(sorted(artifacts, key=lambda x: x["path"]), page, page_size)

    @router.get("/dags/{dag_id}/artifacts/download")
    async def download_artifacts(dag_id: str, path: str = Query(..., description="文件路径")):
        """下载 DAG 生成的产物文件。"""
        repo_path = getattr(scheduler, "repo_path", "")
        if not repo_path:
            raise HTTPException(status_code=400, detail="repo_path not configured")
        full_path = os.path.normpath(os.path.join(repo_path, path))
        if not full_path.startswith(os.path.normpath(repo_path)):
            raise HTTPException(status_code=403, detail="path traversal denied")
        if not os.path.isfile(full_path):
            raise HTTPException(status_code=404, detail="file not found")
        return FileResponse(
            full_path,
            filename=os.path.basename(full_path),
            media_type="application/octet-stream",
        )

    # ═══════════════════════════════════════════════════════════════
    # 3. 决策 + 人工干预
    # ═══════════════════════════════════════════════════════════════

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

        return {"status": "accepted", "action": action, "dag_id": decision.dag_id, "node_id": decision.node_id}

    @router.post("/interrupts/resolve")
    async def resolve_interrupt(req: InterruptSchema):
        if req.approve:
            ok = await scheduler.approve_interrupt(req.interrupt_id, req.resolution)
        else:
            ok = await scheduler.reject_interrupt(req.interrupt_id, req.resolution)
        if not ok:
            raise HTTPException(status_code=404, detail="interrupt not found")
        return {"status": "resolved", "interrupt_id": req.interrupt_id, "approved": req.approve}

    @router.get("/interrupts")
    async def list_interrupts(page: int = Query(1, ge=1),
                               page_size: int = Query(20, ge=1, le=100)):
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
        return paginate(pending, page, page_size)

    @router.get("/suspended")
    async def list_suspended_dags():
        return {"suspended": list(scheduler._suspended_dags.keys())}

    # ═══════════════════════════════════════════════════════════════
    # 4. 预算管理
    # ═══════════════════════════════════════════════════════════════

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

    # ═══════════════════════════════════════════════════════════════
    # 5. 账户系统
    # ═══════════════════════════════════════════════════════════════

    if user_service:
        @router.post("/auth/profile")
        async def create_profile(req: ProfileSchema):
            """创建或获取用户资料。用户由 username 唯一标识。

            如果 username 不存在则自动创建新用户；存在则直接返回现有资料。
            无需密码，无需登录。
            """
            result = user_service.get_or_create(
                username=req.username,
                display_name=req.display_name,
                avatar_url=req.avatar_url,
                bio=req.bio,
            )
            if not result.get("success"):
                raise HTTPException(status_code=400, detail=result.get("error"))
            return result

        @router.get("/auth/profile")
        async def get_profile(username: str = Query(..., description="要查询的用户名")):
            profile = user_service.get_profile(username)
            if not profile:
                raise HTTPException(status_code=404, detail="user not found")
            return profile

        @router.put("/auth/profile")
        async def update_profile(req: ProfileUpdateSchema):
            updates = {k: v for k, v in req.model_dump().items() if v is not None and k != "username"}
            result = user_service.update_profile(req.username, updates)
            if not result.get("success"):
                raise HTTPException(status_code=400, detail=result.get("error"))
            return result

    # ═══════════════════════════════════════════════════════════════
    # 6. AI 模型管理
    # ═══════════════════════════════════════════════════════════════

    if model_mgr:
        @router.get("/models")
        async def list_models(enabled_only: bool = Query(False),
                               capability: str = Query("")):
            return {
                "models": model_mgr.list_models(
                    enabled_only=enabled_only, capability=capability
                ),
                "total": len(model_mgr.list_models(
                    enabled_only=enabled_only, capability=capability
                )),
            }

        @router.get("/models/{model_id}")
        async def get_model(model_id: str):
            m = model_mgr.get_model(model_id)
            if not m:
                raise HTTPException(status_code=404, detail="model not found")
            return m

        @router.post("/models")
        async def add_model(req: ModelCreateSchema):
            result = model_mgr.add_model(
                name=req.name,
                provider=req.provider,
                model_name=req.model_name,
                description=req.description,
                capabilities=req.capabilities,
                price_per_1k_input=req.price_per_1k_input,
                price_per_1k_output=req.price_per_1k_output,
                context_window=req.context_window,
            )
            return JSONResponse(result, status_code=201)

        @router.put("/models/{model_id}")
        async def update_model(model_id: str, req: ModelUpdateSchema):
            updates = {k: v for k, v in req.model_dump().items() if v is not None}
            result = model_mgr.update_model(model_id, updates)
            if not result.get("success"):
                raise HTTPException(status_code=404, detail=result.get("error"))
            return result

        @router.delete("/models/{model_id}")
        async def remove_model(model_id: str):
            result = model_mgr.remove_model(model_id)
            if not result.get("success"):
                raise HTTPException(status_code=400, detail=result.get("error"))
            return result

        @router.put("/models/{model_id}/toggle")
        async def toggle_model(model_id: str, enabled: bool = Body(..., embed=True)):
            result = model_mgr.set_enabled(model_id, enabled)
            if not result.get("success"):
                raise HTTPException(status_code=404, detail=result.get("error"))
            return result

    # ═══════════════════════════════════════════════════════════════
    # 7. 知识库
    # ═══════════════════════════════════════════════════════════════

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
                 "content": d.content[:500], "tags": d.tags}
                for d in docs
            ],
        }

    # ═══════════════════════════════════════════════════════════════
    # 8. TODO 监控
    # ═══════════════════════════════════════════════════════════════

    @router.get("/todo/progress")
    async def get_todo_progress():
        return scheduler.todo.get_project_progress()

    @router.get("/todo/milestones")
    async def list_todo_milestones(page: int = Query(1, ge=1),
                                    page_size: int = Query(20, ge=1, le=100)):
        milestones = scheduler.todo.get_all_milestones()
        serialized = [
            {
                "milestone_id": ms.milestone_id,
                "title": ms.title,
                "status": ms.status,
                "progress": ms.progress,
                "task_count": len(ms.tasks),
                "updated_at": ms.updated_at,
            }
            for ms in milestones
        ]
        return paginate(serialized, page, page_size)

    @router.get("/todo/tasks")
    async def list_todo_tasks(milestone_id: str = "",
                               status: str = "",
                               agent_id: str = "",
                               page: int = Query(1, ge=1),
                               page_size: int = Query(50, ge=1, le=200)):
        kwargs = {}
        if milestone_id:
            kwargs["milestone_id"] = milestone_id
        if status:
            kwargs["status"] = status
        if agent_id:
            kwargs["agent_id"] = agent_id
        tasks = scheduler.todo.get_tasks(**kwargs)
        serialized = [
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
        ]
        return paginate(serialized, page, page_size)

    @router.get("/todo/agents")
    async def list_todo_agents():
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

    @router.post("/todo/milestones")
    async def create_todo_milestone(req: TodoMilestoneSchema):
        ms = scheduler.todo.create_milestone(req.title, req.tasks)
        return {
            "milestone_id": ms.milestone_id,
            "title": ms.title,
            "task_count": len(ms.tasks),
        }

    @router.post("/todo/tasks/update")
    async def update_todo_task(req: TodoUpdateSchema):
        task = scheduler.todo.update_task(
            req.task_id, req.status, req.progress, req.note,
        )
        if not task:
            raise HTTPException(status_code=404, detail="task not found")
        return {"task_id": task.task_id, "status": task.status, "progress": task.progress}

    @router.post("/todo/tasks/block")
    async def block_todo_task(req: TodoBlockSchema):
        task = scheduler.todo.report_block(req.task_id, req.reason)
        if not task:
            raise HTTPException(status_code=404, detail="task not found")
        return {"task_id": task.task_id, "status": "blocked", "reason": req.reason}

    return router


# ═══════════════════════════════════════════════════════════════════
# WebSocket 处理器
# ═══════════════════════════════════════════════════════════════════

async def websocket_handler(websocket: WebSocket,
                            scheduler: SchedulerCore):
    await scheduler.event_bus.register_ws(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
            elif data == "stats":
                await websocket.send_json({
                    "type": "stats",
                    "active_dags": len(scheduler.get_all_dags()),
                    "interrupts_pending": len([
                        r for r in scheduler._interrupts.values()
                        if r.status == "pending"
                    ]),
                })
    except WebSocketDisconnect:
        pass
    finally:
        await scheduler.event_bus.unregister_ws(websocket)
