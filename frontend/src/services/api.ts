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

export default api

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
  open: (path: string): Promise<{ success: boolean; data: WorkspaceSummary; error?: string }> =>
    api.post('/workspace/open', { path }),

  get: (id: string): Promise<{ success: boolean; data: WorkspaceSummary; error?: string }> =>
    api.get(`/workspace/${id}`),

  getProjectSummary: (): Promise<{ success: boolean; data: WorkspaceSummary; error?: string }> =>
    api.get('/workspace/summary'),

  scan: (id: string): Promise<{ success: boolean; data: WorkspaceSummary; error?: string }> =>
    api.post(`/workspace/${id}/rescan`),

  readFile: (filePath: string): Promise<{ success: boolean; data: { path: string; content: string }; error?: string }> =>
    api.post('/workspace/file/read', { path: filePath }),

  writeFile: (filePath: string, content: string, createDirectories = true): Promise<{ success: boolean; data: { path: string }; error?: string }> =>
    api.post('/workspace/file/write', { path: filePath, content, createDirectories }),

  deleteFile: (filePath: string): Promise<{ success: boolean; data: { path: string }; error?: string }> =>
    api.post('/workspace/file/delete', { path: filePath }),

  createDirectory: (dirPath: string, recursive = true): Promise<{ success: boolean; data: { path: string }; error?: string }> =>
    api.post('/workspace/file/mkdir', { path: dirPath, recursive }),

  listDirectory: (dirPath = '.'): Promise<{ success: boolean; data: Array<{ name: string; path: string; isDirectory: boolean; size: number; modified: string }>; error?: string }> =>
    api.post('/workspace/file/list', { path: dirPath }),

  searchFiles: (query: string, path?: string, type?: string, filePattern?: string): Promise<{ success: boolean; data: any[]; error?: string }> =>
    api.post('/workspace/file/search', { query, path, type, filePattern }),
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

  create: (agent: Partial<Agent>): Promise<{ success: boolean; data: Agent; error?: string }> =>
    api.post('/agents', agent),

  update: (id: string, updates: Partial<Agent>): Promise<{ success: boolean; data: Agent; error?: string }> =>
    api.put(`/agents/${id}`, updates),

  delete: (id: string): Promise<{ success: boolean; message?: string; error?: string }> =>
    api.delete(`/agents/${id}`),

  createSession: (title: string, masterAgentId: string, participatingAgentIds: string[]): Promise<{ 
    success: boolean; 
    data?: any; 
    error?: string 
  }> =>
    api.post('/agents/sessions', { title, masterAgentId, participatingAgentIds }),

  listSessions: (): Promise<{ success: boolean; data: any[]; error?: string }> =>
    api.get('/agents/sessions'),

  getSession: (id: string): Promise<{ success: boolean; data: any; error?: string }> =>
    api.get(`/agents/sessions/${id}`),

  startSession: (id: string): Promise<{ success: boolean; data: any; error?: string }> =>
    api.post(`/agents/sessions/${id}/start`),

  pauseSession: (id: string): Promise<{ success: boolean; data: any; error?: string }> =>
    api.post(`/agents/sessions/${id}/pause`),

  addTask: (sessionId: string, description: string, priority?: string, assignedTo?: string): Promise<{ 
    success: boolean; 
    data?: any; 
    error?: string 
  }> =>
    api.post('/agents/sessions/:id/tasks', { sessionId, description, priority, assignedTo }),

  executeTask: (sessionId: string, taskId: string, llmConfig?: any): Promise<{ 
    success: boolean; 
    data?: any; 
    error?: string 
  }> =>
    api.post(`/agents/sessions/${sessionId}/tasks/${taskId}/execute`, { llmConfig }),

  executeCommand: async (
    command: string,
    workingDirectory?: string,
    timeout = 30000
  ): Promise<{ success: boolean; data?: { output: string; exitCode: number }; error?: string }> => {
    try {
      const response = await fetch('/api/v1/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, workingDirectory, timeout })
      })
      
      const data = await response.json()
      return data
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution failed'
      }
    }
  },

  gitOperation: async (
    operation: string,
    args?: string
  ): Promise<{ success: boolean; data?: { output: string; exitCode: number }; error?: string }> => {
    try {
      const response = await fetch('/api/v1/agent/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, args })
      })
      
      const data = await response.json()
      return data
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git operation failed'
      }
    }
  },

  getWorkspaceFiles: async (
    workspaceId: string
  ): Promise<{ success: boolean; data?: { files: string[] }; error?: string }> => {
    try {
      const response = await fetch(`/api/v1/agent/workspace/${workspaceId}/files`, {
        method: 'GET'
      })
      
      const data = await response.json()
      return data
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get workspace files'
      }
    }
  },
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
  sendMessage: (message: string, model: string, conversationId?: string, llmConfig?: { apiKey: string; baseUrl: string; modelName: string }): Promise<{ success: boolean; data: { response: string; conversationId: string } }> =>
    api.post('/chat/message', { message, model, conversationId, llmConfig }),

  sendMessageStream: (message: string, model: string, conversationId: string | undefined, llmConfig: { apiKey: string; baseUrl: string; modelName: string } | undefined, onChunk: (chunk: string) => void): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch('/api/v1/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, model, conversationId, llmConfig })
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No reader available')
        }

        const decoder = new TextDecoder()
        let fullResponse = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6)
              if (dataStr === '[DONE]') continue

              try {
                const data = JSON.parse(dataStr)
                const delta = data.choices?.[0]?.delta?.content
                if (delta) {
                  fullResponse += delta
                  onChunk(delta)
                }
              } catch (e) {
                console.debug('Parse stream data error', e)
              }
            }
          }
        }

        resolve(fullResponse)
      } catch (error) {
        reject(error)
      }
    })
  },

  getConversations: (): Promise<{ success: boolean; data: Array<{ id: string; title: string; updatedAt: string; messageCount: number }> }> =>
    api.get('/chat/conversations'),

  getMessages: (conversationId: string): Promise<{ success: boolean; data: Array<{ id: string; role: string; content: string; timestamp: string }> }> =>
    api.get(`/chat/conversations/${conversationId}/messages`),

  deleteConversation: (conversationId: string): Promise<{ success: boolean }> =>
    api.delete(`/chat/conversations/${conversationId}`),
}

export interface ModelConfig {
  id: string
  name: string
  provider: string
  type: 'llm' | 'custom'
  apiKey: string
  baseUrl: string
  modelName: string
  icon?: string
  isDefault: boolean
  temperature?: number
  topP?: number
  maxTokens?: number
  contextWindow?: number
  protocol?: 'openai' | 'anthropic'
  useFullUrl?: boolean
  fullUrl?: string
  createdAt: string
  updatedAt: string
}

export const modelApi = {
  getProviders: (): Promise<{ success: boolean; data: any[] }> =>
    api.get('/models/providers'),

  list: (): Promise<{ success: boolean; data: ModelConfig[] }> =>
    api.get('/models'),

  get: (id: string): Promise<{ success: boolean; data: ModelConfig }> =>
    api.get(`/models/${id}`),

  create: (config: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; data: ModelConfig }> =>
    api.post('/models', config),

  update: (id: string, updates: Partial<ModelConfig>): Promise<{ success: boolean; data: ModelConfig }> =>
    api.put(`/models/${id}`, updates),

  delete: (id: string): Promise<{ success: boolean }> =>
    api.delete(`/models/${id}`),

  testConnection: (params: { apiKey: string; baseUrl: string; modelName: string; protocol?: string }): Promise<{ success: boolean; data: { connected: boolean; error?: string } }> =>
    api.post('/models/test', params),
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
