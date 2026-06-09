import sys
from pathlib import PurePosixPath, Path

from aider.coders.editblock_coder import EditBlockCoder
from aider.coders.ask_coder import AskCoder
from aider.coders.wholefile_coder import WholeFileCoder


class HeadlessCoder(EditBlockCoder):
    """无头 Coder — 使用 SEARCH/REPLACE 格式编辑代码。

    核心控制：
    - allowed_files 白名单：只允许编辑指定文件
    - extra_system_prompt：注入额外约束
    - 禁止所有交互输入
    """

    def __init__(self, main_model, io, *,
                 allowed_files=None,
                 extra_system_prompt=None,
                 max_reflections=None,
                 **kwargs):
        self.allowed_files = set(allowed_files or [])
        self.extra_system_prompt = extra_system_prompt

        kwargs.setdefault("auto_commits", True)
        kwargs.setdefault("dirty_commits", True)

        super().__init__(main_model, io, **kwargs)

        if max_reflections is not None:
            self.max_reflections = max_reflections

    def allowed_to_edit(self, path):
        if self.allowed_files:
            path_obj = PurePosixPath(path)
            allowed = set()
            for f in self.allowed_files:
                allowed.add(f)
                allowed.add(str(PurePosixPath(f).name))
            if str(path_obj) not in allowed and str(path_obj.name) not in allowed:
                return False
        return super().allowed_to_edit(path)

    def check_for_file_mentions(self, content):
        return None

    def check_for_urls(self, inp):
        return inp

    def keyboard_interrupt(self):
        sys.exit(1)

    def format_chat_chunks(self):
        chunks = super().format_chat_chunks()
        if self.extra_system_prompt:
            for msg in chunks.system:
                if msg["role"] == "system":
                    # 将 extra_system_prompt 作为覆写指令前置到 aider 系统提示词之前
                    override = (
                        "【强制覆写 — 优先于以下所有指令执行】\n"
                        f"{self.extra_system_prompt}\n\n"
                        "【格式约束 — 必须同时遵守】\n"
                    )
                    msg["content"] = override + msg["content"]
        return chunks

    def get_chat_files_messages(self):
        """Override: tell the model to create new files directly instead of asking user to add them."""
        if self.abs_fnames:
            files_content = self.gpt_prompts.files_content_prefix
            files_content += self.get_files_content()
            files_reply = self.gpt_prompts.files_content_assistant_reply
            return [
                dict(role="user", content=files_content),
                dict(role="assistant", content=files_reply),
            ]
        return [
            dict(
                role="user",
                content=(
                    "I am not sharing any existing files. "
                    "Create the required new files directly using *SEARCH/REPLACE* blocks. "
                    "Do NOT ask me to add files to the chat."
                ),
            ),
            dict(role="assistant", content=(
                "Ok, I will create new files directly using *SEARCH/REPLACE* blocks "
                "without asking you to add files to the chat."
            )),
        ]


class HeadlessWholeFileCoder(WholeFileCoder):
    """无头 WholeFile Coder — 使用全文件替换格式（对 GLM 等模型兼容性更好）。

    核心控制：
    - allowed_files 白名单：只允许编辑指定文件
    - extra_system_prompt：注入额外约束
    - 禁止所有交互输入

    格式要求（由 WholeFileCoder 定义）：
    path/to/file.py
    ```python
    // entire file content
    ```
    """

    def __init__(self, main_model, io, *,
                 allowed_files=None,
                 extra_system_prompt=None,
                 max_reflections=None,
                 **kwargs):
        self.allowed_files = set(allowed_files or [])
        self.extra_system_prompt = extra_system_prompt

        kwargs.setdefault("auto_commits", True)
        kwargs.setdefault("dirty_commits", True)

        super().__init__(main_model, io, **kwargs)

        if max_reflections is not None:
            self.max_reflections = max_reflections

    def allowed_to_edit(self, path):
        if self.allowed_files:
            path_obj = PurePosixPath(path)
            allowed = set()
            for f in self.allowed_files:
                allowed.add(f)
                allowed.add(str(PurePosixPath(f).name))
            if str(path_obj) not in allowed and str(path_obj.name) not in allowed:
                return False
        return super().allowed_to_edit(path)

    def check_for_file_mentions(self, content):
        return None

    def check_for_urls(self, inp):
        return inp

    def keyboard_interrupt(self):
        sys.exit(1)

    def format_chat_chunks(self):
        chunks = super().format_chat_chunks()
        if self.extra_system_prompt:
            for msg in chunks.system:
                if msg["role"] == "system":
                    # 角色约束作为前置指令注入，不额外添加模板文字
                    msg["content"] = (
                        f"【任务指令 — 最高优先级】\n{self.extra_system_prompt}\n\n"
                        f"{msg['content']}"
                    )
        return chunks

    def get_chat_files_messages(self):
        """Override: tell the model to create new files directly instead of asking user to add them."""
        if self.abs_fnames:
            files_content = self.gpt_prompts.files_content_prefix
            files_content += self.get_files_content()
            files_reply = self.gpt_prompts.files_content_assistant_reply
            return [
                dict(role="user", content=files_content),
                dict(role="assistant", content=files_reply),
            ]
        return [
            dict(
                role="user",
                content=(
                    "No existing files provided. "
                    "Create required files directly using WholeFile format: filename on its own line, "
                    "then a code block with the full file content. Do NOT ask to add files."
                ),
            ),
            dict(role="assistant", content="Understood. I will create files directly using WholeFile format."),
        ]


class HeadlessAskCoder(AskCoder):
    """无头 Ask Coder — 只提问不修改代码。

    用于只读分析任务，同样受 Contract 约束。
    """

    def __init__(self, main_model, io, *,
                 allowed_files=None,
                 extra_system_prompt=None,
                 max_reflections=None,
                 **kwargs):
        self.allowed_files = set(allowed_files or [])
        self.extra_system_prompt = extra_system_prompt

        kwargs.setdefault("auto_commits", True)
        kwargs.setdefault("dirty_commits", True)

        super().__init__(main_model, io, **kwargs)

        if max_reflections is not None:
            self.max_reflections = max_reflections

    def allowed_to_edit(self, path):
        return False  # AskCoder 不允许编辑

    def check_for_file_mentions(self, content):
        return None

    def check_for_urls(self, inp):
        return inp

    def keyboard_interrupt(self):
        sys.exit(1)
