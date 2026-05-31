import { useState, useCallback, useRef, useEffect } from 'react'
import { Send, Paperclip, Wand2, Sparkles, Mic, Smile, PanelLeftOpen } from 'lucide-react'
import { useChatStore, useLayoutStore } from '../../store'
import { chatApi } from '../../services/api'

/** 模型选择列表 */
const models = [
  { key: 'qwen3.6-plus', label: 'Qwen3.6-Plus' },
  { key: 'gpt-4', label: 'GPT-4' },
  { key: 'claude-3', label: 'Claude 3' },
  { key: 'llama-3', label: 'Llama 3' },
]

/** 聊天面板：输入区在消息下方，自身不可折叠 */
export default function ChatPanel() {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    conversations,
    currentConversationId,
    isLoading,
    selectedModel,
    addMessage,
    setLoading,
    setSelectedModel,
    createConversation,
  } = useChatStore()

  const { leftCollapsed, toggleLeft } = useLayoutStore()

  const currentConversation = conversations.find((c) => c.id === currentConversationId)
  const messages = currentConversation?.messages || []

  /** 消息更新后滚动到底部 */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /** 发送消息 */
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return

    let convId = currentConversationId
    if (!convId) {
      convId = createConversation()
    }

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    }

    addMessage(convId, userMessage)
    setInputValue('')
    setLoading(true)

    try {
      const response = await chatApi.sendMessage(userMessage.content, selectedModel, convId)
      if (response.success) {
        addMessage(convId, {
          id: `msg_${Date.now() + 1}`,
          role: 'ai',
          content: response.data.response,
          timestamp: new Date().toISOString(),
          model: selectedModel,
        })
      }
    } catch (error) {
      addMessage(convId, {
        id: `msg_${Date.now() + 1}`,
        role: 'system',
        content: `发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [inputValue, isLoading, currentConversationId, selectedModel, addMessage, setLoading, createConversation])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* 顶部栏：标题 + 展开对话管理按钮 */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-gray-600">
          {currentConversation?.title || '新对话'}
        </span>
        {leftCollapsed && (
          <button
            onClick={toggleLeft}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)] text-xs hover:bg-[var(--flowmind-primary)]/20 transition-colors"
            title="展开对话列表"
          >
            <PanelLeftOpen size={12} />
            对话
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--flowmind-primary)]/10 flex items-center justify-center mb-3">
              <Sparkles size={20} className="text-[var(--flowmind-primary)]" />
            </div>
            <p className="text-sm text-gray-500 mb-1">开始一个新的对话</p>
            <p className="text-xs text-gray-400">在下方输入你的问题或需求</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'user' ? (
                <div className="max-w-[85%] bg-gray-100 rounded-2xl rounded-tr-sm px-4 py-2.5">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block text-right">
                    {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ) : msg.role === 'ai' ? (
                <div className="max-w-[90%]">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.model && (
                      <span className="text-[10px] text-[var(--flowmind-primary)]">{msg.model}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-[85%] bg-red-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600">{msg.content}</p>
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区：位于消息列表下方 */}
      <div className="px-3 pt-2 pb-3 flex-shrink-0">
        <div className="rounded-xl bg-white shadow-sm" style={{ border: '1px solid #f0f0f0' }}>
          {/* 输入区域：6行高度，最大10行 */}
          <div className="px-3 pt-2 pb-1">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="帮你编写代码、调试 Bug、优化性能等开发工作，交付生产级代码产物。"
              rows={6}
              className="w-full resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none py-1.5 leading-relaxed"
              style={{
                minHeight: '120px',
                maxHeight: '200px',
                fieldSizing: 'content',
              }}
            />
          </div>

          {/* 底部控制栏：左工具 + 右控制 */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            {/* 左侧工具按钮 */}
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="附件">
                <Paperclip size={16} />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="魔法工具">
                <Wand2 size={16} />
              </button>
            </div>

            {/* 右侧控制区 */}
            <div className="flex items-center gap-1.5">
              {/* 模型选择 */}
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-xs bg-gray-100 border-0 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-[var(--flowmind-primary)] cursor-pointer"
              >
                {models.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>

              <button className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors" title="表情">
                <Smile size={16} />
              </button>
              <button className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors" title="语音">
                <Mic size={16} />
              </button>

              {/* 发送按钮 */}
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="p-2 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-200 disabled:cursor-not-allowed text-white transition-colors"
                title="发送"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
