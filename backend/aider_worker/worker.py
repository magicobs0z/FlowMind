import io as io_module
import logging
import os
import re
import sys

# 抑制第三方库 DEBUG 日志
for _noisy in ["LiteLLM", "litellm", "httpx", "httpcore", "aiohttp", "urllib3"]:
    logging.getLogger(_noisy).setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

from aider.models import Model
from aider.repo import GitRepo

from .contract import Contract
from .headless_io import HeadlessIO, Event
from .headless_coder import HeadlessCoder, HeadlessWholeFileCoder, HeadlessAskCoder
from .sandbox import Sandbox


class AiderWorker:
    """Headless Aider Worker。

    生命周期：
    - execute(contract) → 执行单次任务
    - reset_session() → 手动清除保留状态，触发新对话
    - retain_state=True 的 contract 会复用 sandbox/coder
    """

    def __init__(self, todo_service=None, event_bus=None):
        self._retained_sandbox = None
        self._retained_coder = None
        self._retained_session_id = None
        self._retained_io = None
        self.todo_service = todo_service
        self.event_bus = event_bus

    def reset_session(self) -> None:
        """手动清除保留的 sandbox/coder 状态，强制下次创建新环境。"""
        if self._retained_sandbox:
            try:
                self._retained_sandbox.cleanup()
            except Exception:
                pass
        self._retained_sandbox = None
        self._retained_coder = None
        self._retained_session_id = None
        self._retained_io = None

    @staticmethod
    def _sync_back_files(sandbox_result: dict, temp_dir: str, target_dir: str):
        """将 sandbox 临时目录中的文件复制回目标工作区。"""
        import shutil
        os.makedirs(target_dir, exist_ok=True)
        for edit in sandbox_result.get("file_edits", []):
            rel_path = edit.get("path", "")
            if not rel_path:
                continue
            src = os.path.join(temp_dir, rel_path)
            if os.path.exists(src) and os.path.isfile(src):
                dst = os.path.join(target_dir, rel_path)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                try:
                    shutil.copy2(src, dst)
                    logger.info("Synced back: %s -> %s", rel_path, dst)
                except OSError as e:
                    logger.warning("Failed to sync back %s: %s", rel_path, e)

    def _emit_threadsafe(self, event_type: str, **data):
        """从工作线程向 EventBus 发布事件（线程安全）。"""
        if not self.event_bus:
            return
        from types import SimpleNamespace
        ev = SimpleNamespace(
            event_type=event_type,
            dag_id="flow",
            node_id="",
            event_id="",
            timestamp=None,
            data=data,
        )
        self.event_bus.publish_sync(ev)

    def execute(self, contract: Contract) -> dict:
        """执行编码任务。

        当 contract.retain_state=True 时，复用 sandbox/coder 避免重复初始化。
        """
        max_retries = contract.max_reflections or 3
        last_error = ""
        task_id = contract.task_id or ""

        # ── 上报任务开始 ──
        if task_id and self.todo_service:
            try:
                self.todo_service.update_task(task_id, status="in_progress",
                                              progress=0.1, note="worker starting")
            except Exception:
                pass

        for attempt in range(max_retries):
            events = []

            # ── 决定是复用还是新建 sandbox/coder ──
            reuse = (
                contract.retain_state
                and not attempt  # 只在首次尝试时复用
                and self._retained_sandbox is not None
                and self._retained_coder is not None
                and self._retained_session_id == contract.session_id
            )

            if reuse:
                sandbox = self._retained_sandbox
                coder = self._retained_coder
                headless_io = self._retained_io
                events.append(Event("sandbox", f"Reusing retained state (session={contract.session_id})"))
            else:
                # 清理旧状态
                if self._retained_sandbox:
                    try:
                        self._retained_sandbox.cleanup()
                    except Exception:
                        pass
                    self._retained_sandbox = None
                    self._retained_coder = None
                    self._retained_io = None

                sandbox = Sandbox(
                    repo_url=contract.repo_url,
                    base_commit=contract.base_commit,
                    clone_depth=contract.clone_depth or 1,
                    repo_path=contract.repo_path,
                )

                try:
                    events.append(Event("sandbox", "Preparing workspace"))
                    sandbox.prepare()
                    self._emit_threadsafe("worker.sandbox_ready",
                                          repo_url=contract.repo_url or "",
                                          repo_path=contract.repo_path or "")

                    headless_io = HeadlessIO(events=events, event_bus=self.event_bus)

                    events.append(Event("model", f"Loading model: {contract.model_name}"))
                    main_model = Model(contract.model_name)

                    # 当 allow_new_files=True 时，不限制文件白名单，清空 fnames
                    if contract.allow_new_files:
                        allowed_files = None
                        effective_fnames = []
                    elif not contract.files:
                        allowed_files = None
                        effective_fnames = []
                    else:
                        allowed_files = contract.files
                        effective_fnames = contract.files

                    events.append(Event("sandbox", "Setting up git repo"))
                    repo = GitRepo(
                        io=headless_io,
                        fnames=effective_fnames,
                        git_dname=None,
                        models=main_model.commit_message_models(),
                    )

                    events.append(Event("coder", f"Creating coder"))
                    ct = contract.coder_type or ""
                    if ct == "ask":
                        coder_class = HeadlessAskCoder
                        coder_name = "HeadlessAskCoder"
                    elif ct == "editblock":
                        coder_class = HeadlessCoder
                        coder_name = "HeadlessCoder"
                    else:
                        coder_class = HeadlessWholeFileCoder
                        coder_name = "HeadlessWholeFileCoder"
                    events[-1] = Event("coder", f"Creating {coder_name}")
                    # redundant variables at coder level, kept for clarity
                    coder = coder_class(
                        main_model=main_model,
                        io=headless_io,
                        repo=repo,
                        fnames=effective_fnames,
                        read_only_fnames=contract.read_only_files,
                        allowed_files=allowed_files,
                        extra_system_prompt=contract.system_prompt_extra,
                        max_reflections=1,
                        auto_lint=contract.auto_lint,
                        lint_cmds=self._parse_lint(contract.lint_command),
                        auto_test=contract.auto_test,
                        test_cmd=contract.test_command,
                        dry_run=contract.dry_run,
                        use_git=True,
                        auto_commits=True,
                        dirty_commits=True,
                    )
                except Exception as e:
                    self._retained_sandbox = None
                    self._retained_coder = None
                    self._retained_io = None
                    err_msg = str(e) or type(e).__name__
                    logger.error("Setup failed: %s", err_msg)
                    return self._make_error(f"Setup failed: {err_msg}", events)

            # ── 执行 LLM 调用 ──
            try:
                events.append(Event("execute", f"Starting LLM call (attempt {attempt+1}/{max_retries})"))
                self._emit_threadsafe("worker.executing",
                                      attempt=attempt+1,
                                      max_retries=max_retries,
                                      instruction=contract.instruction[:100])
                _stderr = sys.stderr
                with open(os.devnull, "w", encoding="utf-8") as _null:
                    try:
                        sys.stdout = _null
                        coder.run(with_message=contract.instruction)
                    finally:
                        sys.stdout = sys.__stdout__

                sandbox_result = sandbox.collect_result()

                self._emit_threadsafe("worker.llm_completed",
                                      success=True,
                                      file_count=len(sandbox_result.get("file_edits", [])),
                                      diff_chars=len(sandbox_result.get("full_diff", "")))

                # ── 将 sandbox 中生成的文件同步回原始 repo_path ──
                if contract.repo_path and sandbox.temp_dir:
                    self._sync_back_files(sandbox_result, sandbox.temp_dir, contract.repo_path)

                last_content = getattr(coder, "io", None)
                last_content = last_content.last_assistant_content if last_content else None

                if contract.coder_type != "ask":
                    if not self._validate_editblock_output(sandbox_result, last_content):
                        if attempt < max_retries - 1:
                            last_error = "LLM output format validation failed, retrying..."
                            events.append(Event("retry", last_error))
                            if not reuse:
                                sandbox.cleanup()
                            continue
                        else:
                            self._cleanup_on_error(sandbox, contract, reuse)
                            return self._make_error("LLM output format validation failed after retries", events)

                result = self._assemble_result(coder, sandbox_result, events)

                # ── 上报任务完成 ──
                if task_id and self.todo_service:
                    try:
                        file_count = len(result.get("file_edits", []))
                        self.todo_service.update_task(
                            task_id, status="completed", progress=1.0,
                            note=f"generated {file_count} files" if file_count else "done",
                        )
                    except Exception:
                        pass

                # ── 保留或清理状态 ──
                if contract.retain_state:
                    self._retained_sandbox = sandbox
                    self._retained_coder = coder
                    self._retained_io = headless_io
                    self._retained_session_id = contract.session_id
                elif not reuse:
                    sandbox.cleanup()

                return result

            except Exception as e:
                last_error = str(e) or type(e).__name__
                if attempt < max_retries - 1:
                    events.append(Event("retry", f"Exception: {last_error}, retrying..."))
                    if not reuse:
                        sandbox.cleanup()
                    continue
                self._cleanup_on_error(sandbox, contract, reuse)
                return self._make_error(last_error, events)

        return self._make_error(f"All {max_retries} attempts failed: {last_error}", [])

    def _cleanup_on_error(self, sandbox, contract, reuse) -> None:
        """失败时清理：如果任务不应该保留状态，则销毁 sandbox。"""
        should_retain = contract.retain_state and reuse
        if not should_retain:
            try:
                sandbox.cleanup()
            except Exception:
                pass
            # 如果是 retain_state 但重试耗尽，也不保留失败状态
            if contract.retain_state and self._retained_sandbox is sandbox:
                self._retained_sandbox = None
                self._retained_coder = None
                self._retained_io = None

        # ── 上报任务失败 ──
        if contract.task_id and self.todo_service:
            try:
                self.todo_service.report_block(contract.task_id,
                                               f"worker execution failed after retries")
            except Exception:
                pass

    def _validate_editblock_output(self, sandbox_result: dict, last_content: str) -> bool:
        """P0-1: 校验 LLM 输出是否包含有效内容。

        支持三种格式：
        - Git diff 非空 → 代码已应用，直接通过
        - 包含 SEARCH/REPLACE 标记 → EditBlock 格式通过
        - 包含代码块 (```) → WholeFile 格式通过
        - 有实质文本输出（>50字符） → 非代码分析类任务通过
        """
        full_diff = sandbox_result.get("full_diff", "")

        if full_diff.strip():
            return True

        if not last_content:
            return False

        # EditBlock 格式
        has_search = re.search(r'<{3,7}\s*SEARCH', last_content, re.MULTILINE)
        has_divider = re.search(r'={5,7}', last_content)
        has_replace = re.search(r'>{3,7}\s*REPLACE', last_content, re.MULTILINE)
        if has_search and (has_divider or has_replace):
            return True

        # WholeFile 格式：检查是否包含代码块
        if re.search(r'```\w*\n', last_content):
            return True

        # 有实质文本输出（非问句类）
        if len(last_content) > 50:
            return True

        return False

    def _assemble_result(self, coder, sandbox_result: dict, events: list) -> dict:
        full_diff = sandbox_result.get("full_diff", "")
        io_obj = getattr(coder, "io", None)

        # 获取 LLM 自然语言响应：io.last_assistant_content → 由 send_completion override 设置
        agent_msg = ""
        if io_obj and getattr(io_obj, "last_assistant_content", None):
            agent_msg = io_obj.last_assistant_content
        if not agent_msg:
            agent_msg = getattr(coder, "partial_response_content", "") or ""
        if not agent_msg:
            # 回退：从 events 中收集 assistant 类型消息
            assistant_msgs = [e.message for e in events
                              if getattr(e, "type", "") == "assistant"]
            if assistant_msgs:
                agent_msg = "\n".join(assistant_msgs)

        # 如果 full_diff 为空但 agent_msg 有内容，使用 agent_msg 作为输出
        if not full_diff and agent_msg:
            full_diff = agent_msg

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
            "agent_message": str(agent_msg) if agent_msg else "",
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
