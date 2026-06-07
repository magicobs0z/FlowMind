import { useRef, useEffect, useState, useCallback, useMemo } from 'react'

// 使用 store 中的 Message 类型以保持兼容
type Message = import('../../store').Message

interface VirtualMessageListProps {
  messages: Message[]
  renderMessage: (msg: Message, index: number) => React.ReactNode
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void
  followNewMessage?: boolean
  overscan?: number
  estimateItemHeight?: number
}

export function VirtualMessageList({
  messages,
  renderMessage,
  onScroll,
  followNewMessage = true,
  overscan = 3,
  estimateItemHeight = 120,
}: VirtualMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [measuredHeights, setMeasuredHeights] = useState<Map<number, number>>(new Map())
  const [isFollowing, setIsFollowing] = useState(followNewMessage)
  const prevMessageCountRef = useRef(messages.length)
  const rafRef = useRef<number>(0)

  // 测量实际高度
  const measureItem = useCallback((index: number, el: HTMLDivElement | null) => {
    if (!el) {
      itemRefs.current.delete(index)
      return
    }
    itemRefs.current.set(index, el)
    const height = el.getBoundingClientRect().height
    setMeasuredHeights(prev => {
      if (prev.get(index) === height) return prev
      const next = new Map(prev)
      next.set(index, height)
      return next
    })
  }, [])

  // 计算每个消息的偏移量和总高度
  const { totalHeight, itemOffsets } = useMemo(() => {
    const offsets: number[] = []
    let currentOffset = 0
    messages.forEach((_, index) => {
      offsets[index] = currentOffset
      const measured = measuredHeights.get(index)
      currentOffset += measured || estimateItemHeight
    })
    return { totalHeight: currentOffset, itemOffsets: offsets }
  }, [messages, measuredHeights, estimateItemHeight])

  // 计算可视范围
  const visibleRange = useMemo(() => {
    const start = Math.max(0, itemOffsets.findIndex(offset => offset + (measuredHeights.get(itemOffsets.indexOf(offset)) || estimateItemHeight) > scrollTop) - overscan)
    const end = Math.min(
      messages.length - 1,
      itemOffsets.findIndex(offset => offset > scrollTop + containerHeight) + overscan
    )
    return { start: Math.max(0, start), end: end === -1 ? messages.length - 1 : end }
  }, [scrollTop, containerHeight, itemOffsets, messages.length, measuredHeights, estimateItemHeight, overscan])

  // 处理滚动
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const newScrollTop = container.scrollTop
    const newScrollHeight = container.scrollHeight
    const newClientHeight = container.clientHeight
    
    setScrollTop(newScrollTop)
    
    // 判断是否处于底部（跟随模式）
    const isAtBottom = newScrollTop + newClientHeight >= newScrollHeight - 50
    setIsFollowing(isAtBottom)
    
    onScroll?.(newScrollTop, newScrollHeight, newClientHeight)
  }, [onScroll])

  // 监听容器尺寸变化
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    resizeObserver.observe(container)
    setContainerHeight(container.clientHeight)
    
    return () => resizeObserver.disconnect()
  }, [])

  // 新消息自动滚动到底部
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && isFollowing) {
      const container = containerRef.current
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length, isFollowing])

  // 强制滚动到底部
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
      setIsFollowing(true)
    }
  }, [])

  // 使用 requestAnimationFrame 批量处理滚动事件
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const onScrollThrottled = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        handleScroll()
        rafRef.current = 0
      })
    }
    
    container.addEventListener('scroll', onScrollThrottled, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScrollThrottled)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [handleScroll])

  const topPadding = itemOffsets[visibleRange.start] || 0
  const bottomPadding = totalHeight - (itemOffsets[visibleRange.end] || 0) - (measuredHeights.get(visibleRange.end) || estimateItemHeight)

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden relative"
      style={{ willChange: 'transform' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ height: topPadding }} />
        
        {messages.slice(visibleRange.start, visibleRange.end + 1).map((msg, idx) => {
          const actualIndex = visibleRange.start + idx
          return (
            <div
              key={msg.id}
              ref={(el) => measureItem(actualIndex, el)}
              data-index={actualIndex}
              style={{ willChange: 'transform' }}
            >
              {renderMessage(msg, actualIndex)}
            </div>
          )
        })}
        
        <div style={{ height: Math.max(0, bottomPadding) }} />
      </div>
      
      {/* 新消息提示 - 当不在底部时显示 */}
      {!isFollowing && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-full shadow-lg hover:bg-blue-600 transition-colors z-10 flex items-center gap-1"
        >
          <span>新消息</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      )}
    </div>
  )
}

// 简化版消息列表（消息较少时使用）
interface SimpleMessageListProps {
  messages: Message[]
  renderMessage: (msg: Message, index: number) => React.ReactNode
  messagesEndRef?: React.RefObject<HTMLDivElement | null>
}

export function SimpleMessageList({ messages, renderMessage, messagesEndRef }: SimpleMessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
      {messages.map((msg, index) => (
        <div key={msg.id}>{renderMessage(msg, index)}</div>
      ))}
      {messagesEndRef && <div ref={messagesEndRef} />}
    </div>
  )
}
