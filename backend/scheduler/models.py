from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class TaskStatus(str, Enum):
    PENDING = "pending"
    READY = "ready"
    RUNNING = "running"
    VERIFYING = "verifying"
    RETRYING = "retrying"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    BLOCKED = "blocked"
    MERGED = "merged"


class AgentRole(str, Enum):
    ENGINEER = "engineer"
    TESTER = "tester"
    REVIEWER = "reviewer"
    PRODUCT_MANAGER = "product_manager"
    PROJECT_MANAGER = "project_manager"
    MERGER = "merger"
    HUMAN = "human"


class InterruptReason(str, Enum):
    """Worker 触发 HumanInterrupt 的原因类型。"""
    OUT_OF_SCOPE = "out_of_scope"               # 操作超出契约范围
    NEW_FILE_REQUEST = "new_file_request"       # 需要创建新文件
    SHELL_COMMAND_REQUEST = "shell_command_request"  # 需要执行 shell 命令
    AMBIGUOUS_REQUIREMENT = "ambiguous_requirement"  # 需求不明确
    DESIGN_DECISION = "design_decision"         # 需要设计决策
    CONTRACT_VIOLATION = "contract_violation"   # 检测到契约违规
    MERGE_CONFLICT = "merge_conflict"           # Git 合并冲突


class NodeType(str, Enum):
    CODE = "code"
    TEST = "test"
    REVIEW = "review"
    MERGE = "merge"
    PLAN = "plan"
    MANUAL = "manual"


@dataclass
class TaskNode:
    id: str
    type: NodeType = NodeType.CODE
    depends_on: list[str] = field(default_factory=list)
    instruction: str = ""
    files: list[str] = field(default_factory=list)
    read_only_files: list[str] = field(default_factory=list)
    model_hint: str = ""
    system_prompt_extra: str = ""
    auto_lint: bool = False
    lint_command: str = ""
    auto_test: bool = False
    test_command: str = ""
    max_reflections: int = 3
    timeout_seconds: int = 120
    # 契约权限字段 — 控制 Worker 能做什么
    allowed_operations: list[str] = field(default_factory=lambda: ["edit"])
    allow_new_files: bool = False
    allow_shell_commands: bool = False
    allowed_shell_patterns: list[str] = field(default_factory=list)

    def __post_init__(self):
        if isinstance(self.type, str):
            try:
                self.type = NodeType(self.type)
            except ValueError:
                self.type = NodeType.CODE


@dataclass
class NodePermissions:
    """Worker 操作权限。"""
    allowed_operations: list[str] = field(default_factory=lambda: ["edit"])
    allow_new_files: bool = False
    allow_shell_commands: bool = False
    allowed_shell_patterns: list[str] = field(default_factory=list)
    max_file_size_kb: int = 500


@dataclass
class ValidationRule:
    """结构化校验规则。"""
    type: str = "command"        # command | lint | test | regex | custom
    name: str = ""
    command: str = ""            # type=command/lint/test 时
    pattern: str = ""            # type=regex 时
    expected: str = ""           # 期望结果
    fail_message: str = ""
    max_retries: int = 2


@dataclass
class HumanInterruptRequest:
    """Worker 触发的中断请求 — 等待人类决策。"""
    interrupt_id: str
    dag_id: str
    task_id: str
    node_id: str
    reason: InterruptReason = InterruptReason.AMBIGUOUS_REQUIREMENT
    question: str = ""
    context: dict = field(default_factory=dict)
    options: list[str] = field(default_factory=list)
    status: str = "pending"      # pending | approved | rejected
    created_at: str = ""
    resolved_at: str = ""
    resolution: str = ""
    resolved_by: str = ""


@dataclass
class ApprovalRequest:
    """等待人类审批的决策请求。"""
    approval_id: str
    dag_id: str
    node_id: str
    title: str = ""
    description: str = ""
    request_type: str = "approval"
    status: str = "pending"
    payload: dict = field(default_factory=dict)
    created_at: str = ""
    resolved_at: str = ""
    resolution: str = ""
    resolved_by: str = ""


@dataclass
class MergeConflictInfo:
    """Git 合并冲突详情。"""
    dag_id: str
    source_branch: str
    target_branch: str
    conflict_files: list[str] = field(default_factory=list)
    conflict_diff: str = ""
    status: str = "pending"
    resolution: str = ""
    resolved_at: str = ""
    resolved_by: str = ""


@dataclass
class TaskDAG:
    dag_id: str
    repo_url: str
    base_commit: str = ""
    nodes: list[TaskNode] = field(default_factory=list)
    parallel_policy: str = "max"
    # 原始需求上下文（注入到 Engineer 提示词中）
    requirement_context: str = ""


@dataclass
class TokenUsage:
    tokens_sent: int = 0
    tokens_received: int = 0
    cost_usd: float = 0.0


@dataclass
class TaskInstance:
    task_id: str
    dag_id: str
    node_id: str
    node_type: NodeType = NodeType.CODE
    status: TaskStatus = TaskStatus.PENDING
    depends_on: list[str] = field(default_factory=list)
    retry_count: int = 0
    max_retries: int = 2
    worker_id: str = ""
    branch_name: str = ""
    contract: dict = field(default_factory=dict)
    result: dict = field(default_factory=dict)
    error_message: str = ""
    token_usage: Optional[TokenUsage] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


@dataclass
class DagState:
    dag_id: str
    repo_url: str
    repo_path: str = ""  # 本地仓库路径
    base_commit: str = ""
    nodes: dict[str, TaskInstance] = field(default_factory=dict)
    merge_branch: str = ""
    status: str = "running"
    # 原始需求上下文
    requirement_context: str = ""


@dataclass
class SchedulerEvent:
    event_type: str
    dag_id: str
    node_id: str = ""
    event_id: str = ""
    timestamp: Optional[datetime] = None
    data: dict = field(default_factory=dict)


@dataclass
class AgentContract:
    contract_id: str
    agent_role: AgentRole = AgentRole.ENGINEER
    task_id: str = ""
    dag_id: str = ""
    instruction: str = ""
    context_files: list[str] = field(default_factory=list)
    output_files: list[str] = field(default_factory=list)
    system_prompt_extra: str = ""
    max_reflections: int = 3
    timeout_seconds: int = 120
    validation_rules: list[str] = field(default_factory=list)
    knowledge_refs: list[str] = field(default_factory=list)
    repo_url: str = ""
    repo_path: str = ""  # 本地仓库路径
    base_commit: str = ""
    branch_name: str = ""
    model_name: str = "openai/GLM-4-Flash-250414"
    auto_lint: bool = False
    lint_command: str = ""
    auto_test: bool = False
    test_command: str = ""
    # Human-in-the-loop 字段
    permissions: NodePermissions = field(default_factory=NodePermissions)
    validation: list[ValidationRule] = field(default_factory=list)
    allow_interrupt: bool = True  # Worker 遇到边界时是否允许触发中断
    # 上下文管理
    retain_state: bool = False    # 是否跨调用保留 sandbox/coder
    session_id: str = ""          # 用于恢复会话的标识


@dataclass
class AgentResult:
    success: bool = True
    error_message: str = ""
    output: dict = field(default_factory=dict)
    token_usage: Optional[TokenUsage] = None
    events: list[SchedulerEvent] = field(default_factory=list)


@dataclass
class MergeResult:
    success: bool = True
    conflict_files: list[str] = field(default_factory=list)
    error: str = ""


@dataclass
class VerificationResult:
    passed: bool = True
    checks: list[dict] = field(default_factory=list)


@dataclass
class ContractChangeRequest:
    dag_id: str
    node_id: str
    change_type: str = ""
    reason: str = ""
    proposed_changes: dict = field(default_factory=dict)


@dataclass
class BlueprintPhase:
    name: str
    description: str = ""
    sub_phases: list[BlueprintPhase] = field(default_factory=list)


@dataclass
class Blueprint:
    project_name: str
    description: str = ""
    phases: list[BlueprintPhase] = field(default_factory=list)
    language: str = "python"
    framework: str = ""


@dataclass
class BudgetConfig:
    dag_id: str = ""
    max_cost_usd: float = 0.0
    notify_on: float = 0.0
    enabled: bool = False


# ── TODO 监控模块 ─────────────────────────────────────

@dataclass
class TodoMilestone:
    milestone_id: str
    title: str
    status: str = "pending"       # pending | in_progress | completed
    progress: float = 0.0
    tasks: list[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


@dataclass
class TodoTask:
    task_id: str
    description: str
    agent_role: str = ""
    agent_id: str = ""
    milestone_id: str = ""
    status: str = "todo"          # todo | in_progress | completed | blocked
    progress: float = 0.0
    node_id: str = ""
    dag_id: str = ""
    files: list[str] = field(default_factory=list)
    note: str = ""
    blocked_reason: str = ""
    created_at: str = ""
    updated_at: str = ""


@dataclass
class AgentStatus:
    agent_id: str
    role: str = ""
    current_task: str = ""
    status: str = "idle"          # idle | working | blocked
    last_heartbeat: str = ""


@dataclass
class KnowledgeDoc:
    doc_id: str
    title: str
    content: str
    tags: list[str] = field(default_factory=list)
    source: str = ""


# ── MCP / Skill / Rule 配置 ────────────────────────────

@dataclass
class MCPServerConfig:
    name: str
    endpoint: str
    enabled: bool = True
    tools: list[str] = field(default_factory=list)


@dataclass
class SkillConfig:
    name: str
    description: str
    prompt_template: str = ""
    tags: list[str] = field(default_factory=list)
    enabled: bool = True


@dataclass
class RuleConfig:
    rule_id: str
    name: str
    description: str = ""
    condition: dict = field(default_factory=dict)
    action: str = "block"
    priority: int = 0
    enabled: bool = True


@dataclass
class CapabilityConfig:
    mcp_servers: list[MCPServerConfig] = field(default_factory=list)
    skills: list[SkillConfig] = field(default_factory=list)
    rules: list[RuleConfig] = field(default_factory=list)
