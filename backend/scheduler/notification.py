"""通知服务 — 关键事件多渠道告警。

支持：
- Webhook (HTTP POST)
- 控制台 (stderr)
- 可扩展渠道 (Slack/钉钉/飞书/邮件)
"""
import asyncio
import json
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

try:
    import httpx
    _HTTPX_AVAILABLE = True
except ImportError:
    _HTTPX_AVAILABLE = False


class NotificationChannel:
    """通知渠道基类。"""
    async def send(self, title: str, message: str, level: str = "info",
                   extra: dict = None) -> bool:
        raise NotImplementedError


class ConsoleChannel(NotificationChannel):
    """控制台通知（开发调试用）。"""
    async def send(self, title: str, message: str, level: str = "info",
                   extra: dict = None) -> bool:
        log_fn = {
            "info": logger.info,
            "warning": logger.warning,
            "error": logger.error,
            "critical": logger.critical,
        }.get(level, logger.info)
        log_fn("[%s] %s: %s", level.upper(), title, message)
        return True


class WebhookChannel(NotificationChannel):
    """Webhook 通知通道。"""

    def __init__(self, url: str, secret: str = "", timeout: float = 10.0):
        self._url = url
        self._secret = secret
        self._timeout = timeout

    async def send(self, title: str, message: str, level: str = "info",
                   extra: dict = None) -> bool:
        if not _HTTPX_AVAILABLE or not self._url:
            return False

        payload = {
            "title": title,
            "message": message,
            "level": level,
            "timestamp": __import__("datetime").datetime.now().isoformat(),
            "extra": extra or {},
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                headers = {"Content-Type": "application/json"}
                if self._secret:
                    headers["X-Webhook-Secret"] = self._secret
                resp = await client.post(self._url, json=payload, headers=headers)
                return resp.status_code < 400
        except Exception as e:
            logger.warning("Webhook notification failed: %s", e)
            return False


class DingTalkChannel(NotificationChannel):
    """钉钉机器人通知通道。"""

    def __init__(self, webhook_url: str, secret: str = ""):
        self._url = webhook_url
        self._secret = secret

    async def send(self, title: str, message: str, level: str = "info",
                   extra: dict = None) -> bool:
        if not _HTTPX_AVAILABLE or not self._url:
            return False

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": f"## {title}\n\n**级别**: {level}\n\n{message}\n\n"
                        + (f"```json\n{json.dumps(extra, indent=2, ensure_ascii=False)}\n```"
                           if extra else ""),
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(self._url, json=payload)
                return resp.status_code < 400
        except Exception as e:
            logger.warning("DingTalk notification failed: %s", e)
            return False


class NotificationService:
    """通知服务 — 管理多个通知渠道，根据事件类型分发。"""

    def __init__(self):
        self._channels: Dict[str, NotificationChannel] = {}
        self._rules: List[dict] = []

    def add_channel(self, name: str, channel: NotificationChannel):
        """注册通知渠道。"""
        self._channels[name] = channel
        logger.info("Notification channel registered: %s", name)

    def add_rule(self, event_type: str, channels: List[str],
                 min_level: str = "info"):
        """添加事件路由规则。"""
        self._rules.append({
            "event_type": event_type,
            "channels": channels,
            "min_level": min_level,
        })

    async def notify(self, event_type: str, title: str = "",
                     message: str = "", level: str = "info",
                     extra: dict = None):
        """根据事件类型分发通知到对应渠道。"""
        # 查找匹配的规则
        for rule in self._rules:
            if event_type.startswith(rule["event_type"]):
                if self._level_priority(level) >= self._level_priority(rule["min_level"]):
                    for ch_name in rule["channels"]:
                        channel = self._channels.get(ch_name)
                        if channel:
                            try:
                                await channel.send(title, message, level, extra)
                            except Exception as e:
                                logger.warning("Notification to %s failed: %s",
                                               ch_name, e)

    @staticmethod
    def _level_priority(level: str) -> int:
        return {"info": 0, "warning": 1, "error": 2, "critical": 3}.get(level, 0)


# ── 调度事件→通知映射 ─────────────────────────────────

NOTIFICATION_RULES = [
    # 关键事件
    ("human_intervention", ["console", "webhook"], "warning"),
    ("merge.conflict", ["console", "webhook"], "warning"),
    ("budget.exceeded", ["console", "webhook"], "error"),
    ("budget.warning", ["console"], "warning"),
    ("dag.blocked", ["console", "webhook"], "error"),
    ("dag.failed", ["console", "webhook"], "error"),
    ("dag.completed", ["console"], "info"),
    ("task.failed", ["console"], "warning"),
    ("task.started", ["console"], "info"),
    ("worker.interrupt", ["console", "webhook"], "warning"),
]


def create_notification_service(webhook_url: str = "",
                                 dingtalk_url: str = "") -> NotificationService:
    """创建并配置通知服务。"""
    service = NotificationService()

    # 注册渠道
    service.add_channel("console", ConsoleChannel())
    if webhook_url:
        service.add_channel("webhook", WebhookChannel(webhook_url))
    if dingtalk_url:
        service.add_channel("dingtalk", DingTalkChannel(dingtalk_url))

    # 注册路由规则
    for event_type, channels, level in NOTIFICATION_RULES:
        service.add_rule(event_type, channels, level)

    return service