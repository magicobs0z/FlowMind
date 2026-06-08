import uuid

from .models import (
    TaskInstance, DagState, AgentContract, AgentRole,
    NodePermissions, ValidationRule,
)
from .planning_agent import ROLE_FRAGMENTS


class ContractGenerator:
    """契约生成器 — 将 DAG 节点转化为 Agent 可执行的结构化契约。"""

    MODEL_MAP = {
        "fast": "openai/GLM-4-FlashX",
        "strong": "openai/GLM-4-Plus",
        "review": "openai/GLM-4-AirX",
    }

    def generate(self, task: TaskInstance, dag_state: DagState,
                 repo_path: str = "") -> AgentContract:
        role = self._resolve_role(task)

        # 获取角色片段并按层级组装 prompt
        role_key = role.value
        role_fragment = ROLE_FRAGMENTS.get(role_key, "")
        system_prompt = task.contract.get("system_prompt_extra", "")
        if role_fragment and role_fragment not in system_prompt:
            system_prompt = (
                f"{system_prompt}\n\n"
                f"[角色约束]\n{role_fragment}"
            ).strip()

        # 构建权限结构
        # ENGINEER 角色且没有指定文件时，自动允许创建新文件
        output_files = task.contract.get("files", [])
        if role == AgentRole.ENGINEER and not output_files:
            # 没有指定文件 → 必须允许创建新文件
            allowed_ops = task.contract.get("allowed_operations", ["edit", "create"])
            if "create" not in allowed_ops:
                allowed_ops = list(allowed_ops) + ["create"]
            # 添加强指令：直接创建代码，不要询问文件
            create_directive = (
                "\n\n【重要】\n"
                "本次任务没有预定义文件列表。请直接根据任务描述创建所需的代码文件，"
                "不要询问用户需要修改哪些文件。直接输出代码。"
            )
            if create_directive not in system_prompt:
                system_prompt += create_directive
        else:
            allowed_ops = task.contract.get(
                "allowed_operations", ["edit"])
        permissions = NodePermissions(
            allowed_operations=allowed_ops,
            allow_new_files=task.contract.get("allow_new_files", True) if (role == AgentRole.ENGINEER and not output_files) else task.contract.get("allow_new_files", False),
            allow_shell_commands=task.contract.get(
                "allow_shell_commands", False),
            allowed_shell_patterns=task.contract.get(
                "allowed_shell_patterns", []),
        )

        # 构建校验规则列表
        validation: list[ValidationRule] = []
        if task.contract.get("auto_lint", False):
            validation.append(ValidationRule(
                type="lint", name="lint",
                command=task.contract.get("lint_command", ""),
                fail_message="Lint 检查未通过",
            ))
        if task.contract.get("auto_test", False):
            validation.append(ValidationRule(
                type="test", name="test",
                command=task.contract.get("test_command", ""),
                fail_message="测试未通过",
            ))

        return AgentContract(
            contract_id=f"ct_{uuid.uuid4().hex[:12]}",
            agent_role=role,
            task_id=task.task_id,
            dag_id=task.dag_id,
            instruction=task.contract.get("instruction", ""),
            context_files=task.contract.get("read_only_files", []),
            output_files=task.contract.get("files", []),
            system_prompt_extra=system_prompt,
            max_reflections=task.contract.get("max_reflections", 3),
            timeout_seconds=task.contract.get("timeout_seconds", 120),
            repo_url=dag_state.repo_url,
            repo_path=repo_path or dag_state.repo_path or "",
            base_commit=self._resolve_base(task, dag_state),
            branch_name=task.branch_name,
            model_name=self._select_model(task),
            auto_lint=task.contract.get("auto_lint", False),
            lint_command=task.contract.get("lint_command", ""),
            auto_test=task.contract.get("auto_test", False),
            test_command=task.contract.get("test_command", ""),
            # Human-in-the-loop 字段
            permissions=permissions,
            validation=validation,
            allow_interrupt=True,
        )

    def _resolve_role(self, task: TaskInstance) -> AgentRole:
        mapping = {
            "code": AgentRole.ENGINEER,
            "test": AgentRole.TESTER,
            "review": AgentRole.REVIEWER,
            "merge": AgentRole.MERGER,
            "plan": AgentRole.PROJECT_MANAGER,
        }
        return mapping.get(task.node_type.value, AgentRole.ENGINEER)

    def _select_model(self, task: TaskInstance) -> str:
        hint = task.contract.get("model_hint", "")
        if hint in self.MODEL_MAP:
            return self.MODEL_MAP[hint]
        if task.node_type.value == "review":
            return self.MODEL_MAP["review"]
        if task.contract.get("max_reflections", 3) > 5:
            return self.MODEL_MAP["strong"]
        return self.MODEL_MAP["fast"]

    def _resolve_base(self, task: TaskInstance, dag_state: DagState) -> str:
        if not task.depends_on:
            return dag_state.base_commit
        dep_commits = []
        for dep_id in task.depends_on:
            dep = dag_state.nodes.get(dep_id)
            if dep and dep.result:
                dep_commits.append(dep.result.get("head_commit", ""))
        return dep_commits[-1] if dep_commits else dag_state.base_commit

    def build_worker_contract(self, agent_contract: AgentContract):
        from aider_worker import Contract
        return Contract(
            model_name=agent_contract.model_name,
            api_key_env_var="",
            instruction=agent_contract.instruction,
            system_prompt_extra=agent_contract.system_prompt_extra,
            repo_url=agent_contract.repo_url,
            repo_path=agent_contract.repo_path,
            base_commit=agent_contract.base_commit,
            files=agent_contract.output_files,
            read_only_files=agent_contract.context_files,
            auto_lint=agent_contract.auto_lint,
            lint_command=agent_contract.lint_command,
            auto_test=agent_contract.auto_test,
            test_command=agent_contract.test_command,
            max_reflections=agent_contract.max_reflections,
            timeout_seconds=agent_contract.timeout_seconds,
            # 权限字段
            allowed_operations=agent_contract.permissions.allowed_operations,
            allow_new_files=agent_contract.permissions.allow_new_files,
            allow_shell_commands=agent_contract.permissions.allow_shell_commands,
            allowed_shell_patterns=agent_contract.permissions.allowed_shell_patterns,
        )
