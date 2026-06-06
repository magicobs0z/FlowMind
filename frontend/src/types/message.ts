export type MessageStatus = 'thinking' | 'tool_call' | 'executing' | 'result' | 'error'
export type MessageRole = 'user' | 'ai' | 'system'
export type ContentType = 'text' | 'code' | 'command' | 'table' | 'image' | 'link' | 'plan' | 'progress' | 'think'

export interface MessageContent {
  type: ContentType
  content: string
  language?: string
  filePath?: string
  output?: string
  table?: {
    headers: string[]
    rows: string[][]
  }
  imageUrl?: string
  linkUrl?: string
  progress?: number
  progressText?: string
}

export interface AIMessage {
  id: string
  role: 'ai'
  content: string
  contents: MessageContent[]
  timestamp: string
  model?: string
  status: MessageStatus
  think?: string
  toolCalls?: ToolCall[]
  plan?: Plan
  sessionId?: string
}

export interface UserMessage {
  id: string
  role: 'user'
  content: string
  timestamp: string
  attachments?: Attachment[]
  mentions?: string[]
}

export interface SystemMessage {
  id: string
  role: 'system'
  content: string
  timestamp: string
  type: 'info' | 'warning' | 'error' | 'success'
}

export interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'executing' | 'success' | 'error'
  input: Record<string, any>
  output?: any
  error?: string
  startTime?: string
  endTime?: string
}

export interface Plan {
  id: string
  title: string
  tasks: PlanTask[]
  risks: string[]
  rollbackStrategy?: string
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed'
  progress?: number
}

export interface PlanTask {
  id: string
  title: string
  description: string
  filePath?: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'
  assignedAgent?: string
  estimatedTime?: string
  dependencies?: string[]
}

export interface Attachment {
  id: string
  type: 'file' | 'image' | 'link' | 'figma'
  name: string
  url?: string
  content?: string
}

export type Message = AIMessage | UserMessage | SystemMessage
