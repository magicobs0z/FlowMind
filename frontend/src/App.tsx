import { Settings, User, PanelRightOpen, PanelBottomOpen } from 'lucide-react'
import { useLayoutStore, useTabStore } from './store'
import ResizablePanel from './components/layout/ResizablePanel'
import ConversationList from './components/layout/ConversationList'
import ChatPanel from './components/layout/ChatPanel'
import TabBar from './components/layout/TabBar'
import EditorArea from './components/layout/EditorArea'
import RightPanel from './components/layout/RightPanel'
import BottomTimeline from './components/layout/BottomTimeline'

/** 主应用布局 */
function App() {
  const {
    leftWidth,
    rightWidth,
    bottomHeight,
    leftCollapsed,
    rightCollapsed,
    bottomCollapsed,
    setLeftWidth,
    setRightWidth,
    setBottomHeight,
    toggleLeft,
    toggleRight,
    toggleBottom,
  } = useLayoutStore()

  const { openTab } = useTabStore()

  const handleOpenSettings = () => {
    openTab({ id: 'settings', type: 'settings', title: '设置' })
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--flowmind-bg)] overflow-hidden">
      {/* 右上角悬浮控制按钮：面板折叠时显示展开入口，距右侧 30px */}
      <div className="fixed top-1 z-50 flex items-center gap-1" style={{ right: '30px' }}>
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

      {/* 主体区域：左 + 中 + 右 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：对话管理（可折叠向左收起）+ 聊天面板（不可折叠） */}
        <ResizablePanel
          direction="horizontal"
          size={leftWidth}
          minSize={260}
          maxSize={600}
          onResize={setLeftWidth}
          onCollapse={toggleLeft}
          collapsed={leftCollapsed}
          collapseDirection="left"
        >
          <div className="flex h-full">
            <ConversationList />
            <div className="flex-1 flex flex-col min-w-0 bg-white">
              {/* 聊天面板上方工具栏：设置 + 用户按钮，无文字 */}
              <div className="flex items-center justify-end gap-1 px-3 py-1.5">
                <button
                  onClick={handleOpenSettings}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                  title="设置"
                >
                  <Settings size={15} />
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                  title="用户"
                >
                  <User size={15} />
                </button>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <ChatPanel />
              </div>
            </div>
          </div>
        </ResizablePanel>

        {/* 中间：标签栏 + 编辑区 */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TabBar />
          <div className="flex-1 overflow-hidden">
            <EditorArea />
          </div>

          {/* 底部时间轴（完全可折叠） */}
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
        </main>

        {/* 右侧：资源管理器/待办/上下文/Git */}
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

export default App
