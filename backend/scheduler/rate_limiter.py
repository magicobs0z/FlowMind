"""限流中间件 — 基于滑动窗口的请求限流。

支持：
- 全局限流（所有请求）
- 路径级限流（特定端点）
- 客户端 IP 限流
"""
import asyncio
import logging
import time
from collections import defaultdict
from typing import Dict, Optional, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class RateLimiter:
    """基于滑动窗口的限流器。"""

    def __init__(self, max_requests: int = 100, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: Dict[str, list] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def acquire(self, key: str) -> Tuple[bool, int, float]:
        """尝试获取令牌。

        Returns:
            (allowed: bool, remaining: int, reset_seconds: float)
        """
        async with self._lock:
            now = time.time()
            bucket = self._buckets[key]

            # 清理过期记录
            cutoff = now - self.window_seconds
            while bucket and bucket[0] < cutoff:
                bucket.pop(0)

            count = len(bucket)
            if count >= self.max_requests:
                reset_seconds = bucket[0] + self.window_seconds - now
                return False, 0, max(0, reset_seconds)

            bucket.append(now)
            remaining = self.max_requests - count - 1
            return True, remaining, self.window_seconds


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI 限流中间件。"""

    # 默认限流配置
    GLOBAL_RATE = 200         # 全局每分钟
    SUBMIT_RATE = 10           # DAG 提交每分钟
    PLAN_RATE = 5              # 规划请求每分钟

    def __init__(self, app):
        super().__init__(app)
        self._global_limiter = RateLimiter(self.GLOBAL_RATE, 60)
        self._submit_limiter = RateLimiter(self.SUBMIT_RATE, 60)
        self._plan_limiter = RateLimiter(self.PLAN_RATE, 60)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"

        # 全局限流
        global_key = f"global:{client_ip}"
        allowed, remaining, reset = await self._global_limiter.acquire(global_key)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limit_exceeded",
                    "message": "请求过于频繁，请稍后重试",
                    "retry_after": int(reset),
                },
                headers={"Retry-After": str(int(reset))},
            )

        # 路径级限流
        if path in ("/api/v1/dags", "/api/v1/flow"):
            submit_key = f"submit:{client_ip}"
            allowed, _, reset = await self._submit_limiter.acquire(submit_key)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "rate_limit_exceeded",
                        "message": "DAG 提交过于频繁，请稍后重试",
                        "retry_after": int(reset),
                    },
                    headers={"Retry-After": str(int(reset))},
                )

        if path == "/api/v1/plan":
            plan_key = f"plan:{client_ip}"
            allowed, _, reset = await self._plan_limiter.acquire(plan_key)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "rate_limit_exceeded",
                        "message": "规划请求过于频繁，请稍后重试",
                        "retry_after": int(reset),
                    },
                    headers={"Retry-After": str(int(reset))},
                )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response