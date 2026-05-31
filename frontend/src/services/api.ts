import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error?.message || error.message || 'Unknown error'
    return Promise.reject(new Error(message))
  }
)

export interface WorkspaceSummary {
  id: string
  path: string
  name: string
  summary: {
    techStack: {
      frontend: string[]
      backend: string[]
      database: string[]
    }
    modules: Array<{ name: string; path: string; type: string }>
    gitInfo: {
      branch: string
      commitCount: number
      lastCommit: string
    }
  }
  fileTree: FileNode[]
  createdAt: string
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export interface DagData {
  id: string
  blueprintId: string
  workspaceId: string
  nodes: DagNode[]
  edges: DagEdge[]
}

export interface DagNode {
  id: string
  title: string
  description: string
  type: string
  status: string
  assignedAgent?: string
  dependencies: string[]
}

export interface DagEdge {
  from: string
  to: string
  type: string
}

export interface Agent {
  id: string
  type: string
  name: string
  capabilities: string[]
  status: string
  modelProvider?: string
  model?: string
}

export interface BlueprintTemplate {
  id: string
  name: string
  description: string
  category: string
  version: string
}

export interface TimelineEvent {
  id: string
  type: 'ai' | 'human' | 'auto'
  message: string
  timestamp: string
  commit?: string
  files?: string[]
  agentId?: string
}

export const workspaceApi = {
  open: (path: string): Promise<{ success: boolean; data: WorkspaceSummary }> =>
    api.post('/workspace/open', { path }),

  get: (id: string): Promise<{ success: boolean; data: WorkspaceSummary }> =>
    api.get(`/workspace/${id}`),

  scan: (id: string): Promise<{ success: boolean; data: WorkspaceSummary }> =>
    api.post(`/workspace/${id}/scan`),

  getFileContent: (workspaceId: string, filePath: string): Promise<{ success: boolean; data: { content: string; language: string } }> =>
    api.get(`/workspace/${workspaceId}/files`, { params: { path: filePath } }),
}

export const dagApi = {
  create: (blueprintId: string, workspaceId: string): Promise<{ success: boolean; data: DagData }> =>
    api.post('/dag', { blueprintId, workspaceId }),

  get: (dagId: string): Promise<{ success: boolean; data: DagData }> =>
    api.get(`/dag/${dagId}`),

  createNode: (dagId: string, node: Partial<DagNode>): Promise<{ success: boolean; data: DagNode }> =>
    api.post(`/dag/${dagId}/nodes`, node),

  createEdge: (dagId: string, from: string, to: string, type = 'hard'): Promise<{ success: boolean; data: DagEdge }> =>
    api.post(`/dag/${dagId}/edges`, { from, to, type }),

  updateNodeStatus: (dagId: string, nodeId: string, status: string, output?: unknown): Promise<{ success: boolean; data: DagNode }> =>
    api.patch(`/dag/${dagId}/nodes/${nodeId}/status`, { status, output }),

  getExecutable: (dagId: string): Promise<{ success: boolean; data: DagNode[] }> =>
    api.get(`/dag/${dagId}/executable`),
}

export const agentApi = {
  register: (agent: Partial<Agent>): Promise<{ success: boolean; data: Agent }> =>
    api.post('/agents/register', agent),

  list: (): Promise<{ success: boolean; data: Agent[] }> =>
    api.get('/agents'),

  get: (id: string): Promise<{ success: boolean; data: Agent }> =>
    api.get(`/agents/${id}`),

  getStatus: (id: string): Promise<{ success: boolean; data: { agentId: string; status: string } }> =>
    api.get(`/agents/${id}/status`),

  sendRequest: (from: string, to: string, type: string, payload: unknown, contract?: unknown) =>
    api.post('/agents/bus/request', { from, to, type, payload, contract }),

  negotiate: (requesterId: string, responderId: string, request: unknown, timeout?: number) =>
    api.post('/agents/bus/negotiate', { requesterId, responderId, request, timeout }),

  getConflicts: (type: string, target: string, agentId: string) =>
    api.get('/agents/bus/conflicts', { params: { type, target, agentId } }),
}

export const blueprintApi = {
  listTemplates: (category?: string): Promise<{ success: boolean; data: BlueprintTemplate[] }> =>
    api.get('/blueprints/templates', { params: { category } }),

  createTemplate: (template: Partial<BlueprintTemplate>): Promise<{ success: boolean; data: BlueprintTemplate }> =>
    api.post('/blueprints/templates', template),

  getTemplate: (id: string): Promise<{ success: boolean; data: BlueprintTemplate }> =>
    api.get(`/blueprints/templates/${id}`),

  execute: (templateId: string, taskDoc: { title: string; description?: string; requirements?: string[] }) =>
    api.post('/blueprints/execute', { templateId, taskDoc }),

  getExecution: (id: string) =>
    api.get(`/blueprints/execute/${id}`),

  updateNodeStatus: (id: string, nodeId: string, status: string, output?: unknown) =>
    api.patch(`/blueprints/execute/${id}/nodes/${nodeId}`, { status, output }),

  listFunctions: (category?: string) =>
    api.get('/blueprints/functions', { params: { category } }),
}

export const chatApi = {
  sendMessage: (message: string, model: string, conversationId?: string): Promise<{ success: boolean; data: { response: string; conversationId: string } }> =>
    api.post('/chat/message', { message, model, conversationId }),

  getConversations: (): Promise<{ success: boolean; data: Array<{ id: string; title: string; updatedAt: string }> }> =>
    api.get('/chat/conversations'),

  getMessages: (conversationId: string): Promise<{ success: boolean; data: Array<{ id: string; role: string; content: string; timestamp: string }> }> =>
    api.get(`/chat/conversations/${conversationId}/messages`),
}

export const timelineApi = {
  getEvents: (workspaceId: string, params?: { from?: string; to?: string; type?: string; limit?: number }): Promise<{ success: boolean; data: { events: TimelineEvent[]; total: number } }> =>
    api.get(`/git/timeline/${workspaceId}`, { params }),

  checkout: (eventId: string, workspaceId: string, createBranch = false) =>
    api.post('/git/timeline/checkout', { eventId, workspaceId, createBranch }),

  createHypothesis: (eventId: string, branchName: string, description?: string) =>
    api.post('/git/timeline/hypothesis', { eventId, branchName, description }),
}

export default api
