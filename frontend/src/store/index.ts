import { create } from 'zustand'

export interface Tab {
  id: string
  type: 'file' | 'blueprint' | 'dag' | 'diff' | 'welcome' | 'settings'
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

interface LayoutState {
  leftWidth: number
  rightWidth: number
  bottomHeight: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  bottomCollapsed: boolean
  setLeftWidth: (w: number) => void
  setRightWidth: (w: number) => void
  setBottomHeight: (h: number) => void
  toggleLeft: () => void
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

export const useLayoutStore = create<LayoutState>((set) => ({
  leftWidth: 380,
  rightWidth: 280,
  bottomHeight: 200,
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: false,
  setLeftWidth: (w) => set({ leftWidth: Math.max(260, Math.min(600, w)) }),
  setRightWidth: (w) => set({ rightWidth: Math.max(200, Math.min(400, w)) }),
  setBottomHeight: (h) => set({ bottomHeight: Math.max(100, Math.min(400, h)) }),
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
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
  addTimelineEvent: (event) =>
    set((s) => ({ timelineEvents: [...s.timelineEvents, event] })),
}))
