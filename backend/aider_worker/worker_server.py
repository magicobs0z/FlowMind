import time
from concurrent import futures
import grpc

from .gen import worker_pb2
from .gen import worker_pb2_grpc
from .contract import Contract
from .worker import AiderWorker

__version__ = "0.1.0"


class AiderWorkerService(worker_pb2_grpc.AiderWorkerServicer):
    """gRPC 服务实现 — 常驻进程，每次 Execute 创建独立 AiderWorker 实例。"""

    def __init__(self):
        self._start_time = time.time()

    def Execute(self, request, context):
        contract = Contract(
            model_name=request.model_name,
            api_key_env_var=request.api_key_env_var,
            instruction=request.instruction,
            system_prompt_extra=request.system_prompt_extra,
            repo_url=request.repo_url,
            base_commit=request.base_commit,
            files=list(request.files),
            read_only_files=list(request.read_only_files),
            clone_depth=request.clone_depth,
            auto_lint=request.auto_lint,
            lint_command=request.lint_command,
            auto_test=request.auto_test,
            test_command=request.test_command,
            max_reflections=request.max_reflections,
            dry_run=request.dry_run,
            timeout_seconds=request.timeout_seconds,
        )

        worker = AiderWorker()
        result = worker.execute(contract)

        file_edits = []
        for fe in result.get("file_edits", []):
            file_edits.append(
                worker_pb2.FileEdit(
                    path=fe.get("path", ""),
                    diff=fe.get("diff", ""),
                    success=fe.get("change_type") is not None,
                    error="",
                )
            )

        cost = result.get("cost", {})
        return worker_pb2.Result(
            success=result["success"],
            error_message=result.get("error_message", ""),
            head_commit=result.get("head_commit", ""),
            base_commit=result.get("base_commit", ""),
            full_diff=result.get("full_diff", ""),
            file_edits=file_edits,
            cost=worker_pb2.CostBreakdown(
                total_cost_usd=cost.get("total_cost_usd", 0),
                prompt_tokens=cost.get("prompt_tokens", 0),
                completion_tokens=cost.get("completion_tokens", 0),
                cache_write_tokens=cost.get("cache_write_tokens", 0),
                cache_hit_tokens=cost.get("cache_hit_tokens", 0),
            ),
            session_cost_usd=result.get("session_cost_usd", 0),
            total_tokens_sent=result.get("total_tokens_sent", 0),
            total_tokens_received=result.get("total_tokens_received", 0),
            lint_output=result.get("lint_output", ""),
            test_output=result.get("test_output", ""),
            lint_passed=result.get("lint_passed", True),
            test_passed=result.get("test_passed", True),
        )

    def HealthCheck(self, request, context):
        return worker_pb2.HealthResponse(
            healthy=True,
            version=__version__,
            uptime_seconds=int(time.time() - self._start_time),
        )
