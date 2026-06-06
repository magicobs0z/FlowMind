import { Copy, Check, RefreshCw, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { CodeBlock } from './CodeBlock'
import { CommandBlock } from './CommandBlock'
import { ProgressBar } from './ProgressBar'
import { PlanCard } from './PlanCard'
import { TableBlock } from './TableBlock'
import { ThinkBlock } from './ThinkBlock'
import { ToolCallLog } from './ToolCallLog'

type MessageStatus = 'thinking' | 'tool_call' | 'executing' | 'result' | 'error'

interface BaseMessage {
  id: string
  role: 'user' | 'ai' | 'system'
  content: string
  timestamp: string
  status?: MessageStatus
}

export interface AIMessage extends BaseMessage {
  role: 'ai'
  model?: string
  contents?: any[]
  think?: string
  toolCalls?: any[]
  plan?: any
}

export interface UserMessage extends BaseMessage {
  role: 'user'
}

export interface SystemMessage extends BaseMessage {
  role: 'system'
  type?: 'error' | 'warning' | 'success' | 'info'
}

interface AIMessageBubbleProps {
  message: AIMessage
  onRegenerate?: () => void
  onCopy?: () => void
  onQuote?: () => void
  onFeedback?: (type: 'good' | 'bad', comment?: string) => void
  onApprovePlan?: () => void
  onRunCode?: (code: string) => void
  onViewFile?: (path: string) => void
  onExecuteCommand?: (command: string) => Promise<string>
}

export function AIMessageBubble({
  message,
  onRegenerate,
  onCopy,
  onQuote,
  onFeedback,
  onApprovePlan,
  onRunCode,
  onViewFile,
  onExecuteCommand,
}: AIMessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [displayedContent, setDisplayedContent] = useState(message.content)
  const [isTyping, setIsTyping] = useState(false)
  const contentRef = useRef(message.content)
  const lastLengthRef = useRef(0)

  useEffect(() => {
    if (message.content !== contentRef.current) {
      contentRef.current = message.content
      lastLengthRef.current = 0
      setDisplayedContent('')
      setIsTyping(true)
    }
  }, [message.content])

  useEffect(() => {
    if (!isTyping) {
      setDisplayedContent(message.content)
      return
    }

    const targetLength = message.content.length
    if (lastLengthRef.current >= targetLength) {
      setIsTyping(false)
      setDisplayedContent(message.content)
      return
    }

    const interval = setInterval(() => {
      if (lastLengthRef.current < targetLength) {
        lastLengthRef.current++
        setDisplayedContent(message.content.slice(0, lastLengthRef.current))
      } else {
        setIsTyping(false)
        clearInterval(interval)
      }
    }, 15)

    return () => clearInterval(interval)
  }, [message.content, isTyping])

  const getStatusLabel = (status?: MessageStatus) => {
    switch (status) {
      case 'thinking':
        return { text: '思考中', color: 'bg-blue-100 text-blue-700' }
      case 'tool_call':
        return { text: '工具调用', color: 'bg-purple-100 text-purple-700' }
      case 'executing':
        return { text: '执行中', color: 'bg-orange-100 text-orange-700' }
      case 'error':
        return { text: '错误', color: 'bg-red-100 text-red-700' }
      default:
        return { text: '结果', color: 'bg-green-100 text-green-700' }
    }
  }

  const statusInfo = getStatusLabel(message.status)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy?.()
  }

  const renderContent = () => {
    return (
      <div className="space-y-2">
        {message.think && <ThinkBlock content={message.think} />}
        
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallLog toolCalls={message.toolCalls} />
        )}

        {message.plan && (
          <PlanCard 
            plan={message.plan} 
            onApprove={onApprovePlan}
          />
        )}

        {message.contents && message.contents.map((content, index) => {
          switch (content.type) {
            case 'code':
              return (
                <CodeBlock
                  key={index}
                  content={content}
                  onRun={onRunCode}
                  onViewFile={onViewFile}
                />
              )
            case 'command':
              return (
                <CommandBlock
                  key={index}
                  content={content}
                  onExecute={onExecuteCommand}
                />
              )
            case 'table':
              return <TableBlock key={index} content={content} />
            case 'progress':
              return <ProgressBar key={index} content={content} />
            default:
              return null
          }
        })}

        {(displayedContent || isTyping) && (
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {displayedContent}
            {isTyping && <span className="animate-pulse">▌</span>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-3 max-w-[90%]">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-bold">AI</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
            {message.model && (
              <span className="text-[10px] text-gray-400">
                {message.model}
              </span>
            )}
          </div>

          {renderContent()}

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
            <span className="text-[10px] text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                title="复制"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                  title="重新生成"
                >
                  <RefreshCw size={12} />
                </button>
              )}
              {onQuote && (
                <button
                  onClick={onQuote}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                  title="引用"
                >
                  <MessageSquare size={12} />
                </button>
              )}
              {onFeedback && (
                <div className="relative">
                  <button
                    onClick={() => setShowFeedback(!showFeedback)}
                    className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                    title="反馈"
                  >
                    <ThumbsUp size={12} />
                  </button>
                  {showFeedback && (
                    <div className="absolute bottom-full right-0 mb-1 p-2 bg-white rounded-lg shadow-lg border border-gray-200 space-y-1">
                      <button
                        onClick={() => {
                          onFeedback('good')
                          setShowFeedback(false)
                        }}
                        className="flex items-center gap-1 text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded"
                      >
                        <ThumbsUp size={12} /> 满意
                      </button>
                      <button
                        onClick={() => {
                          onFeedback('bad')
                          setShowFeedback(false)
                        }}
                        className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                      >
                        <ThumbsDown size={12} /> 不满意
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface UserMessageBubbleProps {
  message: UserMessage
  onEdit?: () => void
  onDelete?: () => void
}

export function UserMessageBubble({ message, onEdit, onDelete }: UserMessageBubbleProps) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div className="flex gap-3 max-w-[85%] ml-auto">
      <div className="flex-1 min-w-0">
        <div
          className="bg-gray-100 rounded-2xl rounded-tr-sm px-4 py-3"
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {showActions && (
              <div className="flex items-center gap-1">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="text-[10px] text-gray-500 hover:text-gray-700"
                  >
                    编辑
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="text-[10px] text-gray-500 hover:text-red-600"
                  >
                    删除
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-bold">U</span>
      </div>
    </div>
  )
}

interface SystemMessageBubbleProps {
  message: SystemMessage
}

export function SystemMessageBubble({ message }: SystemMessageBubbleProps) {
  const getTypeColor = () => {
    switch (message.type) {
      case 'error':
        return 'text-red-600 bg-red-50'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50'
      case 'success':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="text-center py-2">
      <span className={`text-xs px-3 py-1 rounded-full ${getTypeColor()}`}>
        {message.content}
      </span>
    </div>
  )
}
