import { useState, useCallback, useRef, useEffect } from 'react'
import { Send, Paperclip, Wand2, Eye, EyeOff, Zap, Bot, PanelLeftOpen, FolderPlus, Square, RotateCcw } from 'lucide-react'
import { useChatStore, useLayoutStore, useAIStore, useTabStore, useWorkspaceStore } from '../../store'
import { chatApi } from '../../services/api'
import { AIMessageBubble, UserMessageBubble, SystemMessageBubble } from '../chat/MessageBubble'
import { SimpleMessageList } from '../chat/VirtualMessageList'
import type { AIMessage, UserMessage, SystemMessage } from '../../types/message'

// 兼容 store 中的 Message 类型
type Message = import('../../store').Message

export default function ChatPanel() {
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [liveFollow, setLiveFollow] = useState(true)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [isStopping, setIsStopping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRefs = useRef<NodeJS.Timeout[]>([])

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
  const { openTab } = useTabStore()
  const { isConfigured, currentWorkspace, setWorkspace } = useWorkspaceStore()

  const currentConversation = conversations.find((c) => c.id === currentConversationId)
  const messages = currentConversation?.messages || []

  const currentModel = models.find(m => m.id === selectedModel) || models.find(m => m.isDefault)

  // 清理所有定时器
  const clearAllTimers = useCallback(() => {
    timerRefs.current.forEach(timer => clearTimeout(timer))
    timerRefs.current = []
  }, [])

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [inputValue])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearAllTimers()
    }
  }, [clearAllTimers])

  // 处理流式消息更新
  const handleChunk = useCallback((convId: string, aiMessageId: string) => (chunk: string) => {
    const currentContent = useChatStore.getState()
      .conversations.find(c => c.id === convId)
      ?.messages.find(m => m.id === aiMessageId)?.content || ''
    
    updateMessage(convId, aiMessageId, {
      content: currentContent + chunk
    })
  }, [updateMessage])

  // 停止任务
  const handleStop = useCallback(() => {
    if (!streamingMessageId || !currentConversationId) return
    
    setIsStopping(true)
    
    // 立即清理所有定时器
    clearAllTimers()
    
    // 更新消息状态
    updateMessage(currentConversationId, streamingMessageId, {
      status: 'interrupted',
      statusDetail: '任务已停止'
    })
    
    // 重置状态
    setTimeout(() => {
      setLoading(false)
      setIsStreaming(false)
      setStreamingMessageId(null)
      setIsStopping(false)
    }, 300)
  }, [streamingMessageId, currentConversationId, updateMessage, clearAllTimers])

  // 模拟状态流转
  const runStatusFlow = useCallback((convId: string, aiMessageId: string, userQuery: string) => {
    const statusSequence = [
      { status: 'thinking' as const, message: '思考中...', detail: '正在理解您的需求...', delay: 1000 },
      { status: 'planning' as const, message: '制定计划中...', detail: '正在分析任务并制定执行计划...', delay: 1500 },
      { status: 'tool_call' as const, message: '调用工具', toolName: 'search_codebase', detail: '正在搜索相关代码...', delay: 1200 },
      { status: 'executing' as const, message: '执行中...', detail: '正在修改文件...', delay: 2000 },
      { status: 'terminal_running' as const, message: '终端运行中...', detail: '正在运行构建命令...', logs: ['$ npm run build', '> vite build', '✓ 构建完成'], delay: 1500 },
      { status: 'preview_generating' as const, message: '生成预览...', detail: '正在准备预览...', delay: 800 },
    ]
    
    let currentStep = 0
    let isAborted = false
    
    // 添加检查是否已停止的函数
    const checkAborted = () => {
      const currentState = useChatStore.getState()
      const msg = currentState.conversations.find(c => c.id === convId)?.messages.find(m => m.id === aiMessageId)
      if (msg?.status === 'interrupted') {
        isAborted = true
        return true
      }
      return false
    }
    
    const executeStep = () => {
      if (isAborted) return
      
      if (currentStep >= statusSequence.length) {
        // 完成时，生成最终回复
        const finalContent = `好的，我已经完成了对"${userQuery}"的处理！\n\n## 任务总结\n\n我帮你完成了以下工作：\n1. **理解需求** - 分析了你的问题描述\n2. **制定计划** - 设计了完整的开发方案\n3. **代码修改** - 更新了相关源文件\n4. **测试验证** - 运行了完整的构建流程\n\n### 代码示例\n\n\`\`\`typescript\n// 这是一段示例代码\nfunction helloWorld() {\n  console.log('Hello from FlowMind!');\n}\n\`\`\`\n\n### 相关文件\n\n- \`src/components/Example.tsx\` (新增)\n- \`src/utils/helpers.ts\` (修改)\n\n任务已全部完成！`
        
        updateMessage(convId, aiMessageId, {
          status: 'result',
          content: finalContent,
          statusDetail: undefined,
          statusProgress: 100,
          statusLogs: undefined,
        })
        
        setLoading(false)
        setIsStreaming(false)
        setStreamingMessageId(null)
        return
      }
      
      const step = statusSequence[currentStep]
      updateMessage(convId, aiMessageId, {
        status: step.status,
        statusDetail: step.detail,
        toolName: step.toolName,
        statusProgress: Math.round((currentStep / statusSequence.length) * 100),
        statusLogs: step.logs,
      })
      
      currentStep++
      
      // 添加定时器并保存引用
      const timer = setTimeout(executeStep, step.delay)
      timerRefs.current.push(timer)
    }
    
    // 启动第一个步骤
    const timer = setTimeout(executeStep, 400)
    timerRefs.current.push(timer)
  }, [updateMessage])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading || isStreaming || !isConfigured) return

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
    const query = inputValue.trim()
    setInputValue('')
    setLoading(true)
    setIsStreaming(true)
    setIsStopping(false)

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
    setStreamingMessageId(aiMessageId)

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
        updateMessage(convId, aiMessageId, { status: 'executing', statusDetail: '正在执行请求...' })
        
        const response = await chatApi.sendMessageStream(
          userMessage.content,
          currentModel?.name || 'unknown',
          convId,
          llmConfig,
          handleChunk(convId, aiMessageId)
        )

        updateMessage(convId, aiMessageId, {
          content: response,
          status: 'result'
        })
      } else {
        // 如果没有配置模型，演示状态流转
        runStatusFlow(convId, aiMessageId, query)
      }
    } catch (error) {
      updateMessage(convId, aiMessageId, {
        content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
        status: 'error'
      })
    } finally {
      // 总是清理状态
      setLoading(false)
      setIsStreaming(false)
      setStreamingMessageId(null)
    }
  }, [inputValue, isLoading, isStreaming, currentConversationId, selectedModel, addMessage, setLoading, createConversation, updateMessage, currentModel, handleChunk, isConfigured, runStatusFlow])

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

  const handleFeedback = (_messageId: string, _type: 'good' | 'bad', _comment?: string) => {
    // TODO: 实现反馈功能
  }

  const handleApprovePlan = (messageId: string) => {
    updateMessage(currentConversationId!, messageId, {
      status: 'executing'
    })
  }

  const handleRunCode = async (_code: string) => {
    // TODO: 实现代码运行
    return 'Code execution not implemented yet'
  }

  const handleViewFile = (path: string) => {
    // 联动侧边面板 - 打开文件编辑器
    openTab({
      id: `file_${path}`,
      type: 'file',
      title: path.split('/').pop() || path,
      path: path,
    })
  }

  const handleExecuteCommand = async (_command: string) => {
    // TODO: 实现命令执行
    return 'Command execution not implemented yet'
  }

  const handleLayerToggle = useCallback((_messageId: string, _layerId: string, _collapsed: boolean) => {
    // 层状态由组件内部管理
  }, [])

  // 渲染单条消息
  const renderMessage = useCallback((msg: Message, _index: number) => {
    if (msg.role === 'ai') {
      return (
        <AIMessageBubble
          message={msg as AIMessage}
          isStreaming={isStreaming && msg.id === streamingMessageId}
          onRegenerate={() => handleRegenerate(msg.id)}
          onQuote={() => handleQuote(msg.content)}
          onFeedback={(type, comment) => handleFeedback(msg.id, type, comment)}
          onApprovePlan={() => handleApprovePlan(msg.id)}
          onLayerToggle={(layerId, collapsed) => handleLayerToggle(msg.id, layerId, collapsed)}
          onStop={msg.id === streamingMessageId ? handleStop : undefined}
        />
      )
    } else if (msg.role === 'user') {
      return (
        <UserMessageBubble
          message={msg as UserMessage}
          onEdit={() => handleEditMessage(msg.id)}
          onDelete={() => handleDeleteMessage(msg.id)}
        />
      )
    } else {
      return (
        <SystemMessageBubble
          message={msg as SystemMessage}
        />
      )
    }
  }, [isStreaming, streamingMessageId, handleLayerToggle, handleStop])

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white h-full">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">
            {currentConversation?.title || '新对话'}
          </span>
          {!conversationPanelOpen && (
            <button
              onClick={toggleConversationPanel}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-sky-100 text-sky-600 text-xs hover:bg-sky-200 transition-colors"
            >
              <PanelLeftOpen size={12} />
              对话
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConfigured && (
            <button
              onClick={() => setLiveFollow(!liveFollow)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                liveFollow
                  ? 'bg-sky-100 text-sky-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
              title={liveFollow ? '关闭实时跟随' : '开启实时跟随'}
            >
              {liveFollow ? <Eye size={12} /> : <EyeOff size={12} />}
              {liveFollow ? '跟随' : '已暂停'}
            </button>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          {isConfigured ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center mb-4 shadow-lg">
                <Bot size={32} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                FlowMind AI 助手
              </h2>
              <p className="text-sm text-gray-500 mb-4 max-w-md">
                我可以帮你完成代码开发、调试、优化等全流程工作
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
                     onClick={() => setInputValue('帮我做一个登录页面')}>
                  帮我做一个登录页面
                </div>
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
                     onClick={() => setInputValue('解释这段代码的作用')}>
                  解释这段代码的作用
                </div>
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
                     onClick={() => setInputValue('优化这段SQL查询')}>
                  优化这段SQL查询
                </div>
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
                     onClick={() => setInputValue('帮我写单元测试')}>
                  帮我写单元测试
                </div>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center mb-4 shadow-lg mx-auto">
                <Bot size={32} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                欢迎使用 FlowMind
              </h2>
              <p className="text-sm text-gray-500 mb-4 max-w-sm">
                在开始之前，请先选择一个项目文件夹
              </p>
              <div className="p-4 bg-sky-50 rounded-xl max-w-xs mx-auto">
                <div className="flex items-start gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                    <FolderPlus size={16} className="text-sky-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">选择项目文件夹</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      点击右侧面板的「资源管理器」标签，选择或创建一个文件夹作为项目根目录。FlowMind 将在其中创建 .flowmind 配置目录。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <SimpleMessageList
          messages={messages}
          renderMessage={renderMessage}
          messagesEndRef={messagesEndRef}
        />
      )}

      {/* 加载中指示器 */}
      {isLoading && !isStreaming && (
        <div className="flex-shrink-0 px-4 py-2">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[9px] font-bold">AI</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      {/* 输入区 */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
        <div className={`rounded-xl border overflow-hidden focus-within:border-sky-500 transition-colors ${
          !isConfigured ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !isConfigured
                ? '请先选择项目文件夹...'
                : models.length === 0
                ? '请先在设置页面配置 AI 模型'
                : '输入你的需求，支持自然语言描述...'
            }
            className="w-full px-4 py-3 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-none"
            rows={1}
            disabled={!isConfigured || models.length === 0}
          />
          
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-1">
              <button 
                className="p-2 hover:bg-sky-50 rounded-lg text-gray-500 hover:text-sky-500 transition-colors disabled:opacity-50" 
                title="附件"
                disabled={!isConfigured}
              >
                <Paperclip size={16} />
              </button>
              <button 
                className="p-2 hover:bg-sky-50 rounded-lg text-gray-500 hover:text-sky-500 transition-colors disabled:opacity-50" 
                title="AI增强"
                disabled={!isConfigured}
              >
                <Zap size={16} />
              </button>
              <button 
                className="p-2 hover:bg-sky-50 rounded-lg text-gray-500 hover:text-sky-500 transition-colors disabled:opacity-50" 
                title="模板"
                disabled={!isConfigured}
              >
                <Wand2 size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isConfigured && models.length > 0 ? (
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="text-xs bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : !isConfigured ? (
                <span className="text-xs px-3 py-1.5 bg-gray-200 text-gray-500 rounded-lg">
                  未配置项目
                </span>
              ) : (
                <button
                  onClick={() => window.location.hash = '#settings'}
                  className="text-xs px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                >
                  配置模型
                </button>
              )}

              {/* 发送/停止按钮 */}
              {(isLoading || isStreaming) ? (
                <button
                  onClick={handleStop}
                  disabled={isStopping}
                  className="p-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white transition-all shadow-sm"
                  title="停止"
                >
                  {isStopping ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Square size={14} fill="currentColor" />
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || !isConfigured || models.length === 0}
                  className="p-2 rounded-lg bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:bg-gray-300 text-white transition-all shadow-sm disabled:shadow-none"
                  title="发送"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-[10px] text-gray-400 text-center mt-2">
          {isConfigured 
            ? `FlowMind AI 基于 ${currentModel?.name || '未配置模型'} 提供服务`
            : '在右侧面板选择项目文件夹以开始使用'
          }
        </p>
      </div>
    </div>
  )
}
