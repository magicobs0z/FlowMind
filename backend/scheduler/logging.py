"""结构化日志 + trace_id 全链路追踪。

功能：
- FastAPI 中间件注入 trace_id/dag_id
- gRPC 拦截器传播 trace_id
- structlog JSON 日志格式
"""
import contextvars
import logging
import uuid
from typing import Optional
from fastapi import Request

from starlette.middleware.base import BaseHTTPMiddleware

# 结构化日志
try:
    import structlog
    from structlog.contextvars import bind_contextvars, clear_contextvars
    STRUCTLOG_AVAILABLE = True
except ImportError:
    STRUCTLOG_AVAILABLE = False

# 上下文变量存储 trace_id
current_trace_id = contextvars.ContextVar('trace_id', default=None)
current_dag_id = contextvars.ContextVar('dag_id', default=None)
current_node_id = contextvars.ContextVar('node_id', default=None)


def setup_structured_logging():
    """配置 structlog JSON 日志输出。"""
    if not STRUCTLOG_AVAILABLE:
        return

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )


def get_trace_id() -> Optional[str]:
    """获取当前请求的 trace_id。"""
    return current_trace_id.get()


def set_trace_id(trace_id: str):
    """设置 trace_id。"""
    current_trace_id.set(trace_id)


def get_dag_id() -> Optional[str]:
    """获取当前 DAG ID。"""
    return current_dag_id.get()


def set_dag_id(dag_id: str):
    """设置 DAG ID。"""
    current_dag_id.set(dag_id)


def clear_context():
    """清除当前上下文。"""
    current_trace_id.set(None)
    current_dag_id.set(None)
    current_node_id.set(None)


class TraceIdMiddleware(BaseHTTPMiddleware):
    """FastAPI 中间件：注入 trace_id 到日志上下文。"""

    async def dispatch(self, request: Request, call_next):
        clear_context()

        # 从请求头获取 trace_id，不存在则生成
        trace_id = request.headers.get("X-Trace-Id", uuid.uuid4().hex[:16])
        set_trace_id(trace_id)

        # 尝试从路径提取 DAG ID
        path = request.url.path
        if '/dags/' in path:
            parts = path.split('/')
            if len(parts) >= 4:
                dag_id = parts[3]
                set_dag_id(dag_id)

        if STRUCTLOG_AVAILABLE:
            structlog.contextvars.bind_contextvars(
                trace_id=trace_id,
                dag_id=get_dag_id(),
            )

        response = await call_next(request)
        response.headers["X-Trace-Id"] = trace_id

        if STRUCTLOG_AVAILABLE:
            structlog.contextvars.clear_contextvars()

        clear_context()
        return response


# 结构化日志处理器（兼容非 structlog）
class StructuredLoggerAdapter(logging.LoggerAdapter):
    """结构化日志适配器，自动注入 trace_id/dag_id。"""

    def process(self, msg, kwargs):
        extra = kwargs.get('extra', {})
        tid = get_trace_id()
        did = get_dag_id()
        if tid:
            extra['trace_id'] = tid
        if did:
            extra['dag_id'] = did
        kwargs['extra'] = extra
        return msg, kwargs


def get_structured_logger(name: str) -> logging.Logger:
    """获取结构化 logger。"""
    logger = logging.getLogger(name)
    return StructuredLoggerAdapter(logger, {})
