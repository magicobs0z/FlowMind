import { CheckCircle2, Circle, AlertTriangle, Clock, Play, Edit3, Check } from 'lucide-react'

interface PlanTask {
  id: string
  title: string
  description: string
  filePath?: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'
  estimatedTime?: string
}

interface Plan {
  id: string
  title: string
  tasks: PlanTask[]
  risks: string[]
  rollbackStrategy?: string
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed'
  progress?: number
}

interface PlanCardProps {
  plan: Plan
  onApprove?: () => void
  onEdit?: (plan: Plan) => void
}

export function PlanCard({ plan, onApprove, onEdit }: PlanCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-green-600 bg-green-50'
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高'
      case 'medium':
        return '中'
      default:
        return '低'
    }
  }

  const getStatusIcon = (status: PlanTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} className="text-green-500" />
      case 'executing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'failed':
        return <AlertTriangle size={16} className="text-red-500" />
      case 'skipped':
        return <Circle size={16} className="text-gray-300" />
      default:
        return <Circle size={16} className="text-gray-300" />
    }
  }

  return (
    <div className="my-4 rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white overflow-hidden">
      <div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{plan.title || '执行计划'}</h3>
              <p className="text-xs text-gray-600">
                {plan.tasks.length} 个任务 · {plan.risks.length} 个风险点
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {plan.status === 'pending' && onEdit && (
              <button
                onClick={() => onEdit(plan)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Edit3 size={12} />
                编辑
              </button>
            )}
            {plan.status === 'pending' && onApprove && (
              <button
                onClick={onApprove}
                className="flex items-center gap-1 px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Play size={12} />
                确认执行
              </button>
            )}
            {plan.status === 'executing' && plan.progress !== undefined && (
              <span className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg">
                进行中 {plan.progress}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
            <Check size={12} />
            任务清单
          </h4>
          <div className="space-y-2">
            {plan.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {getStatusIcon(task.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {task.title}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${getPriorityColor(
                        task.priority
                      )}`}
                    >
                      {getPriorityLabel(task.priority)}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 mb-1">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {task.filePath && (
                      <span className="font-mono truncate max-w-[200px]">
                        {task.filePath}
                      </span>
                    )}
                    {task.estimatedTime && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {task.estimatedTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {plan.risks.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
              <AlertTriangle size={12} />
              风险点
            </h4>
            <div className="space-y-1">
              {plan.risks.map((risk, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg"
                >
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.rollbackStrategy && (
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
              回滚策略
            </h4>
            <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              {plan.rollbackStrategy}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
