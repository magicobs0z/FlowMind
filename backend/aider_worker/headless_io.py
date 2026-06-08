from dataclasses import dataclass, field
from typing import List

from aider.io import InputOutput
from prompt_toolkit.enums import EditingMode


@dataclass
class Event:
    type: str
    message: str
    data: dict = field(default_factory=dict)


class HeadlessIO(InputOutput):
    """无头 IO：替换所有终端交互为结构化事件采集。"""

    def __init__(self, events: List[Event] = None, **kwargs):
        self.events = events or []
        self.last_assistant_content = None

        kwargs.setdefault("fancy_input", False)
        kwargs.setdefault("pretty", False)
        kwargs.setdefault("yes", True)

        super().__init__(
            pretty=kwargs.pop("pretty", False),
            yes=kwargs.pop("yes", True),
            fancy_input=kwargs.pop("fancy_input", False),
            input_history_file=kwargs.get("input_history_file"),
            chat_history_file=kwargs.get("chat_history_file"),
            llm_history_file=kwargs.get("llm_history_file"),
            encoding=kwargs.get("encoding", "utf-8"),
            dry_run=kwargs.get("dry_run", False),
            editingmode=EditingMode.EMACS,
            notifications=False,
            notifications_command=None,
            multiline_mode=False,
            root=".",
        )

    def get_input(self, root, rel_fnames, addable_rel_fnames, commands,
                  abs_read_only_fnames=None, edit_format=None):
        raise RuntimeError(
            "HeadlessIO does not support interactive input. "
            "Use coder.run(with_message=...) instead."
        )

    def confirm_ask(self, question, default="y", **kwargs):
        return True

    def prompt_ask(self, question, default="", subject=None):
        return default

    def offer_url(self, url, prompt="Open URL for more info?", allow_never=True):
        return False

    def rule(self):
        pass

    def tool_output(self, *messages, log_only=False, bold=False):
        if messages:
            hist = " ".join(messages)
            self.events.append(Event("output", hist.strip(), {"bold": bold}))

    def tool_error(self, message="", strip=True):
        if message:
            self.events.append(Event("error", str(message).strip()))

    def tool_warning(self, message="", strip=True):
        if message:
            self.events.append(Event("warning", str(message).strip()))

    def assistant_output(self, message, pretty=None):
        self.last_assistant_content = message
        self.events.append(Event("assistant", message, {"pretty": pretty}))

    def ring_bell(self):
        pass

    def get_assistant_mdstream(self):
        return None

    def append_chat_history(self, text, linebreak=False, blockquote=False, strip=True):
        pass

    def log_llm_history(self, role, content):
        pass

    def get_default_notification_command(self):
        return None

    def format_files_for_input(self, rel_fnames, rel_read_only_fnames):
        parts = []
        if rel_fnames:
            parts.append(", ".join(rel_fnames))
        if rel_read_only_fnames:
            parts.append("(read only): " + ", ".join(rel_read_only_fnames))
        return " ".join(parts)
