import { useState, useEffect } from 'react'
import { Settings, User, PanelRightOpen, PanelBottomOpen, MessageSquare, X, Workflow, Terminal, FolderOpen, ChevronDown } from 'lucide-react'
import { useLayoutStore, useTabStore, useChatStore, useBlueprintStore, useWorkspaceStore, useFileStore } from './store'
import ResizablePanel from './components/layout/ResizablePanel'
import ChatPanel from './components/layout/ChatPanel'
import TabBar from './components/layout/TabBar'
import EditorArea from './components/layout/EditorArea'
import RightPanel from './components/layout/RightPanel'
import BottomTimeline from './components/layout/BottomTimeline'
import BlueprintWelcomeModal from './components/layout/BlueprintWelcomeModal'
import { workspaceApi } from './services/api'

function App() {
  const {
    rightWidth,
    bottomHeight,
    chatWidth,
    conversationPanelWidth,
    conversationPanelOpen,
    rightCollapsed,
    bottomCollapsed,
    setRightWidth,
    setBottomHeight,
    setChatWidth,
    setConversationPanelWidth,
    toggleConversationPanel,
    toggleRight,
    toggleBottom,
  } = useLayoutStore()

  const { openTab } = useTabStore()
  const { setCurrentBlueprintId } = useBlueprintStore()
  const { currentWorkspace, isConfigured, clearWorkspace } = useWorkspaceStore()
  const { setFileTree } = useFileStore()
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [showBlueprintModal, setShowBlueprintModal] = useState(false)
  const [recentProjects, setRecentProjects] = useState<Array<{ path: string; name: string }>>([])

  // 初始化加载工作区文件树
  useEffect(() => {
    const initializeWorkspace = async () => {
      if (currentWorkspace && currentWorkspace.path) {
        try {
          const response = await workspaceApi.open(currentWorkspace.path)
          if (response.success && response.data.fileTree) {
            setFileTree(response.data.fileTree)
          }
        } catch (error) {
          console.error('初始化工作区失败:', error)
        }
      }
    }
    initializeWorkspace()
  }, [])

  // 加载最近项目
  useEffect(() => {
    const saved = localStorage.getItem('flowmind_recent_projects')
    if (saved) {
      setRecentProjects(JSON.parse(saved))
    }
  }, [])

  const handleOpenSettings = () => {
    openTab({ id: 'settings', type: 'settings', title: '设置' })
  }

  const handleCreateBlueprint = () => {
    setShowBlueprintModal(true)
  }

  const handleOpenTerminal = () => {
    openTab({ id: 'terminal', type: 'terminal', title: '终端' })
  }

  const handleSwitchProject = () => {
    setShowProjectMenu(!showProjectMenu)
  }

  const handleSelectProject = async (path: string) => {
    try {
      const response = await workspaceApi.open(path)
      if (response.success && response.data) {
        setFileTree(response.data.fileTree || [])
        useWorkspaceStore.getState().setWorkspace({
          id: response.data.id,
          path: response.data.path,
          name: response.data.name,
        })
      }
    } catch (error) {
      console.error('切换项目失败:', error)
    }
    setShowProjectMenu(false)
  }

  const handleClearWorkspace = () => {
    clearWorkspace()
    setShowProjectMenu(false)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#f7f7f7' }}>
      {/* 顶部栏 */}
      <div className="h-8 flex-shrink-0 flex items-center justify-between px-3 border-b border-gray-200" style={{ background: '#fafafa' }}>
        <div className="flex items-center gap-2 relative">
          {/* FlowMind 图标 + 项目切换下拉 */}
          <div className="relative">
            <button
              onClick={handleSwitchProject}
              className="flex items-center gap-1.5 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
            >
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: '#0099ff' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-800">FlowMind</span>
              {isConfigured && <ChevronDown size={10} className="text-gray-400" />}
            </button>
            
            {/* 项目切换下拉菜单 */}
            {showProjectMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowProjectMenu(false)} 
                />
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-2 border-b border-gray-100">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider px-2">
                      当前项目
                    </div>
                    {isConfigured && currentWorkspace ? (
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-blue-50">
                        <FolderOpen size={12} className="text-blue-500" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">
                            {currentWorkspace.name}
                          </div>
                          <div className="text-[9px] text-gray-400 truncate">
                            {currentWorkspace.path}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-gray-500">
                        未选择项目
                      </div>
                    )}
                  </div>
                  
                  {recentProjects.length > 0 && (
                    <div className="p-2 border-b border-gray-100">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider px-2 mb-1">
                        最近项目
                      </div>
                      {recentProjects.slice(0, 5).map((project) => (
                        <button
                          key={project.path}
                          onClick={() => handleSelectProject(project.path)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-left"
                        >
                          <FolderOpen size={12} className="text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-700 truncate">{project.name}</div>
                            <div className="text-[9px] text-gray-400 truncate">{project.path}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {isConfigured && (
                    <div className="p-2">
                      <button
                        onClick={handleClearWorkspace}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-red-600 hover:bg-red-50"
                      >
                        <X size={12} />
                        关闭当前项目
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateBlueprint}
            className="flex items-center gap-1.5 px-2 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-700"
            title="新建蓝图"
          >
            <Workflow size={12} />
            <span>新建蓝图</span>
          </button>
          <button
            onClick={handleOpenTerminal}
            className="flex items-center gap-1.5 px-2 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-700"
            title="打开终端"
          >
            <Terminal size={12} />
            <span>终端</span>
          </button>
        </div>
      </div>

      {/* 右上角悬浮控制按钮 */}
      <div className="fixed top-9 z-50 flex items-center gap-1" style={{ right: '30px' }}>
        {rightCollapsed && (
          <button
            onClick={toggleRight}
            className="p-1.5 rounded-md bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors"
            title="展开右侧面板"
          >
            <PanelRightOpen size={14} />
          </button>
        )}
        {bottomCollapsed && (
          <button
            onClick={toggleBottom}
            className="p-1.5 rounded-md bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors"
            title="展开时间轴"
          >
            <PanelBottomOpen size={14} />
          </button>
        )}
      </div>

      {/* 主体区域 - 水平排列 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：对话历史面板 */}
        {conversationPanelOpen && (
          <>
            <div
              className="flex flex-col flex-shrink-0 h-full bg-white border-r border-gray-200"
              style={{ width: conversationPanelWidth }}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 flex-shrink-0" style={{ background: '#fafafa' }}>
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">对话历史</span>
                <button
                  onClick={toggleConversationPanel}
                  className="p-1 rounded hover:bg-sky-50 text-gray-500 hover:text-sky-600 transition-colors"
                  title="收起"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ConversationListEmbedded />
              </div>
            </div>
            {/* 对话面板拖拽条 */}
            <div
              className="flex-shrink-0 h-full cursor-col-resize hover:bg-[var(--flowmind-primary)] transition-colors"
              style={{ width: '4px', background: '#e5e7eb' }}
              onMouseDown={(e) => {
                const startX = e.clientX
                const startWidth = conversationPanelWidth
                const onMouseMove = (ev: MouseEvent) => {
                  const delta = ev.clientX - startX
                  setConversationPanelWidth(startWidth + delta)
                }
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove)
                  document.removeEventListener('mouseup', onMouseUp)
                }
                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
              }}
            />
          </>
        )}

        {/* 中间：聊天面板 */}
        <div
          className="flex flex-col flex-shrink-0 h-full bg-white border-r border-gray-200"
          style={{ width: chatWidth }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 flex-shrink-0" style={{ background: '#fafafa' }}>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleConversationPanel}
                className="p-1.5 rounded-lg hover:bg-sky-50 text-gray-600 hover:text-sky-600 transition-colors"
                title="对话列表"
              >
                <MessageSquare size={15} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleOpenSettings}
                className="p-1.5 rounded-lg hover:bg-sky-50 text-gray-600 hover:text-sky-600 transition-colors"
                title="设置"
              >
                <Settings size={15} />
              </button>
              <button
                className="p-1.5 rounded-lg hover:bg-sky-50 text-gray-600 hover:text-sky-600 transition-colors"
                title="用户"
              >
                <User size={15} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ChatPanel />
          </div>
        </div>

        {/* 聊天面板与编辑器之间的拖拽条 */}
        <div
          className="flex-shrink-0 h-full cursor-col-resize hover:bg-[var(--flowmind-primary)] transition-colors"
          style={{ width: '4px', background: '#e5e7eb' }}
          onMouseDown={(e) => {
            const startX = e.clientX
            const startWidth = chatWidth
            const onMouseMove = (ev: MouseEvent) => {
              const delta = ev.clientX - startX
              setChatWidth(startWidth + delta)
            }
            const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove)
              document.removeEventListener('mouseup', onMouseUp)
            }
            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
          }}
        />

        {/* 中央：标签栏 + 编辑区 + 底部时间轴 */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <div className="border-b border-gray-200 flex-shrink-0" style={{ background: '#fafafa' }}>
            <TabBar />
          </div>
          <div className="flex-1 overflow-hidden bg-white min-h-0">
            <EditorArea />
          </div>

          {/* 底部时间轴 */}
          <div className="border-t border-gray-200 flex-shrink-0">
            <ResizablePanel
              direction="vertical"
              size={bottomHeight}
              minSize={100}
              maxSize={400}
              onResize={setBottomHeight}
              onCollapse={toggleBottom}
              collapsed={bottomCollapsed}
              collapseDirection="bottom"
            >
              <BottomTimeline />
            </ResizablePanel>
          </div>
        </div>

        {/* 右侧：资源管理器 */}
        <ResizablePanel
          direction="horizontal"
          size={rightWidth}
          minSize={200}
          maxSize={400}
          onResize={setRightWidth}
          onCollapse={toggleRight}
          collapsed={rightCollapsed}
          collapseDirection="right"
        >
          <RightPanel />
        </ResizablePanel>
      </div>

      <BlueprintWelcomeModal
        isOpen={showBlueprintModal}
        onClose={() => setShowBlueprintModal(false)}
      />
    </div>
  )
}

function ConversationListEmbedded() {
  const { conversations, currentConversationId, createConversation, setCurrentConversation } = useChatStore()

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex-shrink-0">
        <button
          onClick={createConversation}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-lg transition-colors"
        >
          <span className="text-base">+</span>
          <span>新建对话</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-2">
        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-gray-400">暂无对话</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setCurrentConversation(conv.id)}
              className={`w-full text-left px-3 py-2 mx-1 rounded-lg text-sm transition-colors ${
                currentConversationId === conv.id
                  ? 'bg-sky-100 text-sky-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="flex-shrink-0" />
                <span className="truncate flex-1">{conv.title}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-gray-400">
                  {conv.messages.length} 条消息
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(conv.updatedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default App
