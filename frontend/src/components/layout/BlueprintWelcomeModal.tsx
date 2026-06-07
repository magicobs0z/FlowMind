import { useState } from 'react'
import {
  X,
  Workflow,
  Plus,
  ChevronDown,
  ChevronRight,
  Zap,
  Bot,
  FunctionSquare,
  PlayCircle,
  Clock,
  FolderOpen,
} from 'lucide-react'
import { useBlueprintStore, useTabStore } from '../../store'

interface BlueprintWelcomeModalProps {
  isOpen: boolean
  onClose: () => void
}

interface BlueprintCategory {
  id: string
  name: string
  description: string
  scope: string
  note: string
  icon: React.ReactNode
}

interface RecentProject {
  id: string
  name: string
  path: string
  blueprints: Array<{ id: string; name: string; category: string }>
}

const blueprintCategories: BlueprintCategory[] = [
  {
    id: 'task',
    name: '任务蓝图',
    description: '任务的全生命周期事件驱动，串联整个开发流水线。',
    scope: '每任务仅1份',
    note: '当前任务实例',
    icon: <Zap size={20} className="text-yellow-600" />,
  },
  {
    id: 'agent',
    name: '智能体蓝图',
    description: '定义单个智能体（如工程师）的通用行为模式。',
    scope: '每个智能体1份',
    note: '全局（可启停）',
    icon: <Bot size={20} className="text-blue-600" />,
  },
  {
    id: 'function',
    name: '蓝图函数库',
    description: '存放纯函数、校验逻辑、工具方法，无副作用。',
    scope: '全局多份',
    note: '全局跨蓝图',
    icon: <FunctionSquare size={20} className="text-green-600" />,
  },
  {
    id: 'runtime',
    name: '运行蓝图',
    description: 'AI 根据任务上下文动态拼装的临时执行计划表。',
    scope: 'AI临时生成',
    note: '单次运行',
    icon: <PlayCircle size={20} className="text-purple-600" />,
  },
  {
    id: 'automation',
    name: '自动化蓝图',
    description: '绑定 Git 提交、定时任务、Webhook 等自动化触发。',
    scope: '项目配置级',
    note: '全局监听',
    icon: <Clock size={20} className="text-orange-600" />,
  },
]

const mockRecentProjects: RecentProject[] = [
  {
    id: '1',
    name: 'FlowMind Project',
    path: '/work/flowmind',
    blueprints: [
      { id: 'bp1', name: '开发任务流程', category: 'task' },
      { id: 'bp2', name: '代码审查自动化', category: 'automation' },
    ],
  },
  {
    id: '2',
    name: 'AI Assistant',
    path: '/work/ai-assistant',
    blueprints: [
      { id: 'bp3', name: '工程师智能体', category: 'agent' },
      { id: 'bp4', name: '工具函数库', category: 'function' },
    ],
  },
]

export default function BlueprintWelcomeModal({ isOpen, onClose }: BlueprintWelcomeModalProps) {
  const { blueprints, createBlueprint, setCurrentBlueprintId } = useBlueprintStore()
  const { openTab } = useTabStore()
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)

  const handleOpenBlueprint = (blueprintId: string, blueprintName: string) => {
    setCurrentBlueprintId(blueprintId)
    openTab({ id: blueprintId, type: 'blueprint', title: blueprintName })
    onClose()
  }

  const handleCreateBlueprint = (category: BlueprintCategory) => {
    const newId = createBlueprint(`${category.name} - 新建`, [], [], category.id)
    setCurrentBlueprintId(newId)
    openTab({ id: newId, type: 'blueprint', title: `${category.name} - 新建` })
    onClose()
  }

  const toggleProject = (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null)
    } else {
      setExpandedProjectId(projectId)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[600px] max-h-[75vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">[BluePrint]</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <FolderOpen size={16} />
              最近项目
            </h3>
            <div className="space-y-2">
              {mockRecentProjects.map((project) => (
                <div key={project.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <FolderOpen size={16} className="text-gray-500" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-800">{project.name}</div>
                        <div className="text-xs text-gray-400">{project.path}</div>
                      </div>
                    </div>
                    {expandedProjectId === project.id ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </button>
                  {expandedProjectId === project.id && (
                    <div className="border-t border-gray-100 bg-gray-50">
                      {project.blueprints.map((bp) => (
                        <button
                          key={bp.id}
                          onClick={() => handleOpenBlueprint(bp.id, bp.name)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 pl-14 hover:bg-gray-100 transition-colors"
                        >
                          <Workflow size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-700">{bp.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Plus size={16} />
              创建新蓝图
            </h3>
            <div className="space-y-3">
              {blueprintCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCreateBlueprint(category)}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left group"
                >
                  <div className="mt-1">{category.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800">{category.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {category.scope}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{category.description}</p>
                    <p className="text-xs text-gray-400">{category.note}</p>
                  </div>
                  <div className="text-gray-300 group-hover:text-blue-400 transition-colors">
                    <Plus size={18} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
