import { useCallback, useEffect, useState } from 'react'
import {
  FolderOpen, ChevronRight, ChevronDown, RefreshCw, Search,
  PanelRightClose, PanelRightOpen, ListTodo, Brain, GitBranch,
  CheckCircle2, Circle, Clock, AlertCircle, Bot
} from 'lucide-react'
import { useFileStore, useTabStore, useWorkspaceStore, useLayoutStore } from '../../store'
import { workspaceApi, agentApi } from '../../services/api'
import { getFileIcon, getLanguageFromPath } from '../../utils/fileIcons'
import type { FileNode } from '../../store'

type RightTab = 'explorer' | 'todo' | 'context' | 'git'

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
      {node.type === 'directory' && isExpanded && node.children && (
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
  const { fileTree, setFileTree } = useFileStore()
  const { currentWorkspace } = useWorkspaceStore()

  const loadWorkspace = useCallback(async () => {
    const wsId = currentWorkspace?.id || 'default'
    const wsPath = currentWorkspace?.path || 'd:\\AI\\FlowMind\\flowmind'
    try {
      const response = await workspaceApi.open(wsPath)
      if (response.success && response.data.fileTree) {
        setFileTree(response.data.fileTree)
      }
    } catch {
      setFileTree([])
    }
  }, [currentWorkspace, setFileTree])

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex-shrink-0">
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
        {fileTree.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-gray-400">暂无文件</p>
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

/** 待办面板：任务进度 + 智能体状态 */
function TodoPanel() {
  const [agents, setAgents] = useState<Array<{ id: string; type: string; name: string; status: string }>>([])

  useEffect(() => {
    agentApi.list().then((r) => {
      if (r.success) setAgents(r.data)
    }).catch(() => {})
  }, [])

  const tasks = [
    { id: 1, title: 'Task 7: 规格文档-契约联动引擎', status: 'pending' },
    { id: 2, title: 'Task 8: 项目记忆（语义知识库）', status: 'pending' },
    { id: 3, title: 'Task 9: 脚本安全执行器', status: 'pending' },
    { id: 4, title: 'Task 10: 人机协同闸门控制', status: 'pending' },
    { id: 5, title: 'Task 1-4: 核心模块完成', status: 'done' },
    { id: 6, title: 'Task 5: 三栏+时间轴 UI 重构', status: 'in_progress' },
    { id: 7, title: 'Task 6: 文件浏览器+编辑器接入', status: 'in_progress' },
  ]

  const statusIcon = (s: string) => {
    if (s === 'done') return <CheckCircle2 size={12} className="text-green-500" />
    if (s === 'in_progress') return <Clock size={12} className="text-blue-500" />
    return <Circle size={12} className="text-gray-300" />
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-4">
      {/* 任务进度 */}
      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ListTodo size={13} /> 任务进度
        </h4>
        <div className="space-y-1">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-colors">
              {statusIcon(t.status)}
              <span className={`text-[12px] truncate ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                {t.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 智能体状态 */}
      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Bot size={13} /> 智能体状态
        </h4>
        {agents.length === 0 ? (
          <p className="text-[11px] text-gray-400 px-2">暂无智能体运行</p>
        ) : (
          <div className="space-y-1">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-[12px] text-gray-600 flex-1 truncate">{a.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  a.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {a.status === 'active' ? '运行中' : '空闲'}
                </span>
              </div>
            ))}
          </div>
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
        <div className="p-2 bg-gray-50 rounded-lg">
          <p className="text-[11px] text-gray-500 mb-1">工作空间</p>
          <p className="text-xs text-gray-700 font-medium">FlowMind</p>
        </div>
      </div>
      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2">打开文件</h4>
        <div className="space-y-1">
          <div className="text-[11px] text-gray-500 px-2">editorArea.tsx</div>
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
  const [gitInfo, setGitInfo] = useState<{ branch: string; changes: string[]; staged: string[] }>({
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
        <h5 className="text-[10px] text-gray-500 mb-1">变更 ({gitInfo.changes.length})</h5>
        {gitInfo.changes.length === 0 ? (
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

      <div className="border-t pt-2" style={{ borderColor: 'var(--flowmind-border)' }}>
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

/** 右侧面板：带标签切换的复合面板 */
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
        className="w-8 flex-shrink-0 flex flex-col items-center py-3 border-l cursor-pointer hover:bg-gray-50"
        style={{ borderColor: 'var(--flowmind-border)' }}
        onClick={toggleRight}
        title="展开面板"
      >
        <PanelRightOpen size={16} className="text-gray-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--flowmind-bg)]">
      {/* 标签栏 */}
      <div className="flex items-center border-b justify-between" style={{ borderColor: 'var(--flowmind-border)' }}>
        <div className="flex">
          {tabItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-[var(--flowmind-primary)] text-[var(--flowmind-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} />
              <span className="hidden xl:inline">{label}</span>
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

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'explorer' && <ExplorerPanel />}
        {activeTab === 'todo' && <TodoPanel />}
        {activeTab === 'context' && <ContextPanel />}
        {activeTab === 'git' && <GitPanel />}
      </div>
    </div>
  )
}
