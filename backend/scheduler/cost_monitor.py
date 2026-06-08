import logging
from dataclasses import dataclass, field

from .models import BudgetConfig, SchedulerEvent

logger = logging.getLogger(__name__)


@dataclass
class NodeUsage:
    tokens_sent: int = 0
    tokens_received: int = 0
    cost_usd: float = 0.0


@dataclass
class DagUsage:
    total_tokens_sent: int = 0
    total_tokens_received: int = 0
    total_cost_usd: float = 0.0
    node_usages: dict[str, NodeUsage] = field(default_factory=dict)
    budget_exceeded: bool = False


class CostMonitor:
    def __init__(self, event_bus=None):
        self._node_usage: dict[str, NodeUsage] = {}
        self._dag_usage: dict[str, DagUsage] = {}
        self._budgets: dict[str, BudgetConfig] = {}
        self._budget_notified: set[str] = set()
        self.event_bus = event_bus

    def record_usage(self, event: SchedulerEvent):
        if event.event_type != "token.usage":
            return
        data = event.data
        sent = data.get("tokens_sent", 0)
        recv = data.get("tokens_received", 0)
        cost = data.get("cost_usd", 0.0)

        node_key = f"{event.dag_id}:{event.node_id}"
        node = self._node_usage.get(node_key)
        if not node:
            node = NodeUsage()
            self._node_usage[node_key] = node
        node.tokens_sent += sent
        node.tokens_received += recv
        node.cost_usd += cost

        dag = self._dag_usage.get(event.dag_id)
        if not dag:
            dag = DagUsage()
            self._dag_usage[event.dag_id] = dag
        dag.total_tokens_sent += sent
        dag.total_tokens_received += recv
        dag.total_cost_usd += cost
        dag.node_usages[event.node_id] = node

        self._check_budget(event.dag_id, dag)

    def _check_budget(self, dag_id: str, usage: DagUsage):
        budget = self._budgets.get(dag_id)
        if not budget or not budget.enabled:
            return

        if (budget.max_cost_usd > 0
                and usage.total_cost_usd >= budget.max_cost_usd):
            usage.budget_exceeded = True
            if dag_id not in self._budget_notified:
                self._budget_notified.add(dag_id)
                logger.warning("BUDGET EXCEEDED: DAG %s cost $%.4f >= $%.4f",
                               dag_id, usage.total_cost_usd, budget.max_cost_usd)
                if self.event_bus:
                    import asyncio
                    try:
                        asyncio.ensure_future(self.event_bus.publish(
                            SchedulerEvent(
                                event_type="budget.exceeded",
                                dag_id=dag_id,
                                data={
                                    "total_cost": usage.total_cost_usd,
                                    "budget": budget.max_cost_usd,
                                },
                            )
                        ))
                    except Exception:
                        pass

        if (budget.notify_on > 0
                and usage.total_cost_usd >= budget.notify_on
                and dag_id not in self._budget_notified):
            self._budget_notified.add(dag_id)
            logger.info("BUDGET NOTIFY: DAG %s cost $%.4f reached $%.4f",
                        dag_id, usage.total_cost_usd, budget.notify_on)
            if self.event_bus:
                import asyncio
                try:
                    asyncio.ensure_future(self.event_bus.publish(
                        SchedulerEvent(
                            event_type="budget.warning",
                            dag_id=dag_id,
                            data={
                                "total_cost": usage.total_cost_usd,
                                "threshold": budget.notify_on,
                            },
                        )
                    ))
                except Exception:
                    pass

    def set_budget(self, dag_id: str, config: BudgetConfig):
        self._budgets[dag_id] = config
        self._budget_notified.discard(dag_id)
        logger.info("budget set for DAG %s: max=$%.2f, notify=$%.2f",
                    dag_id, config.max_cost_usd, config.notify_on)

    def get_budget(self, dag_id: str) -> BudgetConfig | None:
        return self._budgets.get(dag_id)

    def is_budget_exceeded(self, dag_id: str) -> bool:
        usage = self._dag_usage.get(dag_id)
        if not usage:
            return False
        budget = self._budgets.get(dag_id)
        if not budget or not budget.enabled:
            return False
        return budget.max_cost_usd > 0 and usage.total_cost_usd >= budget.max_cost_usd

    def get_dag_report(self, dag_id: str) -> DagUsage:
        return self._dag_usage.get(dag_id, DagUsage())

    def check_budget(self, dag_id: str, budget_usd: float) -> tuple[bool, DagUsage]:
        usage = self.get_dag_report(dag_id)
        over = usage.total_cost_usd >= budget_usd
        return not over, usage

    def get_all_reports(self) -> dict[str, DagUsage]:
        return dict(self._dag_usage)

    def reset(self):
        self._node_usage.clear()
        self._dag_usage.clear()
        self._budgets.clear()
        self._budget_notified.clear()
