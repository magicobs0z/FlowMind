# FlowMind Frontend

FlowMind 的前端部分，使用 React + TypeScript + Vite 构建。

## ✨ 核心特性

### 聊天界面
- 支持 Markdown 格式的消息显示
- 实时状态提示系统
- 流式文本渲染
- 用户消息可编辑

### 状态提示系统
全新的状态提示组件，支持：
- 🤔 **思考中** - AI 正在理解你的需求
- 📋 **制定计划中** - AI 正在制定执行计划
- 🔧 **调用工具** - AI 正在调用工具（显示工具名称）
- 🛠️ **执行中** - AI 正在执行任务
- 💻 **终端运行中** - 显示终端执行日志
- 👁️ **生成预览** - 准备展示结果
- ✅ **已完成** - 任务执行完毕
- ❌ **失败** - 任务执行失败
- ⏸️ **已中断** - 任务被用户停止

### Markdown 渲染
支持完整的 Markdown 格式：
- 标题（# ## ###）
- 粗体、斜体
- 有序列表、无序列表
- 代码块（支持多种语言）
- 链接、引用

### 任务控制
- **停止按钮** - 执行中可随时停止任务
- **重新生成** - 对不满意的结果重新生成
- **复制内容** - 一键复制消息内容

## 📁 目录结构

```
src/
├── components/
│   ├── chat/
│   │   ├── StatusIndicator.tsx      # 状态提示组件
│   │   ├── MarkdownRenderer.tsx     # Markdown 渲染器
│   │   ├── MessageBubble.tsx        # 消息气泡
│   │   ├── StreamingText.tsx        # 流式文本
│   │   └── ...
│   └── layout/
│       └── ChatPanel.tsx            # 聊天面板
├── types/
│   └── message.ts                   # 消息类型定义
├── store/
│   └── index.ts                     # Zustand 状态管理
└── services/
    └── api.ts                       # API 服务
```

## 🔧 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 类型检查
tsc -b

# 代码检查
npm run lint
```

## 📝 状态类型

```typescript
export type MessageStatus = 
  | 'thinking'         // 思考中
  | 'planning'         // 制定计划中
  | 'tool_call'        // 调用工具
  | 'executing'        // 执行中
  | 'terminal_running' // 终端运行中
  | 'preview_generating' // 生成预览
  | 'result'           // 已完成
  | 'error'            // 失败
  | 'interrupted';     // 已中断
```

## 🎨 使用示例

### StatusIndicator 组件

```tsx
import StatusIndicator from './components/chat/StatusIndicator';

<StatusIndicator
  status="thinking"
  message="正在理解您的需求..."
  detail="分析上下文..."
  toolName="search_codebase"
  progress={50}
  logs={['$ npm run build', '> vite build']}
  onStop={() => console.log('停止')}
  onRetry={() => console.log('重试')}
/>
```

### MarkdownRenderer 组件

```tsx
import MarkdownRenderer from './components/chat/MarkdownRenderer';

<MarkdownRenderer
  content="# Hello\n\nThis is **bold** text.\n\n```typescript\nconsole.log('Hello World');\n```"
  className="text-sm"
/>
```

## 📚 相关文档

- [FlowMind 主文档](../README.md)
- [CHANGELOG](../CHANGELOG.md)

