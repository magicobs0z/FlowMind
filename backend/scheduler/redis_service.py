"""Redis 服务注册发现 + 动态配置。

轻量级服务注册：
- Worker 启动时注册到 Redis，心跳 TTL 续期
- 调度中心扫描活跃 Worker 列表
- 健康检查自动摘除死 Worker

动态配置：
- Redis KV 存储运行时配置
- 热加载，无需重启
"""
import asyncio
import json
import logging
import os
from typing import Optional, Dict, Any, List, Callable

logger = logging.getLogger(__name__)

# 尝试导入 redis，如果不可用则降级为 noop
try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False
    logger.warning("redis not installed, service discovery disabled")


class ServiceRegistry:
    """Redis 服务注册。"""

    REDIS_KEY_PREFIX = "flowmind:workers:"
    HEARTBEAT_TTL = 15  # 心跳 TTL 秒

    def __init__(self, redis_url: str = ""):
        self._redis_url = redis_url or os.environ.get("FLOWMIND_REDIS_URL", "redis://localhost:6379/0")
        self._redis: Optional[aioredis.Redis] = None
        self._worker_id: Optional[str] = None
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def connect(self):
        if not _REDIS_AVAILABLE:
            return
        try:
            self._redis = await aioredis.from_url(self._redis_url)
            await self._redis.ping()
            logger.info("Connected to Redis at %s", self._redis_url)
        except Exception as e:
            logger.warning("Redis connection failed: %s, service discovery disabled", e)
            self._redis = None

    async def register_worker(self, worker_id: str, host: str, port: int,
                               metadata: dict = None) -> bool:
        """Worker 注册到 Redis。"""
        if not self._redis:
            return False

        key = f"{self.REDIS_KEY_PREFIX}{worker_id}"
        info = {
            "host": host,
            "port": port,
            "status": "online",
            "metadata": metadata or {},
            "registered_at": __import__("datetime").datetime.now().isoformat(),
        }

        try:
            await self._redis.setex(key, self.HEARTBEAT_TTL, json.dumps(info))
            self._worker_id = worker_id
            logger.info("Worker %s registered at %s:%d", worker_id, host, port)

            # 启动心跳续期
            if self._heartbeat_task:
                self._heartbeat_task.cancel()
            self._heartbeat_task = asyncio.ensure_future(self._heartbeat_loop(key, info))
            return True
        except Exception as e:
            logger.warning("Worker registration failed: %s", e)
            return False

    async def _heartbeat_loop(self, key: str, info: dict):
        """心跳续期，保持 Worker 注册有效。"""
        while self._redis:
            try:
                await asyncio.sleep(self.HEARTBEAT_TTL - 3)
                info["updated_at"] = __import__("datetime").datetime.now().isoformat()
                await self._redis.setex(key, self.HEARTBEAT_TTL, json.dumps(info))
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    async def discover_workers(self) -> List[Dict[str, Any]]:
        """发现所有活跃 Worker。"""
        if not self._redis:
            return []

        try:
            keys = await self._redis.keys(f"{self.REDIS_KEY_PREFIX}*")
            workers = []
            for key in keys:
                data = await self._redis.get(key)
                if data:
                    try:
                        info = json.loads(data)
                        wid = key.decode().replace(self.REDIS_KEY_PREFIX, "")
                        info["worker_id"] = wid
                        workers.append(info)
                    except json.JSONDecodeError:
                        pass
            return workers
        except Exception as e:
            logger.warning("Worker discovery failed: %s", e)
            return []

    async def deregister_worker(self, worker_id: str = ""):
        """Worker 下线时注销。"""
        wid = worker_id or self._worker_id
        if not self._redis or not wid:
            return

        try:
            await self._redis.delete(f"{self.REDIS_KEY_PREFIX}{wid}")
            if self._heartbeat_task:
                self._heartbeat_task.cancel()
            logger.info("Worker %s deregistered", wid)
        except Exception:
            pass

    async def close(self):
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        if self._redis:
            await self._redis.close()
            self._redis = None


class DynamicConfig:
    """Redis 动态配置中心。"""

    CONFIG_KEY_PREFIX = "flowmind:config:"

    def __init__(self, redis_url: str = ""):
        self._redis_url = redis_url or os.environ.get("FLOWMIND_REDIS_URL", "redis://localhost:6379/0")
        self._redis: Optional[aioredis.Redis] = None
        self._cache: Dict[str, Any] = {}
        self._watchers: Dict[str, List[Callable]] = {}

    async def connect(self):
        if not _REDIS_AVAILABLE:
            return
        try:
            self._redis = await aioredis.from_url(self._redis_url)
            await self._redis.ping()
        except Exception as e:
            logger.warning("Redis config connection failed: %s", e)
            self._redis = None

    async def get(self, key: str, default: Any = None) -> Any:
        """获取配置值（优先本地缓存）。"""
        if key in self._cache:
            return self._cache[key]

        if self._redis:
            try:
                val = await self._redis.get(f"{self.CONFIG_KEY_PREFIX}{key}")
                if val:
                    parsed = json.loads(val)
                    self._cache[key] = parsed
                    return parsed
            except Exception:
                pass

        return default

    async def set(self, key: str, value: Any) -> bool:
        """设置配置值。"""
        self._cache[key] = value
        if self._redis:
            try:
                await self._redis.set(
                    f"{self.CONFIG_KEY_PREFIX}{key}",
                    json.dumps(value),
                )
                return True
            except Exception:
                return False
        return True

    def watch(self, key: str, callback: Callable):
        """注册配置变更回调。"""
        self._watchers.setdefault(key, []).append(callback)

    async def close(self):
        if self._redis:
            await self._redis.close()
            self._redis = None


# 常用配置键
CONFIG_KEYS = {
    "worker.timeout_seconds": 120,
    "worker.max_retries": 2,
    "worker.max_reflections": 3,
    "model.fast": "openai/GLM-4-FlashX",
    "model.strong": "openai/GLM-4-Plus",
    "model.review": "openai/GLM-4-AirX",
    "scheduler.max_workers": 4,
    "scheduler.max_nodes": 10,
    "budget.default_max_usd": 5.0,
    "budget.default_notify_at": 0.8,
    "rate_limit.global": 200,
    "rate_limit.submit": 10,
    "rate_limit.plan": 5,
}