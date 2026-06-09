from dataclasses import dataclass, field
from typing import List, Dict


@dataclass
class Contract:
    model_name: str = "claude-sonnet-4-20250514"
    api_key_env_var: str = ""

    instruction: str = ""
    system_prompt_extra: str = ""

    repo_url: str = ""
    base_commit: str = ""
    repo_path: str = ""  # 本地仓库路径
    files: List[str] = field(default_factory=list)
    read_only_files: List[str] = field(default_factory=list)
    clone_depth: int = 1

    auto_lint: bool = False
    lint_command: str = ""
    auto_test: bool = False
    test_command: str = ""
    max_reflections: int = 3
    dry_run: bool = False

    timeout_seconds: int = 120

    # Human-in-the-loop: 权限控制
    allowed_operations: List[str] = field(default_factory=lambda: ["edit"])
    allow_new_files: bool = False
    allow_shell_commands: bool = False
    allowed_shell_patterns: List[str] = field(default_factory=list)

    extra_params: Dict[str, str] = field(default_factory=dict)

    # Coder 类型：默认 None 使用 HeadlessCoder（编辑模式），"ask" 使用 HeadlessAskCoder（只读问答）
    coder_type: str = ""

    # 上下文管理
    retain_state: bool = False  # 是否保留 sandbox/coder 跨调用复用
    session_id: str = ""        # 会话标识，用于恢复上下文
    task_id: str = ""           # TodoService 任务 ID（{dag_id}:{node_id}），用于进度上报

    def validate_permissions(self, operation: str, target: str = "") -> tuple[bool, str]:
        """校验操作是否在契约权限范围内。

        Returns:
            (allowed: bool, reason: str)
        """
        if operation == "edit":
            if "edit" not in self.allowed_operations:
                return False, f"operation '{operation}' not in allowed_operations"
            return True, ""

        if operation == "create_file":
            if not self.allow_new_files:
                return False, "creating new files is not allowed by contract"
            if target and self.files:
                # 检查目标路径是否在允许的目录范围内
                allowed = False
                for f in self.files:
                    if target.startswith(f.rsplit("/", 1)[0] if "/" in f else ""):
                        allowed = True
                        break
                if not allowed:
                    return False, f"new file '{target}' not in allowed directories"
            return True, ""

        if operation == "shell_command":
            if not self.allow_shell_commands:
                return False, "shell commands are not allowed by contract"
            if self.allowed_shell_patterns and target:
                import re
                if not any(re.match(p, target) for p in self.allowed_shell_patterns):
                    return False, f"shell command '{target}' not in allowed patterns"
            return True, ""

        return False, f"unknown operation '{operation}'"
