# FlowMind 多智能体协作开发平台 - 技术文档

## 1. 项目概述

FlowMind 是一个多智能体协作开发平台，提供类似 VS Code 的 IDE 体验，集成 AI 助手、蓝图编排、DAG 任务管理等功能。

## 2. 技术架构

```
┌─────────────────────────────────────────────────────┐
│                   前端 (React 19)                     │
│  ┌──────┬──────────────────────┬──────────────────┐ │
│  │ 对话  │    聊天面板（不可折叠） │  右侧面板（可折叠） │ │
│  │ 管理  │  ┌────────────────┐  │ □ 资源管理器      │ │
│  │(可折叠)│  │   输入区(上方)  │  │ □ 待办/智能体     │ │
│  │      │  │   消息列表     │  │ □ 上下文         │ │
│  │      │  └────────────────┘  │ □ Git 管理       │ │
│  └──────┴──────────────────────┴──────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │          标签栏（真实Tab切换）                    │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  Monaco Editor / Blueprint / DAG / Diff Viewer  │ │
│  ├─────────────────────────────────────────────────┤ │
│  │         时间轴（可折叠，15%底部高度）              │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Express API │ │  Chat Module │ │ Timeline API │
│  Workspace   │ │  Agent Bus   │ │  Git Events  │
│  DAG         │ │  Blueprint   │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         ▼
              ┌──────────────────┐
              │  PostgreSQL 16   │
              │  Redis 7         │
              │  pgvector        │
              └──────────────────┘
```

## 3. 项目结构

```
flowmind/
├── frontend/                 # 前端 React + Vite + TypeScript
│   ├── src/
│   │   ├── store/           # Zustand 全局状态管理
│   │   │   └── index.ts     # Layout/Tab/File/Chat/Workspace Store
│   │   ├── services/        # API 服务层
│   │   │   └── api.ts       # Axios 封装 + 所有 API 调用
│   │   ├── components/
│   │   │   └── layout/      # 布局组件
│   │   │       ├── App.tsx              # 主应用布局
│   │   │       ├── ResizablePanel.tsx   # 可拖拽分割面板
│   │   │       ├── ConversationList.tsx # 对话管理列表（可折叠）
│   │   │       ├── ChatPanel.tsx        # 聊天面板（不可折叠）
│   │   │       ├── TabBar.tsx           # 标签栏
│   │   │       ├── EditorArea.tsx       # 编辑区（Monaco Editor）
│   │   │       ├── RightPanel.tsx       # 右侧复合面板（标签切换）
│   │   │       └── BottomTimeline.tsx   # 底部时间轴
│   │   ├── utils/
│   │   │   └── fileIcons.ts  # 文件图标映射 + 语言检测
│   │   └── index.css         # TailwindCSS + CSS 变量
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/                  # 后端 Express + TypeScript
│   ├── src/
│   │   ├── app.ts           # Express 应用入口
│   │   ├── server.ts        # 服务器启动
│   │   ├── constants/       # 常量定义（HTTP状态码、错误码）
│   │   ├── core/error/      # 全局错误处理
│   │   ├── utils/           # 日志工具（Pino）
│   │   └── modules/         # 功能模块
│   │       ├── workspace/   # 工作空间管理
│   │       ├── dag/         # DAG 任务依赖图
│   │       ├── agent/       # 智能体管理 + 协商总线
│   │       ├── blueprint/   # 蓝图编排系统
│   │       ├── chat/        # 聊天服务
│   │       └── timeline/    # 时间轴事件服务
│   ├── tsconfig.json
│   └── package.json
├── docs/                     # 文档
├── libs/                     # 已下载的开源库
├── docker-compose.yml
└── .gitignore
```

## 4. 前端核心模块

### 4.1 状态管理 (Zustand)

| Store | 职责 |
|-------|------|
| `useLayoutStore` | 面板尺寸、折叠状态（左宽/右宽/底高） |
| `useTabStore` | 标签页管理（打开/关闭/切换/内容更新） |
| `useFileStore` | 文件树、选中文件、展开/折叠路径 |
| `useChatStore` | 对话管理、消息收发、模型选择 |
| `useWorkspaceStore` | 工作空间、时间轴事件 |

### 4.2 布局系统

- **ResizablePanel**: 通用的可拖拽分割面板，支持水平和垂直方向
- **左侧**: 对话管理（可折叠） + 聊天面板（不可折叠）
- **中间**: 标签栏 + 编辑区（Monaco Editor）
- **右侧**: 复合面板，顶部标签切换 [资源管理器 / 待办 / 上下文 / Git]
- **底部**: 时间轴（可折叠）

### 4.3 折叠行为

| 面板 | 折叠方向 | 展开入口 |
|------|---------|---------|
| 对话管理 | 向左折叠，聊天保持不变 | 聊天顶部的 "对话" 按钮 |
| 右侧面板 | 向右折叠 | 右上角 "面板" 按钮 |
| 时间轴 | 向下折叠 | 右上角 "时间轴" 按钮 |

### 4.4 标签页系统

- 支持类型: `file`, `blueprint`, `dag`, `diff`, `welcome`
- 点击文件树中的文件自动打开新标签
- 点击 X 关闭标签
- 脏状态指示器（未保存标记 ●）

### 4.5 聊天界面

- 输入区位于消息列表上方（非传统底部输入框）
- 输入框初始 6 行高度，最大扩展到 10 行
- 用户消息：灰色圆角气泡，右对齐
- AI 消息：无背景框，左对齐
- 布局：左工具（附件/魔法）+ 右控制（模型选择/表情/语音/发送）

### 4.6 文件图标

基于文件扩展名映射 Lucide 图标，支持 40+ 种文件类型识别。

## 5. 后端 API

### 5.1 路由表

| 路由前缀 | 功能 | 模块文件 |
|---------|------|---------|
| `/health` | 健康检查 | `app.ts` |
| `/api/v1/workspace` | 工作空间管理 + 文件内容读取 | `modules/workspace/routes.ts` |
| `/api/v1/dag` | DAG 任务管理（节点/边/状态） | `modules/dag/routes.ts` |
| `/api/v1/agents` | 智能体注册/协商/冲突检测 | `modules/agent/routes.ts` |
| `/api/v1/blueprints` | 蓝图模板/执行/函数 | `modules/blueprint/routes.ts` |
| `/api/v1/chat` | 聊天消息/对话管理 | `modules/chat/routes.ts` |
| `/api/v1/git/timeline` | 时间轴事件/分支检出 | `modules/timeline/routes.ts` |

### 5.2 Workspace API

```
POST   /api/v1/workspace/open        打开/扫描工作空间
GET    /api/v1/workspace/:id         获取工作空间信息
POST   /api/v1/workspace/:id/scan    重新扫描
GET    /api/v1/workspace/:id/files   读取文件内容 (query: path)
```

### 5.3 Chat API

```
POST   /api/v1/chat/message          发送消息，返回 AI 回复
GET    /api/v1/chat/conversations    获取对话列表
GET    /api/v1/chat/conversations/:id/messages  获取对话消息
```

### 5.4 Timeline API

```
GET    /api/v1/git/timeline/:wsId    获取时间轴事件 (query: from/to/type/limit)
POST   /api/v1/git/timeline/checkout  检出到指定事件
POST   /api/v1/git/timeline/hypothesis 创建假设分支
```

### 5.5 错误处理

统一错误格式:
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable message"
}
```

## 6. 开源库集成

| 库 | 用途 | 状态 |
|----|------|------|
| `@monaco-editor/react` v4.7.0 | 代码编辑器 | ✅ 已接入 |
| `zustand` v5.x | 全局状态管理 | ✅ 已接入 |
| `lucide-react` | 图标库 | ✅ 已接入 |
| `reactflow` (已下载 v11.x) | 蓝图/DAG 可视化 | 🔲 待接入 |
| `react-diff-view` (已下载) | 代码差异对比 | 🔲 待接入 |
| `gitgraph-react` (已下载) | Git 图形化展示 | 🔲 待接入 |
| `yjs` (已下载) | 协同编辑 | 🔲 待接入 |
| `@vscode/codicons` (已下载) | VS Code 风格图标 | 🔲 待接入 |

## 7. 技术栈

### 前端
- React 19 + TypeScript
- Vite 8.x (构建工具)
- TailwindCSS v4 (样式)
- Zustand v5 (状态管理)
- Monaco Editor (代码编辑)
- Lucide React (图标)

### 后端
- Node.js + Express
- TypeScript + ts-node
- Pino (结构化日志)
- Helmet + CORS + Rate Limiting (安全)
- Biome (Linter & Formatter)

### 数据库（规划中）
- PostgreSQL 16 + pgvector
- Redis 7

## 8. 运行命令

```bash
# 前端
cd frontend
npm install
npm run dev      # 开发模式，端口 5173
npm run build    # 生产构建

# 后端
cd backend
npm install
npm run dev      # 开发模式，端口 3000
npm run build    # 编译到 dist/

# Docker
docker-compose up -d  # 启动 PostgreSQL + Redis
```

## 9. 环境变量

后端 `.env` 文件:
```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
DATABASE_URL=postgresql://user:pass@localhost:5432/flowmind
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

## 10. 待完成模块

| 任务 | 描述 | 优先级 |
|------|------|--------|
| Task 7 | 规格文档-契约联动引擎 | 高 |
| Task 8 | 项目记忆（语义知识库） | 高 |
| Task 9 | 脚本安全执行器 | 高 |
| Task 10 | 人机协同闸门控制 | 高 |
| 开源库接入 | reactflow / diff-view / gitgraph | 中 |
| 数据库持久化 | PostgreSQL + Redis 数据存储 | 中 |
| 真实 AI 接入 | OpenAI / Claude API 配置 | 中 |
