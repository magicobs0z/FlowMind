"""持久化存储模块 — SQLite 存储 DAG 状态和 Todo。

支持：
- DAG 状态持久化
- Task 实例持久化
- Todo 任务持久化
- Event 持久化
- 启动时加载未完成任务
"""
import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from .models import (
    TaskDAG, TaskNode, TaskInstance, TaskStatus, DagState, SchedulerEvent,
    TodoTask, TodoMilestone,
)

logger = logging.getLogger(__name__)


class SQLitePersistence:
    """SQLite 持久化存储。"""

    TABLE_SCHEMA = """
CREATE TABLE IF NOT EXISTS dag_states (
    dag_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    base_commit TEXT,
    merge_branch TEXT,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_instances (
    task_id TEXT PRIMARY KEY,
    dag_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    node_type TEXT NOT NULL,
    status TEXT NOT NULL,
    depends_on TEXT NOT NULL,
    retry_count INTEGER NOT NULL,
    max_retries INTEGER NOT NULL,
    worker_id TEXT,
    branch_name TEXT,
    contract_json TEXT,
    result_json TEXT,
    error_message TEXT,
    token_usage_json TEXT,
    created_at TEXT,
    started_at TEXT,
    finished_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todo_tasks (
    task_id TEXT PRIMARY KEY,
    milestone_id TEXT,
    description TEXT NOT NULL,
    agent_role TEXT,
    agent_id TEXT,
    node_id TEXT,
    dag_id TEXT,
    status TEXT NOT NULL,
    progress REAL NOT NULL,
    files TEXT NOT NULL,
    note TEXT,
    blocked_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todo_milestones (
    milestone_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    progress REAL NOT NULL,
    tasks_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduler_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    dag_id TEXT NOT NULL,
    node_id TEXT,
    data_json TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dag_states_status ON dag_states(status);
CREATE INDEX IF NOT EXISTS idx_task_instances_dag_id ON task_instances(dag_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_status ON task_instances(status);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_milestone_id ON todo_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON todo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_scheduler_events_dag_id ON scheduler_events(dag_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_events_event_type ON scheduler_events(event_type);
"""

    def __init__(self, db_path: str = "flowmind.db"):
        self._db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None
        self._init_schema()

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self._db_path)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def _init_schema(self):
        conn = self._get_conn()
        conn.executescript(self.TABLE_SCHEMA)
        conn.commit()
        logger.info("SQLite schema initialized at %s", self._db_path)

    def save_dag_state(self, state: DagState) -> None:
        """保存 DAG 状态。"""
        conn = self._get_conn()
        now = datetime.now(timezone.utc).isoformat()

        # 序列化状态
        nodes_serialized = {}
        for nid, node in state.nodes.items():
            nodes_serialized[nid] = {
                "task_id": node.task_id,
                "dag_id": node.dag_id,
                "node_id": node.node_id,
                "node_type": node.node_type.value,
                "status": node.status.value,
                "depends_on": node.depends_on,
                "retry_count": node.retry_count,
                "max_retries": node.max_retries,
                "worker_id": node.worker_id,
                "branch_name": node.branch_name,
                "contract": node.contract,
                "result": node.result,
                "error_message": node.error_message,
                "token_usage": {
                    "tokens_sent": node.token_usage.tokens_sent,
                    "tokens_received": node.token_usage.tokens_received,
                    "cost_usd": node.token_usage.cost_usd,
                } if node.token_usage else None,
                "created_at": node.created_at.isoformat() if node.created_at else None,
                "started_at": node.started_at.isoformat() if node.started_at else None,
                "finished_at": node.finished_at.isoformat() if node.finished_at else None,
            }

        state_json = json.dumps({
            "dag_id": state.dag_id,
            "repo_url": state.repo_url,
            "base_commit": state.base_commit,
            "merge_branch": state.merge_branch,
            "status": state.status,
            "nodes": nodes_serialized,
        })

        conn.execute("""
            INSERT OR REPLACE INTO dag_states
            (dag_id, status, repo_url, base_commit, merge_branch, state_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            state.dag_id,
            state.status,
            state.repo_url,
            state.base_commit,
            state.merge_branch,
            state_json,
            now,
            now,
        ))
        conn.commit()
        logger.debug("Saved DAG state: %s", state.dag_id)

    def load_dag_state(self, dag_id: str) -> Optional[dict]:
        """加载单个 DAG 状态。"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT state_json FROM dag_states WHERE dag_id = ?",
            (dag_id,)
        ).fetchone()
        if not row:
            return None
        return json.loads(row[0])

    def load_unfinished_dags(self) -> List[str]:
        """加载所有未完成的 DAG ID。"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT dag_id FROM dag_states
            WHERE status IN ('running', 'blocked', 'suspended')
            ORDER BY created_at DESC
        """).fetchall()
        return [row[0] for row in rows]

    def delete_dag(self, dag_id: str) -> None:
        """删除已完成的 DAG（可选归档）。"""
        conn = self._get_conn()
        conn.execute("DELETE FROM task_instances WHERE dag_id = ?", (dag_id,))
        conn.execute("DELETE FROM dag_states WHERE dag_id = ?", (dag_id,))
        conn.execute("DELETE FROM scheduler_events WHERE dag_id = ?", (dag_id,))
        conn.commit()

    def save_event(self, event: SchedulerEvent) -> None:
        """保存调度事件。"""
        conn = self._get_conn()
        ts = event.timestamp.isoformat() if event.timestamp else datetime.now(timezone.utc).isoformat()
        conn.execute("""
            INSERT OR IGNORE INTO scheduler_events
            (event_id, event_type, dag_id, node_id, data_json, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            event.event_id,
            event.event_type,
            event.dag_id,
            event.node_id,
            json.dumps(event.data),
            ts,
        ))
        conn.commit()

    def get_events(self, dag_id: str) -> List[Dict[str, Any]]:
        """获取 DAG 的所有事件。"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT event_id, event_type, node_id, data_json, timestamp
            FROM scheduler_events
            WHERE dag_id = ?
            ORDER BY timestamp ASC
        """, (dag_id,)).fetchall()
        return [
            {
                "event_id": row[0],
                "event_type": row[1],
                "node_id": row[2],
                "data": json.loads(row[3]),
                "timestamp": row[4],
            }
            for row in rows
        ]

    def save_todo_task(self, task: TodoTask) -> None:
        """保存 Todo 任务。"""
        conn = self._get_conn()
        conn.execute("""
            INSERT OR REPLACE INTO todo_tasks
            (task_id, milestone_id, description, agent_role, agent_id, node_id, dag_id,
             status, progress, files, note, blocked_reason, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            task.task_id,
            task.milestone_id,
            task.description,
            task.agent_role,
            task.agent_id,
            task.node_id,
            task.dag_id,
            task.status,
            task.progress,
            json.dumps(task.files),
            task.note,
            task.blocked_reason,
            task.created_at,
            task.updated_at,
        ))
        conn.commit()

    def save_todo_milestone(self, milestone: TodoMilestone) -> None:
        """保存 Todo 里程碑。"""
        conn = self._get_conn()
        conn.execute("""
            INSERT OR REPLACE INTO todo_milestones
            (milestone_id, title, status, progress, tasks_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            milestone.milestone_id,
            milestone.title,
            milestone.status,
            milestone.progress,
            json.dumps(milestone.tasks),
            milestone.created_at,
            milestone.updated_at,
        ))
        conn.commit()

    def load_all_todo_tasks(self) -> List[Dict[str, Any]]:
        """加载所有 Todo 任务。"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT task_id, milestone_id, description, agent_role, agent_id,
                   node_id, dag_id, status, progress, files, note,
                   blocked_reason, created_at, updated_at
            FROM todo_tasks
        """).fetchall()
        return [
            {
                "task_id": row[0],
                "milestone_id": row[1],
                "description": row[2],
                "agent_role": row[3],
                "agent_id": row[4],
                "node_id": row[5],
                "dag_id": row[6],
                "status": row[7],
                "progress": row[8],
                "files": json.loads(row[9]),
                "note": row[10],
                "blocked_reason": row[11],
                "created_at": row[12],
                "updated_at": row[13],
            }
            for row in rows
        ]

    def load_all_todo_milestones(self) -> List[Dict[str, Any]]:
        """加载所有 Todo 里程碑。"""
        conn = self._get_conn()
        rows = conn.execute("""
            SELECT milestone_id, title, status, progress, tasks_json, created_at, updated_at
            FROM todo_milestones
        """).fetchall()
        return [
            {
                "milestone_id": row[0],
                "title": row[1],
                "status": row[2],
                "progress": row[3],
                "tasks": json.loads(row[4]),
                "created_at": row[5],
                "updated_at": row[6],
            }
            for row in rows
        ]

    def vacuum(self) -> None:
        """压缩数据库，回收空间。"""
        conn = self._get_conn()
        conn.execute("VACUUM")
        conn.commit()

    def close(self) -> None:
        """关闭连接。"""
        if self._conn:
            self._conn.close()
            self._conn = None
