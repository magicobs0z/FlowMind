"""压力测试框架 — 验证系统高并发下的稳定性。

测试场景：
1. 大量 DAG 并发提交
2. Worker 池耗尽
3. 事件堆积
4. 重试风暴
5. 分支爆炸
"""
import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import List, Optional, Callable

logger = logging.getLogger(__name__)


@dataclass
class StressTestResult:
    """压力测试结果。"""
    test_name: str = ""
    total_requests: int = 0
    success: int = 0
    failed: int = 0
    timeout: int = 0
    duration_seconds: float = 0.0
    avg_latency_ms: float = 0.0
    p50_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    errors: List[str] = field(default_factory=list)
    passed: bool = False


class CircuitBreaker:
    """熔断器 — 保护下游服务不被雪崩。"""

    def __init__(self, name: str, failure_threshold: int = 5,
                 recovery_timeout: float = 30.0):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.state = "closed"  # closed | open | half-open
        self.failure_count = 0
        self.last_failure_time = 0.0

    async def call(self, fn: Callable, *args, **kwargs):
        if self.state == "open":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "half-open"
                logger.info("Circuit %s: half-open", self.name)
            else:
                raise RuntimeError(f"Circuit {self.name} is open")

        try:
            result = await fn(*args, **kwargs) if asyncio.iscoroutinefunction(fn) else fn(*args, **kwargs)
            if self.state == "half-open":
                self.state = "closed"
                self.failure_count = 0
                logger.info("Circuit %s: closed", self.name)
            else:
                self.failure_count = 0
            return result
        except Exception:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "open"
                logger.warning("Circuit %s: opened after %d failures",
                               self.name, self.failure_count)
            raise


class StressTestRunner:
    """压力测试执行器。"""

    def __init__(self, concurrency: int = 10, timeout: float = 60.0):
        self.concurrency = concurrency
        self.timeout = timeout
        self._sem: Optional[asyncio.Semaphore] = None
        self._circuit_breaker = CircuitBreaker("stress_test")

    async def run(self, test_name: str, task_fn: Callable,
                  task_args_list: List[tuple] = None,
                  total_requests: int = 100) -> StressTestResult:
        """执行压力测试。

        Args:
            test_name: 测试名称
            task_fn: 异步任务函数
            task_args_list: 任务参数列表（None 则自动生成空参数）
            total_requests: 总请求数
        """
        self._sem = asyncio.Semaphore(self.concurrency)
        result = StressTestResult(test_name=test_name, total_requests=total_requests)

        if task_args_list is None:
            task_args_list = [()] * total_requests

        start = time.time()
        latencies: List[float] = []

        async def worker(args):
            async with self._sem:
                t0 = time.time()
                try:
                    await asyncio.wait_for(
                        self._circuit_breaker.call(task_fn, *args),
                        timeout=self.timeout,
                    )
                    result.success += 1
                    latencies.append((time.time() - t0) * 1000)
                except asyncio.TimeoutError:
                    result.timeout += 1
                except Exception as e:
                    result.failed += 1
                    result.errors.append(str(e)[:200])

        tasks = [worker(args) for args in task_args_list]
        await asyncio.gather(*tasks, return_exceptions=True)

        result.duration_seconds = time.time() - start

        if latencies:
            latencies.sort()
            result.avg_latency_ms = sum(latencies) / len(latencies)
            result.max_latency_ms = max(latencies)
            result.p50_latency_ms = latencies[len(latencies) // 2]
            result.p95_latency_ms = latencies[int(len(latencies) * 0.95)]
            result.p99_latency_ms = latencies[int(len(latencies) * 0.99)]

        # 判定通过：成功率 > 95%
        result.passed = (result.success / total_requests) >= 0.95
        return result

    @staticmethod
    def print_report(result: StressTestResult):
        """打印测试报告。"""
        print(f"\n{'='*60}")
        print(f"  Stress Test: {result.test_name}")
        print(f"{'='*60}")
        print(f"  Total:     {result.total_requests}")
        print(f"  Success:   {result.success} ({result.success/max(1,result.total_requests)*100:.1f}%)")
        print(f"  Failed:    {result.failed}")
        print(f"  Timeout:   {result.timeout}")
        print(f"  Duration:  {result.duration_seconds:.2f}s")
        print(f"  Latency:")
        print(f"    avg:     {result.avg_latency_ms:.1f}ms")
        print(f"    p50:     {result.p50_latency_ms:.1f}ms")
        print(f"    p95:     {result.p95_latency_ms:.1f}ms")
        print(f"    p99:     {result.p99_latency_ms:.1f}ms")
        print(f"    max:     {result.max_latency_ms:.1f}ms")
        print(f"  PASSED:    {result.passed}")
        if result.errors:
            print(f"  Errors ({len(result.errors)}):")
            for e in result.errors[:5]:
                print(f"    - {e}")
        print(f"{'='*60}\n")


# ── 预定义测试场景 ─────────────────────────────────────


async def stress_test_concurrent_dag_submit(
    scheduler, total: int = 50, concurrency: int = 10
) -> StressTestResult:
    """并发 DAG 提交压力测试。"""
    from .models import TaskDAG, TaskNode, NodeType

    def make_dag(i: int) -> TaskDAG:
        return TaskDAG(
            dag_id=f"stress_{i}_{uuid.uuid4().hex[:6]}",
            repo_url="https://github.com/example/repo.git",
            nodes=[
                TaskNode(
                    id=f"stress_node_{i}",
                    type=NodeType.CODE,
                    instruction=f"stress test task {i}",
                    files=["README.md"],
                    timeout_seconds=30,
                ),
            ],
        )

    runner = StressTestRunner(concurrency=concurrency, timeout=30)
    return await runner.run(
        test_name="concurrent_dag_submit",
        task_fn=lambda d: scheduler.submit(d),
        task_args_list=[(make_dag(i),) for i in range(total)],
        total_requests=total,
    )


async def stress_test_worker_pool_exhaustion(
    scheduler, total: int = 20, max_workers: int = 4
) -> StressTestResult:
    """Worker 池耗尽压力测试。"""
    from .models import TaskDAG, TaskNode, NodeType

    def make_dag(i: int) -> TaskDAG:
        return TaskDAG(
            dag_id=f"exhaust_{i}_{uuid.uuid4().hex[:6]}",
            repo_url="https://github.com/example/repo.git",
            nodes=[
                TaskNode(
                    id=f"node_{i}",
                    type=NodeType.CODE,
                    instruction=f"long running task {i}",
                    files=["README.md"],
                    timeout_seconds=120,
                ),
            ],
        )

    runner = StressTestRunner(concurrency=max_workers * 2, timeout=30)
    return await runner.run(
        test_name="worker_pool_exhaustion",
        task_fn=lambda d: scheduler.submit(d),
        task_args_list=[(make_dag(i),) for i in range(total)],
        total_requests=total,
    )


async def stress_test_event_burst(
    scheduler, total: int = 100
) -> StressTestResult:
    """事件爆发压力测试。"""
    from .models import SchedulerEvent

    async def publish_event(i: int):
        event = SchedulerEvent(
            event_type="stress.test",
            dag_id=f"stress_{i % 10}",
            node_id=f"node_{i}",
            data={"index": i, "message": f"stress event {i}"},
        )
        await scheduler.event_bus.publish(event)

    runner = StressTestRunner(concurrency=20, timeout=30)
    return await runner.run(
        test_name="event_burst",
        task_fn=publish_event,
        task_args_list=[(i,) for i in range(total)],
        total_requests=total,
    )


async def run_all_stress_tests(scheduler) -> List[StressTestResult]:
    """运行全部压力测试套件。"""
    results = []

    logger.info("=== Stress Test Suite Started ===")

    # 测试 1: 并发提交
    r1 = await stress_test_concurrent_dag_submit(scheduler, total=30, concurrency=5)
    results.append(r1)

    # 测试 2: 事件爆发
    r2 = await stress_test_event_burst(scheduler, total=50)
    results.append(r2)

    # 测试 3: Worker 池耗尽
    r3 = await stress_test_worker_pool_exhaustion(scheduler, total=10)
    results.append(r3)

    for r in results:
        StressTestRunner.print_report(r)

    all_passed = all(r.passed for r in results)
    logger.info("=== Stress Test Suite %s ===", "PASSED" if all_passed else "FAILED")
    return results