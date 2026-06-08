import logging

from .git_branch_manager import GitBranchManager
from .models import DagState, MergeResult, TaskStatus

logger = logging.getLogger(__name__)


class MergeAgent:
    def __init__(self, repo_path: str):
        self.git_mgr = GitBranchManager(repo_path)

    def can_merge(self, dag_state: DagState, node: str) -> bool:
        task = dag_state.nodes.get(node)
        if not task:
            return False
        for dep_id in task.depends_on:
            dep = dag_state.nodes.get(dep_id)
            if dep and dep.status not in (TaskStatus.MERGED, TaskStatus.SUCCEEDED):
                return False
        return True

    def merge_node(self, dag_state: DagState, node_id: str,
                   target_branch: str = "") -> MergeResult:
        task = dag_state.nodes.get(node_id)
        if not task or not task.branch_name:
            return MergeResult(success=False, error="no branch to merge")

        logger.info("merging branch %s -> %s (task=%s)",
                    task.branch_name, target_branch or "default", node_id)
        result = self.git_mgr.merge_back(task.branch_name, target_branch)
        return result

    def merge_batch(self, dag_state: DagState,
                    node_ids: list[str],
                    target_branch: str = "",
                    on_conflict: str = "skip") -> list[tuple[str, MergeResult]]:
        results = []
        for node_id in node_ids:
            result = self.merge_node(dag_state, node_id, target_branch)
            results.append((node_id, result))
            if not result.success and on_conflict == "stop":
                break
        return results

    def merge_all_ready(self, dag_state: DagState,
                        target_branch: str = "") -> list[tuple[str, MergeResult]]:
        ready = [
            nid for nid, task in dag_state.nodes.items()
            if task.status == TaskStatus.SUCCEEDED
            and self.can_merge(dag_state, nid)
        ]
        if not ready:
            return []
        return self.merge_batch(dag_state, ready, target_branch)

    def resolve_conflict(self, repo_path: str,
                         conflict_files: list[str],
                         strategy: str) -> MergeResult:
        repo = self.git_mgr.repo_path
        if strategy == "accept_theirs":
            return self._accept_theirs(repo_path, conflict_files)
        elif strategy == "accept_ours":
            return self._accept_ours(repo_path, conflict_files)
        elif strategy == "manual_resolved":
            return MergeResult(success=True, conflict_files=[])
        else:
            return MergeResult(success=False, error=f"unknown strategy: {strategy}")

    def _accept_theirs(self, repo_path: str,
                       conflict_files: list[str]) -> MergeResult:
        import git
        repo_obj = __import__("git", fromlist=["Repo"]).Repo(repo_path)
        try:
            for f in conflict_files:
                repo_obj.git.checkout("--theirs", f)
            repo_obj.git.add(conflict_files)
            repo_obj.git.commit("-m", "auto-resolve: accept theirs", "--no-edit")
            return MergeResult(success=True)
        except Exception as e:
            return MergeResult(success=False, error=str(e))

    def _accept_ours(self, repo_path: str,
                     conflict_files: list[str]) -> MergeResult:
        import git
        repo_obj = __import__("git", fromlist=["Repo"]).Repo(repo_path)
        try:
            for f in conflict_files:
                repo_obj.git.checkout("--ours", f)
            repo_obj.git.add(conflict_files)
            repo_obj.git.commit("-m", "auto-resolve: accept ours", "--no-edit")
            return MergeResult(success=True)
        except Exception as e:
            return MergeResult(success=False, error=str(e))
