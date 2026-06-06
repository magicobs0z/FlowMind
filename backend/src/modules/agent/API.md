# Agent 模块 API 文档

本文档描述 FlowMind Agent 模块的所有 REST API 端点。

**基础路径**: `/api/v1/agents`

---

## 智能体管理

### 获取智能体列表

```http
GET /api/v1/agents
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "agent_lead",
      "name": "负责人",
      "type": "lead",
      "description": "接收指令、制定计划、质量把关",
      "status": "idle",
      "capabilities": ["planning", "review"]
    },
    {
      "id": "agent_frontend_coder",
      "name": "前端开发",
      "type": "coder",
      "description": "React/Vue/TypeScript 开发",
      "status": "idle",
      "capabilities": ["frontend", "ui"]
    }
  ]
}
```

### 获取指定智能体

```http
GET /api/v1/agents/:id
```

**参数**:
- `id` (path): 智能体 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "agent_lead",
    "name": "负责人",
    "type": "lead",
    "description": "接收指令、制定计划、质量把关",
    "status": "idle",
    "capabilities": ["planning", "review"]
  }
}
```

### 创建智能体

```http
POST /api/v1/agents
```

**请求体**:
```json
{
  "name": "自定义智能体",
  "type": "custom",
  "description": "我的自定义智能体",
  "capabilities": ["coding"],
  "customPrompt": "你是一个专业的..."
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "agent_custom_123",
    "name": "自定义智能体",
    "type": "custom",
    "status": "idle"
  }
}
```

### 更新智能体

```http
PUT /api/v1/agents/:id
```

**请求体**:
```json
{
  "name": "新名称",
  "description": "新描述"
}
```

### 删除智能体

```http
DELETE /api/v1/agents/:id
```

### 获取智能体状态

```http
GET /api/v1/agents/:id/status
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "agent_lead",
    "status": "idle",
    "currentTask": null,
    "lastActive": "2024-01-15T10:30:00Z"
  }
}
```

---

## 提示词管理

### 获取智能体提示词

```http
GET /api/v1/agents/:id/prompt
```

**响应**:
```json
{
  "success": true,
  "data": {
    "systemPrompt": "你是一个负责人智能体...",
    "customPrompt": null,
    "fullPrompt": "系统基础提示词 + Skill 规范 + 角色专用提示词"
  }
}
```

### 设置自定义提示词

```http
POST /api/v1/agents/:id/prompt
```

**请求体**:
```json
{
  "customPrompt": "你是一个专注于安全审计的代码审查员..."
}
```

**注意**: 仅 `custom` 类型智能体支持自定义提示词。

### 清除自定义提示词

```http
DELETE /api/v1/agents/:id/prompt
```

---

## 会话管理

### 创建会话

```http
POST /api/v1/agents/sessions
```

**请求体**:
```json
{
  "name": "登录功能开发",
  "description": "实现用户登录功能",
  "planId": "plan_123" // 可选，关联计划
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "session_456",
    "name": "登录功能开发",
    "status": "created",
    "planId": "plan_123",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### 获取会话列表

```http
GET /api/v1/agents/sessions
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "session_456",
      "name": "登录功能开发",
      "status": "active",
      "taskCount": 3,
      "completedTasks": 1
    }
  ]
}
```

### 获取指定会话

```http
GET /api/v1/agents/sessions/:id
```

### 启动会话

```http
POST /api/v1/agents/sessions/:id/start
```

### 暂停会话

```http
POST /api/v1/agents/sessions/:id/pause
```

---

## 任务管理

### 添加任务

```http
POST /api/v1/agents/sessions/:id/tasks
```

**请求体**:
```json
{
  "title": "实现登录 API",
  "description": "创建 /api/login 接口，支持邮箱和密码验证",
  "targetAgentId": "agent_backend_coder",
  "priority": "high"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "task_789",
    "title": "实现登录 API",
    "status": "pending",
    "targetAgentId": "agent_backend_coder"
  }
}
```

### 执行任务

```http
POST /api/v1/agents/sessions/:id/tasks/:taskId/execute
```

**响应**:
```json
{
  "success": true,
  "data": {
    "taskId": "task_789",
    "status": "running",
    "backendTaskId": "btask_abc"
  }
}
```

---

## 后台任务

### 创建后台任务

```http
POST /api/v1/tasks
```

**请求体**:
```json
{
  "title": "代码搜索",
  "description": "搜索项目中所有登录相关代码",
  "agentId": "agent_explorer",
  "sessionId": "session_456",
  "payload": {
    "operation": "search_files",
    "params": {
      "pattern": "login|auth|signin",
      "mode": "regex"
    }
  },
  "priority": "normal",
  "timeoutMs": 300000
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "btask_abc",
    "title": "代码搜索",
    "status": "queued",
    "createdAt": "2024-01-15T10:30:00Z",
    "timeoutAt": "2024-01-15T10:35:00Z"
  }
}
```

### 列出任务

```http
GET /api/v1/tasks
```

**查询参数**:
- `sessionId` (可选): 按会话过滤
- `agentId` (可选): 按智能体过滤
- `status` (可选): 按状态过滤 (`queued` | `running` | `completed` | `failed` | `timed_out` | `cancelled`)

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "btask_abc",
      "title": "代码搜索",
      "status": "running",
      "progress": 45,
      "agentId": "agent_explorer"
    }
  ]
}
```

### 获取任务详情

```http
GET /api/v1/tasks/:id
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "btask_abc",
    "title": "代码搜索",
    "description": "搜索项目中所有登录相关代码",
    "status": "completed",
    "progress": 100,
    "result": {
      "files": ["src/auth/login.ts", "src/middleware/auth.ts"]
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "startedAt": "2024-01-15T10:30:05Z",
    "completedAt": "2024-01-15T10:30:30Z"
  }
}
```

### 取消任务

```http
POST /api/v1/tasks/:id/cancel
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "btask_abc",
    "status": "cancelled"
  }
}
```

### 订阅任务事件 (SSE)

```http
GET /api/v1/tasks/:id/events
```

**响应**: Server-Sent Events 流

```
event: task:created
data: {"type":"task:created","taskId":"btask_abc","timestamp":"2024-01-15T10:30:00Z","data":{}}

event: task:started
data: {"type":"task:started","taskId":"btask_abc","timestamp":"2024-01-15T10:30:05Z","data":{}}

event: task:progress
data: {"type":"task:progress","taskId":"btask_abc","timestamp":"2024-01-15T10:30:10Z","data":{"progress":50}}

event: task:completed
data: {"type":"task:completed","taskId":"btask_abc","timestamp":"2024-01-15T10:30:30Z","data":{"result":{}}}
```

**前端使用示例**:
```javascript
const eventSource = new EventSource('/api/v1/tasks/btask_abc/events');

eventSource.addEventListener('task:progress', (event) => {
  const data = JSON.parse(event.data);
  console.log(`进度: ${data.data.progress}%`);
});

eventSource.addEventListener('task:completed', (event) => {
  const data = JSON.parse(event.data);
  console.log('任务完成:', data.data.result);
  eventSource.close();
});
```

---

## 计划管理

### 创建计划

```http
POST /api/v1/agents/plans
```

**请求体**:
```json
{
  "title": "登录功能开发计划",
  "description": "包括前端 UI、后端 API、测试用例"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "plan_123",
    "title": "登录功能开发计划",
    "status": "active",
    "tasks": [],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### 列出计划

```http
GET /api/v1/agents/plans
```

### 获取当前活动计划

```http
GET /api/v1/agents/plans/active
```

### 获取指定计划

```http
GET /api/v1/agents/plans/:id
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "plan_123",
    "title": "登录功能开发计划",
    "status": "active",
    "tasks": [
      {
        "id": "ptask_1",
        "description": "实现登录 API",
        "status": "completed",
        "assignedTo": "agent_backend_coder"
      },
      {
        "id": "ptask_2",
        "description": "编写前端登录页面",
        "status": "in_progress",
        "assignedTo": "agent_frontend_coder"
      }
    ]
  }
}
```

### 更新计划

```http
PUT /api/v1/agents/plans/:id
```

**请求体**:
```json
{
  "title": "更新后的标题",
  "tasks": [
    {
      "id": "ptask_3",
      "description": "新增任务",
      "status": "pending"
    }
  ]
}
```

### 归档计划

```http
POST /api/v1/agents/plans/:id/archive
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "plan_123",
    "status": "archived"
  }
}
```

---

## 智能体通信

### 发送请求

```http
POST /api/v1/agents/bus/request
```

**请求体**:
```json
{
  "fromAgentId": "agent_sub_lead",
  "toAgentId": "agent_backend_coder",
  "type": "task_assignment",
  "payload": {
    "task": "实现登录 API",
    "priority": "high"
  }
}
```

### 智能体协商

```http
POST /api/v1/agents/bus/negotiate
```

**请求体**:
```json
{
  "fromAgentId": "agent_backend_coder",
  "toAgentId": "agent_reviewer",
  "type": "code_review_request",
  "payload": {
    "filePath": "src/auth/login.ts",
    "changes": "..."
  }
}
```

### 广播通知

```http
POST /api/v1/agents/bus/broadcast
```

**请求体**:
```json
{
  "fromAgentId": "agent_lead",
  "type": "plan_update",
  "payload": {
    "message": "计划已更新，请查看新任务"
  }
}
```

### 任务委托

```http
POST /api/v1/agents/bus/delegate
```

**请求体**:
```json
{
  "fromAgentId": "agent_sub_lead",
  "toAgentId": "agent_tester",
  "task": {
    "title": "编写登录测试用例",
    "description": "覆盖正常登录和异常场景"
  }
}
```

### 获取会话结果汇总

```http
GET /api/v1/agents/bus/results/:sessionId
```

**响应**:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_456",
    "tasks": [
      {
        "taskId": "task_789",
        "agentId": "agent_backend_coder",
        "status": "completed",
        "result": "登录 API 已实现"
      }
    ],
    "summary": "1/3 任务已完成"
  }
}
```

### 获取文件锁

```http
POST /api/v1/agents/bus/lock
```

**请求体**:
```json
{
  "filePath": "src/auth/login.ts",
  "agentId": "agent_backend_coder",
  "ttlMs": 300000
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "locked": true,
    "filePath": "src/auth/login.ts",
    "agentId": "agent_backend_coder",
    "expiresAt": "2024-01-15T10:35:00Z"
  }
}
```

### 释放文件锁

```http
DELETE /api/v1/agents/bus/lock
```

**请求体**:
```json
{
  "filePath": "src/auth/login.ts",
  "agentId": "agent_backend_coder"
}
```

### 获取冲突列表

```http
GET /api/v1/agents/bus/conflicts
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "type": "file_lock",
      "filePath": "src/auth/login.ts",
      "agents": ["agent_backend_coder", "agent_frontend_coder"],
      "severity": "high"
    }
  ]
}
```

---

## 工具执行

### 执行命令

```http
POST /api/v1/agents/execute
```

**请求体**:
```json
{
  "command": "npm",
  "args": ["test"],
  "workingDirectory": "/project"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "stdout": "Test passed",
    "stderr": "",
    "exitCode": 0
  }
}
```

### Git 操作

```http
POST /api/v1/agents/git
```

**请求体**:
```json
{
  "operation": "status",
  "args": []
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "stdout": "On branch main...",
    "stderr": "",
    "exitCode": 0
  }
}
```

---

## 工作区文件

### 获取工作区文件列表

```http
GET /api/v1/agents/workspace/:workspaceId/files
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "path": "src/index.ts",
      "type": "file",
      "size": 1024
    },
    {
      "path": "src/components",
      "type": "directory"
    }
  ]
}
```

---

## 错误响应

所有 API 在出错时返回统一的错误格式：

```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "智能体不存在",
    "details": {}
  }
}
```

**常见错误码**:

| 错误码 | 描述 | HTTP 状态码 |
|--------|------|------------|
| `AGENT_NOT_FOUND` | 智能体不存在 | 404 |
| `SESSION_NOT_FOUND` | 会话不存在 | 404 |
| `TASK_NOT_FOUND` | 任务不存在 | 404 |
| `PLAN_NOT_FOUND` | 计划不存在 | 404 |
| `INVALID_AGENT_TYPE` | 无效的智能体类型 | 400 |
| `AGENT_BUSY` | 智能体正忙 | 409 |
| `FILE_LOCKED` | 文件已被锁定 | 409 |
| `PATH_ESCAPE` | 路径穿越尝试 | 403 |
| `COMMAND_BLOCKED` | 命令被拦截 | 403 |
| `LLM_ERROR` | LLM 调用失败 | 502 |
| `TIMEOUT` | 任务超时 | 504 |

---

## 状态码说明

### 任务状态

| 状态 | 说明 |
|------|------|
| `queued` | 已创建，等待执行 |
| `dispatching` | 正在分派给智能体 |
| `running` | 正在执行 |
| `completed` | 执行完成 |
| `failed` | 执行失败 |
| `timed_out` | 执行超时 |
| `cancelled` | 已取消 |

### 智能体状态

| 状态 | 说明 |
|------|------|
| `idle` | 空闲 |
| `busy` | 正在执行任务 |
| `offline` | 离线 |

### 计划状态

| 状态 | 说明 |
|------|------|
| `active` | 活跃 |
| `archived` | 已归档 |
| `completed` | 已完成 |
