# Agent 模块技术文档

本文档描述 FlowMind 后端 Agent 模块的架构设计、核心组件和使用方式。

## 目录

- [架构概览](#架构概览)
- [核心组件](#核心组件)
  - [智能体类型与层级](#智能体类型与层级)
  - [LLM 执行引擎](#llm-执行引擎)
  - [工具系统](#工具系统)
  - [计划持久化](#计划持久化)
  - [后台任务服务](#后台任务服务)
  - [智能体协商总线](#智能体协商总线)
- [文件结构](#文件结构)
- [配置说明](#配置说明)
- [测试](#测试)

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent 模块架构                         │
├─────────────────────────────────────────────────────────────┤
│  Orchestrator (编排器)                                       │
│  ├── 管理智能体生命周期                                       │
│  ├── 协调任务执行                                            │
│  └── 集成 PlanManager + TaskService                          │
├─────────────────────────────────────────────────────────────┤
│  AgentEngine (LLM 执行引擎)                                  │
│  ├── OpenAIProvider / AnthropicProvider                      │
│  ├── Tool Calling 循环 (max 20 次迭代)                        │
│  └── 上下文窗口管理                                          │
├─────────────────────────────────────────────────────────────┤
│  ToolRegistry (工具注册表)                                   │
│  ├── read_file / write_file / list_directory                 │
│  ├── search_files / execute_command / git_operations         │
│  └── 统一执行接口 + 安全检查                                  │
├─────────────────────────────────────────────────────────────┤
│  AgentBus (智能体协商总线)                                   │
│  ├── 层级路由 (lead → sub_lead → coder)                      │
│  ├── 任务委托 + 结果汇总                                      │
│  └── 冲突检测 + 文件写入锁                                    │
├─────────────────────────────────────────────────────────────┤
│  PlanManager (计划管理器)                                    │
│  └── .agent/plans/ 磁盘持久化                                │
├─────────────────────────────────────────────────────────────┤
│  TaskService (后台任务服务)                                  │
│  └── 任务队列 + 超时控制 + SSE 事件流                         │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 智能体类型与层级

Agent 模块采用三层架构：

| 层级 | 类型 | 职责 | 文件 |
|------|------|------|------|
| 决策层 | `lead` | 接收用户指令、制定计划、质量把关 | `prompts/lead.ts` |
| 运营层 | `sub_lead` | 任务细化、分发、协调执行层 | `prompts/subLead.ts` |
| 执行层 | `coder` | 具体代码实现（前端/后端） | `prompts/coder.ts` |
| 执行层 | `reviewer` | 代码审查、安全审计 | `prompts/reviewer.ts` |
| 执行层 | `tester` | 测试用例编写、Bug 报告 | `prompts/tester.ts` |
| 执行层 | `explorer` | 代码库探索、依赖分析 | `prompts/explorer.ts` |

**类型定义**：`types.ts`
```typescript
type AgentType = 'lead' | 'sub_lead' | 'coder' | 'reviewer' | 'tester' | 'explorer' | 'custom';
```

**编排器初始化**：`orchestrator.ts` 中内置 7 个智能体：
- `agent_lead`
- `agent_sub_lead`
- `agent_frontend_coder`
- `agent_backend_coder`
- `agent_reviewer`
- `agent_tester`
- `agent_explorer`

### LLM 执行引擎

**核心文件**：`engine/agentEngine.ts`

AgentEngine 实现了 LLM 工具调用循环：

```typescript
class AgentEngine {
  async execute(task: string, options: ExecuteOptions): Promise<ExecuteResult> {
    // 1. 注入系统提示词
    // 2. 循环（最多 20 次）：
    //    a. 调用 LLM（带工具定义）
    //    b. 如果返回 toolCalls → 执行工具 → 结果加入 messages
    //    c. 如果返回文本 → 任务完成
    // 3. 上下文窗口管理（保留系统提示词 + 最近 10 条消息）
  }
}
```

**Provider 抽象**：`llm/types.ts`
```typescript
interface LLMProvider {
  chat(messages: LLMMessage[], tools?: ToolDefinition[], options?: LLMOptions): Promise<LLMResponse>;
  streamChat(messages: LLMMessage[], tools?: ToolDefinition[], options: LLMOptions, onChunk: (chunk: LLMStreamChunk) => void): Promise<LLMResponse>;
}
```

**支持的 Provider**：
- `OpenAIProvider` (`llm/openaiProvider.ts`) — GPT-4/GPT-3.5，function calling
- `AnthropicProvider` (`llm/anthropicProvider.ts`) — Claude，tool use

**Provider 工厂**：`llm/providerFactory.ts`
```typescript
const provider = createProvider({ provider: 'openai', apiKey: 'sk-...', modelName: 'gpt-4' });
```

### 工具系统

**核心文件**：`tools/toolRegistry.ts`

所有工具实现 `ToolDefinition` 接口：

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}
```

**已注册工具**：

| 工具 | 文件 | 功能 | 安全特性 |
|------|------|------|----------|
| `read_file` | `tools/readFile.ts` | 读取文件内容 | 路径校验、行范围、二进制检测、大小限制 |
| `write_file` | `tools/writeFile.ts` | 写入文件内容 | 自动创建目录、符号链接防护、路径校验 |
| `list_directory` | `tools/listDirectory.ts` | 列出目录内容 | 递归控制、忽略模式、最大结果限制 |
| `search_files` | `tools/searchFiles.ts` | 内容搜索 | 基于 ripgrep，正则/字面量、大小写控制 |
| `execute_command` | `tools/executeCommand.ts` | 执行命令 | 超时控制、输出截断、危险命令拦截 |
| `git_operations` | `tools/gitOperations.ts` | Git 操作 | 白名单限制（status/diff/log/branch 等） |

**安全路径解析**：`tools/shared.ts`
```typescript
// 拒绝路径穿越
resolveToolPath('../../etc/passwd', '/project'); // 抛出错误：Path escapes worktree

// 自动解析符号链接
safeRealpathSync('/project/src'); // 返回真实路径
```

**使用示例**：
```typescript
import { ToolRegistry } from './tools';

const registry = new ToolRegistry();
const result = await registry.executeTool('read_file', {
  filePath: 'src/index.ts',
  startLine: 1,
  endLine: 50
}, { worktree: '/project' });
```

### 计划持久化

**核心文件**：`plans/manager.ts`

PlanManager 管理任务计划的 CRUD 和持久化：

```typescript
class PlanManager {
  async createPlan(title: string, description: string): Promise<Plan>;
  async getPlan(id: string): Promise<Plan | null>;
  async updatePlan(id: string, updates: Partial<Plan>): Promise<Plan>;
  async listPlans(): Promise<Plan[]>;
  async archivePlan(id: string): Promise<void>;
  async getActivePlan(): Promise<Plan | null>;
  async setActivePlan(id: string): Promise<void>;
}
```

**存储格式**：
- JSON: `.agent/plans/<planId>/plan.json` — 程序读取
- Markdown: `.agent/plans/active.md` — 人类可读

**使用示例**：
```typescript
import { PlanManager } from './plans';

const planManager = new PlanManager('/project');
const plan = await planManager.createPlan('实现登录功能', '包括前端 UI 和后端 API');
await planManager.setActivePlan(plan.id);
```

### 后台任务服务

**核心文件**：`tasks/taskService.ts`

TaskService 管理异步任务队列：

```typescript
class TaskService extends EventEmitter {
  createTask(title, description, agentId, sessionId, payload, priority, timeoutMs): AgentTask;
  startTask(id): void;
  updateProgress(id, progress): void;
  completeTask(id, result): void;
  failTask(id, error): void;
  cancelTask(id): void;
  heartbeat(id): void;
}
```

**任务状态机**：
```
queued → dispatching → running → completed
                          ↓
                     failed / timed_out / cancelled
```

**超时控制**：默认 5 分钟，每 10 秒检查一次超时任务。

**SSE 事件流**：`GET /api/v1/tasks/:id/events`

```typescript
// 前端订阅任务事件
const eventSource = new EventSource('/api/v1/tasks/123/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.task.status, data.task.progress);
};
```

### 智能体协商总线

**核心文件**：`agentBus.ts`

AgentBus 提供智能体间通信和协商机制：

```typescript
class AgentBus {
  // 层级路由
  routeRequest(request: AgentRequest): Promise<AgentResponse>;

  // 任务委托
  delegateTask(fromAgentId: string, toAgentId: string, task: TaskPayload): Promise<AgentResponse>;

  // 结果汇总
  aggregateResults(sessionId: string): Promise<AggregatedResult>;

  // 协商（考虑层级权重）
  negotiate(request: NegotiationRequest): Promise<NegotiationResult>;

  // 冲突检测
  detectConflict(request1: AgentRequest, request2: AgentRequest): ConflictResult;
}
```

**层级权重**：
```typescript
const AGENT_HIERARCHY = {
  lead: 3,
  sub_lead: 2,
  coder: 1, reviewer: 1, tester: 1, explorer: 1,
  custom: 0
};
```

**文件写入锁**：`conflictDetector.ts`
```typescript
// 获取文件锁
conflictDetector.acquireFileLock('src/index.ts', 'agent_coder', 300000);

// 检查锁状态
conflictDetector.checkFileLock('src/index.ts', 'agent_reviewer');
// { locked: true, holder: 'agent_coder', expiresAt: ... }
```

## 文件结构

```
agent/
├── engine/                     # LLM 执行引擎
│   ├── agentEngine.ts          # 核心执行循环
│   ├── index.ts                # 导出
│   └── __tests__/
│       └── agentEngine.test.ts
├── llm/                        # LLM Provider
│   ├── types.ts                # 接口定义
│   ├── openaiProvider.ts       # OpenAI 适配
│   ├── anthropicProvider.ts    # Anthropic 适配
│   ├── providerFactory.ts      # 工厂函数
│   ├── index.ts                # 导出
│   └── types.ts
├── tools/                      # 工具系统
│   ├── types.ts                # 工具接口
│   ├── shared.ts               # 通用工具函数
│   ├── readFile.ts             # 读取文件
│   ├── writeFile.ts            # 写入文件
│   ├── listDirectory.ts        # 列出目录
│   ├── searchFiles.ts          # 搜索文件
│   ├── executeCommand.ts       # 执行命令
│   ├── gitOperations.ts        # Git 操作
│   ├── toolRegistry.ts         # 工具注册表
│   ├── index.ts                # 导出
│   └── __tests__/              # 测试
│       ├── shared.test.ts
│       ├── toolRegistry.test.ts
│       ├── readFile.test.ts
│       ├── writeFile.test.ts
│       └── executeCommand.test.ts
├── plans/                      # 计划持久化
│   ├── types.ts                # 计划类型
│   ├── fileStorage.ts          # 文件存储
│   ├── manager.ts              # 计划管理器
│   └── index.ts                # 导出
├── tasks/                      # 后台任务
│   ├── types.ts                # 任务类型
│   ├── taskService.ts          # 任务服务
│   ├── controller.ts           # API 控制器
│   ├── index.ts                # 导出
│   └── __tests__/
│       └── taskService.test.ts
├── prompts/                    # 提示词系统
│   ├── types.ts                # 提示词类型
│   ├── manager.ts              # 提示词管理器
│   ├── systemBase.ts           # 系统基础提示词
│   ├── lead.ts                 # Lead 提示词
│   ├── subLead.ts              # SubLead 提示词
│   ├── coder.ts                # Coder 提示词
│   ├── reviewer.ts             # Reviewer 提示词
│   ├── tester.ts               # Tester 提示词
│   ├── explorer.ts             # Explorer 提示词
│   ├── productManager.ts       # (旧) 产品经理
│   ├── projectManager.ts       # (旧) 项目经理
│   ├── frontendEngineer.ts     # (旧) 前端工程师
│   ├── backendEngineer.ts      # (旧) 后端工程师
│   ├── skills/                 # Skill 规范
│   │   ├── fileOperation.ts
│   │   └── collaboration.ts
│   └── index.ts                # 导出
├── types.ts                    # 核心类型定义
├── agentRegistry.ts            # 智能体注册表
├── agentBus.ts                 # 智能体协商总线
├── conflictDetector.ts         # 冲突检测器
├── contractValidator.ts        # 契约验证器
├── orchestrator.ts             # 编排器
├── orchestratorController.ts   # 编排器控制器
├── controller.ts               # 通用控制器
├── routes.ts                   # 路由配置
└── index.ts                    # 模块入口
```

## 配置说明

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `OPENAI_API_KEY` | 条件 | - | OpenAI API Key（使用 OpenAI 时必填） |
| `ANTHROPIC_API_KEY` | 条件 | - | Anthropic API Key（使用 Anthropic 时必填） |
| `LLM_PROVIDER` | 否 | `openai` | LLM Provider 类型：`openai` 或 `anthropic` |
| `LLM_MODEL` | 否 | `gpt-4` | 模型名称 |
| `LLM_TEMPERATURE` | 否 | `0.7` | 温度参数 |
| `LLM_MAX_TOKENS` | 否 | `4096` | 最大 token 数 |
| `AGENT_WORKTREE` | 否 | `process.cwd()` | Agent 工作目录 |
| `AGENT_MAX_ITERATIONS` | 否 | `20` | 最大工具调用迭代次数 |
| `TASK_TIMEOUT_MS` | 否 | `300000` | 任务超时时间（毫秒） |
| `TASK_HEARTBEAT_INTERVAL_MS` | 否 | `10000` | 心跳检测间隔（毫秒） |

### 使用示例

**初始化 Orchestrator**：
```typescript
import { MultiAgentOrchestrator } from './orchestrator';
import { ToolRegistry } from './tools';
import { createProvider } from './llm';

const toolRegistry = new ToolRegistry();
const llmProvider = createProvider({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4'
});

const orchestrator = new MultiAgentOrchestrator(toolRegistry, llmProvider);
```

**创建会话并执行任务**：
```typescript
const session = await orchestrator.createSession({
  name: '登录功能开发',
  description: '实现用户登录功能'
});

await orchestrator.executeTask(session.id, {
  title: '实现登录 API',
  description: '创建 /api/login 接口',
  targetAgentId: 'agent_backend_coder'
});
```

## 测试

### 运行所有 Agent 模块测试

```bash
cd flowmind/backend
npm test -- --testPathPattern="modules/agent"
```

### 测试覆盖

| 测试文件 | 用例数 | 覆盖内容 |
|----------|--------|----------|
| `tools/__tests__/shared.test.ts` | 28 | 路径安全、文件操作、命令执行 |
| `tools/__tests__/toolRegistry.test.ts` | 8 | 工具注册、执行 |
| `tools/__tests__/readFile.test.ts` | 6 | 文件读取 |
| `tools/__tests__/writeFile.test.ts` | 4 | 文件写入 |
| `tools/__tests__/executeCommand.test.ts` | 11 | 命令执行、超时 |
| `engine/__tests__/agentEngine.test.ts` | 7 | LLM 循环、上下文管理 |
| `tasks/__tests__/taskService.test.ts` | 34 | 状态机、超时、事件 |

**总计：98 个测试用例**

### 添加新测试

```typescript
// tools/__tests__/myTool.test.ts
import { describe, it, expect } from 'vitest';
import { myTool } from '../myTool';

describe('myTool', () => {
  it('should do something', async () => {
    const result = await myTool.execute({ param: 'value' }, { worktree: '/tmp' });
    expect(result.ok).toBe(true);
  });
});
```
