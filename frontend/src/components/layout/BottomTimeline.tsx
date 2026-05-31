import { useCallback, useEffect, useState } from 'react'
import { GitCommit, Bot, User, Code, Clock, ChevronDown, ChevronUp, PanelBottomOpen } from 'lucide-react'
import { useWorkspaceStore } from '../../store'
import { timelineApi } from '../../services/api'
import type { TimelineEvent } from '../../store'

/** 事件类型配置 */
const eventConfig = {
  ai: { color: '#0099FF', bg: 'rgba(0, 153, 255, 0.1)', icon: Bot, label: 'AI' },
  human: { color: '#FF8C42', bg: 'rgba(255, 140, 66, 0.1)', icon: User, label: '人工' },
  auto: { color: '#999999', bg: 'rgba(153, 153, 153, 0.1)', icon: Code, label: '脚本' },
}

/** 底部时间轴：完全可折叠，显示真实数据 */
export default function BottomTimeline() {
  const { timelineEvents, currentWorkspace } = useWorkspaceStore()
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)

  const loadEvents = useCallback(async () => {
    if (!currentWorkspace) return
    try {
      const response = await timelineApi.getEvents(currentWorkspace.id, { limit: 100 })
      if (response.success) {
        useWorkspaceStore.getState().setTimelineEvents(response.data.events)
      }
    } catch {
      // 静默失败
    }
  }, [currentWorkspace])

  useEffect(() => {
    loadEvents()
    const interval = setInterval(loadEvents, 30000)
    return () => clearInterval(interval)
  }, [loadEvents])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--flowmind-layer)' }}>
      {/* 头部栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: 'var(--flowmind-border)', background: 'white' }}>
        <div className="flex items-center gap-2">
          <GitCommit size={14} className="text-gray-500" />
          <span className="text-xs font-medium text-gray-700">时间轴</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-500">
            {timelineEvents.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {Object.entries(eventConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: config.color }} />
              <span className="text-[10px] text-gray-500">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 主体：时间轴 + 详情面板 */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-6">
          {timelineEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p className="text-xs">暂无事件，开始工作后会自动记录</p>
            </div>
          ) : (
            <div className="flex items-center relative h-full" style={{ minWidth: `${timelineEvents.length * 100}px` }}>
              <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-200" />

              {timelineEvents.map((event, idx) => {
                const config = eventConfig[event.type]
                const isSelected = selectedEvent?.id === event.id

                return (
                  <div
                    key={event.id}
                    className="relative flex flex-col items-center cursor-pointer group"
                    style={{ width: '100px', marginLeft: idx === 0 ? '20px' : 0 }}
                    onClick={() => setSelectedEvent(event)}
                  >
                    {/* 事件圆点 */}
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center relative z-10"
                      style={{
                        background: isSelected ? config.color : 'white',
                        borderColor: config.color,
                        boxShadow: isSelected ? `0 0 0 4px ${config.bg}` : 'none',
                      }}
                    >
                      {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                    </div>

                    {/* 时间标签 */}
                    <span className="mt-1.5 text-[10px] text-gray-400 whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* 悬浮提示 */}
                    <div className="absolute bottom-full mb-1.5 text-center opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-2 py-1 rounded text-[10px] bg-white shadow-sm text-gray-600 max-w-[180px] truncate">
                      {event.message}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 详情面板 */}
        {selectedEvent && (
          <div className="w-56 border-l p-3 overflow-y-auto bg-white flex-shrink-0" style={{ borderColor: 'var(--flowmind-border)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: eventConfig[selectedEvent.type].bg, color: eventConfig[selectedEvent.type].color }}
                >
                  {(() => {
                    const Icon = eventConfig[selectedEvent.type].icon
                    return <Icon size={10} />
                  })()}
                </div>
                <span className="text-[10px] font-medium" style={{ color: eventConfig[selectedEvent.type].color }}>
                  {eventConfig[selectedEvent.type].label}
                </span>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <h4 className="text-xs font-medium mb-1.5 text-gray-800">{selectedEvent.message}</h4>

            <div className="flex items-center gap-1 mb-2">
              <Clock size={10} className="text-gray-400" />
              <span className="text-[10px] text-gray-400">
                {new Date(selectedEvent.timestamp).toLocaleString('zh-CN')}
              </span>
            </div>

            {selectedEvent.commit && (
              <div className="mb-2">
                <span className="text-[10px] text-gray-500">提交</span>
                <code className="block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                  {selectedEvent.commit.slice(0, 7)}
                </code>
              </div>
            )}

            {selectedEvent.files && selectedEvent.files.length > 0 && (
              <div>
                <span className="text-[10px] text-gray-500">变更文件 ({selectedEvent.files.length})</span>
                <div className="mt-1 space-y-0.5">
                  {selectedEvent.files.map((file, idx) => (
                    <div key={idx} className="text-[10px] px-1.5 py-0.5 rounded truncate bg-gray-50 text-gray-500">
                      {file}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
