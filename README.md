# FlowMind — Multi-Agent Scheduler

FlowMind 是一个基于 DAG 的多智能体调度框架，通过一个统一的项目经理智能体（FlowAgent）接收用户需求，自动进行复杂度评估，将复杂任务拆解为有向无环图（DAG）并调度多个 AI Agent（AiderWorker）并行/串行执行。

## 核心架构

```
用户需求 → FlowAgent (PM)
              │
              ├─ 简单 → 内部消化（AiderWorker 直接执行）
              │
              └─ 复杂 → 规划蓝图 → 拆解 DAG
                               │
                     SchedulerCore 调度执行
                     ┌────┬────┬────┬────┐
                     │ C1 │ C2 │ T1 │ R1 │  ← Agent 节点
                     └────┴────┴────┴────┘
                        │     │     │
                    Contract   Contract    ← 结构化契约
                    (权限+校验+角色+指令)
                        │     │     │
                    AiderWorker 执行代码生成
                        │     │     │
                     Git 分支 → Merge → Master
```

## 核心模块

| 模块 | 文件 | 职责 |
|---|---|---|
| FlowAgent | `planning_agent.py` | 统一对话入口，复杂度自检，规划+拆解 |
| SchedulerCore | `scheduler_core.py` | DAG 调度引擎，Worker 管理，TODO 集成，HITL |
| DAGParser | `dag_parser.py` | 拓扑排序，批次划分，依赖推进 |
| ContractGenerator | `contract_generator.py` | 角色片段注入，权限/校验构建 |
| TodoService | `todo_service.py` | 非侵入式进度监控，里程碑管理 |
| AiderWorker | `aider_worker/worker.py` | 基于 Aider 的代码生成执行器 |
| MergeAgent | `merge_agent.py` | Git 分支合并与冲突处理 |
| Verifier/RetryController | `verifier.py` | 任务输出自动验证与重试 |

## 关键设计

### 契约机制

每个 DAG 节点执行前生成 `AgentContract`，包含：
- **指令**：具体编码任务描述
- **权限**：`NodePermissions`（允许操作、允许新建文件、允许 shell 命令）
- **校验**：`ValidationRule`（lint 规则、测试命令）
- **角色片段**：按需注入 Engineer/Tester/Reviewer 行为约束
- **超时**：`timeout_seconds`

### Human-in-the-loop

- 当 Worker 越权（修改未授权文件、执行 shell）时触发 `HumanInterruptRequest`
- DAG 自动挂起，等待人类审批或拒绝
- 合并冲突同样通过 HITL 机制处理

### TODO 监控

- 非侵入式：`TodoService` 只做状态采集，不干预调度
- `update_task` / `report_block` / `agent_heartbeat` 全链路集成
- 里程碑自动完成：子任务全部完成时自动标记 milestone 为 completed

### 链式 Diff

- 每个 AiderWorker 在独立分支上工作
- 任务成功执行后，`merge_node` 合并到 master
- 后续节点的 `base_commit` 自动指向前序节点的 master HEAD

## 快速开始

### 环境准备

```bash
# Python 3.11+
pip install -r requirements.txt

# 设置环境变量
cp .env.bat FlowMind/
# 编辑 FlowMind/.env.bat 设置 API Key
```

### 运行调度

```python
from FlowMind.backend.scheduler import SchedulerCore, FlowAgent

sc = SchedulerCore(repo_path="./workspace")
result = await sc.submit_task(
    requirement="为用户管理系统实现邮箱注册接口",
    repo_url="./workspace",
)
```

### E2E 测试

```bash
python scripts/test_e2e_real_complex.py
```

8 维验收标准：
1. 多 Agent 触发（FlowAgent 生成 DAG）
2. 契约完整性（权限+校验+超时）
3. TODO 初始化（milestone + task）
4. 进度实时更新（changelog）
5. 契约边界保护（HumanInterrupt）
6. 自动校验与重试（retry flow）
7. 合并与冲突处理
8. 事件与时间轴一致

## 模型配置

模型映射在 `contract_generator.py` 中配置：

| 角色 | 模型 | 用途 |
|---|---|---|
| fast | `GLM-4-FlashX` | 常规编码 |
| strong | `GLM-4-Plus` | 复杂逻辑 |
| review | `GLM-4-AirX` | 代码审查 |

## 许可

MIT License