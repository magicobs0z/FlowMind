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

export interface AgentConfig {
  id: string
  name: string
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
