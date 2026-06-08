import logging
import subprocess
from pathlib import Path

from .models import TaskInstance

logger = logging.getLogger(__name__)

TEST_GENERATION_PROMPT = """你是一名软件测试工程师，被项目经理 Flow 临时调度执行此任务。

【核心原则 — 必须遵守】
- 不要过度自信——测试用例可能有遗漏
- 覆盖正常路径和边界情况
- 优先保证测试的准确性和可重复性
- 如果被测代码有歧义，主动索要澄清
- 使用 pytest 框架，测试文件命名为 test_*.py
- 回答时保持结构化输出

生成全面的 pytest 回归测试用例。
"""


class TesterAgent:
    def run_verification(self, task: TaskInstance, repo_path: str) -> dict:
        results = []
        auto_lint = task.contract.get("auto_lint", False)
        lint_cmd = task.contract.get("lint_command", "")
        if auto_lint and lint_cmd:
            ok, out = self._run_cmd(lint_cmd, cwd=repo_path)
            results.append({
                "type": "lint", "passed": ok, "output": out[:500],
            })
            logger.info("lint %s for %s", "passed" if ok else "failed", task.node_id)

        auto_test = task.contract.get("auto_test", False)
        test_cmd = task.contract.get("test_command", "")
        if auto_test and test_cmd:
            ok, out = self._run_cmd(test_cmd, cwd=repo_path, shell=True)
            results.append({
                "type": "test", "passed": ok, "output": out[:500],
            })
            logger.info("test %s for %s", "passed" if ok else "failed", task.node_id)

        passed = all(r["passed"] for r in results)
        return {"passed": passed, "checks": results}

    def generate_regression_tests(self, task: TaskInstance,
                                  repo_path: str,
                                  worker_pool=None) -> dict:
        files = task.contract.get("files", [])
        if not files or not worker_pool:
            return {"generated": False, "reason": "no files or worker pool"}

        existing_tests = self._find_existing_tests(repo_path, files)
        instruction = (
            f"为以下文件生成 pytest 回归测试用例：{files}\n"
            f"要求：\n"
            f"1. 覆盖正常路径和边缘情况\n"
            f"2. 使用 pytest 框架\n"
            f"3. 测试文件命名为 test_*.py\n"
        )
        if existing_tests:
            instruction += f"\n已有测试文件，请检查覆盖率并补充缺失用例：{existing_tests}"

        from .models import AgentContract, AgentRole
        from .contract_generator import ContractGenerator
        contract = AgentContract(
            contract_id=f"testgen_{task.task_id}",
            agent_role=AgentRole.TESTER,
            task_id=task.task_id,
            dag_id=task.dag_id,
            instruction=instruction,
            context_files=list(files),
            output_files=[],
            repo_url=task.contract.get("repo_url", ""),
            base_commit=task.contract.get("base_commit", ""),
            model_name="openai/GLM-4.7-Flash",
            max_reflections=2,
            timeout_seconds=120,
        )

        try:
            import asyncio
            cg = ContractGenerator()
            worker_ct = cg.build_worker_contract(contract)
            handle = None
            try:
                handle = asyncio.get_event_loop().run_until_complete(
                    worker_pool.acquire(contract, timeout=15)
                )
                result = asyncio.get_event_loop().run_until_complete(
                    worker_pool.dispatch(handle, contract)
                )
                if result.get("success"):
                    return {
                        "generated": True,
                        "diff": result.get("full_diff", ""),
                        "files": result.get("file_edits", []),
                        "tokens_sent": result.get("total_tokens_sent", 0),
                        "tokens_received": result.get("total_tokens_received", 0),
                    }
                return {"generated": False, "reason": result.get("error_message", "")}
            finally:
                if handle:
                    asyncio.get_event_loop().run_until_complete(
                        worker_pool.release(handle.worker_id)
                    )
        except Exception as e:
            logger.warning("test generation failed for %s: %s", task.node_id, e)
            return {"generated": False, "reason": str(e)}

    def _run_cmd(self, cmd, cwd=None, shell=False, timeout=60) -> tuple:
        try:
            subprocess.run(
                cmd if shell else cmd.split(),
                cwd=cwd, capture_output=True, text=True,
                timeout=timeout, shell=shell, check=True,
            )
            return True, ""
        except subprocess.CalledProcessError as e:
            return False, e.stdout or e.stderr or str(e)
        except subprocess.TimeoutExpired:
            return False, f"timeout after {timeout}s"
        except Exception as e:
            return False, str(e)

    def _find_existing_tests(self, repo_path: str, files: list[str]) -> list[str]:
        existing = []
        for f in files:
            base = Path(f).stem
            test_files = list(Path(repo_path).glob(f"test_{base}.py"))
            test_files += list(Path(repo_path).glob(f"{base}_test.py"))
            existing.extend(str(t) for t in test_files)
        return existing
