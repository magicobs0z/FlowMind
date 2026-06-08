import asyncio
import logging
import time

import grpc

from .models import AgentContract, TokenUsage

logger = logging.getLogger(__name__)


class WorkerPoolExhausted(Exception):
    pass


class WorkerHandle:
    def __init__(self, worker_id: str, channel: grpc.aio.Channel,
                 host: str = "localhost", port: int = 50051):
        self.worker_id = worker_id
        self.channel = channel
        self.host = host
        self.port = port
        self.busy = False
        self.last_used = 0.0


class WorkerPool:
    def __init__(self, max_workers: int = 4,
                 worker_host: str = "localhost",
                 base_port: int = 50051):
        self.max_workers = max_workers
        self.worker_host = worker_host
        self.base_port = base_port
        self._workers: dict[str, WorkerHandle] = {}
        self._lock = asyncio.Lock()

    async def acquire(self, contract: AgentContract,
                      timeout: float = 30) -> WorkerHandle:
        deadline = time.monotonic() + timeout
        while True:
            async with self._lock:
                for w in self._workers.values():
                    if not w.busy:
                        w.busy = True
                        w.last_used = time.time()
                        return w
                if len(self._workers) < self.max_workers:
                    wid = f"w-{len(self._workers) + 1}"
                    port = self.base_port + len(self._workers)
                    channel = grpc.aio.insecure_channel(
                        f"{self.worker_host}:{port}"
                    )
                    handle = WorkerHandle(wid, channel, self.worker_host, port)
                    handle.busy = True
                    handle.last_used = time.time()
                    self._workers[wid] = handle
                    return handle

            if time.monotonic() >= deadline:
                raise WorkerPoolExhausted(
                    f"no available worker after {timeout}s"
                )
            await asyncio.sleep(0.5)

    async def release(self, worker_id: str):
        async with self._lock:
            w = self._workers.get(worker_id)
            if w:
                w.busy = False

    async def dispatch(self, handle: WorkerHandle,
                       contract: AgentContract) -> dict:
        from aider_worker.gen import worker_pb2, worker_pb2_grpc

        stub = worker_pb2_grpc.AiderWorkerStub(handle.channel)

        pb_contract = worker_pb2.Contract(
            model_name=contract.model_name,
            instruction=contract.instruction,
            system_prompt_extra=contract.system_prompt_extra,
            repo_url=contract.repo_url,
            base_commit=contract.base_commit,
            files=contract.output_files,
            read_only_files=contract.context_files,
            auto_lint=contract.auto_lint,
            lint_command=contract.lint_command,
            auto_test=contract.auto_test,
            test_command=contract.test_command,
            max_reflections=contract.max_reflections,
            timeout_seconds=contract.timeout_seconds,
            extra_params={
                "allowed_operations": ",".join(contract.permissions.allowed_operations),
                "allow_new_files": str(contract.permissions.allow_new_files).lower(),
                "allow_shell_commands": str(contract.permissions.allow_shell_commands).lower(),
                "allowed_shell_patterns": ",".join(contract.permissions.allowed_shell_patterns),
            },
        )

        try:
            result = await stub.Execute(pb_contract, timeout=contract.timeout_seconds + 10)
            return self._parse_grpc_result(result)
        except grpc.RpcError as e:
            return {
                "success": False,
                "error_message": f"gRPC error: {e.code()}: {e.details()}",
                "head_commit": "",
                "base_commit": "",
                "file_edits": [],
                "full_diff": "",
            }

    async def health_check(self, handle: WorkerHandle) -> bool:
        from aider_worker.gen import worker_pb2, worker_pb2_grpc
        try:
            stub = worker_pb2_grpc.AiderWorkerStub(handle.channel)
            resp = await stub.HealthCheck(worker_pb2.HealthRequest(), timeout=5)
            return resp.healthy
        except Exception:
            return False

    async def check_all(self):
        results = {}
        async with self._lock:
            for wid, handle in list(self._workers.items()):
                try:
                    healthy = await self.health_check(handle)
                    results[wid] = healthy
                except Exception:
                    results[wid] = False
        return results

    async def close_all(self):
        async with self._lock:
            for w in self._workers.values():
                try:
                    await w.channel.close()
                except Exception:
                    pass
            self._workers.clear()

    def _parse_grpc_result(self, pb_result) -> dict:
        cost = pb_result.cost
        return {
            "success": pb_result.success,
            "error_message": pb_result.error_message,
            "head_commit": pb_result.head_commit,
            "base_commit": pb_result.base_commit,
            "full_diff": pb_result.full_diff,
            "file_edits": [
                {"path": fe.path, "diff": fe.diff, "success": fe.success}
                for fe in pb_result.file_edits
            ],
            "cost": {
                "total_cost_usd": cost.total_cost_usd,
                "prompt_tokens": cost.prompt_tokens,
                "completion_tokens": cost.completion_tokens,
                "cache_write_tokens": cost.cache_write_tokens,
                "cache_hit_tokens": cost.cache_hit_tokens,
            },
            "session_cost_usd": pb_result.session_cost_usd,
            "total_tokens_sent": pb_result.total_tokens_sent,
            "total_tokens_received": pb_result.total_tokens_received,
            "lint_output": pb_result.lint_output,
            "test_output": pb_result.test_output,
            "lint_passed": pb_result.lint_passed,
            "test_passed": pb_result.test_passed,
        }
