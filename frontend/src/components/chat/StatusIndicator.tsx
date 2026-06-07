import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

export type StatusType =
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'tool_call'
  | 'terminal_running'
  | 'preview_generating'
  | 'result'
  | 'error'
  | 'interrupted'

export interface StatusIndicatorProps {
  status: StatusType
  message?: string
  detail?: string
  toolName?: string
  progress?: number
  logs?: string[]
  onStop?: () => void
  onRetry?: () => void
}

const statusConfig: Record<
  StatusType,
  {
    label: string
    icon: React.ReactNode
    color: string
  }
> = {
  thinking: {
    label: '思考中...',
    icon: null,
    color: '#6B7280',
  },
  planning: {
    label: '制定计划中...',
    icon: null,
    color: '#7C3AED',
  },
  executing: {
    label: '执行中...',
    icon: null,
    color: '#2563EB',
  },
  tool_call: {
    label: '调用工具',
    icon: null,
    color: '#D97706',
  },
  terminal_running: {
    label: '终端运行中...',
    icon: null,
    color: '#E5E7EB',
  },
  preview_generating: {
    label: '生成预览...',
    icon: null,
    color: '#DB2777',
  },
  result: {
    label: '已完成',
    icon: <CheckCircle2 size={14} className="text-green-500" />,
    color: '#059669',
  },
  error: {
    label: '执行失败',
    icon: <AlertTriangle size={14} className="text-red-500" />,
    color: '#DC2626',
  },
  interrupted: {
    label: '已中断',
    icon: <AlertTriangle size={14} className="text-gray-500" />,
    color: '#4B5563',
  },
}

export default function StatusIndicator({
  status,
  message,
  detail,
  toolName,
  progress,
  logs,
  onStop,
  onRetry,
}: StatusIndicatorProps) {
  const config = statusConfig[status]
  const isRunning = status !== 'result' && status !== 'error' && status !== 'interrupted'

  const displayMessage = message || config.label
  
  const showLogs = logs && logs.length > 0 && (status === 'terminal_running')

  return (
    <div className="mb-3">
      {/* 状态行 */}
      <div className="flex items-center gap-2">
        {/* 加载动画或图标 */}
        {isRunning ? (
          <Loader2 size={14} className="text-blue-500 animate-spin" />
        ) : config.icon}
        
        {/* 状态描述 */}
        <span 
          className="text-sm font-medium" 
          style={{ color: config.color }}
        >
          {displayMessage}
        </span>

        {/* 工具名 */}
        {status === 'tool_call' && toolName && (
          <span className="text-sm text-gray-500 ml-1">
            {toolName}
          </span>
        )}
      </div>

      {/* 细节描述 */}
      {detail && status !== 'result' && (
        <div className="text-sm text-gray-600 ml-6 mt-1">
          {detail}
        </div>
      )}

      {/* 日志显示 */}
      {showLogs && (
        <div className="mt-2 ml-6 bg-gray-900 rounded p-2">
          {logs.map((log, idx) => (
            <div key={idx} className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
