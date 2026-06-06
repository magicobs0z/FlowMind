import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react'

interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'executing' | 'success' | 'error'
  error?: string
}

interface ToolCallLogProps {
  toolCalls: ToolCall[]
}

export function ToolCallLog({ toolCalls }: ToolCallLogProps) {
  const getStatusIcon = (status: ToolCall['status']) => {
    switch (status) {
      case 'executing':
        return <Loader2 size={14} className="text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle2 size={14} className="text-green-500" />
      case 'error':
        return <XCircle size={14} className="text-red-500" />
      default:
        return <Circle size={14} className="text-gray-300" />
    }
  }

  const getStatusColor = (status: ToolCall['status']) => {
    switch (status) {
      case 'executing':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="my-3 space-y-2">
      {toolCalls.map((toolCall) => (
        <div
          key={toolCall.id}
          className={`flex items-start gap-2 p-2 rounded-lg border ${getStatusColor(
            toolCall.status
          )}`}
        >
          {getStatusIcon(toolCall.status)}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">
              {toolCall.name}
            </div>
            {toolCall.status === 'executing' && (
              <div className="text-xs text-gray-500 mt-0.5">
                正在执行...
              </div>
            )}
            {toolCall.status === 'error' && toolCall.error && (
              <div className="text-xs text-red-600 mt-0.5 font-mono">
                {toolCall.error}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
