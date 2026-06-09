import asyncio
import logging
import os
import subprocess

from .models import TaskInstance, VerificationResult

logger = logging.getLogger(__name__)

class Verifier:
    def verify(self, task: TaskInstance, repo_path: str) -> VerificationResult:
        results = []

        auto_lint = task.contract.get("auto_lint", False)
        lint_cmd = task.contract.get("lint_command", "")
        if auto_lint and lint_cmd:
            ok, out = self._run_command(lint_cmd, cwd=repo_path)
            results.append({
                "type": "lint", "passed": ok, "output": out[:500],
            })
            logger.info("lint %s for %s: %s",
                        "passed" if ok else "failed", task.node_id, out[:200])

        auto_test = task.contract.get("auto_test", False)
        test_cmd = task.contract.get("test_command", "")
        if auto_test and test_cmd:
            ok, out = self._run_command(test_cmd, cwd=repo_path, shell=True)
            results.append({
                "type": "test", "passed": ok, "output": out[:500],
            })
            logger.info("test %s for %s: %s",
                        "passed" if ok else "failed", task.node_id, out[:200])

        return VerificationResult(
            passed=all(r["passed"] for r in results),
            checks=results,
        )

    def _run_command(self, cmd, cwd=None, shell=False, timeout=60) -> tuple[bool, str]:
        try:
            subprocess.run(
                cmd if shell else cmd.split(),
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
                shell=shell,
                check=True,
            )
            return True, ""
        except subprocess.CalledProcessError as e:
            return False, e.stdout or e.stderr or str(e)
        except subprocess.TimeoutExpired as e:
            return False, f"command timed out after {timeout}s"
        except FileNotFoundError:
            return False, f"command not found: {cmd}"
        except Exception as e:
            return False, str(e)


class RetryController:
    """决定是否重试、如何重试。超时每次递增 50%。"""

    def should_retry(self, task: TaskInstance) -> bool:
        return (
            task.status.value in ("verifying", "retrying", "failed")
            and task.retry_count < task.max_retries
        )

    def should_ask_pm(self, task: TaskInstance) -> bool:
        """retry_count ≥ max_retries 后交由 PM 决策。"""
        return task.retry_count >= task.max_retries

    def select_timeout(self, task: TaskInstance) -> int:
        """每次重试增加 50% 超时时间，上限 300s。"""
        base_timeout = task.contract.get("timeout_seconds", 120)
        escalated = int(base_timeout * (1.5 ** task.retry_count))
        return min(escalated, 300)

    def plan_retry(self, task: TaskInstance,
                   verification: VerificationResult) -> dict:
        error_detail = "; ".join(
            c["output"][:200]
            for c in verification.checks if not c["passed"]
        )
        timeout = self.select_timeout(task)

        enriched_instruction = (
            f"{task.contract.get('instruction', '')}\n\n"
            f"[校验反馈 - 第 {task.retry_count + 1} 次重试]\n"
            f"以下检查未通过：{error_detail}\n\n"
            f"请修正这些问题。"
        )

        return {
            "action": "rollback_and_retry",
            "rollback_to": task.contract.get("base_commit", ""),
            "updated_instruction": enriched_instruction,
            "timeout_seconds": timeout,
        }
