import { PanelRightOpen, PanelBottomOpen } from 'lucide-react'
import { useLayoutStore } from './store'
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

  return (
    <div className="flex flex-col h-screen bg-[var(--flowmind-bg)] overflow-hidden">
      {/* 右上角悬浮控制按钮：面板折叠时显示展开入口 */}
      <div className="fixed top-1 right-2 z-50 flex items-center gap-1">
        {rightCollapsed && (
          <button
            onClick={toggleRight}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)] text-[11px] hover:bg-[var(--flowmind-primary)]/20 transition-colors"
            title="展开右侧面板"
          >
            <PanelRightOpen size={12} />
            <span>面板</span>
          </button>
        )}
        {bottomCollapsed && (
          <button
            onClick={toggleBottom}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)] text-[11px] hover:bg-[var(--flowmind-primary)]/20 transition-colors"
            title="展开时间轴"
          >
            <PanelBottomOpen size={12} />
            <span>时间轴</span>
          </button>
        )}
      </div>

      {/* 主体区域：左 + 中 + 右 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：对话管理 + 聊天（聊天不可折叠，对话管理可折叠向左收起） */}
        <ResizablePanel
          direction="horizontal"
          size={leftWidth}
          minSize={200}
          maxSize={500}
          onResize={setLeftWidth}
          onCollapse={toggleLeft}
          collapsed={leftCollapsed}
          collapseDirection="left"
          className="border-r"
        >
          <div className="flex h-full">
            <ConversationList />
            <ChatPanel />
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
          className="border-l"
        >
          <RightPanel />
        </ResizablePanel>
      </div>
    </div>
  )
}

export default App
