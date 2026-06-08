import os
import shutil
import tempfile
from pathlib import Path

try:
    import git
except ImportError:
    git = None


class Sandbox:
    """工作目录沙箱：git clone → work → collect → cleanup"""

    def __init__(self, repo_url: str, base_commit: str = None,
                 clone_depth: int = 1, repo_path: str = ""):
        self.repo_url = repo_url
        self.base_commit = base_commit
        self.clone_depth = max(1, clone_depth)
        self.repo_path = repo_path
        self.temp_dir = None
        self.repo = None
        self._original_cwd = None

    def prepare(self) -> str:
        self.temp_dir = tempfile.mkdtemp(prefix="aider_worker_")

        if self.repo_url:
            # 远程克隆
            self.repo = git.Repo.clone_from(
                self.repo_url,
                self.temp_dir,
                depth=self.clone_depth,
            )
        elif self.repo_path and os.path.isdir(self.repo_path):
            # 本地仓库 → 复制到临时目录
            shutil.copytree(self.repo_path, self.temp_dir, dirs_exist_ok=True)
            self.repo = git.Repo(self.temp_dir)
        else:
            # 全新仓库
            self.repo = git.Repo.init(self.temp_dir)
            readme = os.path.join(self.temp_dir, "README.md")
            with open(readme, "w") as f:
                f.write("# FlowMind Generated Project\n")
            self.repo.index.add(["README.md"])
            self.repo.index.commit("initial commit")

        if self.base_commit:
            self.repo.git.checkout(self.base_commit)

        self.repo.git.config("user.name", "aider-worker")
        self.repo.git.config("user.email", "worker@aider.local")

        self._original_cwd = Path.cwd()
        os.chdir(self.temp_dir)

        return self.temp_dir

    def collect_result(self) -> dict:
        if not self.repo:
            return {}

        head_sha = self.repo.head.commit.hexsha

        diff_base = self.base_commit
        if not diff_base:
            try:
                parent = self.repo.head.commit.parents[0]
                diff_base = parent.hexsha
            except (IndexError, ValueError):
                diff_base = "HEAD"

        diff_text = self.repo.git.diff(diff_base, "HEAD")

        if not diff_text and self.repo.is_dirty():
            diff_text = self.repo.git.diff()
            staged = self.repo.git.diff("--staged")
            if staged:
                if diff_text:
                    diff_text += "\n" + staged
                else:
                    diff_text = staged

        file_edits = []
        if diff_text:
            try:
                for diff_item in self.repo.head.commit.diff(
                        diff_base, create_patch=True
                ):
                    raw = diff_item.diff
                    diff_str = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw) if raw else ""
                    file_edits.append({
                        "path": diff_item.b_path or diff_item.a_path,
                        "diff": diff_str,
                        "change_type": diff_item.change_type,
                    })
            except Exception:
                pass

        if not file_edits and diff_text and self.repo.is_dirty():
            for f in self.repo.untracked_files:
                file_edits.append({
                    "path": f,
                    "diff": f"--- /dev/null\n+++ b/{f}\n@@ -0,0 +1 @@\n+[new file]",
                    "change_type": "A",
                })
            for item in self.repo.index.diff(None):
                raw = item.diff
                diff_str = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw) if raw else ""
                file_edits.append({
                    "path": item.b_path or item.a_path,
                    "diff": diff_str,
                    "change_type": item.change_type,
                })

        return {
            "head_commit": head_sha,
            "base_commit": diff_base,
            "full_diff": diff_text,
            "file_edits": file_edits,
        }

    def cleanup(self):
        if self._original_cwd:
            try:
                os.chdir(self._original_cwd)
            except OSError:
                pass
            self._original_cwd = None

        if self.temp_dir:
            def _on_rm_error(func, path, exc_info):
                try:
                    os.chmod(path, 0o777)
                    func(path)
                except OSError:
                    pass

            shutil.rmtree(self.temp_dir, ignore_errors=True, onerror=_on_rm_error)
            self.temp_dir = None
            self.repo = None
