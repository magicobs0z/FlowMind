import argparse
import logging
import os
import sys

import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def create_app(repo_path: str = "",
               max_workers: int = 4,
               worker_host: str = "localhost",
               base_port: int = 50051,
               db_path: str = "flowmind.db") -> FastAPI:
    from .api import create_router, websocket_handler
    from .scheduler_core import SchedulerCore
    from .auth import AuthMiddleware
    from .user_service import UserService
    from .model_manager import ModelManager
    from .metrics import get_metrics, setup_metrics

    scheduler = SchedulerCore(
        repo_path=repo_path,
        max_workers=max_workers,
        worker_host=worker_host,
        base_port=base_port,
        db_path=db_path,
    )

    # 注入可选服务（账户 + 模型管理）
    user_service = UserService()
    model_manager = ModelManager()
    scheduler._user_service = user_service
    scheduler._model_manager = model_manager
    logger.info("user_service and model_manager injected into scheduler")

    app = FastAPI(
        title="FlowMind Multi-Agent Scheduler",
        version="0.2.0",
        description="多智能体调度中心 — 确定性逻辑核心",
    )

    # CORS — 生产环境通过 CORS_ORIGINS 环境变量配置
    cors_origins_str = os.environ.get(
        "CORS_ORIGINS",
        os.environ.get("FLOWMIND_CORS_ORIGINS", "*"),
    )
    cors_origins = (
        ["*"]
        if cors_origins_str == "*"
        else [o.strip() for o in cors_origins_str.split(",") if o.strip()]
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    if cors_origins != ["*"]:
        logger.info("CORS restricted to: %s", cors_origins)

    # 认证中间件（注册/登录端点已加入 PUBLIC_PATHS）
    app.add_middleware(AuthMiddleware)

    # 限流中间件
    from .rate_limiter import RateLimitMiddleware
    app.add_middleware(RateLimitMiddleware)

    # Prometheus Metrics
    metrics = get_metrics()
    setup_metrics(app, metrics)

    # 结构化日志 + trace_id
    from .logging import TraceIdMiddleware
    app.add_middleware(TraceIdMiddleware)

    router = create_router(scheduler)
    app.include_router(router)

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "version": "0.2.0",
            "dags_active": len(scheduler.get_all_dags()),
        }

    @app.websocket("/ws/events")
    async def ws_events(websocket: WebSocket):
        await websocket_handler(websocket, scheduler)

    @app.on_event("shutdown")
    async def shutdown():
        logger.info("shutting down scheduler...")
        await scheduler.shutdown()

    app.state.scheduler = scheduler
    return app


def main():
    parser = argparse.ArgumentParser(description="FlowMind 多智能体调度中心")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址")
    parser.add_argument("--port", type=int, default=8080, help="监听端口")
    parser.add_argument("--repo-path", default="", help="Git 仓库本地路径")
    parser.add_argument("--max-workers", type=int, default=4, help="Worker 池大小")
    parser.add_argument("--worker-host", default="localhost", help="Worker gRPC 地址")
    parser.add_argument("--worker-base-port", type=int, default=50051,
                        help="Worker gRPC 基础端口")
    parser.add_argument("--verbose", action="store_true", help="详细日志")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    repo_path = args.repo_path or os.environ.get("SCHEDULER_REPO_PATH", "")
    if not repo_path:
        logger.warning("--repo-path 未设置，Git 分支管理功能将不可用")

    app = create_app(
        repo_path=repo_path,
        max_workers=args.max_workers,
        worker_host=args.worker_host,
        base_port=args.worker_base_port,
    )

    logger.info("starting scheduler on %s:%d (workers=%d, repo=%s)",
                args.host, args.port, args.max_workers,
                repo_path or "(none)")

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="info" if args.verbose else "warning",
    )


if __name__ == "__main__":
    main()
