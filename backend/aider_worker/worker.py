import os

from aider.models import Model
from aider.repo import GitRepo

from .contract import Contract
from .headless_io import HeadlessIO, Event
from .headless_coder import HeadlessCoder
from .sandbox import Sandbox


class AiderWorker:
    """编码 Worker — 每个实例只执行一次 Execute。"""

    def execute(self, contract: Contract) -> dict:
        events = []
        sandbox = Sandbox(
            repo_url=contract.repo_url,
            base_commit=contract.base_commit,
            clone_depth=contract.clone_depth or 1,
            repo_path=contract.repo_path,
        )

        try:
            events.append(Event("sandbox", "Preparing workspace"))
            sandbox.prepare()

            headless_io = HeadlessIO(events=events)

            events.append(Event("model", f"Loading model: {contract.model_name}"))
            main_model = Model(contract.model_name)

            events.append(Event("sandbox", "Setting up git repo"))
            repo = GitRepo(
                io=headless_io,
                fnames=contract.files,
                git_dname=None,
                models=main_model.commit_message_models(),
            )

            events.append(Event("coder", "Creating HeadlessCoder"))
            # 当 allow_new_files=True 且 files 为空时，不限制文件白名单
            if contract.allow_new_files and not contract.files:
                allowed_files = None
            else:
                allowed_files = contract.files
            coder = HeadlessCoder(
                main_model=main_model,
                io=headless_io,
                repo=repo,
                fnames=contract.files,
                read_only_fnames=contract.read_only_files,
                allowed_files=allowed_files,
                extra_system_prompt=contract.system_prompt_extra,
                max_reflections=contract.max_reflections or 3,
                auto_lint=contract.auto_lint,
                lint_cmds=self._parse_lint(contract.lint_command),
                auto_test=contract.auto_test,
                test_cmd=contract.test_command,
                dry_run=contract.dry_run,
                use_git=True,
                auto_commits=True,
                dirty_commits=True,
            )

            events.append(Event("execute", "Starting LLM call"))
            coder.run(with_message=contract.instruction)

            sandbox_result = sandbox.collect_result()

            result = self._assemble_result(coder, sandbox_result, events)
            return result

        except Exception as e:
            return self._make_error(str(e), events)

        finally:
            sandbox.cleanup()

    def _assemble_result(self, coder, sandbox_result: dict, events: list) -> dict:
        full_diff = sandbox_result.get("full_diff", "")
        last_content = getattr(coder, "io", None)
        last_content = last_content.last_assistant_content if last_content else None
        return {
            "success": True,
            "error_message": "",
            "head_commit": sandbox_result.get("head_commit", ""),
            "base_commit": sandbox_result.get("base_commit", ""),
            "file_edits": sandbox_result.get("file_edits", []),
            "full_diff": full_diff,
            "cost": {
                "total_cost_usd": getattr(coder, "total_cost", 0),
                "prompt_tokens": getattr(coder, "total_tokens_sent", 0),
                "completion_tokens": getattr(coder, "total_tokens_received", 0),
                "cache_write_tokens": 0,
                "cache_hit_tokens": 0,
            },
            "session_cost_usd": getattr(coder, "total_cost", 0),
            "total_tokens_sent": getattr(coder, "total_tokens_sent", 0),
            "total_tokens_received": getattr(coder, "total_tokens_received", 0),
            "lint_output": "",
            "test_output": "",
            "lint_passed": getattr(coder, "lint_outcome", None) or True,
            "test_passed": getattr(coder, "test_outcome", None) or True,
            "_events": [
                {"type": e.type, "message": e.message, "data": e.data}
                for e in events
            ],
            "_last_assistant": str(last_content)[:500] if last_content else "",
        }

    def _make_error(self, message: str, events: list) -> dict:
        return {
            "success": False,
            "error_message": message,
            "head_commit": "",
            "base_commit": "",
            "file_edits": [],
            "full_diff": "",
            "cost": {
                "total_cost_usd": 0, "prompt_tokens": 0, "completion_tokens": 0,
                "cache_write_tokens": 0, "cache_hit_tokens": 0,
            },
            "session_cost_usd": 0,
            "total_tokens_sent": 0,
            "total_tokens_received": 0,
            "lint_output": "",
            "test_output": "",
            "lint_passed": True,
            "test_passed": True,
            "_events": [
                {"type": e.type, "message": e.message, "data": e.data}
                for e in events
            ],
        }

    @staticmethod
    def _parse_lint(lint_command: str):
        if not lint_command:
            return None
        if ":" in lint_command and not lint_command.startswith("/"):
            pieces = lint_command.split(":", 1)
            return {pieces[0].strip(): pieces[1].strip()}
        return {None: lint_command}
