from collections import defaultdict, deque
from datetime import datetime, timezone

from .models import (
    TaskDAG, TaskNode, TaskInstance, TaskStatus, DagState, SchedulerEvent,
)


class DAGParser:
    """DAG 解析器 — 纯函数式设计，无副作用。"""

    def parse(self, dag: TaskDAG) -> tuple[DagState, list[TaskInstance]]:
        nodes_map = {n.id: n for n in dag.nodes}
        if self._has_cycle(nodes_map):
            raise ValueError(f"DAG '{dag.dag_id}' contains a cycle")

        state = DagState(
            dag_id=dag.dag_id,
            repo_url=dag.repo_url,
            base_commit=dag.base_commit,
        )
        ready_nodes = []

        now = datetime.now(timezone.utc)
        for node in dag.nodes:
            instance = TaskInstance(
                task_id=f"{dag.dag_id}:{node.id}",
                dag_id=dag.dag_id,
                node_id=node.id,
                node_type=node.type,
                status=TaskStatus.READY if not node.depends_on
                       else TaskStatus.PENDING,
                depends_on=list(node.depends_on),
                max_retries=2,
                created_at=now,
                contract={
                    "instruction": node.instruction,
                    "files": list(node.files),
                    "read_only_files": list(node.read_only_files),
                    "model_hint": node.model_hint,
                    "system_prompt_extra": node.system_prompt_extra,
                    "auto_lint": node.auto_lint,
                    "lint_command": node.lint_command,
                    "auto_test": node.auto_test,
                    "test_command": node.test_command,
                    "max_reflections": node.max_reflections,
                    "timeout_seconds": node.timeout_seconds,
                    # 权限字段
                    "allowed_operations": list(node.allowed_operations),
                    "allow_new_files": node.allow_new_files,
                    "allow_shell_commands": node.allow_shell_commands,
                    "allowed_shell_patterns": list(node.allowed_shell_patterns),
                },
            )
            state.nodes[node.id] = instance
            if instance.status == TaskStatus.READY:
                ready_nodes.append(instance)

        return state, ready_nodes

    def advance(self, state: DagState, completed_node_id: str) -> list[TaskInstance]:
        """某节点完成后，检查哪些后续节点变为 READY。"""
        newly_ready = []
        completed = state.nodes.get(completed_node_id)
        if not completed:
            return newly_ready

        for task in state.nodes.values():
            if task.status != TaskStatus.PENDING:
                continue
            if completed_node_id in task.depends_on:
                if all(
                    state.nodes[dep].status == TaskStatus.SUCCEEDED
                    for dep in task.depends_on
                ):
                    task.status = TaskStatus.READY
                    newly_ready.append(task)

        return newly_ready

    def _has_cycle(self, nodes: dict[str, TaskNode]) -> bool:
        VISITING, VISITED = 1, 2
        adj = {nid: list(node.depends_on) for nid, node in nodes.items()}
        visit_state: dict[str, int] = {}

        def dfs(nid: str) -> bool:
            if nid in visit_state:
                return visit_state[nid] == VISITING
            visit_state[nid] = VISITING
            for dep in adj.get(nid, []):
                if dep in adj and dfs(dep):
                    return True
            visit_state[nid] = VISITED
            return False

        for nid in nodes:
            if nid not in visit_state:
                if dfs(nid):
                    return True
        return False

    def compute_batches(self, state: DagState) -> list[list[TaskInstance]]:
        """将 DAG 按依赖分层为执行批次，同批次可并行。"""
        in_degree: dict[str, int] = {}
        adj: dict[str, list[str]] = defaultdict(list)

        for task in state.nodes.values():
            in_degree.setdefault(task.node_id, 0)
            for dep in task.depends_on:
                adj[dep].append(task.node_id)
                in_degree[task.node_id] = in_degree.get(task.node_id, 0) + 1

        queue = deque([
            tid for tid, deg in in_degree.items() if deg == 0
        ])
        batches = []

        while queue:
            batch_size = len(queue)
            batch = []
            for _ in range(batch_size):
                nid = queue.popleft()
                task = state.nodes.get(nid)
                if task:
                    batch.append(task)
                for neighbor in adj[nid]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)
            if batch:
                batches.append(batch)

        return batches

    def to_event(self, dag: TaskDAG) -> SchedulerEvent:
        return SchedulerEvent(
            event_id=f"dag_submitted_{dag.dag_id}",
            event_type="dag.submitted",
            dag_id=dag.dag_id,
            data={
                "repo_url": dag.repo_url,
                "node_count": len(dag.nodes),
            },
        )
