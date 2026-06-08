import asyncio
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import WebSocket

from .models import SchedulerEvent


class EventBus:
    def __init__(self):
        self._queues: list[asyncio.Queue] = []
        self._ws_connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._persistence = None  # 由 SchedulerCore 注入
        self._notification = None  # 由 SchedulerCore 注入

    def set_persistence(self, persistence):
        """注入持久化服务。"""
        self._persistence = persistence

    def set_notification(self, notification):
        """注入通知服务。"""
        self._notification = notification

    async def publish(self, event: SchedulerEvent):
        if not event.timestamp:
            event.timestamp = datetime.now(timezone.utc)
        if not event.event_id:
            event.event_id = f"{event.event_type}_{uuid.uuid4().hex[:8]}"

        async with self._lock:
            for q in self._queues:
                await q.put(event)

            disconnected = set()
            for ws in self._ws_connections:
                try:
                    await ws.send_json({
                        "event_id": event.event_id,
                        "event_type": event.event_type,
                        "dag_id": event.dag_id,
                        "node_id": event.node_id,
                        "timestamp": event.timestamp.isoformat(),
                        "data": event.data,
                    })
                except Exception:
                    disconnected.add(ws)
            self._ws_connections -= disconnected

        # 持久化保存事件
        if self._persistence:
            try:
                self._persistence.save_event(event)
            except Exception:
                pass

        # 通知服务
        if self._notification:
            try:
                await self._notification.notify(
                    event_type=event.event_type,
                    title=f"FlowMind: {event.event_type}",
                    message=f"DAG: {event.dag_id}\nNode: {event.node_id or 'N/A'}\nData: {event.data}",
                    level="warning" if "blocked" in event.event_type or "failed" in event.event_type else "info",
                    extra={"event_id": event.event_id, "dag_id": event.dag_id, "node_id": event.node_id},
                )
            except Exception:
                pass

    async def subscribe(self) -> AsyncIterator[SchedulerEvent]:
        q: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._queues.append(q)
        try:
            while True:
                event = await q.get()
                yield event
        finally:
            async with self._lock:
                if q in self._queues:
                    self._queues.remove(q)

    async def register_ws(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._ws_connections.add(websocket)

    async def unregister_ws(self, websocket: WebSocket):
        async with self._lock:
            self._ws_connections.discard(websocket)

    async def task_ready(self, dag_id: str, node_id: str, **extra):
        await self.publish(SchedulerEvent(
            event_type="task.ready",
            dag_id=dag_id,
            node_id=node_id,
            data=extra,
        ))

    async def task_started(self, dag_id: str, node_id: str, worker_id: str = ""):
        await self.publish(SchedulerEvent(
            event_type="task.started",
            dag_id=dag_id,
            node_id=node_id,
            data={"worker_id": worker_id},
        ))

    async def task_failed(self, dag_id: str, node_id: str, error: str = ""):
        await self.publish(SchedulerEvent(
            event_type="task.failed",
            dag_id=dag_id,
            node_id=node_id,
            data={"error": error},
        ))

    async def task_succeeded(self, dag_id: str, node_id: str, **extra):
        await self.publish(SchedulerEvent(
            event_type="task.succeeded",
            dag_id=dag_id,
            node_id=node_id,
            data=extra,
        ))

    async def dag_completed(self, dag_id: str, **extra):
        await self.publish(SchedulerEvent(
            event_type="dag.completed",
            dag_id=dag_id,
            data=extra,
        ))

    async def dag_blocked(self, dag_id: str, reason: str = ""):
        await self.publish(SchedulerEvent(
            event_type="dag.blocked",
            dag_id=dag_id,
            data={"reason": reason},
        ))

    async def human_intervention(self, dag_id: str, node_id: str,
                                 intervention_type: str, **extra):
        await self.publish(SchedulerEvent(
            event_type="human_intervention.required",
            dag_id=dag_id,
            node_id=node_id,
            data={"intervention_type": intervention_type, **extra},
        ))

    async def token_usage(self, dag_id: str, node_id: str,
                          tokens_sent: int, tokens_received: int,
                          cost_usd: float = 0.0):
        await self.publish(SchedulerEvent(
            event_type="token.usage",
            dag_id=dag_id,
            node_id=node_id,
            data={
                "tokens_sent": tokens_sent,
                "tokens_received": tokens_received,
                "cost_usd": cost_usd,
            },
        ))

    async def merge_conflict(self, dag_id: str, conflict_files: list[str]):
        await self.publish(SchedulerEvent(
            event_type="merge.conflict",
            dag_id=dag_id,
            data={"conflict_files": conflict_files},
        ))

    async def contract_change_requested(self, dag_id: str, node_id: str,
                                         change_type: str, reason: str,
                                         proposed: dict):
        await self.publish(SchedulerEvent(
            event_type="contract_change.requested",
            dag_id=dag_id,
            node_id=node_id,
            data={
                "change_type": change_type,
                "reason": reason,
                "proposed_changes": proposed,
            },
        ))

    # ── Human-in-the-loop 事件 ─────────────────────────────────

    async def worker_interrupt(self, dag_id: str, node_id: str,
                               interrupt_id: str, reason: str,
                               question: str, context: dict = None,
                               options: list[str] = None):
        """Worker 触发中断，等待人类决策。"""
        await self.publish(SchedulerEvent(
            event_type="worker.interrupt",
            dag_id=dag_id,
            node_id=node_id,
            data={
                "interrupt_id": interrupt_id,
                "reason": reason,
                "question": question,
                "context": context or {},
                "options": options or [],
            },
        ))

    async def approval_needed(self, dag_id: str, node_id: str,
                              approval_id: str, title: str,
                              description: str = "",
                              payload: dict = None):
        """DAG 执行中需要人类审批。"""
        await self.publish(SchedulerEvent(
            event_type="approval.needed",
            dag_id=dag_id,
            node_id=node_id,
            data={
                "approval_id": approval_id,
                "title": title,
                "description": description,
                "payload": payload or {},
            },
        ))

    async def dag_suspended(self, dag_id: str, reason: str = "",
                            interrupt_id: str = ""):
        """DAG 因等待人类决策而挂起。"""
        await self.publish(SchedulerEvent(
            event_type="dag.suspended",
            dag_id=dag_id,
            data={"reason": reason, "interrupt_id": interrupt_id},
        ))

    async def dag_resumed(self, dag_id: str, resolution: str = ""):
        """DAG 因人类决策而恢复。"""
        await self.publish(SchedulerEvent(
            event_type="dag.resumed",
            dag_id=dag_id,
            data={"resolution": resolution},
        ))
