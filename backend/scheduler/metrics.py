"""Prometheus Metrics 暴露模块。

暴露以下指标：
- 请求计数、延迟、状态码分布
- DAG 提交/完成/失败计数
- Task 执行状态、耗时
- Worker 池利用率
- Token 消耗
- 预算使用
"""
import logging
import time
from typing import Optional

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# 尝试导入 prometheus_client，如果不可用则使用 noop 实现
try:
    from prometheus_client import (
        Counter, Histogram, Gauge, Info,
        CollectorRegistry, generate_latest,
        CONTENT_TYPE_LATEST,
    )
    _PROMETHEUS_AVAILABLE = True
except ImportError:
    _PROMETHEUS_AVAILABLE = False
    logger.warning("prometheus_client not installed, metrics disabled")


class Metrics:
    """流脑调度器指标收集器。"""

    def __init__(self):
        if not _PROMETHEUS_AVAILABLE:
            self._enabled = False
            return

        self._enabled = True
        self._registry = CollectorRegistry()

        # 请求指标
        self.http_requests_total = Counter(
            "flowmind_http_requests_total",
            "HTTP 请求总数",
            ["method", "endpoint", "status"],
            registry=self._registry,
        )
        self.http_request_duration = Histogram(
            "flowmind_http_request_duration_seconds",
            "HTTP 请求延迟",
            ["method", "endpoint"],
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0, 60.0],
            registry=self._registry,
        )

        # DAG 指标
        self.dag_submitted_total = Counter(
            "flowmind_dag_submitted_total",
            "DAG 提交总数",
            registry=self._registry,
        )
        self.dag_completed_total = Counter(
            "flowmind_dag_completed_total",
            "DAG 完成总数",
            ["status"],
            registry=self._registry,
        )
        self.dag_active = Gauge(
            "flowmind_dag_active",
            "当前活跃 DAG 数",
            registry=self._registry,
        )

        # Task 指标
        self.task_duration = Histogram(
            "flowmind_task_duration_seconds",
            "Task 执行耗时",
            ["node_type", "status"],
            buckets=[1, 5, 10, 30, 60, 120, 300, 600],
            registry=self._registry,
        )
        self.task_retry_total = Counter(
            "flowmind_task_retry_total",
            "Task 重试总数",
            ["node_type"],
            registry=self._registry,
        )

        # Worker 指标
        self.worker_pool_size = Gauge(
            "flowmind_worker_pool_size",
            "Worker 池大小",
            registry=self._registry,
        )
        self.worker_active = Gauge(
            "flowmind_worker_active",
            "活跃 Worker 数",
            registry=self._registry,
        )

        # Token 指标
        self.token_usage_total = Counter(
            "flowmind_token_usage_total",
            "Token 消耗总数",
            ["model", "type"],
            registry=self._registry,
        )
        self.cost_usd_total = Counter(
            "flowmind_cost_usd_total",
            "费用总计（美元）",
            registry=self._registry,
        )

        # 预算指标
        self.budget_exceeded_total = Counter(
            "flowmind_budget_exceeded_total",
            "预算超支次数",
            registry=self._registry,
        )

        # 系统信息
        self.build_info = Info(
            "flowmind_build",
            "构建信息",
            registry=self._registry,
        )
        self.build_info.info({"version": "0.1.0"})

    def record_dag_submitted(self):
        if self._enabled:
            self.dag_submitted_total.inc()

    def record_dag_completed(self, status: str = "completed"):
        if self._enabled:
            self.dag_completed_total.labels(status=status).inc()

    def record_task_duration(self, node_type: str, status: str, duration: float):
        if self._enabled:
            self.task_duration.labels(node_type=node_type, status=status).observe(duration)

    def record_task_retry(self, node_type: str):
        if self._enabled:
            self.task_retry_total.labels(node_type=node_type).inc()

    def record_token_usage(self, model: str, sent: int, received: int, cost: float = 0.0):
        if self._enabled:
            self.token_usage_total.labels(model=model, type="sent").inc(sent)
            self.token_usage_total.labels(model=model, type="received").inc(received)
            if cost > 0:
                self.cost_usd_total.inc(cost)

    def record_budget_exceeded(self):
        if self._enabled:
            self.budget_exceeded_total.inc()

    def set_worker_pool(self, total: int, active: int):
        if self._enabled:
            self.worker_pool_size.set(total)
            self.worker_active.set(active)

    def set_dag_active(self, count: int):
        if self._enabled:
            self.dag_active.set(count)

    def get_metrics(self) -> bytes:
        if self._enabled:
            return generate_latest(self._registry)
        return b"# metrics disabled\n"

    def get_content_type(self) -> str:
        if self._enabled:
            return CONTENT_TYPE_LATEST
        return "text/plain"

    def get_registry(self):
        return self._registry if self._enabled else None


class MetricsMiddleware(BaseHTTPMiddleware):
    """HTTP 请求指标中间件。"""

    def __init__(self, app, metrics: Metrics):
        super().__init__(app)
        self._metrics = metrics

    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = time.time() - start

        if self._metrics._enabled:
            self._metrics.http_requests_total.labels(
                method=request.method,
                endpoint=request.url.path,
                status=response.status_code,
            ).inc()
            self._metrics.http_request_duration.labels(
                method=request.method,
                endpoint=request.url.path,
            ).observe(duration)

        return response


def setup_metrics(app: FastAPI, metrics: Metrics) -> Metrics:
    """注册 /metrics 路由和指标中间件。"""
    app.add_middleware(MetricsMiddleware, metrics=metrics)

    @app.get("/metrics")
    async def metrics_endpoint():
        return Response(
            content=metrics.get_metrics(),
            media_type=metrics.get_content_type(),
        )

    # 存储到 app.state 供其他模块使用
    app.state.metrics = metrics
    return metrics


# 全局单例
_metrics_instance: Optional[Metrics] = None


def get_metrics() -> Metrics:
    global _metrics_instance
    if _metrics_instance is None:
        _metrics_instance = Metrics()
    return _metrics_instance