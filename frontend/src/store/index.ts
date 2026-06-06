import { create } from 'zustand'

export interface FlowNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: Record<string, any>
  className?: string
  style?: React.CSSProperties
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  type?: string
  animated?: boolean
  markerEnd?: { type: string }
  style?: React.CSSProperties
}

export interface Tab {
  id: string
  type: 'file' | 'blueprint' | 'dag' | 'diff' | 'welcome' | 'settings' | 'terminal'
  title: string
  path?: string
  content?: string
  language?: string
  isDirty?: boolean
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  isExpanded?: boolean
}

export interface Message {
  id: string
  role: 'user' | 'ai' | 'system'
  content: string
  timestamp: string
  model?: string
  status?: 'thinking' | 'tool_call' | 'executing' | 'result' | 'error'
  contents?: any[]
  think?: string
  toolCalls?: any[]
  plan?: any
}

export interface AIMessage extends Message {
  role: 'ai'
  contents?: any[]
  think?: string
  toolCalls?: any[]
  plan?: any
}

export interface UserMessage extends Message {
  role: 'user'
}

export interface SystemMessage extends Message {
  role: 'system'
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
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

export interface AIModel {
  id: string
  name: string
  provider: string
  type: 'llm' | 'custom'
  apiKey: string
  baseUrl?: string
  modelName?: string
  icon?: string
  isDefault: boolean
}

export interface Blueprint {
  id: string
  name: string
  description?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  createdAt: string
  updatedAt: string
}

interface LayoutState {
  rightWidth: number
  bottomHeight: number
  chatWidth: number
  conversationPanelWidth: number
  conversationPanelOpen: boolean
  rightCollapsed: boolean
  bottomCollapsed: boolean
  setRightWidth: (w: number) => void
  setBottomHeight: (h: number) => void
  setChatWidth: (w: number) => void
  setConversationPanelWidth: (w: number) => void
  toggleConversationPanel: () => void
  toggleRight: () => void
  toggleBottom: () => void
}

interface TabState {
  tabs: Tab[]
  activeTabId: string | null
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabContent: (id: string, content: string) => void
  markTabDirty: (id: string, dirty: boolean) => void
}

interface FileState {
  fileTree: FileNode[]
  selectedFile: string | null
  expandedPaths: Set<string>
  setFileTree: (tree: FileNode[]) => void
  toggleExpanded: (path: string) => void
  selectFile: (path: string) => void
}

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  selectedModel: string
  setConversations: (c: Conversation[]) => void
  setCurrentConversation: (id: string) => void
  addMessage: (conversationId: string, message: Message) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void
  setLoading: (loading: boolean) => void
  setSelectedModel: (model: string) => void
  createConversation: () => string
}

interface WorkspaceState {
  currentWorkspace: { id: string; path: string; name: string } | null
  timelineEvents: TimelineEvent[]
  setWorkspace: (w: { id: string; path: string; name: string } | null) => void
  setTimelineEvents: (events: TimelineEvent[]) => void
  addTimelineEvent: (event: TimelineEvent) => void
}

interface AIState {
  models: AIModel[]
  currentModelId: string | null
  setModels: (models: AIModel[]) => void
  addModel: (model: AIModel) => void
  updateModel: (id: string, model: Partial<AIModel>) => void
  deleteModel: (id: string) => void
  setCurrentModelId: (id: string) => void
}

interface BlueprintState {
  blueprints: Blueprint[]
  currentBlueprintId: string | null
  isExecuting: boolean
  setBlueprints: (blueprints: Blueprint[]) => void
  setCurrentBlueprintId: (id: string) => void
  createBlueprint: (name: string, nodes: FlowNode[], edges: FlowEdge[]) => string
  updateBlueprint: (id: string, updates: Partial<Blueprint>) => void
  deleteBlueprint: (id: string) => void
  setIsExecuting: (executing: boolean) => void
}

export interface AgentTask {
  id: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  logs: Array<{
    timestamp: string
    type: 'info' | 'tool' | 'result' | 'error'
    message: string
  }>
  backendTaskId?: string
  sessionId?: string
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

export interface AgentInfo {
  id: string
  name: string
  type: AgentType
  description?: string
  status: 'idle' | 'busy' | 'error' | 'offline'
  capabilities: string[]
  modelProvider?: string
  model?: string
}

interface AgentState {
  tasks: AgentTask[]
  currentTaskId: string | null
  agents: AgentInfo[]
  currentSessionId: string | null
  addTask: (task: AgentTask) => void
  updateTask: (id: string, updates: Partial<AgentTask>) => void
  removeTask: (id: string) => void
  setCurrentTaskId: (id: string | null) => void
  clearTasks: () => void
  setAgents: (agents: AgentInfo[]) => void
  updateAgent: (id: string, updates: Partial<AgentInfo>) => void
  setCurrentSessionId: (id: string | null) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  rightWidth: 280,
  bottomHeight: 200,
  chatWidth: 520,
  conversationPanelWidth: 260,
  conversationPanelOpen: false,
  rightCollapsed: false,
  bottomCollapsed: false,
  setRightWidth: (w) => set({ rightWidth: Math.max(200, Math.min(500, w)) }),
  setBottomHeight: (h) => set({ bottomHeight: Math.max(100, Math.min(400, h)) }),
  setChatWidth: (w) => set({ chatWidth: Math.max(400, Math.min(800, w)) }),
  setConversationPanelWidth: (w) => set({ conversationPanelWidth: Math.max(180, Math.min(400, w)) }),
  toggleConversationPanel: () => set((s) => ({ conversationPanelOpen: !s.conversationPanelOpen })),
  toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  toggleBottom: () => set((s) => ({ bottomCollapsed: !s.bottomCollapsed })),
}))

export const useTabStore = create<TabState>((set) => ({
  tabs: [{ id: 'welcome', type: 'welcome', title: '欢迎' }],
  activeTabId: 'welcome',
  openTab: (tab) =>
    set((s) => {
      const exists = s.tabs.find((t) => t.id === tab.id)
      if (exists) return { activeTabId: tab.id }
      return { tabs: [...s.tabs, tab], activeTabId: tab.id }
    }),
  closeTab: (id) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.id !== id)
      let newActive = s.activeTabId
      if (s.activeTabId === id) {
        const idx = s.tabs.findIndex((t) => t.id === id)
        newActive = newTabs[Math.max(0, idx - 1)]?.id || null
      }
      return { tabs: newTabs, activeTabId: newActive }
    }),
  setActiveTab: (id) => set({ activeTabId: id }),
  updateTabContent: (id, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, content } : t)),
    })),
  markTabDirty: (id, dirty) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, isDirty: dirty } : t)),
    })),
}))

export const useFileStore = create<FileState>((set) => ({
  fileTree: [],
  selectedFile: null,
  expandedPaths: new Set(),
  setFileTree: (tree) => set({ fileTree: tree }),
  toggleExpanded: (path) =>
    set((s) => {
      const next = new Set(s.expandedPaths)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return { expandedPaths: next }
    }),
  selectFile: (path) => set({ selectedFile: path }),
}))

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversationId: null,
  isLoading: false,
  selectedModel: 'qwen3.6-plus',
  setConversations: (c) => set({ conversations: c }),
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  addMessage: (conversationId, message) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message], updatedAt: new Date().toISOString() }
          : c
      ),
    })),
  updateMessage: (conversationId, messageId, updates) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  createConversation: () => {
    const id = `conv_${Date.now()}`
    const newConv: Conversation = {
      id,
      title: '新对话',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set((s) => ({
      conversations: [...s.conversations, newConv],
      currentConversationId: id,
    }))
    return id
  },
}))

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentWorkspace: null,
  timelineEvents: [],
  setWorkspace: (w) => set({ currentWorkspace: w }),
  setTimelineEvents: (events) => set({ timelineEvents: events }),
  addTimelineEvent: (event) => set((s) => ({ timelineEvents: [...s.timelineEvents, event] })),
}))

export const useAIStore = create<AIState>((set, get) => {
  // 从 localStorage 加载作为初始值（兼容旧数据）
  const savedModels = localStorage.getItem('flowmind_ai_models')
  const initialModels: AIModel[] = savedModels ? JSON.parse(savedModels) : []

  const defaultModel = initialModels.find(m => m.isDefault) || initialModels[0]

  return {
    models: initialModels,
    currentModelId: defaultModel?.id || null,
    setModels: (models) => {
      localStorage.setItem('flowmind_ai_models', JSON.stringify(models))
      set({ models })
    },
    addModel: (model) => {
      const newModels = [...get().models, model]
      localStorage.setItem('flowmind_ai_models', JSON.stringify(newModels))
      set({ models: newModels })
    },
    updateModel: (id, model) => {
      const newModels = get().models.map(m => m.id === id ? { ...m, ...model } : m)
      localStorage.setItem('flowmind_ai_models', JSON.stringify(newModels))
      set({ models: newModels })
    },
    deleteModel: (id) => {
      const newModels = get().models.filter(m => m.id !== id)
      localStorage.setItem('flowmind_ai_models', JSON.stringify(newModels))
      set({ models: newModels })
    },
    setCurrentModelId: (id) => set({ currentModelId: id }),
  }
})

export const useBlueprintStore = create<BlueprintState>((set, get) => {
  const savedBlueprints = localStorage.getItem('flowmind_blueprints')
  const initialBlueprints: Blueprint[] = savedBlueprints ? JSON.parse(savedBlueprints) : []

  return {
    blueprints: initialBlueprints,
    currentBlueprintId: null,
    isExecuting: false,
    setBlueprints: (blueprints) => {
      localStorage.setItem('flowmind_blueprints', JSON.stringify(blueprints))
      set({ blueprints })
    },
    setCurrentBlueprintId: (id) => set({ currentBlueprintId: id }),
    createBlueprint: (name, nodes, edges) => {
      const id = `blueprint_${Date.now()}`
      const newBlueprint: Blueprint = {
        id,
        name,
        nodes,
        edges,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const newBlueprints = [...get().blueprints, newBlueprint]
      localStorage.setItem('flowmind_blueprints', JSON.stringify(newBlueprints))
      set({ blueprints: newBlueprints, currentBlueprintId: id })
      return id
    },
    updateBlueprint: (id, updates) => {
      const newBlueprints = get().blueprints.map(b =>
        b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
      )
      localStorage.setItem('flowmind_blueprints', JSON.stringify(newBlueprints))
      set({ blueprints: newBlueprints })
    },
    deleteBlueprint: (id) => {
      const newBlueprints = get().blueprints.filter(b => b.id !== id)
      localStorage.setItem('flowmind_blueprints', JSON.stringify(newBlueprints))
      set({ blueprints: newBlueprints })
    },
    setIsExecuting: (executing) => set({ isExecuting: executing }),
  }
})

export const useAgentStore = create<AgentState>((set, get) => ({
  tasks: [],
  currentTaskId: null,
  agents: [],
  currentSessionId: null,
  addTask: (task) => set({ tasks: [...get().tasks, task] }),
  updateTask: (id, updates) =>
    set({
      tasks: get().tasks.map(t => t.id === id ? { ...t, ...updates } : t)
    }),
  removeTask: (id) => set({ tasks: get().tasks.filter(t => t.id !== id) }),
  setCurrentTaskId: (id) => set({ currentTaskId: id }),
  clearTasks: () => set({ tasks: [] }),
  setAgents: (agents) => set({ agents }),
  updateAgent: (id, updates) =>
    set({
      agents: get().agents.map(a => a.id === id ? { ...a, ...updates } : a)
    }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
}))
