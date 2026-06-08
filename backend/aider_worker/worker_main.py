"""
Worker 进程入口 — 生产级 gRPC 服务。

启动方式：
    # 常驻服务（默认）
    python -m aider_worker.worker_main --port 50051

    # 单次执行后退出
    python -m aider_worker.worker_main --port 50051 --single

    # stdin/stdout 帧协议（适合 subprocess 管道）
    echo <packed_proto> | python -m aider_worker.worker_main

帧协议格式：
    [4-byte big-endian length][protobuf Contract]
    → [4-byte big-endian length][protobuf Result]"""

import os
import sys
import signal
import struct
import logging
import argparse
from datetime import datetime

from .gen import worker_pb2
from .worker_server import AiderWorkerService, __version__

logger = logging.getLogger("aider_worker")


def _setup_logging(verbose: bool):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stderr,
    )


def main():
    parser = argparse.ArgumentParser(description="Aider Worker gRPC server")
    parser.add_argument("--port", type=int, default=0,
                        help="TCP port for gRPC (default: stdin/stdout mode)")
    parser.add_argument("--single", action="store_true",
                        help="Exit after processing one request")
    parser.add_argument("--verbose", action="store_true",
                        help="Enable debug logging")
    parser.add_argument("--max-workers", type=int, default=1,
                        help="Max concurrent gRPC workers (default: 1)")
    args = parser.parse_args()

    _setup_logging(args.verbose)

    logger.info("AiderWorker v%s starting", __version__)
    logger.info("Python: %s", sys.executable)
    logger.info("PID: %d", os.getpid())
    logger.debug("TMP: %s", os.environ.get("TMP", "(not set)"))
    logger.debug("PYTHONPATH: %s", os.environ.get("PYTHONPATH", "(not set)"))

    if args.port:
        _serve_tcp(args.port, single=args.single, max_workers=args.max_workers)
    else:
        _serve_stdio()


def _serve_stdio():
    """通过 stdin/stdout 进行单次 protobuf 通信。"""
    raw = sys.stdin.buffer.read()
    if len(raw) < 4:
        return

    msg_len = struct.unpack(">I", raw[:4])[0]
    proto_data = raw[4:4 + msg_len]

    contract = worker_pb2.Contract()
    contract.ParseFromString(proto_data)

    logger.info("Received contract via stdin: model=%s instruction_len=%d",
                contract.model_name, len(contract.instruction))

    service = AiderWorkerService()
    result = service.Execute(contract, None)

    out_data = result.SerializeToString()
    sys.stdout.buffer.write(struct.pack(">I", len(out_data)))
    sys.stdout.buffer.write(out_data)
    sys.stdout.buffer.flush()

    logger.info("Result sent: success=%s", result.success)


def _serve_tcp(port, single=False, max_workers=1):
    """TCP gRPC 模式 — 常驻服务。"""
    import grpc
    from concurrent import futures
    from .gen import worker_pb2_grpc

    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=max_workers),
        maximum_concurrent_rpcs=max_workers,
    )
    service = AiderWorkerService()
    worker_pb2_grpc.add_AiderWorkerServicer_to_server(service, server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()

    logger.info("gRPC server listening on port %d (max_workers=%d)", port, max_workers)
    logger.info("HealthCheck available")

    def _handle_shutdown(signum, frame):
        signame = signal.Signals(signum).name
        logger.info("Received %s, shutting down gracefully...", signame)
        server.stop(grace=30)

    signal.signal(signal.SIGTERM, _handle_shutdown)
    signal.signal(signal.SIGINT, _handle_shutdown)

    if single:
        server.wait_for_termination(timeout=300)
    else:
        server.wait_for_termination()

    logger.info("Server stopped")


if __name__ == "__main__":
    main()
