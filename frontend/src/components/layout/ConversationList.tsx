import { useCallback } from 'react'
import { Plus, MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useChatStore, useLayoutStore } from '../../store'

export default function ConversationList() {
  const { conversations, currentConversationId, createConversation, setCurrentConversation } = useChatStore()
  const { leftCollapsed, toggleLeft } = useLayoutStore()

  const handleNewConversation = useCallback(() => {
    createConversation()
  }, [createConversation])

  if (leftCollapsed) {
    return (
      <div className="w-10 flex-shrink-0 flex flex-col items-center py-3" style={{ background: 'var(--flowmind-bg)' }}>
        <button
          onClick={toggleLeft}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 mb-3"
          title="展开对话列表"
        >
          <PanelLeftOpen size={16} />
        </button>
        <button
          onClick={handleNewConversation}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          title="新建对话"
        >
          <Plus size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="w-52 flex-shrink-0 flex flex-col" style={{ background: 'var(--flowmind-bg)' }}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">对话</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            title="新建对话"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={toggleLeft}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            title="收起"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-gray-400">暂无对话</p>
            <button
              onClick={handleNewConversation}
              className="mt-2 text-xs text-[var(--flowmind-primary)] hover:underline"
            >
              开始新对话
            </button>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setCurrentConversation(conv.id)}
              className={`w-full text-left px-3 py-2 mx-1 rounded-lg text-sm transition-colors group ${
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
