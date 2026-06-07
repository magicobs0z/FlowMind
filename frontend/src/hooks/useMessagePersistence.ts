import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_PREFIX = 'flowmind_chat_state_'
const MAX_PERSISTED_CONVERSATIONS = 50

/**
 * 消息折叠状态持久化 Hook
 * 缓存每个对话的折叠/展开状态，重新加载时恢复
 */
export function useLayerPersistence(conversationId: string | null) {
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({})
  const initializedRef = useRef(false)

  // 从 localStorage 加载状态
  useEffect(() => {
    if (!conversationId || initializedRef.current) return
    
    try {
      const key = `${STORAGE_PREFIX}layers_${conversationId}`
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        setExpandedLayers(parsed)
      }
      initializedRef.current = true
    } catch (e) {
      console.warn('Failed to load layer states:', e)
    }
  }, [conversationId])

  // 保存状态到 localStorage
  const saveLayerState = useCallback((messageId: string, layerId: string, expanded: boolean) => {
    if (!conversationId) return
    
    setExpandedLayers(prev => {
      const next = {
        ...prev,
        [`${messageId}_${layerId}`]: expanded
      }
      
      // 异步保存到 localStorage
      requestIdleCallback?.(() => {
        try {
          const key = `${STORAGE_PREFIX}layers_${conversationId}`
          localStorage.setItem(key, JSON.stringify(next))
        } catch (e) {
          // 存储空间不足时清理旧数据
          cleanupOldStates()
        }
      }) ?? setTimeout(() => {
        try {
          const key = `${STORAGE_PREFIX}layers_${conversationId}`
          localStorage.setItem(key, JSON.stringify(next))
        } catch (e) {
          cleanupOldStates()
        }
      }, 0)
      
      return next
    })
  }, [conversationId])

  // 获取特定消息的层状态
  const getLayerState = useCallback((messageId: string, layerId: string): boolean => {
    return expandedLayers[`${messageId}_${layerId}`] ?? false
  }, [expandedLayers])

  return { saveLayerState, getLayerState, expandedLayers }
}

/**
 * 滚动位置持久化 Hook
 */
export function useScrollPersistence(conversationId: string | null) {
  const scrollRef = useRef(0)

  // 保存滚动位置
  const saveScrollPosition = useCallback((position: number) => {
    if (!conversationId) return
    scrollRef.current = position
    
    requestIdleCallback?.(() => {
      try {
        const key = `${STORAGE_PREFIX}scroll_${conversationId}`
        localStorage.setItem(key, JSON.stringify({
          position,
          timestamp: Date.now()
        }))
      } catch (e) {
        console.warn('Failed to save scroll position:', e)
      }
    }) ?? setTimeout(() => {
      try {
        const key = `${STORAGE_PREFIX}scroll_${conversationId}`
        localStorage.setItem(key, JSON.stringify({
          position,
          timestamp: Date.now()
        }))
      } catch (e) {
        console.warn('Failed to save scroll position:', e)
      }
    }, 0)
  }, [conversationId])

  // 恢复滚动位置
  const restoreScrollPosition = useCallback((): number => {
    if (!conversationId) return 0
    
    try {
      const key = `${STORAGE_PREFIX}scroll_${conversationId}`
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.position || 0
      }
    } catch (e) {
      console.warn('Failed to restore scroll position:', e)
    }
    return 0
  }, [conversationId])

  return { saveScrollPosition, restoreScrollPosition }
}

/**
 * 可视区懒加载 Hook
 * 只渲染可视区域内的消息，滚动到视口外时卸载DOM
 */
export function useLazyRender(
  containerRef: React.RefObject<HTMLElement | null>,
  _itemCount: number,
  itemHeight: number = 100
) {
  const [visibleRange] = useState({ start: 0, end: 20 })
  const observerRef = useRef<IntersectionObserver | null>(null)
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map())

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 使用 IntersectionObserver 检测元素是否在视口内
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const index = Number(entry.target.getAttribute('data-index'))
          if (!isNaN(index)) {
            const el = itemRefs.current.get(index)
            if (el) {
              // 使用 content-visibility 优化离屏渲染
              if (entry.isIntersecting) {
                el.style.contentVisibility = 'auto'
                el.style.containIntrinsicHeight = `${itemHeight}px`
              } else {
                el.style.contentVisibility = 'hidden'
              }
            }
          }
        })
      },
      {
        root: container,
        rootMargin: '100px 0px', // 提前 100px 开始渲染
        threshold: 0,
      }
    )

    return () => {
      observerRef.current?.disconnect()
    }
  }, [containerRef, itemHeight])

  // 注册元素到观察器
  const registerItem = useCallback((index: number, el: HTMLElement | null) => {
    if (!el) {
      const oldEl = itemRefs.current.get(index)
      if (oldEl) {
        observerRef.current?.unobserve(oldEl)
        itemRefs.current.delete(index)
      }
      return
    }
    
    itemRefs.current.set(index, el)
    observerRef.current?.observe(el)
  }, [])

  return { visibleRange, registerItem }
}

/**
 * 文件修改快照持久化
 * 支持在历史对话中一键回滚代码变更
 */
export function useCodeSnapshot() {
  const saveSnapshot = useCallback((
    conversationId: string,
    messageId: string,
    filePath: string,
    originalContent: string,
    modifiedContent: string
  ) => {
    try {
      const key = `${STORAGE_PREFIX}snapshot_${conversationId}_${messageId}`
      const snapshot = {
        filePath,
        originalContent,
        modifiedContent,
        timestamp: Date.now(),
      }
      localStorage.setItem(key, JSON.stringify(snapshot))
    } catch (e) {
      console.warn('Failed to save code snapshot:', e)
    }
  }, [])

  const getSnapshot = useCallback((
    conversationId: string,
    messageId: string
  ): { filePath: string; originalContent: string; modifiedContent: string; timestamp: number } | null => {
    try {
      const key = `${STORAGE_PREFIX}snapshot_${conversationId}_${messageId}`
      const saved = localStorage.getItem(key)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.warn('Failed to get code snapshot:', e)
    }
    return null
  }, [])

  const rollbackSnapshot = useCallback(async (
    conversationId: string,
    messageId: string
  ): Promise<string | null> => {
    const snapshot = getSnapshot(conversationId, messageId)
    if (!snapshot) return null
    
    // TODO: 调用文件系统 API 回滚代码
    console.log('Rolling back:', snapshot.filePath)
    return snapshot.originalContent
  }, [getSnapshot])

  return { saveSnapshot, getSnapshot, rollbackSnapshot }
}

/**
 * 清理旧的持久化状态
 */
function cleanupOldStates() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key)
      }
    }
    
    // 按时间戳排序，删除最旧的
    const sortedKeys = keys
      .map(key => {
        try {
          const value = JSON.parse(localStorage.getItem(key) || '{}')
          return { key, timestamp: value.timestamp || 0 }
        } catch {
          return { key, timestamp: 0 }
        }
      })
      .sort((a, b) => a.timestamp - b.timestamp)
    
    // 保留最近的数据
    const toDelete = sortedKeys.slice(0, Math.max(0, sortedKeys.length - MAX_PERSISTED_CONVERSATIONS))
    toDelete.forEach(({ key }) => localStorage.removeItem(key))
  } catch (e) {
    console.warn('Failed to cleanup old states:', e)
  }
}
