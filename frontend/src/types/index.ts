export interface Project {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceFile {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  content?: string
  children?: WorkspaceFile[]
  language?: string
}

export interface BlueprintNode {
  id: string
  type: string
  label: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface BlueprintEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  data?: Record<string, unknown>
}

export interface Blueprint {
  id: string
  name: string
  nodes: BlueprintNode[]
  edges: BlueprintEdge[]
  createdAt: string
  updatedAt: string
}

export type AgentType =
  | 'master'
  | 'sub_master'
  | 'lead'
  | 'sub_lead'
  | 'coder'
  | 'reviewer'
  | 'tester'
  | 'explorer'
  | 'custom'

export interface AgentConfig {
  id: string
  name: string
  type: AgentType
  model: string
  systemPrompt: string
  tools: string[]
  createdAt: string
  updatedAt: string
}

export interface DagNode {
  id: string
  label: string
  type: string
  status: 'pending' | 'running' | 'success' | 'failed'
  dependencies: string[]
  metadata?: Record<string, unknown>
}

export interface DagEdge {
  id: string
  source: string
  target: string
}

export interface Dag {
  id: string
  name: string
  nodes: DagNode[]
  edges: DagEdge[]
}

export interface TimelineEvent {
  id: string
  timestamp: string
  type: string
  message: string
  metadata?: Record<string, unknown>
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: ApiError
  meta?: {
    page: number
    pageSize: number
    total: number
  }
}

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

export interface Plan {
  id: string
  title: string
  tasks: PlanTask[]
  risks: string[]
  rollbackStrategy?: string
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed'
  progress?: number
}

export interface Attachment {
  id: string
  type: 'file' | 'image' | 'link' | 'figma'
  name: string
  url?: string
  content?: string
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

export type Message = AIMessage | UserMessage | SystemMessage
