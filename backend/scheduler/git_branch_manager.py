import os
import git
from git import Repo

from .models import MergeResult


class GitBranchManager:
    """Git 分支隔离管理器 — 每个任务独立分支，并行互不干扰。"""

    def __init__(self, repo_path: str):
        self.repo_path = repo_path

    def create_task_branch(self, dag_id: str, node_id: str,
                           base_commit: str = "") -> str:
        branch_name = f"scheduler/{dag_id}/{node_id}"
        repo = Repo(self.repo_path)
        try:
            repo.git.checkout(branch_name)
            if base_commit:
                repo.git.reset("--hard", base_commit)
            return branch_name
        except git.GitCommandError:
            pass

        try:
            if base_commit:
                repo.git.checkout(base_commit)
                repo.git.checkout("-b", branch_name)
            elif repo.head.is_valid():
                repo.git.checkout("-b", branch_name)
            else:
                repo.git.checkout("--orphan", branch_name)
                repo.git.rm("-rf", "--cached", ".", recurse_submodules=True)
            return branch_name
        except git.GitCommandError as e:
            return ""

    def _branch_exists(self, branch_name: str) -> bool:
        repo = Repo(self.repo_path)
        try:
            repo.git.rev_parse("--verify", f"refs/heads/{branch_name}")
            return True
        except git.GitCommandError:
            return False

    def merge_back(self, source_branch: str,
                   target_branch: str = "") -> MergeResult:
        repo = Repo(self.repo_path)
        if not target_branch:
            target_branch = repo.active_branch.name
        current_branch = repo.active_branch.name
        try:
            repo.git.checkout(target_branch)
            try:
                repo.git.merge(source_branch, "--no-ff", "--no-edit")
                return MergeResult(success=True)
            except git.GitCommandError as e:
                error_str = str(e)
                if "conflict" in error_str.lower():
                    conflict_files = self._detect_conflicts(repo)
                    repo.git.merge("--abort")
                    return MergeResult(
                        success=False,
                        conflict_files=conflict_files,
                        error=error_str,
                    )
                return MergeResult(success=False, error=error_str)
        finally:
            safe_branch = current_branch
            try:
                repo.git.checkout(safe_branch)
            except git.GitCommandError:
                pass

    def merge_back_batch(self, branches: list[str],
                         target_branch: str = "",
                         on_conflict: str = "skip") -> list[MergeResult]:
        results = []
        for branch in branches:
            result = self.merge_back(branch, target_branch)
            results.append(result)
            if not result.success and on_conflict == "stop":
                break
        return results

    def cleanup_branch(self, branch_name: str):
        repo = Repo(self.repo_path)
        try:
            repo.git.branch("-D", branch_name)
        except git.GitCommandError:
            pass

    def branch_exists(self, branch_name: str) -> bool:
        repo = Repo(self.repo_path)
        try:
            repo.git.rev_parse("--verify", branch_name)
            return True
        except git.GitCommandError:
            return False

    def apply_diff_to_branch(self, branch_name: str, diff_text: str) -> str | None:
        """将 diff 应用到指定分支并提交，返回新 commit hash。"""
        if not diff_text.strip():
            return None
        if not branch_name:
            return None

        repo = Repo(self.repo_path)
        try:
            current = repo.active_branch.name
        except TypeError:
            current = None

        try:
            if not self._branch_exists(branch_name):
                return None
            repo.git.checkout(branch_name)

            # P1-1: 使用 git apply 直接应用 diff
            try:
                repo.git.apply("--allow-empty", "--reject", _in=diff_text)
                repo.git.add("-A")
                if repo.index.diff("HEAD") or repo.index.diff("--cached"):
                    commit_sha = repo.index.commit("apply aider worker diff").hexsha
                    return commit_sha
                else:
                    return repo.head.commit.hexsha
            except git.GitCommandError as e:
                # Fallback: 解析 diff 并直接写文件
                return self._apply_diff_fallback(repo, diff_text, branch_name)
        finally:
            if current is not None:
                try:
                    repo.git.checkout(current)
                except git.GitCommandError:
                    pass

    def _apply_diff_fallback(self, repo: Repo, diff_text: str,
                              branch_name: str) -> str | None:
        """git apply 失败时通过文本解析直接写文件。"""
        import re
        
        current_files = []
        current_content = []
        writing = False
        in_hunk = False
        current_file = None
        
        for line in diff_text.split("\n"):
            m = re.match(r'^\+\+\+\s+b/(.+)', line)
            if m:
                if writing and current_file:
                    fpath = os.path.join(self.repo_path, current_file)
                    os.makedirs(os.path.dirname(fpath), exist_ok=True)
                    content = "\n".join(current_content)
                    with open(fpath, "w", encoding="utf-8") as f:
                        f.write(content)
                
                current_file = m.group(1).strip()
                current_content = []
                writing = True
                in_hunk = False
                continue

            if not writing or not current_file:
                continue

            if line.startswith("@@"):
                in_hunk = True
                continue

            if line.startswith("--- ") or line.startswith("diff --git") or \
               line.startswith("index ") or line.startswith("new file") or \
               line.startswith("deleted file"):
                continue

            if in_hunk:
                if line.startswith("+"):
                    current_content.append(line[1:])
                elif line.startswith("-"):
                    pass
                else:
                    current_content.append(line)

        if writing and current_file:
            fpath = os.path.join(self.repo_path, current_file)
            os.makedirs(os.path.dirname(fpath), exist_ok=True)
            content = "\n".join(current_content)
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)

        if current_file:
            repo.git.add("-A")
            if repo.index.diff("HEAD") or repo.index.diff("--cached"):
                sha = repo.index.commit("apply aider worker diff (fallback)").hexsha
                return sha
            else:
                return repo.head.commit.hexsha
        return None

    def _detect_conflicts(self, repo: Repo) -> list[str]:
        try:
            output = repo.git.diff("--name-only", "--diff-filter=U")
            if output.strip():
                return [f.strip() for f in output.strip().split("\n") if f.strip()]
        except git.GitCommandError:
            pass
        return []
