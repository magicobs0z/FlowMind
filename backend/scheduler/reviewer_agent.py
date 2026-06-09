import logging
import uuid

logger = logging.getLogger(__name__)

REVIEW_SYSTEM_PROMPT = """你是一名代码审查员，被项目经理 Flow 临时调度执行此任务。

【核心原则 — 必须遵守】
- 避免过分的夸赞，保持客观中立
- 你的判断不一定正确，需明确给出置信度
- 反复推敲，优先保证准确性
- 必要时主动索要补充信息
- 回答时保持结构化输出

请审查以下代码 diff，输出结构化审查报告。

审查维度：
1. 正确性 - 逻辑是否有缺陷？
2. 安全性 - 是否有注入、权限、数据泄露风险？
3. 性能 - 是否有可预见的性能问题？
4. 可维护性 - 命名、注释、复杂度是否合理？
5. 契约合规性 - 修改是否在白名单范围内？是否修改了不应修改的文件？

输出格式（JSON）：
{
  "approved": true/false,
  "confidence": "high|medium|low",
  "summary": "总体评价",
  "issues": [
    {"severity": "critical"|"major"|"minor", "file": "file.py", "line": 10, "description": "问题描述"}
  ],
  "recommendations": ["建议1", "建议2"]
}
"""


class ReviewerAgent:
    def __init__(self, model_name: str = "openai/GLM-4-Flash-250414"):
        self.model_name = model_name

    async def review(self, diff: str, task_context: dict,
                     worker_pool=None) -> dict:
        if not diff.strip():
            return {
                "approved": True,
                "summary": "无变更，自动通过",
                "issues": [],
                "recommendations": [],
            }

        if not worker_pool:
            return self._rule_based_review(diff, task_context)

        return await self._llm_review(diff, task_context, worker_pool)

    async def _llm_review(self, diff: str, task_context: dict,
                          worker_pool) -> dict:
        from .models import AgentContract, AgentRole
        from .contract_generator import ContractGenerator

        allowed = task_context.get("allowed_files", [])
        files_info = f"允许修改的文件：{', '.join(allowed)}" if allowed else "无限制"

        instruction = (
            f"审查以下代码变更。\n"
            f"任务描述：{task_context.get('instruction', '')}\n"
            f"{files_info}\n\n"
            f"代码 diff：\n```diff\n{diff[:6000]}\n```"
        )

        contract = AgentContract(
            contract_id=f"review_{uuid.uuid4().hex[:8]}",
            agent_role=AgentRole.REVIEWER,
            task_id=task_context.get("task_id", ""),
            dag_id=task_context.get("dag_id", ""),
            instruction=instruction,
            system_prompt_extra=REVIEW_SYSTEM_PROMPT,
            model_name=self.model_name,
            max_reflections=1,
            timeout_seconds=120,
        )

        try:
            import asyncio
            handle = await worker_pool.acquire(contract, timeout=20)
            try:
                result = await worker_pool.dispatch(handle, contract)
                output = result.get("full_diff", "")
                parsed = self._parse_review_output(output)
                if parsed:
                    return parsed
            finally:
                await worker_pool.release(handle.worker_id)
        except Exception as e:
            logger.warning("LLM review failed, fallback to rule-based: %s", e)

        return self._rule_based_review(diff, task_context)

    def _rule_based_review(self, diff: str, task_context: dict) -> dict:
        issues = []
        allowed = task_context.get("allowed_files", [])

        for line in diff.split("\n"):
            if line.startswith("+++ b/"):
                fname = line[6:]
                if allowed and fname not in allowed:
                    issues.append({
                        "severity": "critical",
                        "file": fname,
                        "line": 0,
                        "description": f"修改了白名单外的文件：{fname}",
                    })

            if "import " in line and line.startswith("+") and "os" in line:
                issues.append({
                    "severity": "major",
                    "file": "",
                    "line": 0,
                    "description": "引入了 os 模块，请确认是否有安全风险",
                })

            if "eval(" in line or "exec(" in line:
                issues.append({
                    "severity": "critical",
                    "file": "",
                    "line": 0,
                    "description": "使用了 eval/exec，存在代码注入风险",
                })

        approved = len([i for i in issues if i["severity"] == "critical"]) == 0
        return {
            "approved": approved,
            "summary": f"规则审查完成，发现 {len(issues)} 个问题"
                       + ("" if approved else "，存在严重问题"),
            "issues": issues,
            "recommendations": [
                "建议人工复核" if not approved else "无特殊建议",
            ],
        }

    def _parse_review_output(self, output: str) -> dict | None:
        import json
        import re
        try:
            json_match = re.search(r'\{[\s\S]*"approved"[\s\S]*\}', output)
            if json_match:
                return json.loads(json_match.group())
        except (json.JSONDecodeError, AttributeError):
            pass
        return None
