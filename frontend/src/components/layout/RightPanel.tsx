import { useCallback, useEffect, useState } from 'react'
import {
  FolderOpen, ChevronRight, ChevronDown, Search,
  PanelRightClose, PanelRightOpen, ListTodo, Brain, GitBranch,
  CheckCircle2, Circle, Clock, Bot, FolderOpen as OpenFolder,
  Layers, Loader2
} from 'lucide-react'
import { useFileStore, useTabStore, useWorkspaceStore, useLayoutStore, useAgentStore } from '../../store'
import { workspaceApi, agentApi } from '../../services/api'
import { getFileIcon, getLanguageFromPath } from '../../utils/fileIcons'
import type { AgentInfo, AgentTask } from '../../store'

type RightTab = 'explorer' | 'todo' | 'context' | 'git'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

/** 文件树节点 */
function FileTreeItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const { expandedPaths, toggleExpanded, selectedFile } = useFileStore()
  const { openTab } = useTabStore()
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedFile === node.path
  const Icon = getFileIcon(node.name, node.type === 'directory', isExpanded)

  const handleClick = useCallback(() => {
    if (node.type === 'directory') {
      toggleExpanded(node.path)
    } else {
      openTab({
        id: `file:${node.path}`,
        type: 'file',
        title: node.name,
        path: node.path,
        language: getLanguageFromPath(node.path),
      })
    }
  }, [node, toggleExpanded, openTab])

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 pr-2 cursor-pointer transition-colors rounded-md mx-1 ${
          isSelected ? 'bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)]' : 'text-gray-600 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        <div className="flex-shrink-0 w-4 flex items-center justify-center">
          {node.type === 'directory' && (
            isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          )}
        </div>
        <Icon size={14} className="flex-shrink-0" />
        <span className="text-[13px] truncate flex-1">{node.name}</span>
      </div>
      {node.type === 'directory' && isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

/** 资源管理器面板 */
function ExplorerPanel() {
  const fileStore = useFileStore()
  const { setWorkspace, currentWorkspace } = useWorkspaceStore()
  const [isLoading, setIsLoading] = useState(false)

  const fileTree = fileStore.fileTree || []
  const setFileTree = fileStore.setFileTree

  const openProject = useCallback(async (path: string) => {
    setIsLoading(true)
    try {
      const response = await workspaceApi.open(path)
      if (response.success && response.data.fileTree) {
        setFileTree(response.data.fileTree)
        setWorkspace({
          id: response.data.id,
          path: response.data.path,
          name: response.data.name,
        })
      }
    } catch (err) {
      console.error('打开项目失败:', err)
    } finally {
      setIsLoading(false)
    }
  }, [setFileTree, setWorkspace])

  const handleSelectFolder = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker()
        const path = (dirHandle as any).name || dirHandle.kind
        await openProject(path)
      } else {
        const input = document.createElement('input')
        input.type = 'file'
        input.webkitdirectory = true
        input.onchange = async (e) => {
          const files = (e.target as HTMLInputElement).files
          if (files && files.length > 0) {
            const path = files[0].webkitRelativePath.split('/')[0]
            await openProject(path)
          }
        }
        input.click()
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('选择文件夹失败:', err)
      }
    }
  }

  useEffect(() => {
    if (!currentWorkspace) {
      openProject('d:\\AI\\FlowMind\\flowmind')
    }
  }, [currentWorkspace, openProject])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={handleSelectFolder}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)] rounded hover:bg-[var(--flowmind-primary)]/20 transition-colors disabled:opacity-50"
          >
            <OpenFolder size={12} />
            <span>打开项目</span>
          </button>
          {currentWorkspace && (
            <span className="text-[10px] text-gray-400 truncate max-w-[100px]" title={currentWorkspace.path}>
              {currentWorkspace.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-100 rounded-lg">
          <Search size={12} className="text-gray-400" />
          <input
            type="text"
            placeholder="搜索文件..."
            className="flex-1 bg-transparent text-xs text-gray-600 placeholder-gray-400 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-gray-400">加载中...</p>
          </div>
        ) : fileTree.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-gray-400">暂无文件</p>
            <p className="text-[10px] text-gray-400 mt-1">点击上方按钮选择文件夹</p>
          </div>
        ) : (
          fileTree.map((node) => (
            <FileTreeItem key={node.path} node={node} />
          ))
        )}
      </div>
    </div>
  )
}

/** 获取层级智能体的颜色 */
function getAgentTypeColor(type: string): string {
  const colors: Record<string, string> = {
    master: 'bg-purple-100 text-purple-700',
    sub_master: 'bg-indigo-100 text-indigo-700',
    lead: 'bg-blue-100 text-blue-700',
    sub_lead: 'bg-cyan-100 text-cyan-700',
    coder: 'bg-green-100 text-green-700',
    reviewer: 'bg-orange-100 text-orange-700',
    tester: 'bg-yellow-100 text-yellow-700',
    explorer: 'bg-pink-100 text-pink-700',
    custom: 'bg-gray-100 text-gray-700',
  }
  return colors[type] || colors.custom
}

/** 获取层级智能体的显示名称 */
function getAgentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    master: '总控',
    sub_master: '副控',
    lead: '负责人',
    sub_lead: '副负责人',
    coder: '工程师',
    reviewer: '审查员',
    tester: '测试员',
    explorer: '探索者',
    custom: '自定义',
  }
  return labels[type] || type
}

/** 待办面板 */
function TodoPanel() {
  const { agents, tasks, setAgents } = useAgentStore()

  useEffect(() => {
    agentApi.list().then((r) => {
      if (r.success && r.data) {
        const mapped: AgentInfo[] = r.data.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: (a.type || 'custom') as AgentInfo['type'],
          description: a.description,
          status: (a.status === 'active' ? 'busy' : a.status === 'idle' ? 'idle' : 'offline') as AgentInfo['status'],
          capabilities: a.capabilities || a.skills || [],
          modelProvider: a.modelProvider,
          model: a.model,
        }))
        setAgents(mapped)
      }
    }).catch(() => {
      setAgents([])
    })
  }, [setAgents])

  const staticTasks = [
    { id: 1, title: 'Task 7: 规格文档-契约联动引擎', status: 'done' },
    { id: 2, title: 'Task 8: 项目记忆（语义知识库）', status: 'pending' },
    { id: 3, title: 'Task 9: 脚本安全执行器', status: 'pending' },
    { id: 4, title: 'Task 10: 人机协同闸门控制', status: 'pending' },
    { id: 5, title: 'Task 1-4: 核心模块完成', status: 'done' },
    { id: 6, title: 'Task 5-6: UI 重构与文件编辑器', status: 'done' },
  ]

  const statusIcon = (s: string) => {
    if (s === 'done') return <CheckCircle2 size={12} className="text-green-500" />
    if (s === 'in_progress') return <Clock size={12} className="text-blue-500" />
    return <Circle size={12} className="text-gray-300" />
  }

  const taskStatusIcon = (task: AgentTask) => {
    if (task.status === 'completed') return <CheckCircle2 size={12} className="text-green-500" />
    if (task.status === 'running') return <Loader2 size={12} className="text-blue-500 animate-spin" />
    if (task.status === 'failed') return <Circle size={12} className="text-red-400" />
    return <Circle size={12} className="text-gray-300" />
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-4">
      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ListTodo size={13} /> 项目进度
        </h4>
        <div className="space-y-1">
          {staticTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-colors">
              {statusIcon(t.status)}
              <span className={`text-[12px] truncate ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                {t.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Layers size={13} /> 层级智能体
        </h4>
        {agents && agents.length > 0 ? (
          <div className="space-y-1.5">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                <div className={`w-2 h-2 rounded-full ${
                  a.status === 'busy' ? 'bg-yellow-400' :
                  a.status === 'idle' ? 'bg-green-400' :
                  a.status === 'error' ? 'bg-red-400' : 'bg-gray-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] text-gray-700 font-medium truncate">{a.name}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded ${getAgentTypeColor(a.type)}`}>
                      {getAgentTypeLabel(a.type)}
                    </span>
                  </div>
                  {a.capabilities.length > 0 && (
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      {a.capabilities.slice(0, 2).join(', ')}
                      {a.capabilities.length > 2 && ` +${a.capabilities.length - 2}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 px-2">暂无智能体</p>
        )}
      </div>

      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Bot size={13} /> 任务执行状态
        </h4>
        {tasks && tasks.length > 0 ? (
          <div className="space-y-1">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-colors">
                {taskStatusIcon(t)}
                <span className="text-[12px] text-gray-600 flex-1 truncate">{t.description}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  t.status === 'running' ? 'bg-blue-100 text-blue-600' :
                  t.status === 'completed' ? 'bg-green-100 text-green-600' :
                  t.status === 'failed' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {t.status === 'running' ? '执行中' :
                   t.status === 'completed' ? '已完成' :
                   t.status === 'failed' ? '失败' : '待执行'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 px-2">暂无运行中任务</p>
        )}
      </div>
    </div>
  )
}

/** 上下文面板 */
function ContextPanel() {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-3">
      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Brain size={13} /> 当前上下文
        </h4>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[11px] text-gray-500 mb-1">工作空间</p>
          <p className="text-xs text-gray-700 font-medium">FlowMind</p>
        </div>
      </div>
      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2">打开文件</h4>
        <div className="space-y-1">
          <div className="text-[11px] text-gray-500 px-2">暂无打开文件</div>
        </div>
      </div>
      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2">AI 记忆</h4>
        <p className="text-[11px] text-gray-400 px-2">暂无记忆数据</p>
      </div>
    </div>
  )
}

/** Git 管理面板 */
function GitPanel() {
  const [gitInfo] = useState<{ branch: string; changes: string[]; staged: string[] }>({
    branch: 'main',
    changes: [],
    staged: [],
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          <GitBranch size={13} /> Git
        </h4>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)]">
          {gitInfo.branch}
        </span>
      </div>

      <div>
        <h5 className="text-[10px] text-gray-500 mb-1">变更 ({gitInfo.changes ? gitInfo.changes.length : 0})</h5>
        {(!gitInfo.changes || gitInfo.changes.length === 0) ? (
          <p className="text-[10px] text-gray-400 px-2">工作区干净</p>
        ) : (
          <div className="space-y-0.5">
            {gitInfo.changes.map((f, i) => (
              <div key={i} className="text-[11px] px-2 py-0.5 rounded text-gray-600 bg-yellow-50">
                {f}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="提交信息..."
            className="flex-1 text-[11px] px-2 py-1 bg-gray-100 rounded border-0 focus:outline-none focus:ring-1 focus:ring-[var(--flowmind-primary)]"
          />
          <button className="text-[11px] px-2 py-1 bg-[var(--flowmind-primary)] text-white rounded hover:bg-[var(--flowmind-primary-hover)] transition-colors">
            提交
          </button>
        </div>
      </div>
    </div>
  )
}

/** 右侧面板 */
export default function RightPanel() {
  const { rightCollapsed, toggleRight } = useLayoutStore()
  const [activeTab, setActiveTab] = useState<RightTab>('explorer')

  const tabItems: { key: RightTab; label: string; Icon: typeof FolderOpen }[] = [
    { key: 'explorer', label: '资源管理器', Icon: FolderOpen },
    { key: 'todo', label: '待办', Icon: ListTodo },
    { key: 'context', label: '上下文', Icon: Brain },
    { key: 'git', label: 'Git', Icon: GitBranch },
  ]

  if (rightCollapsed) {
    return (
      <div
        className="w-8 flex-shrink-0 flex flex-col items-center py-3 cursor-pointer hover:bg-gray-50"
        onClick={toggleRight}
        title="展开面板"
      >
        <PanelRightOpen size={16} className="text-gray-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--flowmind-bg)]">
      <div className="flex items-center justify-between">
        <div className="flex">
          {tabItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center justify-center px-3 py-2 transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-[var(--flowmind-primary)] text-[var(--flowmind-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              title={label}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
        <button
          onClick={toggleRight}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 mx-1"
          title="折叠"
        >
          <PanelRightClose size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'explorer' && <ExplorerPanel />}
        {activeTab === 'todo' && <TodoPanel />}
        {activeTab === 'context' && <ContextPanel />}
        {activeTab === 'git' && <GitPanel />}
      </div>
    </div>
  )
}
