import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
interface MessageContent {
  type: string
  progress?: number
  progressText?: string
}

interface ProgressBarProps {
  content: MessageContent
  tasks?: Array<{ title: string; status: string; progress?: number }>
}

export function ProgressBar({ content, tasks }: ProgressBarProps) {
  const progress = content.progress || 0
  const text = content.progressText || '处理中...'

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={14} className="text-green-500" />
      case 'executing':
        return <Loader2 size={14} className="text-blue-500 animate-spin" />
      default:
        return <Circle size={14} className="text-gray-300" />
    }
  }

  return (
    <div className="my-3 space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 font-medium">{text}</span>
          <span className="text-gray-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {tasks && tasks.length > 0 && (
        <div className="space-y-2 mt-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase">
            任务列表
          </h4>
          <div className="space-y-1.5">
            {tasks.map((task, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                {getStatusIcon(task.status)}
                <span className="flex-1">{task.title}</span>
                {task.progress !== undefined && (
                  <span className="text-xs text-gray-400">
                    {task.progress}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
