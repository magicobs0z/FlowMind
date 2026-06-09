"""TODO 监控模块 — 轻量级任务进度共享账本。

设计原则：
- Agent 主动上报：Agent 在任务开始、进度更新、完成、阻塞时主动调用。
- 统一视角：自动聚合所有 Agent 的状态到全局视图。
- 非侵入：不干预调度逻辑，只做进度采集与展示。
- 持久化：支持 SQLite 持久化，重启后恢复。
"""
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from .models import (
    TodoMilestone, TodoTask, AgentStatus,
    SchedulerEvent,
)
from .persistence import SQLitePersistence


class TodoService:
    """TODO 监控服务。

    纯内存缓存 + SQLite 持久化。每次状态变更自动发布事件到 EventBus。
    """

    def __init__(self, event_bus=None, db_path: str = "flowmind.db",
                 persistence=None):
        self._event_bus = event_bus
        self._persistence = persistence or SQLitePersistence(db_path)
        self._milestones: dict[str, TodoMilestone] = {}
        self._tasks: dict[str, TodoTask] = {}
        self._agents: dict[str, AgentStatus] = {}

        # 启动时加载持久化数据
        self._load_from_persistence()

    # ── 项目经理 API ─────────────────────────────────────

    def create_milestone(self, title: str,
                         task_descriptions: list[dict] = None) -> TodoMilestone:
        """创建里程碑和子任务列表。"""
        now = self._now()
        mid = f"ms_{uuid.uuid4().hex[:8]}"

        milestone = TodoMilestone(
            milestone_id=mid,
            title=title,
            created_at=now,
            updated_at=now,
        )

        if task_descriptions:
            for td in task_descriptions:
                task = self._add_task(
                    description=td.get("description", ""),
                    agent_role=td.get("agent_role", ""),
                    milestone_id=mid,
                    node_id=td.get("node_id", ""),
                    dag_id=td.get("dag_id", ""),
                    files=td.get("files", []),
                )
                milestone.tasks.append(task.task_id)

        self._milestones[mid] = milestone
        self._publish("todo.milestone_created", milestone_id=mid,
                      title=title, task_count=len(milestone.tasks))
        return milestone

    # ── Agent API ─────────────────────────────────────────

    def update_task(self, task_id: str, status: str = None,
                    progress: float = None, note: str = "") -> TodoTask | None:
        """更新任务状态。Agent 主动调用。"""
        task = self._tasks.get(task_id)
        if not task:
            return None

        old_status = task.status
        if status:
            task.status = status
        if progress is not None:
            task.progress = max(0.0, min(1.0, progress))
        if note:
            task.note = note
        task.updated_at = self._now()

        # 里程碑进度自动重算
        if task.milestone_id:
            self._recalc_milestone(task.milestone_id)

        # 持久化保存
        self._persistence.save_todo_task(task)
        if task.milestone_id:
            self._persistence.save_todo_milestone(self._milestones[task.milestone_id])

        self._publish("todo.task_updated",
                      task_id=task_id, status=task.status,
                      progress=task.progress,
                      old_status=old_status,
                      note=note)
        return task

    def report_block(self, task_id: str, reason: str) -> TodoTask | None:
        """报告任务阻塞。"""
        task = self._tasks.get(task_id)
        if not task:
            return None
        task.status = "blocked"
        task.blocked_reason = reason
        task.updated_at = self._now()

        if task.milestone_id:
            self._recalc_milestone(task.milestone_id)

        self._publish("todo.task_blocked",
                      task_id=task_id, reason=reason)
        return task

    def get_agent_tasks(self, agent_id: str) -> list[TodoTask]:
        """Agent 查询自己当前被分配的任务。"""
        return [t for t in self._tasks.values()
                if t.agent_id == agent_id]

    def get_project_progress(self) -> dict:
        """获取整体进度摘要。"""
        total = len(self._tasks)
        if total == 0:
            return {"total": 0, "completed": 0, "blocked": 0,
                    "in_progress": 0, "progress": 0.0}

        completed = sum(1 for t in self._tasks.values()
                        if t.status == "completed")
        blocked = sum(1 for t in self._tasks.values()
                      if t.status == "blocked")
        in_progress = sum(1 for t in self._tasks.values()
                          if t.status == "in_progress")

        return {
            "total": total,
            "completed": completed,
            "blocked": blocked,
            "in_progress": in_progress,
            "progress": completed / total if total > 0 else 0.0,
        }

    # ── Agent 心跳 ────────────────────────────────────────

    def agent_heartbeat(self, agent_id: str, role: str = "",
                        current_task: str = "",
                        status: str = "working") -> AgentStatus:
        """Agent 心跳，记录在线状态和当前任务。"""
        now = self._now()
        existing = self._agents.get(agent_id)

        if existing:
            existing.role = role or existing.role
            existing.current_task = current_task or existing.current_task
            existing.status = status
            existing.last_heartbeat = now
            return existing

        agent = AgentStatus(
            agent_id=agent_id,
            role=role,
            current_task=current_task,
            status=status,
            last_heartbeat=now,
        )
        self._agents[agent_id] = agent
        return agent

    # ── 调度中心集成 ──────────────────────────────────────

    def register_from_contract(self, dag_id: str, node_id: str,
                               description: str, agent_role: str = "",
                               agent_id: str = "",
                               files: list[str] = None,
                               milestone_id: str = "") -> TodoTask:
        """调度中心在创建契约时自动注册 TODO 任务项。"""
        task = self._add_task(
            task_id=f"{dag_id}:{node_id}",
            description=description,
            agent_role=agent_role,
            agent_id=agent_id,
            milestone_id=milestone_id,
            node_id=node_id,
            dag_id=dag_id,
            files=files or [],
            status="todo",
        )
        return task

    def update_from_task_result(self, task_id: str,
                                 success: bool,
                                 error: str = "") -> TodoTask | None:
        """根据任务执行结果更新 TODO 状态。"""
        if success:
            return self.update_task(task_id, status="completed", progress=1.0)
        else:
            return self.report_block(task_id, error or "task failed")

    def agent_working_on(self, agent_id: str, role: str,
                         task_id: str) -> AgentStatus:
        """Agent 开始处理某任务时，同时更新心跳和任务关联。"""
        return self.agent_heartbeat(
            agent_id=agent_id, role=role,
            current_task=task_id, status="working",
        )

    # ── 查询 API ─────────────────────────────────────────

    def get_milestone(self, milestone_id: str) -> TodoMilestone | None:
        return self._milestones.get(milestone_id)

    def get_all_milestones(self) -> list[TodoMilestone]:
        return list(self._milestones.values())

    def get_task(self, task_id: str) -> TodoTask | None:
        return self._tasks.get(task_id)

    def get_tasks(self, milestone_id: str = None,
                  status: str = None,
                  agent_id: str = None) -> list[TodoTask]:
        tasks = list(self._tasks.values())
        if milestone_id:
            tasks = [t for t in tasks if t.milestone_id == milestone_id]
        if status:
            tasks = [t for t in tasks if t.status == status]
        if agent_id:
            tasks = [t for t in tasks if t.agent_id == agent_id]
        return tasks

    def get_all_agents(self) -> list[AgentStatus]:
        return list(self._agents.values())

    def get_agent(self, agent_id: str) -> AgentStatus | None:
        return self._agents.get(agent_id)

    # ── LLM 上下文注入 ────────────────────────────────

    def format_project_context(self, repo_path: str = "",
                               max_tasks: int = 20) -> str:
        """生成供 LLM 消费的项目结构化摘要。

        包含：整体进度、任务列表（含状态）、Agent 状态、文件清单。
        项目经理 Worker 可调用此方法获取项目全貌。
        """
        lines = []
        progress = self.get_project_progress()

        lines.append("【项目进度总览】")
        lines.append(f"  总任务: {progress['total']}, "
                     f"已完成: {progress['completed']}, "
                     f"进行中: {progress['in_progress']}, "
                     f"阻塞: {progress['blocked']}, "
                     f"进度: {progress['progress']:.0%}")

        if self._tasks:
            lines.append("\n【任务列表】")
            all_tasks = sorted(self._tasks.values(),
                              key=lambda t: t.updated_at or "", reverse=True)
            for task in all_tasks[:max_tasks]:
                status_icon = {
                    "completed": "✅", "in_progress": "🔄",
                    "blocked": "❌", "todo": "⏳",
                }.get(task.status, "❓")
                lines.append(
                    f"  {status_icon} [{task.status}] {task.node_id or task.task_id}"
                )
                if task.description:
                    desc = task.description[:100]
                    lines.append(f"     {desc}")
                if task.files:
                    lines.append(f"     文件: {', '.join(task.files[:5])}")
                if task.note:
                    lines.append(f"     备注: {task.note[:80]}")
                if task.blocked_reason:
                    lines.append(f"     阻塞原因: {task.blocked_reason[:120]}")

        if self._agents:
            lines.append("\n【Agent 状态】")
            for agent in list(self._agents.values())[:10]:
                lines.append(f"  {agent.agent_id}: {agent.status} "
                           f"(role={agent.role}, task={agent.current_task})")

        # 文件清单（从所有 task 的 files 字段汇总）
        all_files = set()
        for task in self._tasks.values():
            for f in task.files:
                all_files.add(f)
        if all_files:
            lines.append("\n【涉及文件清单】")
            for f in sorted(all_files)[:30]:
                lines.append(f"  - {f}")

        return "\n".join(lines)

    def get_task_summary_for_llm(self, dag_id: str = "",
                                  node_id: str = "") -> str:
        """获取单个任务及其上下游的简明摘要。"""
        if dag_id and node_id:
            task_id = f"{dag_id}:{node_id}"
        else:
            task_id = node_id or dag_id

        task = self._tasks.get(task_id)
        if not task:
            return ""

        lines = [
            f"任务: {task.node_id}",
            f"描述: {task.description}",
            f"状态: {task.status} (进度: {task.progress:.0%})",
            f"文件: {', '.join(task.files) if task.files else '(无)'}",
        ]
        if task.note:
            lines.append(f"备注: {task.note}")
        if task.blocked_reason:
            lines.append(f"阻塞原因: {task.blocked_reason}")
        return "\n".join(lines)

    # ── 内部方法 ─────────────────────────────────────────

    def _add_task(self, task_id: str = "", **kw) -> TodoTask:
        tid = task_id or f"tk_{uuid.uuid4().hex[:8]}"
        now = self._now()
        task = TodoTask(
            task_id=tid,
            created_at=now,
            updated_at=now,
            **kw,
        )
        self._tasks[tid] = task
        self._persistence.save_todo_task(task)
        return task

    def _load_from_persistence(self):
        """启动时从 SQLite 恢复数据。"""
        try:
            for data in self._persistence.load_all_todo_tasks():
                task = TodoTask(
                    task_id=data["task_id"],
                    milestone_id=data.get("milestone_id", ""),
                    description=data["description"],
                    agent_role=data.get("agent_role", ""),
                    agent_id=data.get("agent_id", ""),
                    node_id=data.get("node_id", ""),
                    dag_id=data.get("dag_id", ""),
                    status=data["status"],
                    progress=data["progress"],
                    files=data.get("files", []),
                    note=data.get("note", ""),
                    blocked_reason=data.get("blocked_reason", ""),
                    created_at=data.get("created_at", ""),
                    updated_at=data.get("updated_at", ""),
                )
                self._tasks[task.task_id] = task

            for data in self._persistence.load_all_todo_milestones():
                ms = TodoMilestone(
                    milestone_id=data["milestone_id"],
                    title=data["title"],
                    status=data["status"],
                    progress=data["progress"],
                    tasks=data.get("tasks", []),
                    created_at=data.get("created_at", ""),
                    updated_at=data.get("updated_at", ""),
                )
                self._milestones[ms.milestone_id] = ms

            logger = __import__("logging").getLogger(__name__)
            logger.info("Loaded %d tasks and %d milestones from persistence",
                        len(self._tasks), len(self._milestones))
        except Exception:
            logger = __import__("logging").getLogger(__name__)
            logger.warning("Failed to load from persistence, starting fresh")

    def _recalc_milestone(self, milestone_id: str):
        """根据子任务状态重算里程碑进度。"""
        ms = self._milestones.get(milestone_id)
        if not ms:
            return

        tasks = [t for t in self._tasks.values()
                 if t.milestone_id == milestone_id]
        if not tasks:
            return

        completed = sum(1 for t in tasks if t.status == "completed")
        blocked = sum(1 for t in tasks if t.status == "blocked")
        ms.progress = completed / len(tasks) if tasks else 0.0

        if completed == len(tasks):
            ms.status = "completed"
        elif blocked > 0:
            ms.status = "in_progress"
        elif completed > 0:
            ms.status = "in_progress"
        else:
            ms.status = "pending"
        ms.updated_at = self._now()

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _publish(self, event_type: str, **data):
        if not self._event_bus:
            return
        try:
            asyncio.ensure_future(self._event_bus.publish(SchedulerEvent(
                event_type=event_type,
                dag_id=data.get("dag_id", ""),
                node_id=data.get("node_id", ""),
                data=data,
            )))
        except Exception:
            pass