# FlowMind 多 Agent 调度系统 — 技术架构

## 项目结构

```
FlowMind/
├── aider/                          # Aider 源码（已整合到项目内，零修改）
│   ├── coders/                     # 编码器实现（editblock, udiff, wholefile等）
│   ├── queries/                    # tree-sitter 语法查询文件
│   ├── resources/                  # 模型元数据
│   ├── __init__.py
│   ├── models.py                   # LLM 模型适配层
│   ├── io.py                       # 输入输出抽象
│   ├── repo.py                     # Git 仓库操作
│   └── ...
├── backend/
│   ├── aider_worker/               # Aider 无头 Worker（核心代码生成引擎）
│   │   ├── gen/                    # gRPC protobuf 生成代码
│   │   ├── proto/                  # protobuf 定义文件
│   │   ├── contract.py             # 契约数据类（Contract/NodePermissions）
│   │   ├── headless_coder.py       # HeadlessCoder — 无交互模式的 Coder 封装
│   │   ├── headless_io.py          # HeadlessIO — 无交互 I/O 模拟
│   │   ├── sandbox.py              # 沙箱执行环境
│   │   ├── worker.py               # AiderWorker — 核心 Worker 实现
│   │   ├── worker_main.py          # Worker 入口（gRPC 服务）
│   │   └── worker_server.py        # Worker gRPC 服务端
│   └── scheduler/                  # 调度中心
│       ├── planning_agent.py       # FlowAgent — PM Agent（需求拆解 + DAG 规划）
│       ├── scheduler_core.py       # SchedulerCore — DAG 执行引擎
│       ├── contract_generator.py   # 契约生成器（DAG 节点 → Contract）
│       ├── dag_parser.py           # DAG 解析器（拓扑排序 + 批次调度）
│       ├── worker_pool.py          # Worker 池管理（gRPC / InProc）
│       ├── models.py               # 核心数据模型（AgentRole, TaskDAG, Contract）
│       ├── event_bus.py            # 事件总线
│       ├── git_branch_manager.py   # Git 分支管理（任务分支 + diff 合并）
│       ├── persistence.py          # SQLite 持久化层
│       ├── auth.py                 # JWT + API Key 鉴权
│       ├── logging.py              # 结构化日志 + trace_id
│       ├── rate_limiter.py         # 滑动窗口限流器
│       ├── metrics.py              # Prometheus 指标收集
│       ├── notification.py         # 通知服务（Console/Webhook/DingTalk）
│       ├── redis_service.py        # Redis 服务发现 + 动态配置
│       ├── stress_test.py          # 压力测试框架
│       ├── reviewer_agent.py       # Reviewer Agent 角色
│       ├── tester_agent.py         # Tester Agent 角色
│       ├── merge_agent.py          # Merge Agent 角色
│       ├── cost_monitor.py         # Token 成本监控
│       ├── knowledge_service.py    # 知识库服务
│       ├── todo_service.py         # TODO 管理服务
│       ├── verifier.py             # 结果校验器
│       ├── main.py                 # FastAPI 主入口
│       └── api.py                  # REST API 路由
├── .env.bat                        # 环境激活脚本
├── setup.bat                       # 环境初始化脚本（CMD）
├── setup.ps1                       # 环境初始化脚本（PowerShell）
└── .gitignore
```

## 架构分层

```
用户需求 (自然语言)
    │
    ▼
┌─────────────────────────────────────────┐
│  FlowAgent (PlanningAgent)              │
│  ├─ 复杂度自评估（规则匹配）            │
│  ├─ 简单模式 → 直接调用 AiderWorker     │
│  └─ 复杂模式 → DAG 生成                 │
└────────────────┬────────────────────────┘
                 │ DAG
                 ▼
┌─────────────────────────────────────────┐
│  SchedulerCore                          │
│  ├─ DAG 拓扑排序 → 批次调度             │
│  ├─ 契约生成（ContractGenerator）       │
│  ├─ Worker 分发（WorkerPool）           │
│  ├─ Git 分支管理（GitBranchManager）    │
│  └─ 结果收集 + 合并                     │
└────────────────┬────────────────────────┘
                 │ Contract
                 ▼
┌─────────────────────────────────────────┐
│  AiderWorker (Engineer/Tester/Reviewer) │
│  ├─ 沙箱隔离（Sandbox）                 │
│  ├─ HeadlessCoder（aider 无头模式）     │
│  ├─ 代码生成 + diff 收集                │
│  └─ 结果返回                            │
└─────────────────────────────────────────┘
```

## 核心流程

### 1. 需求接收
用户输入自然语言需求 → FlowAgent.process_request()

### 2. 复杂度评估
规则引擎根据关键词判断 simple / complex：
- simple: 单文件、单函数、单测试等
- complex: 多组件、认证、完整页面等

### 3. DAG 生成（复杂模式）
- FlowAgent._create_blueprint() → LLM 输出 JSON 阶段规划
- FlowAgent._breakdown() → LLM 将阶段拆解为 DAG 节点
- 兜底：规则生成（_rule_based_dag()）

### 4. 契约生成
每个 DAG 节点 → Contract（角色 + 文件 + 指令 + 权限 + 验证规则）

### 5. 执行
SchedulerCore 按拓扑批次调度：
1. code 节点 → Engineer Worker（代码生成）
2. test 节点 → Tester Worker（测试执行）
3. review 节点 → Reviewer Worker（代码审查）
4. merge 节点 → Merge Worker（分支合并）

## 角色系统

| 角色 | AgentRole | DAG node_type | 职责 |
|------|-----------|---------------|------|
| PM (Project Manager) | pm | — | 需求理解 + 任务拆解 |
| Engineer | engineer | code | 代码生成/修改 |
| Tester | tester | test | 编写/运行测试 |
| Reviewer | reviewer | review | 代码审查 |
| Merger | merger | merge | 分支合并 |

## 隔离与安全

- **沙箱隔离**：每个 Worker 在临时目录（`%TEMP%/aider_worker_*`）中工作
- **文件白名单**：契约限定可修改文件列表
- **Git 分支隔离**：每个任务创建独立 feature branch
- **令牌限流**：滑动窗口限制 API 调用频率
- **鉴权**：JWT + API Key 双认证

## 持久化

SQLite 数据库 (`flowmind.db`)：
- `tasks` — 任务状态
- `milestones` — 里程碑
- `workflow_contracts` — 契约
- `events` — 事件
- `tokens` — Token 统计

## 依赖说明

所有依赖已整合到 `FlowMind/` 内，无需外部 `lib/` 目录：
- `FlowMind/aider/` — Aider 源码（代码生成引擎）
- `FlowMind/backend/aider_worker/` — 自定义 Worker 封装
- `FlowMind/backend/scheduler/` — 调度中心

PYTHONPATH 需要包含：
```powershell
$env:PYTHONPATH = "FlowMind;FlowMind\backend"
```
