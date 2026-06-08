"""认证与授权模块 — JWT + API Key 双重鉴权。"""
import hashlib
import hmac
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# 默认密钥（生产环境必须通过环境变量覆盖）
DEFAULT_SECRET = os.environ.get("FLOWMIND_JWT_SECRET", "flowmind-dev-secret-change-me")
DEFAULT_API_KEY = os.environ.get("FLOWMIND_API_KEY", "")
AUTH_ENABLED = os.environ.get("FLOWMIND_AUTH_ENABLED", "false").lower() == "true"

security = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    """认证上下文。"""
    user_id: str = "anonymous"
    role: str = "user"
    api_key_hash: str = ""
    authenticated: bool = False


class AuthMiddleware(BaseHTTPMiddleware):
    """FastAPI 认证中间件 — 在请求进入路由前校验身份。

    支持两种方式：
    1. Authorization: Bearer <jwt_token>
    2. X-API-Key: <api_key>
    """

    PUBLIC_PATHS = {
        "/health", "/api/v1/health",
        "/docs", "/openapi.json", "/redoc",
    }

    def __init__(self, app, secret: str = DEFAULT_SECRET, api_key: str = ""):
        super().__init__(app)
        self._secret = secret
        self._api_key = api_key

    async def dispatch(self, request: Request, call_next):
        # 白名单路径跳过认证
        if request.url.path in self.PUBLIC_PATHS or request.url.path.startswith("/ws"):
            request.state.auth = AuthContext(authenticated=False)
            return await call_next(request)

        # 如果未启用认证，直接放行
        if not AUTH_ENABLED:
            request.state.auth = AuthContext(authenticated=False)
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        api_key = request.headers.get("X-API-Key", "")

        # API Key 认证
        if api_key and self._api_key:
            if hmac.compare_digest(api_key, self._api_key):
                request.state.auth = AuthContext(
                    user_id="api_key_user",
                    role="admin",
                    api_key_hash=hashlib.sha256(api_key.encode()).hexdigest()[:12],
                    authenticated=True,
                )
                return await call_next(request)
            return JSONResponse(
                status_code=401,
                content={"error": "invalid_api_key"},
            )

        # JWT Bearer Token 认证
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = self._verify_jwt(token)
            if payload:
                request.state.auth = AuthContext(
                    user_id=payload.get("sub", "unknown"),
                    role=payload.get("role", "user"),
                    authenticated=True,
                )
                return await call_next(request)
            return JSONResponse(
                status_code=401,
                content={"error": "invalid_token"},
            )

        return JSONResponse(
            status_code=401,
            content={"error": "authentication_required"},
        )

    def _verify_jwt(self, token: str) -> Optional[dict]:
        """简易 JWT 验证（HMAC-SHA256）。

        生产环境建议使用 PyJWT 库。
        """
        try:
            import base64
            import json

            parts = token.split(".")
            if len(parts) != 3:
                return None

            # 验证签名
            header_b64, payload_b64, sig_b64 = parts
            signing_input = f"{header_b64}.{payload_b64}"
            expected_sig = hmac.new(
                self._secret.encode(),
                signing_input.encode(),
                hashlib.sha256,
            ).digest()

            # Base64 URL decode
            def b64url_decode(s):
                s = s + "=" * (4 - len(s) % 4)
                return base64.urlsafe_b64decode(s)

            actual_sig = b64url_decode(sig_b64)
            if not hmac.compare_digest(actual_sig, expected_sig):
                return None

            # 解码 payload
            payload = json.loads(b64url_decode(payload_b64))

            # 检查过期
            exp = payload.get("exp", 0)
            if exp and time.time() > exp:
                return None

            return payload
        except Exception:
            return None

    @staticmethod
    def create_token(user_id: str, role: str = "user",
                     secret: str = DEFAULT_SECRET,
                     expires_in: int = 86400) -> str:
        """生成 JWT 令牌（用于测试/开发）。"""
        import base64
        import json

        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "sub": user_id,
            "role": role,
            "iat": int(time.time()),
            "exp": int(time.time()) + expires_in,
        }

        def b64url_encode(data: bytes) -> str:
            return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

        header_b64 = b64url_encode(json.dumps(header).encode())
        payload_b64 = b64url_encode(json.dumps(payload).encode())
        signing_input = f"{header_b64}.{payload_b64}"

        signature = hmac.new(
            secret.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        sig_b64 = b64url_encode(signature)

        return f"{header_b64}.{payload_b64}.{sig_b64}"


def require_auth(request: Request) -> AuthContext:
    """路由级别的认证依赖注入。"""
    if AUTH_ENABLED and not request.state.auth.authenticated:
        raise HTTPException(status_code=401, detail="authentication required")
    return request.state.auth


def require_admin(request: Request) -> AuthContext:
    """需要管理员权限。"""
    ctx = require_auth(request)
    if ctx.role != "admin":
        raise HTTPException(status_code=403, detail="admin role required")
    return ctx