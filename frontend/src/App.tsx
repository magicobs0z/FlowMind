import { Settings, User, PanelRightOpen, PanelBottomOpen, MessageSquare, X, Workflow, Terminal } from 'lucide-react'
import { useLayoutStore, useTabStore, useChatStore, useBlueprintStore } from './store'
import ResizablePanel from './components/layout/ResizablePanel'
import ChatPanel from './components/layout/ChatPanel'
import TabBar from './components/layout/TabBar'
import EditorArea from './components/layout/EditorArea'
import RightPanel from './components/layout/RightPanel'
import BottomTimeline from './components/layout/BottomTimeline'

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
  const { createBlueprint, setCurrentBlueprintId } = useBlueprintStore()

  const handleOpenSettings = () => {
    openTab({ id: 'settings', type: 'settings', title: '设置' })
  }

  const handleCreateBlueprint = () => {
    const newId = createBlueprint('新蓝图', [], [])
    setCurrentBlueprintId(newId)
    openTab({ id: newId, type: 'blueprint', title: '新蓝图' })
  }

  const handleOpenTerminal = () => {
    openTab({ id: 'terminal', type: 'terminal', title: '终端' })
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#f7f7f7' }}>
      {/* 顶部栏 */}
      <div className="h-8 flex-shrink-0 flex items-center justify-between px-3 border-b border-gray-200" style={{ background: '#fafafa' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: '#0099ff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-800">FlowMind</span>
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
            className="p-1.5 rounded-md bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)] hover:bg-[var(--flowmind-primary)]/20 transition-colors"
            title="展开右侧面板"
          >
            <PanelRightOpen size={14} />
          </button>
        )}
        {bottomCollapsed && (
          <button
            onClick={toggleBottom}
            className="p-1.5 rounded-md bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)] hover:bg-[var(--flowmind-primary)]/20 transition-colors"
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
                  className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
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
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                title="对话列表"
              >
                <MessageSquare size={15} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleOpenSettings}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                title="设置"
              >
                <Settings size={15} />
              </button>
              <button
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
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
          className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)] rounded-lg hover:bg-[var(--flowmind-primary)]/20 transition-colors"
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
                  ? 'bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)]'
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
