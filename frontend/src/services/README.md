# 前端 Agent 服务层文档

本文档描述 FlowMind 前端 Agent 相关的服务层架构和使用方式。

## 架构概览

前端 Agent 执行流程已从"直接调用 LLM"重构为"调用后端 API"：

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 Agent 执行流程                       │
├─────────────────────────────────────────────────────────────┤
│  用户输入 → AgentExecutor.executeTask()                      │
│       ↓                                                     │
│  1. 确保 Session（自动创建或复用）                            │
│  2. 调用 taskApi.createTask() 创建后端任务                    │
│  3. 调用 taskApi.watchTask() 启动 SSE/轮询监听               │
│  4. 调用后端 execute API 触发执行                            │
│       ↓                                                     │
│  SSE 事件流 / 轮询更新 → 更新前端状态                         │
│       ↓                                                     │
│  任务完成 → 返回结果                                         │
└─────────────────────────────────────────────────────────────┘
```

## 核心服务

### AgentExecutor (`agentExecutor.ts`)

AgentExecutor 是前端 Agent 执行的入口，负责协调任务创建、状态监听和结果返回。

```typescript
class AgentExecutor {
  async executeTask(
    task: AgentTask,
    context: AgentExecutionContext
  ): Promise<AgentExecutionResult> {
    // 1. 确保 sessionId（没有则自动创建默认会话）
    // 2. 调用后端 POST /api/v1/agents/sessions/:id/tasks 创建任务
    // 3. 调用 watchTask 启动 SSE/轮询监听
    // 4. 调用后端 POST /api/v1/agents/sessions/:id/tasks/:taskId/execute 执行
    // 5. 等待任务完成，返回结果
  }

  stop(): void {
    // 调用后端 POST /api/v1/tasks/:id/cancel 取消任务
  }
}
```

**关键变化**：
- ❌ 移除：直接调用 LLM（`callLLM`、`buildSystemPrompt`、`extractToolCalls` 等）
- ✅ 新增：通过 `taskApi` 调用后端 API
- ✅ 保留：日志记录、状态管理、错误处理

### TaskApi (`taskApi.ts`)

TaskApi 封装了后端任务相关的 API 调用，提供统一的任务管理接口。

```typescript
const taskApi = {
  // 创建任务
  async createTask(sessionId: string, task: Partial<AgentTask>): Promise<{ taskId: string }>;

  // 执行任务
  async executeTask(sessionId: string, taskId: string): Promise<void>;

  // 获取任务详情
  async getTask(taskId: string): Promise<BackendTask>;

  // 取消任务
  async cancelTask(taskId: string): Promise<void>;

  // SSE 订阅任务事件（优先）
  subscribeToEvents(taskId: string, onEvent: (event: TaskEvent) => void): EventSource;

  // 轮询任务状态（降级方案）
  pollTaskStatus(taskId: string, onUpdate: (task: BackendTask) => void, interval?: number): { stop: () => void };

  // 智能监听（SSE 优先，降级轮询）
  watchTask(taskId: string, callbacks: WatchCallbacks): { stop: () => void };
};
```

**实时更新机制**：

```typescript
// 优先使用 SSE，不支持时降级到轮询
const { stop } = taskApi.watchTask(taskId, {
  onProgress: (progress) => console.log(`进度: ${progress}%`),
  onLog: (log) => console.log(`[${log.level}] ${log.message}`),
  onComplete: (result) => console.log('任务完成:', result),
  onError: (error) => console.error('任务失败:', error),
  onStatusChange: (status) => console.log('状态变更:', status),
});

// 停止监听
stop();
```

### API 客户端 (`api.ts`)

使用 axios 封装的 API 客户端，所有服务层统一使用。

```typescript
import api from './api';

// 自动处理 baseURL、超时、错误拦截
const response = await api.post('/agents/sessions', { name: '会话名称' });
```

## 状态管理

### Agent Store (`store/index.ts`)

Zustand 状态管理，维护 Agent 相关的全局状态。

```typescript
interface AgentState {
  // 智能体列表
  agents: AgentInfo[];

  // 当前会话 ID
  currentSessionId: string | null;

  // 任务列表
  tasks: AgentTask[];

  // 当前执行任务
  currentTask: AgentTask | null;

  // 执行状态
  isExecuting: boolean;

  // 日志
  logs: AgentLog[];

  // Actions
  setAgents: (agents: AgentInfo[]) => void;
  updateAgent: (id: string, updates: Partial<AgentInfo>) => void;
  setCurrentSessionId: (id: string | null) => void;
  addTask: (task: AgentTask) => void;
  updateTask: (id: string, updates: Partial<AgentTask>) => void;
  setCurrentTask: (task: AgentTask | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  addLog: (log: AgentLog) => void;
  clearLogs: () => void;
}
```

**智能体类型定义**：

```typescript
type AgentType = 'master' | 'sub_master' | 'lead' | 'sub_lead' | 'coder' | 'reviewer' | 'tester' | 'explorer' | 'custom';

interface AgentInfo {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  status: 'idle' | 'busy' | 'offline';
}
```

## UI 组件集成

### RightPanel (`components/layout/RightPanel.tsx`)

右侧面板展示层级智能体和任务执行状态：

```
┌─────────────────────────┐
│ 层级智能体               │
│ ├── Lead (在线)         │
│ ├── SubLead (空闲)      │
│ ├── Frontend Coder (忙) │
│ ├── Backend Coder (空闲)│
│ ├── Reviewer (空闲)     │
│ ├── Tester (空闲)       │
│ └── Explorer (空闲)     │
├─────────────────────────┤
│ 任务执行状态             │
│ ├── 实现登录 API (运行中)│
│ ├── 编写测试用例 (待执行)│
│ └── 代码审查 (已完成)   │
├─────────────────────────┤
│ 项目进度                 │
│ └── ...                 │
└─────────────────────────┘
```

## 使用示例

### 执行一个 Agent 任务

```typescript
import { AgentExecutor } from '@/services/agentExecutor';
import { useAgentStore } from '@/store';

const executor = new AgentExecutor();
const addLog = useAgentStore((state) => state.addLog);

// 执行任务
const result = await executor.executeTask(
  {
    id: 'task-1',
    title: '实现登录功能',
    description: '创建用户登录 API 和前端页面',
    targetAgent: 'agent_backend_coder',
  },
  {
    projectPath: '/project',
    onLog: (log) => addLog(log),
    onProgress: (progress) => console.log(`${progress}%`),
  }
);

console.log('执行结果:', result.output);
```

### 监听任务状态

```typescript
import { taskApi } from '@/services/taskApi';

const { stop } = taskApi.watchTask('task-123', {
  onStatusChange: (status) => {
    console.log(`任务状态: ${status}`);
  },
  onProgress: (progress) => {
    console.log(`进度: ${progress}%`);
  },
  onLog: (log) => {
    console.log(`[${log.level}] ${log.message}`);
  },
  onComplete: (result) => {
    console.log('任务完成:', result);
  },
  onError: (error) => {
    console.error('任务失败:', error);
  },
});

// 取消监听
stop();
```

### 获取智能体列表

```typescript
import api from '@/services/api';

const response = await api.get('/agents');
const agents = response.data;

// 按类型分组
const leads = agents.filter((a) => a.type === 'lead');
const coders = agents.filter((a) => a.type === 'coder');
```

## 文件结构

```
frontend/src/
├── services/
│   ├── api.ts              # Axios API 客户端
│   ├── agentExecutor.ts    # Agent 执行器（调用后端 API）
│   ├── taskApi.ts          # 任务 API 封装
│   ├── skillSystem.ts      # Skill 系统（保留）
│   ├── mcpSystem.ts        # MCP 系统（保留）
│   └── toolRegistry.ts     # 前端工具注册表（保留）
├── store/
│   └── index.ts            # Zustand 状态管理
├── types/
│   └── index.ts            # 类型定义（AgentType 等）
└── components/
    └── layout/
        ├── RightPanel.tsx  # 右侧面板（展示智能体和任务状态）
        ├── AgentManagement.tsx  # 智能体管理（下拉选项更新）
        └── TerminalPanel.tsx    # 终端面板（展示文本更新）
```

## 与后端的交互

### 关键 API 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/v1/agents/sessions` | POST | 创建会话 |
| `/api/v1/agents/sessions/:id/tasks` | POST | 创建任务 |
| `/api/v1/agents/sessions/:id/tasks/:taskId/execute` | POST | 执行任务 |
| `/api/v1/tasks/:id` | GET | 获取任务详情 |
| `/api/v1/tasks/:id/cancel` | POST | 取消任务 |
| `/api/v1/tasks/:id/events` | GET (SSE) | 订阅任务事件 |
| `/api/v1/agents` | GET | 获取智能体列表 |
| `/api/v1/plans` | GET/POST | 计划管理 |

### 数据流

```
用户操作 → AgentExecutor → taskApi → 后端 API
                              ↑
                        SSE/轮询 ← 后端推送
                              ↓
                        AgentStore → UI 更新
```

## 迁移说明

从"前端直接调用 LLM"迁移到"调用后端 API"的关键变化：

1. **AgentExecutor**：移除 LLM 调用逻辑，改为 HTTP API 调用
2. **新增 TaskApi**：封装所有任务相关的后端 API
3. **状态管理**：扩展 store 支持层级智能体和任务状态
4. **UI 更新**：RightPanel 新增层级智能体展示和任务状态展示
5. **实时更新**：支持 SSE 优先 + 轮询降级的任务状态监听
