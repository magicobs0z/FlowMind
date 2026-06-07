import { useState, useEffect, useRef } from 'react'

interface StreamingTextProps {
  content: string
  isStreaming: boolean
  speed?: number
  onComplete?: () => void
  className?: string
}

export function StreamingText({ 
  content, 
  isStreaming, 
  speed = 15, 
  onComplete,
  className = ''
}: StreamingTextProps) {
  const [displayedContent, setDisplayedContent] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const contentRef = useRef(content)
  const lastLengthRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  // 当内容变化时重置打字机状态
  useEffect(() => {
    if (content !== contentRef.current) {
      contentRef.current = content
      // 如果是流式输出，保持当前显示长度，继续追加
      if (isStreaming) {
        const currentLength = displayedContent.length
        if (currentLength < content.length) {
          setIsTyping(true)
          lastLengthRef.current = currentLength
        }
      } else {
        // 非流式，直接显示全部
        setDisplayedContent(content)
        setIsTyping(false)
        lastLengthRef.current = content.length
      }
    }
  }, [content, isStreaming, displayedContent])

  // 打字机效果
  useEffect(() => {
    if (!isTyping) {
      if (displayedContent !== content) {
        setDisplayedContent(content)
      }
      return
    }

    const targetLength = content.length
    if (lastLengthRef.current >= targetLength) {
      setIsTyping(false)
      setDisplayedContent(content)
      onComplete?.()
      return
    }

    intervalRef.current = setInterval(() => {
      if (lastLengthRef.current < targetLength) {
        lastLengthRef.current++
        setDisplayedContent(content.slice(0, lastLengthRef.current))
      } else {
        setIsTyping(false)
        clearInterval(intervalRef.current)
        onComplete?.()
      }
    }, speed)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [content, isTyping, speed, onComplete, displayedContent])

  // 流式输出时，如果内容增长，自动继续打字
  useEffect(() => {
    if (isStreaming && content.length > displayedContent.length && !isTyping) {
      setIsTyping(true)
      lastLengthRef.current = displayedContent.length
    }
  }, [isStreaming, content.length, displayedContent.length, isTyping])

  return (
    <div className={`relative ${className}`}>
      <span className="whitespace-pre-wrap">{displayedContent}</span>
      {isTyping && (
        <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  )
}

// 代码块流式渲染 - 先渲染骨架，再填充内容
interface StreamingCodeBlockProps {
  language: string
  content: string
  isStreaming: boolean
  filePath?: string
  className?: string
}

export function StreamingCodeBlock({
  language,
  content,
  isStreaming,
  filePath,
  className = ''
}: StreamingCodeBlockProps) {
  const [displayedContent, setDisplayedContent] = useState('')
  const contentRef = useRef('')
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (content !== contentRef.current) {
      contentRef.current = content
      
      // 使用 requestAnimationFrame 批量更新，避免频繁重绘
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      
      frameRef.current = requestAnimationFrame(() => {
        if (isStreaming) {
          // 流式时逐行或逐块更新
          setDisplayedContent(content)
        } else {
          setDisplayedContent(content)
        }
      })
    }
  }, [content, isStreaming])

  return (
    <div className={`rounded-lg overflow-hidden border border-gray-200 bg-gray-50 ${className}`}>
      {/* 代码块头部 - 始终显示 */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-xs font-medium text-gray-600 uppercase">
            {language}
          </span>
          {filePath && (
            <span className="text-xs text-gray-400 ml-2 font-mono">
              {filePath}
            </span>
          )}
        </div>
        {isStreaming && (
          <span className="text-[10px] text-blue-500 animate-pulse">
            写入中...
          </span>
        )}
      </div>
      
      {/* 代码内容区域 */}
      <div className="overflow-auto max-h-96">
        <pre className="p-3 text-sm font-mono text-gray-800 leading-relaxed overflow-x-auto">
          <code>{displayedContent}</code>
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle" />
          )}
        </pre>
      </div>
    </div>
  )
}

// 占位骨架组件 - 用于中间态渲染
interface SkeletonCardProps {
  type: 'thinking' | 'tool_call' | 'code' | 'command' | 'preview'
  title?: string
  className?: string
}

export function SkeletonCard({ type, title, className = '' }: SkeletonCardProps) {
  const getTypeConfig = () => {
    switch (type) {
      case 'thinking':
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 animate-pulse">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.9 9.9h-6m-6 0H1.9" />
            </svg>
          ),
          label: '思考中',
          color: 'border-blue-200 bg-blue-50',
        }
      case 'tool_call':
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-500 animate-pulse">
              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
            </svg>
          ),
          label: '工具调用',
          color: 'border-purple-200 bg-purple-50',
        }
      case 'code':
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500 animate-pulse">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          ),
          label: '生成代码',
          color: 'border-green-200 bg-green-50',
        }
      case 'command':
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-500 animate-pulse">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          ),
          label: '执行命令',
          color: 'border-orange-200 bg-orange-50',
        }
      case 'preview':
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500 animate-pulse">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          ),
          label: '生成预览',
          color: 'border-indigo-200 bg-indigo-50',
        }
    }
  }

  const config = getTypeConfig()

  return (
    <div className={`rounded-lg border p-3 ${config.color} ${className}`}>
      <div className="flex items-center gap-2">
        {config.icon}
        <span className="text-xs font-medium text-gray-600">{title || config.label}</span>
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
