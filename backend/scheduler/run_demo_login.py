"""
FlowMind 真实 E2E 测试：自然语言需求 → 多 Agent 自动开发

模拟真实用户场景：
1. 用户输入自然语言需求："做一个登录页面，包含前后端"
2. FlowAgent 自动评估复杂度、拆解 DAG
3. 多 Agent 并行/串行执行
4. 产出完整代码
5. 全程事件追踪 + 最终汇报

运行方式：
  python -m FlowMind.backend.scheduler.run_demo_login
"""
import asyncio
import logging
import os
import sys
import time
import uuid
from datetime import datetime

# ── 配置 ────────────────────────────────────────────────────────────────────
REPO_PATH = r"d:\AI\FlowMind-V2\demo_login"
os.makedirs(REPO_PATH, exist_ok=True)

REQUIREMENT = (
    "做一个登录页面系统，包含前后端。"
    "后端：Python FastAPI 实现登录/注册 API，使用 JWT 认证，"
    "密码用 bcrypt 哈希存储，支持 token 刷新。"
    "前端：React + Vite 实现登录页和注册页，包含用户名、密码、验证码输入，"
    "登录成功后跳转到欢迎页（显示用户名）。"
    "要求：前后端分离，CORS 配置好，响应式布局好看。"
)
MAX_BUDGET_USD = 3.0

# ── 日志配置 ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "demo_login_e2e.log"),
            encoding="utf-8",
        ),
    ],
)
logger = logging.getLogger("demo_login")


# ── 事件收集器 ───────────────────────────────────────────────────────────────
class EventLogger:
    """实时收集 EventBus 事件，用于最终汇报。"""

    def __init__(self):
        self.events: list[dict] = []
        self.start_time = time.time()

    def log(self, event_type: str, dag_id: str = "", node_id: str = "",
            data: dict = None):
        elapsed = time.time() - self.start_time
        entry = {
            "time": f"+{elapsed:.1f}s",
            "type": event_type,
            "dag_id": dag_id,
            "node_id": node_id,
            "data": data or {},
        }
        self.events.append(entry)
        logger.info("  [%s] %s | dag=%s node=%s",
                     f"{elapsed:6.1f}s", event_type, dag_id, node_id)

    def print_timeline(self):
        print("\n" + "=" * 80)
        print("  执行时间线")
        print("=" * 80)
        for e in self.events:
            dag = f"[{e['dag_id'][:12]}]" if e['dag_id'] else ""
            node = f"[{e['node_id']}]" if e['node_id'] else ""
            data_str = ""
            if e['data']:
                data_str = " | " + ", ".join(f"{k}={v}" for k, v in list(e['data'].items())[:3])
            print(f"  {e['time']:>8}  {e['type']:<40} {dag} {node}{data_str}")
        print("=" * 80)


event_logger = EventLogger()


async def main():
    from FlowMind.backend.scheduler.scheduler_core import SchedulerCore
    from FlowMind.backend.scheduler.worker_pool import WorkerPool
    from FlowMind.backend.scheduler.planning_agent import PlanningAgent
    from FlowMind.backend.scheduler.contract_generator import ContractGenerator
    from FlowMind.backend.scheduler.event_bus import EventBus
    from FlowMind.backend.scheduler.todo_service import TodoService
    from FlowMind.backend.scheduler.cost_monitor import CostMonitor
    from FlowMind.backend.scheduler.git_branch_manager import GitBranchManager
    from FlowMind.backend.scheduler.knowledge_service import KnowledgeService
    from FlowMind.backend.scheduler.verifier import Verifier
    from FlowMind.backend.scheduler.retry_controller import RetryController
    from FlowMind.backend.scheduler.tester_agent import TesterAgent
    from FlowMind.backend.scheduler.reviewer_agent import ReviewerAgent
    from FlowMind.backend.scheduler.merge_agent import MergeAgent

    logger.info("=" * 80)
    logger.info("  FlowMind 多 Agent 开发演示")
    logger.info("  需求: %s", REQUIREMENT[:60] + "...")
    logger.info("  仓库: %s", REPO_PATH)
    logger.info("=" * 80)

    # ── 1. 初始化调度中心 ───────────────────────────────────────────────────
    logger.info("[1/5] 初始化调度中心...")
    t0 = time.time()

    event_bus = EventBus()
    worker_pool = WorkerPool(max_workers=4, worker_host="localhost", base_port=50051)
    contract_gen = ContractGenerator()
    git_mgr = GitBranchManager(REPO_PATH) if REPO_PATH else None
    verifier = Verifier()
    retry_ctrl = RetryController()
    merge_agent = MergeAgent(REPO_PATH) if REPO_PATH else None
    cost_monitor = CostMonitor(event_bus=event_bus)
    tester_agent = TesterAgent()
    reviewer_agent = ReviewerAgent()
    knowledge_service = KnowledgeService()
    todo_service = TodoService(event_bus=event_bus)
    planning_agent = PlanningAgent(
        worker_pool=worker_pool,
        knowledge_service=knowledge_service,
        event_bus=event_bus,
    )

    scheduler = SchedulerCore.__new__(SchedulerCore)
    scheduler.repo_path = REPO_PATH
    scheduler.dag_parser = None
    scheduler.event_bus = event_bus
    scheduler.contract_gen = contract_gen
    scheduler.worker_pool = worker_pool
    scheduler.git_mgr = git_mgr
    scheduler.verifier = verifier
    scheduler.retry_ctrl = retry_ctrl
    scheduler.merge_agent = merge_agent
    scheduler.cost_monitor = cost_monitor
    scheduler.tester_agent = tester_agent
    scheduler.reviewer_agent = reviewer_agent
    scheduler.knowledge_service = knowledge_service
    scheduler.flow_agent = planning_agent
    scheduler.todo = todo_service
    scheduler.persistence = None
    scheduler._dag_states = {}
    scheduler._task_events = {}
    scheduler._pending_changes = {}
    scheduler._running = True
    scheduler._loop_task = None
    scheduler._batch_sem = asyncio.Semaphore(4)
    scheduler._suspended_dags = {}
    scheduler._interrupts = {}
    scheduler._approvals = {}
    scheduler._merge_conflicts = {}

    # EventBus 注入
    from FlowMind.backend.scheduler.notification import create_notification_service
    from FlowMind.backend.scheduler.persistence import SQLitePersistence
    persistence = SQLitePersistence(":memory:")
    notification = create_notification_service()
    event_bus.set_persistence(persistence)
    event_bus.set_notification(notification)

    logger.info("  初始化完成，耗时 %.1fs", time.time() - t0)

    # ── 2. 订阅事件 ─────────────────────────────────────────────────────────
    logger.info("[2/5] 订阅事件流...")
    task_events = asyncio.create_task(_listen_events(scheduler))

    # ── 3. 提交自然语言需求 ─────────────────────────────────────────────────
    logger.info("[3/5] 提交自然语言需求 → FlowAgent 自动拆解...")
    t1 = time.time()

    result = await scheduler.submit_task(
        requirement=REQUIREMENT,
        repo_url="",  # 本地 repo_path 模式
        repo_path=REPO_PATH,
    )

    logger.info("  提交结果: mode=%s dag_id=%s status=%s",
                result.get("mode"), result.get("dag_id"), result.get("status"))
    event_logger.log("user.requirement_submitted", dag_id=result.get("dag_id", ""),
                     data={"requirement": REQUIREMENT[:80], "mode": result.get("mode")})

    if result.get("status") == "failed":
        logger.error("  提交失败: %s", result.get("error"))
        return

    dag_id = result.get("dag_id", "")
    mode = result.get("mode", "")

    if mode == "simple":
        # 简单模式：直接执行
        logger.info("  [简单模式] 需求简单，直接执行...")
        event_logger.log("mode.simple", dag_id=dag_id)
    else:
        # 复杂模式：DAG 规划
        logger.info("  [复杂模式] DAG 规划中，已拆解 %d 个节点...",
                    len(result.get("nodes", [])))
        event_logger.log("mode.complex", dag_id=dag_id,
                         data={"node_count": len(result.get("nodes", []))})

        # 打印 DAG 结构
        for node in result.get("nodes", []):
            logger.info("    → %s (%s) depends_on=%s",
                        node.get("id"), node.get("type"),
                        node.get("depends_on", []))

    planning_time = time.time() - t1
    logger.info("  规划耗时: %.1fs", planning_time)
    event_logger.log("plan.completed", dag_id=dag_id,
                     data={"planning_time_s": planning_time, "nodes": len(result.get("nodes", []))})

    # ── 4. 等待执行完成 ─────────────────────────────────────────────────────
    logger.info("[4/5] 等待 DAG 执行完成...")
    t2 = time.time()

    max_wait = 300  # 5 分钟超时
    poll_interval = 5
    while time.time() - t2 < max_wait:
        state = scheduler.get_state(dag_id) if dag_id else None
        if not state:
            await asyncio.sleep(poll_interval)
            continue

        active_count = sum(
            1 for t in state.nodes.values()
            if t.status.value in ("pending", "running", "waiting")
        )
        done_count = len(state.nodes) - active_count

        logger.info("  进度: %d/%d 节点完成 | 状态: %s",
                    done_count, len(state.nodes), state.status)
        event_logger.log(
            "dag.progress",
            dag_id=dag_id,
            data={
                "done": done_count,
                "total": len(state.nodes),
                "status": state.status,
            },
        )

        if state.status in ("completed", "blocked", "failed"):
            break

        await asyncio.sleep(poll_interval)

    execution_time = time.time() - t2
    logger.info("  执行耗时: %.1fs", execution_time)

    # ── 5. 最终汇报 ─────────────────────────────────────────────────────────
    logger.info("[5/5] 生成执行汇报...")
    await _generate_report(scheduler, dag_id, result, planning_time, execution_time)

    task_events.cancel()
    try:
        await task_events
    except asyncio.CancelledError:
        pass

    # 清理
    await worker_pool.close_all()
    persistence.close()
    logger.info("演示完成。")


async def _listen_events(scheduler):
    """监听 EventBus 事件流。"""
    async for event in scheduler.event_bus.subscribe():
        event_logger.log(
            event_type=event.event_type,
            dag_id=event.dag_id,
            node_id=event.node_id,
            data=event.data,
        )


async def _generate_report(scheduler, dag_id: str, submit_result: dict,
                           planning_time: float, execution_time: float):
    """生成最终执行汇报。"""
    print("\n" + "=" * 80)
    print("  FlowMind 多 Agent 开发汇报")
    print("=" * 80)

    state = scheduler.get_state(dag_id) if dag_id else None

    # 基本信息
    print(f"\n需求: {REQUIREMENT}")
    print(f"仓库: {REPO_PATH}")
    print(f"模式: {submit_result.get('mode', 'unknown')}")
    print(f"DAG ID: {dag_id}")
    print(f"总耗时: {planning_time + execution_time:.1f}s (规划 {planning_time:.1f}s + 执行 {execution_time:.1f}s)")

    if state:
        print(f"\n最终状态: {state.status}")
        print(f"节点数: {len(state.nodes)}")

        # 各节点详情
        print("\n节点执行详情:")
        print(f"  {'节点ID':<20} {'类型':<10} {'状态':<12} {'重试':<4} {'耗时'}")
        print(f"  {'-'*20} {'-'*10} {'-'*12} {'-'*4} {'-'*20}")
        for nid, node in state.nodes.items():
            started = node.started_at
            finished = node.finished_at
            dur = ""
            if started and finished:
                try:
                    from datetime import datetime as dt, timezone as tz
                    if isinstance(started, str):
                        started = dt.fromisoformat(started)
                    if isinstance(finished, str):
                        finished = dt.fromisoformat(finished)
                    dur = (finished - started).total_seconds()
                    dur = f"{dur:.1f}s"
                except Exception:
                    dur = "?"
            token_info = ""
            if node.token_usage:
                token_info = f" | {node.token_usage.tokens_sent + node.token_usage.tokens_received} tokens"
            print(f"  {nid:<20} {node.node_type.value:<10} {node.status.value:<12} "
                  f"{node.retry_count:<4} {dur}{token_info}")
            if node.error_message:
                print(f"    ⚠ 错误: {node.error_message[:100]}")

    # 成本报告
    if dag_id:
        report = scheduler.get_cost_report(dag_id)
        print(f"\n成本报告:")
        print(f"  Token 发送: {report.total_tokens_sent:,}")
        print(f"  Token 接收: {report.total_tokens_received:,}")
        print(f"  估算费用: ${report.total_cost_usd:.4f}")
        print(f"  预算上限: ${MAX_BUDGET_USD:.2f}")
        print(f"  预算使用: {report.total_cost_usd / MAX_BUDGET_USD * 100:.1f}%")

    # TODO 进度
    milestones = scheduler.todo.get_all_milestones()
    if milestones:
        print(f"\nTODO 里程碑:")
        for ms in milestones:
            print(f"  [{ms.status}] {ms.title} — {ms.progress*100:.0f}% "
                  f"({len(ms.tasks)} 任务)")

    # 产物检查
    print(f"\n产物检查:")
    backend_files = [
        os.path.join(REPO_PATH, "backend", "main.py"),
        os.path.join(REPO_PATH, "backend", "auth.py"),
        os.path.join(REPO_PATH, "backend", "models.py"),
        os.path.join(REPO_PATH, "backend", "requirements.txt"),
    ]
    frontend_files = [
        os.path.join(REPO_PATH, "frontend", "package.json"),
        os.path.join(REPO_PATH, "frontend", "src", "App.jsx"),
        os.path.join(REPO_PATH, "frontend", "src", "pages", "Login.jsx"),
        os.path.join(REPO_PATH, "frontend", "src", "pages", "Register.jsx"),
        os.path.join(REPO_PATH, "frontend", "src", "App.css"),
    ]

    all_files = backend_files + frontend_files
    found = []
    missing = []
    for f in all_files:
        if os.path.exists(f):
            size = os.path.getsize(f)
            found.append((f, size))
            print(f"  ✅ {f.replace(REPO_PATH, '')} ({size} bytes)")
        else:
            missing.append(f)
            print(f"  ❌ {f.replace(REPO_PATH, '')} (未生成)")

    # 时间线
    print()
    event_logger.print_timeline()

    # 总结
    print("\n" + "=" * 80)
    print("  执行总结")
    print("=" * 80)
    if state:
        if state.status == "completed":
            print("  ✅ DAG 执行成功")
        elif state.status == "blocked":
            print("  ⚠ DAG 被阻塞（部分节点失败）")
        else:
            print(f"  ❌ DAG 状态: {state.status}")
    print(f"  📁 产物: {len(found)}/{len(all_files)} 文件生成")
    if missing:
        print(f"  ⚠ 未生成: {', '.join(os.path.basename(m) for m in missing)}")
    print(f"  ⏱ 总耗时: {planning_time + execution_time:.1f}s")
    print(f"  💰 费用: ${scheduler.get_cost_report(dag_id).total_cost_usd:.4f}" if dag_id else "")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
