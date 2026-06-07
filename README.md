# FlowMind

FlowMind 是一个多智能体协作平台，让 AI 智能体能够相互通信、协作并共同完成复杂的开发任务。通过**三层智能体层级架构**、**生产级工具系统**、**真实 LLM 执行引擎**和**计划持久化机制**，AI 真正掌握了"干活"的能力。

## ✨ 核心特性

- 🤖 **三层智能体层级架构**：Lead（决策层）→ SubLead（运营层）→ Coder/Reviewer/Tester（执行层）
- 🛠️ **生产级工具系统**：安全文件操作、命令执行、代码搜索、Git 集成，带路径防护和超时控制
- 🧠 **真实 LLM 执行引擎**：支持 OpenAI/Anthropic API，工具调用循环，流式响应，上下文窗口管理
- 📋 **计划持久化**：任务计划存储在 `.agent/plans/`，支持跨会话恢复
- ⏱️ **后台任务服务**：异步任务队列，超时控制，心跳检测，SSE 实时通知
- 🔒 **安全机制**：工作区限制、命令白名单、文件写入锁、自动备份
- 📡 **智能体协商总线**：层级路由、任务委托、冲突检测、契约验证
- 🎨 **实时状态提示**：AI 执行过程全程透明，展示思考、计划、工具调用、执行等状态
- 📝 **Markdown 渲染**：支持美观的 Markdown 格式消息显示
- ⏹️ **任务停止**：随时可停止正在执行的任务

## 📁 项目结构

```
flowmind/
├── backend/                    # Node.js 后端服务
│   └── src/
│       └── modules/
│           └── agent/          # 智能体核心模块
│               ├── engine/     # LLM 执行引擎
│               │   ├── agentEngine.ts      # 核心执行循环
│               │   └── __tests__/          # 引擎测试
│               ├── llm/        # LLM Provider 抽象
│               │   ├── openaiProvider.ts   # OpenAI 适配
│               │   ├── anthropicProvider.ts # Anthropic 适配
│               │   └── providerFactory.ts  # Provider 工厂
│               ├── tools/      # 生产级工具系统
│               │   ├── readFile.ts         # 安全文件读取
│               │   ├── writeFile.ts        # 安全文件写入
│               │   ├── listDirectory.ts    # 目录列出
│               │   ├── searchFiles.ts      # ripgrep 搜索
│               │   ├── executeCommand.ts   # 命令执行
│               │   ├── gitOperations.ts    # Git 操作
│               │   ├── toolRegistry.ts     # 工具注册表
│               │   └── __tests__/          # 工具测试
│               ├── plans/      # 计划持久化
│               │   ├── manager.ts          # 计划管理器
│               │   └── fileStorage.ts      # 文件存储
│               ├── tasks/      # 后台任务服务
│               │   ├── taskService.ts      # 任务队列
│               │   ├── controller.ts       # 任务 API
│               │   └── __tests__/          # 任务测试
│               ├── prompts/    # 提示词系统
│               │   ├── lead.ts             # Lead 提示词
│               │   ├── subLead.ts          # SubLead 提示词
│               │   ├── coder.ts            # Coder 提示词
│               │   ├── reviewer.ts         # Reviewer 提示词
│               │   ├── tester.ts           # Tester 提示词
│               │   ├── explorer.ts         # Explorer 提示词
│               │   └── manager.ts          # 提示词管理器
│               ├── agentBus.ts             # 智能体协商总线
│               ├── conflictDetector.ts     # 冲突检测器
│               ├── orchestrator.ts         # 编排器
│               ├── orchestratorController.ts # API 控制器
│               └── routes.ts   # 路由配置
├── frontend/                   # React + Vite 前端
├── electron/                   # Electron 桌面端
├── migrations/                 # 数据库迁移
└── docker-compose.yml
```

## 🚀 快速开始

### 环境要求

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- OpenAI API Key 或 Anthropic API Key

### 配置环境变量

```bash
# backend/.env
OPENAI_API_KEY=sk-...
# 或
ANTHROPIC_API_KEY=sk-ant-...
```

### 启动所有服务

```bash
docker compose up -d
```

这将启动：
- PostgreSQL on port `5432`
- Redis on port `6379`
- Backend on port `3000`
- Frontend on port `5173`

### 查看日志

```bash
docker compose logs -f
```

### 停止服务

```bash
# 停止服务
docker compose down

# 停止并清除数据
docker compose down -v
```

## 🏗️ 系统架构

### 三层智能体层级

```
┌─────────────────────────────────────────┐
│              Lead 智能体                  │
│    (用户-facing，制定计划、质量把关)        │
├─────────────────────────────────────────┤
│            SubLead 智能体                 │
│    (任务分发、协调执行层智能体)            │
├─────────────────────────────────────────┤
│  Coder │ Reviewer │ Tester │ Explorer   │
│  (执行层，具体代码/审查/测试/探索任务)      │
└─────────────────────────────────────────┘
```

### 智能体类型

| 智能体 | 类型 | 层级 | 职责 |
|--------|------|------|------|
| 负责人 | lead | 决策层 | 接收指令、制定计划、质量把关 |
| 协调员 | sub_lead | 运营层 | 任务细化、分发、协调执行层 |
| 前端开发 | coder | 执行层 | React/Vue/TypeScript 开发 |
| 后端开发 | coder | 执行层 | Node.js/API/数据库开发 |
| 测试工程师 | tester | 执行层 | 测试用例、Bug 报告 |
| 代码审查员 | reviewer | 执行层 | 代码质量、安全审计 |
| 代码探索者 | explorer | 执行层 | 代码库探索、依赖分析 |
| 自定义 | custom | - | 用户自定义角色 |

### 工具系统

**文件操作工具**
- `read_file` — 安全读取文件，支持行范围、大小限制、二进制检测
- `write_file` — 安全写入文件，自动创建目录、路径校验、符号链接防护
- `list_directory` — 递归/非递归列出目录，支持忽略模式

**代码搜索工具**
- `search_files` — 基于 ripgrep 的内容搜索，支持正则、字面量、大小写控制

**命令执行工具**
- `execute_command` — 命令执行，支持超时、输出截断、危险命令拦截

**版本控制工具**
- `git_operations` — 封装常用 Git 命令（status/diff/log/branch/checkout/add/commit/pull/push）

### LLM 执行引擎

```
用户请求 → Lead 制定计划 → SubLead 分发任务
    ↓
AgentEngine 执行循环（最多 20 次迭代）
    ↓
LLM 推理 → 工具调用 → 执行工具 → 返回结果 → LLM 继续推理
    ↓
任务完成 → 更新计划 → 通知前端
```

支持：
- OpenAI GPT-4/GPT-3.5（chat.completions + function calling）
- Anthropic Claude（messages API + tool use）
- 流式响应（SSE）
- 上下文窗口管理（自动截断，保留系统提示词 + 最近 10 条消息）

### 后台任务服务

```
queued → dispatching → running → completed/failed/timed_out/cancelled
```

- 默认超时 5 分钟（可配置）
- 每 10 秒心跳检测
- SSE 实时事件流
- 父会话自动通知

## 🔌 API 接口

### 智能体管理
- `GET /api/v1/agents` - 获取智能体列表
- `GET /api/v1/agents/:id` - 获取指定智能体
- `POST /api/v1/agents` - 创建智能体
- `PUT /api/v1/agents/:id` - 更新智能体
- `DELETE /api/v1/agents/:id` - 删除智能体

### 提示词管理
- `GET /api/v1/agents/:id/prompt` - 获取智能体提示词
- `POST /api/v1/agents/:id/prompt` - 设置自定义提示词（仅 custom 类型）
- `DELETE /api/v1/agents/:id/prompt` - 清除自定义提示词

### 会话管理
- `POST /api/v1/agents/sessions` - 创建会话
- `GET /api/v1/agents/sessions` - 获取会话列表
- `GET /api/v1/agents/sessions/:id` - 获取指定会话
- `POST /api/v1/agents/sessions/:id/start` - 启动会话
- `POST /api/v1/agents/sessions/:id/pause` - 暂停会话

### 任务管理
- `POST /api/v1/agents/sessions/:id/tasks` - 添加任务
- `POST /api/v1/agents/sessions/:id/tasks/:taskId/execute` - 执行任务

### 后台任务
- `POST /api/v1/tasks` - 创建后台任务
- `GET /api/v1/tasks` - 列出任务（支持过滤）
- `GET /api/v1/tasks/:id` - 获取任务详情
- `POST /api/v1/tasks/:id/cancel` - 取消任务
- `GET /api/v1/tasks/:id/events` - SSE 订阅任务事件

### 计划管理
- `POST /api/v1/plans` - 创建计划
- `GET /api/v1/plans` - 列出计划
- `GET /api/v1/plans/active` - 获取当前活动计划
- `GET /api/v1/plans/:id` - 获取指定计划
- `PUT /api/v1/plans/:id` - 更新计划
- `POST /api/v1/plans/:id/archive` - 归档计划

### 智能体通信
- `POST /api/v1/agents/bus/request` - 发送请求
- `POST /api/v1/agents/bus/negotiate` - 智能体协商
- `POST /api/v1/agents/bus/broadcast` - 广播通知
- `POST /api/v1/agents/bus/delegate` - 任务委托
- `GET /api/v1/agents/bus/results/:sessionId` - 获取会话结果汇总
- `POST /api/v1/agents/bus/lock` - 获取文件锁
- `DELETE /api/v1/agents/bus/lock` - 释放文件锁

## 🛠️ 开发

### 环境变量

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Node 环境 |
| DB_HOST | postgres | 数据库主机 |
| DB_PORT | 5432 | 数据库端口 |
| DB_NAME | flowmind | 数据库名称 |
| DB_USER | dev | 数据库用户 |
| DB_PASSWORD | dev | 数据库密码 |
| REDIS_HOST | redis | Redis 主机 |
| REDIS_PORT | 6379 | Redis 端口 |
| OPENAI_API_KEY | - | OpenAI API Key |
| ANTHROPIC_API_KEY | - | Anthropic API Key |
| VITE_API_URL | http://localhost:3000 | 后端 API URL |

### 独立启动

```bash
# 后端
cd backend
npm install
npm run dev

# 前端
cd frontend
npm install
npm run dev
```

### 运行测试

```bash
cd backend
npm test -- --testPathPattern="modules/agent"
```

## 🎨 前端功能

### 状态提示系统

AI 执行过程全程透明，支持以下状态：

| 状态 | 描述 | 图标 |
|------|------|------|
| thinking | 思考中，正在理解需求 | 🔄 |
| planning | 制定计划中 | 📋 |
| tool_call | 调用工具中（显示工具名称） | 🔧 |
| executing | 执行中 | 🛠️ |
| terminal_running | 终端运行中（显示日志） | 💻 |
| preview_generating | 生成预览 | 👁️ |
| result | 已完成 | ✅ |
| error | 执行失败 | ❌ |
| interrupted | 已中断 | ⏸️ |

### Markdown 支持

支持完整的 Markdown 格式渲染：
- 标题、列表、粗体、斜体
- 代码块（支持语言高亮）
- 链接、引用
- 美观的排版效果

### 任务控制

- **停止按钮**：执行中随时可停止任务
- **重新生成**：对结果不满意可重新生成
- **复制内容**：一键复制消息内容
- **状态重置**：停止后立即可以发送新消息

## 📚 文档

- [前端文档](./frontend/README.md) - 前端使用和开发指南
- [CHANGELOG](./CHANGELOG.md) - 版本更新日志
- [智能体系统 Spec](.trae/specs/agent-system-oma-redesign/spec.md) - 架构设计规格
- [任务清单](.trae/specs/agent-system-oma-redesign/tasks.md) - 实施任务分解
- [验收清单](.trae/specs/agent-system-oma-redesign/checklist.md) - 功能验收检查点

## 🔒 安全

- 文件操作限制在工作区内，防止路径穿越（`../../etc/passwd` 会被拒绝）
- 命令执行有白名单和超时保护，危险命令（`rm -rf /`、`sudo` 等）会被拦截
- Git 操作安全检查，仅允许白名单内的操作
- 文件写入锁机制，防止并发写入冲突
- 系统提示词不可修改，确保行为一致性
- 敏感信息（API Key、密码）通过环境变量配置，不硬编码

## 📝 许可证

[MIT](LICENSE)

---

**FlowMind** - 让 AI 真正能干活！ 🤖💪
