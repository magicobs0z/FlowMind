import { useState, useCallback, useRef, useEffect } from 'react'
import { Send, Paperclip, Wand2, Eye, EyeOff, Zap, Bot, PanelLeftOpen } from 'lucide-react'
import { useChatStore, useLayoutStore, useAIStore } from '../../store'
import { chatApi } from '../../services/api'
import { AIMessageBubble, UserMessageBubble, SystemMessageBubble } from '../chat/MessageBubble'
import type { AIMessage, UserMessage } from '../chat/MessageBubble'

export default function ChatPanel() {
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [liveFollow, setLiveFollow] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    conversations,
    currentConversationId,
    isLoading,
    selectedModel,
    addMessage,
    setLoading,
    setSelectedModel,
    createConversation,
    updateMessage,
  } = useChatStore()

  const { models } = useAIStore()
  const { conversationPanelOpen, toggleConversationPanel } = useLayoutStore()

  const currentConversation = conversations.find((c) => c.id === currentConversationId)
  const messages = currentConversation?.messages || []

  const currentModel = models.find(m => m.id === selectedModel) || models.find(m => m.isDefault)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [inputValue])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return

    let convId = currentConversationId
    if (!convId) {
      convId = createConversation()
    }

    const userMessage: UserMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    }

    addMessage(convId, userMessage as any)
    setInputValue('')
    setLoading(true)
    setIsStreaming(true)

    const aiMessageId = `msg_${Date.now() + 1}`
    const aiMessage: AIMessage = {
      id: aiMessageId,
      role: 'ai',
      content: '',
      contents: [],
      timestamp: new Date().toISOString(),
      model: currentModel?.name,
      status: 'thinking',
    }
    addMessage(convId, aiMessage as any)

    try {
      let llmConfig: { apiKey: string; baseUrl: string; modelName: string } | undefined
      if (currentModel && currentModel.apiKey && currentModel.baseUrl && currentModel.modelName) {
        llmConfig = {
          apiKey: currentModel.apiKey,
          baseUrl: currentModel.baseUrl,
          modelName: currentModel.modelName,
        }
      }

      if (llmConfig) {
        updateMessage(convId, aiMessageId, { status: 'executing' })
        
        const handleChunk = (chunk: string) => {
          const currentContent = useChatStore.getState()
            .conversations.find(c => c.id === convId)
            ?.messages.find(m => m.id === aiMessageId)?.content || ''
          
          updateMessage(convId, aiMessageId, {
            content: currentContent + chunk
          })
        }

        const response = await chatApi.sendMessageStream(
          userMessage.content,
          currentModel?.name || 'unknown',
          convId,
          llmConfig,
          handleChunk
        )

        updateMessage(convId, aiMessageId, {
          content: response,
          status: 'result'
        })
      } else {
        updateMessage(convId, aiMessageId, {
          content: `请先在设置页面配置 AI 模型。\n\n推荐配置：\n1. DeepSeek-V4（国产，性价比高）\n2. Qwen-3.6（阿里云，性能强）\n3. GPT-5.5（OpenAI，最强）`,
          status: 'result'
        })
      }
    } catch (error) {
      updateMessage(convId, aiMessageId, {
        content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
        status: 'error'
      })
    } finally {
      setLoading(false)
      setIsStreaming(false)
    }
  }, [inputValue, isLoading, isStreaming, currentConversationId, selectedModel, addMessage, setLoading, createConversation, updateMessage, currentModel])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleEditMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (message && message.role === 'user') {
      setInputValue(message.content)
    }
  }

  const handleDeleteMessage = (_messageId: string) => {
    // TODO: 实现删除消息
  }

  const handleRegenerate = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex > 0) {
      const previousMessage = messages[messageIndex - 1]
      if (previousMessage.role === 'user') {
        setInputValue(previousMessage.content)
        handleSend()
      }
    }
  }

  const handleQuote = (messageContent: string) => {
    setInputValue(prev => prev + `\n> ${messageContent}\n`)
  }

  const handleFeedback = (messageId: string, type: 'good' | 'bad', comment?: string) => {
    // TODO: 实现反馈功能
    console.log('Feedback:', messageId, type, comment)
  }

  const handleApprovePlan = (messageId: string) => {
    updateMessage(currentConversationId!, messageId, {
      status: 'executing'
    })
  }

  const handleRunCode = async (code: string) => {
    // TODO: 实现代码运行
    console.log('Run code:', code)
    return 'Code execution not implemented yet'
  }

  const handleViewFile = (path: string) => {
    // TODO: 实现查看文件
    console.log('View file:', path)
  }

  const handleExecuteCommand = async (command: string) => {
    // TODO: 实现命令执行
    console.log('Execute command:', command)
    return 'Command execution not implemented yet'
  }

  const renderMessages = () => {
    return messages.map((msg) => {
      if (msg.role === 'ai') {
        return (
          <AIMessageBubble
            key={msg.id}
            message={msg as AIMessage}
            onRegenerate={() => handleRegenerate(msg.id)}
            onQuote={() => handleQuote(msg.content)}
            onFeedback={(type, comment) => handleFeedback(msg.id, type, comment)}
            onApprovePlan={() => handleApprovePlan(msg.id)}
            onRunCode={handleRunCode}
            onViewFile={handleViewFile}
            onExecuteCommand={handleExecuteCommand}
          />
        )
      } else if (msg.role === 'user') {
        return (
          <UserMessageBubble
            key={msg.id}
            message={msg as UserMessage}
            onEdit={() => handleEditMessage(msg.id)}
            onDelete={() => handleDeleteMessage(msg.id)}
          />
        )
      } else {
        return (
          <SystemMessageBubble
            key={msg.id}
            message={msg as any}
          />
        )
      }
    })
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">
            {currentConversation?.title || '新对话'}
          </span>
          {!conversationPanelOpen && (
            <button
              onClick={toggleConversationPanel}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)] text-xs hover:bg-[var(--flowmind-primary)]/20 transition-colors"
            >
              <PanelLeftOpen size={12} />
              对话
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLiveFollow(!liveFollow)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
              liveFollow
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
            title={liveFollow ? '关闭实时跟随' : '开启实时跟随'}
          >
            {liveFollow ? <Eye size={12} /> : <EyeOff size={12} />}
            {liveFollow ? '实时跟随' : '跟随已关闭'}
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
              <Bot size={32} className="text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              FlowMind AI 助手
            </h2>
            <p className="text-sm text-gray-500 mb-4 max-w-md">
              我可以帮你完成代码开发、调试、优化等全流程工作
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-600">
                帮我做一个登录页面
              </div>
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-600">
                解释这段代码的作用
              </div>
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-600">
                优化这段SQL查询
              </div>
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-600">
                帮我写单元测试
              </div>
            </div>
          </div>
        ) : (
          renderMessages()
        )}
        
        {isLoading && (
          <div className="flex gap-3 max-w-[90%]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  思考中
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <div className="rounded-xl bg-gray-50 border border-gray-200 overflow-hidden focus-within:border-blue-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              models.length === 0
                ? '请先在设置页面配置 AI 模型'
                : '输入你的需求，支持自然语言描述...'
            }
            className="w-full px-4 py-3 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-none"
            rows={1}
            disabled={models.length === 0}
          />
          
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors" title="附件">
                <Paperclip size={16} />
              </button>
              <button className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors" title="AI增强">
                <Zap size={16} />
              </button>
              <button className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors" title="模板">
                <Wand2 size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {models.length > 0 ? (
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="text-xs bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => window.location.hash = '#settings'}
                  className="text-xs px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                >
                  配置模型
                </button>
              )}

              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading || isStreaming || models.length === 0}
                className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white transition-all shadow-md disabled:shadow-none"
                title="发送"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-[10px] text-gray-400 text-center mt-2">
          FlowMind AI 基于 {currentModel?.name || '未配置模型'} 提供服务
        </p>
      </div>
    </div>
  )
}
