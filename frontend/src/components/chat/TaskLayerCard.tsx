import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Brain, Code, Terminal, Globe, FileEdit, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export type TaskLayerType = 'thinking' | 'code_edit' | 'terminal_run' | 'web_preview' | 'tool_call'

interface TaskLayerCardProps {
  type: TaskLayerType
  title: string
  description?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  children?: React.ReactNode
  defaultExpanded?: boolean
  onToggle?: (expanded: boolean) => void
  className?: string
  nestedLevel?: number
}

const typeConfig: Record<TaskLayerType, { icon: React.ReactNode; label: string; color: string; borderColor: string; bgColor: string }> = {
  thinking: {
    icon: <Brain size={14} />,
    label: '思考',
    color: 'text-blue-600',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50',
  },
  code_edit: {
    icon: <Code size={14} />,
    label: '代码编辑',
    color: 'text-green-600',
    borderColor: 'border-green-200',
    bgColor: 'bg-green-50',
  },
  terminal_run: {
    icon: <Terminal size={14} />,
    label: '终端运行',
    color: 'text-orange-600',
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50',
  },
  web_preview: {
    icon: <Globe size={14} />,
    label: '网页预览',
    color: 'text-indigo-600',
    borderColor: 'border-indigo-200',
    bgColor: 'bg-indigo-50',
  },
  tool_call: {
    icon: <FileEdit size={14} />,
    label: '工具调用',
    color: 'text-purple-600',
    borderColor: 'border-purple-200',
    bgColor: 'bg-purple-50',
  },
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  pending: {
    icon: <div className="w-3 h-3 rounded-full border-2 border-gray-300" />,
    label: '待执行',
    color: 'text-gray-500',
  },
  running: {
    icon: <Loader2 size={12} className="animate-spin text-blue-500" />,
    label: '执行中',
    color: 'text-blue-600',
  },
  completed: {
    icon: <CheckCircle2 size={12} className="text-green-500" />,
    label: '已完成',
    color: 'text-green-600',
  },
  failed: {
    icon: <AlertCircle size={12} className="text-red-500" />,
    label: '失败',
    color: 'text-red-600',
  },
}

export function TaskLayerCard({
  type,
  title,
  description,
  status,
  children,
  defaultExpanded = false,
  onToggle,
  className = '',
  nestedLevel = 0,
}: TaskLayerCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const config = typeConfig[type]
  const statusInfo = statusConfig[status]

  const handleToggle = useCallback(() => {
    const newExpanded = !expanded
    setExpanded(newExpanded)
    onToggle?.(newExpanded)
  }, [expanded, onToggle])

  const indentStyle = nestedLevel > 0 ? { marginLeft: `${nestedLevel * 16}px` } : undefined

  return (
    <div 
      className={`rounded-lg border ${config.borderColor} overflow-hidden ${className}`}
      style={indentStyle}
    >
      {/* 摘要卡片头部 - 始终显示 */}
      <button
        onClick={handleToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 ${config.bgColor} hover:opacity-80 transition-opacity text-left`}
      >
        <span className={config.color}>
          {config.icon}
        </span>
        <span className={`text-xs font-medium ${config.color} flex-1 truncate`}>
          {config.label}
        </span>
        <span className="text-xs text-gray-600 flex-1 truncate">
          {title}
        </span>
        {description && (
          <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
            {description}
          </span>
        )}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-1">
            {statusInfo.icon}
            <span className={`text-[10px] ${statusInfo.color}`}>{statusInfo.label}</span>
          </span>
          {children && (
            <span className="text-gray-400">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
        </div>
      </button>

      {/* 展开内容区域 */}
      {expanded && children && (
        <div className="border-t border-gray-100">
          <div className="p-3 bg-white">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

// 任务层级容器 - 用于嵌套多个任务层
interface TaskLayerContainerProps {
  children: React.ReactNode
  className?: string
}

export function TaskLayerContainer({ children, className = '' }: TaskLayerContainerProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {children}
    </div>
  )
}

// AI回合消息的分层渲染组件
interface AIActionRoundProps {
  think?: string
  codeEdits?: Array<{
    id: string
    filePath: string
    language: string
    diff: string
    status: 'pending' | 'running' | 'completed' | 'failed'
  }>
  terminalRuns?: Array<{
    id: string
    command: string
    output?: string
    status: 'pending' | 'running' | 'completed' | 'failed'
  }>
  webPreviews?: Array<{
    id: string
    url: string
    title?: string
    status: 'pending' | 'running' | 'completed' | 'failed'
  }>
  toolCalls?: Array<{
    id: string
    name: string
    input: Record<string, any>
    output?: any
    status: 'pending' | 'running' | 'completed' | 'failed'
  }>
  defaultExpandedLayers?: Record<string, boolean>
  onLayerToggle?: (layerId: string, expanded: boolean) => void
}

export function AIActionRound({
  think,
  codeEdits,
  terminalRuns,
  webPreviews,
  toolCalls,
  defaultExpandedLayers = {},
  onLayerToggle,
}: AIActionRoundProps) {
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>(defaultExpandedLayers)

  const handleToggle = useCallback((layerId: string, expanded: boolean) => {
    setExpandedStates(prev => ({ ...prev, [layerId]: expanded }))
    onLayerToggle?.(layerId, expanded)
  }, [onLayerToggle])

  return (
    <TaskLayerContainer>
      {/* 思考层 */}
      {think && (
        <TaskLayerCard
          type="thinking"
          title="AI思考过程"
          status="completed"
          defaultExpanded={expandedStates['think']}
          onToggle={(expanded) => handleToggle('think', expanded)}
        >
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
            {think}
          </pre>
        </TaskLayerCard>
      )}

      {/* 工具调用层 */}
      {toolCalls && toolCalls.length > 0 && (
        <TaskLayerCard
          type="tool_call"
          title={`调用 ${toolCalls.length} 个工具`}
          status={toolCalls.every(t => t.status === 'completed') ? 'completed' : toolCalls.some(t => t.status === 'running') ? 'running' : 'pending'}
          defaultExpanded={expandedStates['tool_calls']}
          onToggle={(expanded) => handleToggle('tool_calls', expanded)}
        >
          <div className="space-y-2">
            {toolCalls.map((tool) => (
              <div key={tool.id} className="text-xs">
                <div className="font-medium text-gray-700">{tool.name}</div>
                <pre className="mt-1 p-2 bg-gray-50 rounded text-gray-600 overflow-auto">
                  {JSON.stringify(tool.input, null, 2)}
                </pre>
                {tool.output && (
                  <pre className="mt-1 p-2 bg-green-50 rounded text-green-700 overflow-auto">
                    {typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </TaskLayerCard>
      )}

      {/* 代码编辑层 */}
      {codeEdits && codeEdits.length > 0 && (
        <TaskLayerCard
          type="code_edit"
          title={`修改 ${codeEdits.length} 个文件`}
          status={codeEdits.every(e => e.status === 'completed') ? 'completed' : codeEdits.some(e => e.status === 'running') ? 'running' : 'pending'}
          defaultExpanded={expandedStates['code_edits']}
          onToggle={(expanded) => handleToggle('code_edits', expanded)}
        >
          <div className="space-y-3">
            {codeEdits.map((edit) => (
              <div key={edit.id} className="rounded border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-xs">
                  <Code size={12} className="text-gray-500" />
                  <span className="font-mono text-gray-700">{edit.filePath}</span>
                  <span className="text-[10px] uppercase text-gray-400">{edit.language}</span>
                </div>
                <pre className="p-3 text-xs font-mono text-gray-800 overflow-auto max-h-64">
                  <code>{edit.diff}</code>
                </pre>
              </div>
            ))}
          </div>
        </TaskLayerCard>
      )}

      {/* 终端运行层 */}
      {terminalRuns && terminalRuns.length > 0 && (
        <TaskLayerCard
          type="terminal_run"
          title={`执行 ${terminalRuns.length} 个命令`}
          status={terminalRuns.every(t => t.status === 'completed') ? 'completed' : terminalRuns.some(t => t.status === 'running') ? 'running' : 'pending'}
          defaultExpanded={expandedStates['terminal_runs']}
          onToggle={(expanded) => handleToggle('terminal_runs', expanded)}
        >
          <div className="space-y-2">
            {terminalRuns.map((run) => (
              <div key={run.id} className="rounded bg-gray-900 text-green-300 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-gray-700 text-xs font-mono">
                  $ {run.command}
                </div>
                {run.output && (
                  <pre className="p-3 text-xs font-mono text-gray-300 whitespace-pre-wrap max-h-60 overflow-auto">
                    {run.output}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </TaskLayerCard>
      )}

      {/* 网页预览层 */}
      {webPreviews && webPreviews.length > 0 && (
        <TaskLayerCard
          type="web_preview"
          title={`${webPreviews.length} 个预览`}
          status={webPreviews.every(p => p.status === 'completed') ? 'completed' : webPreviews.some(p => p.status === 'running') ? 'running' : 'pending'}
          defaultExpanded={expandedStates['web_previews']}
          onToggle={(expanded) => handleToggle('web_previews', expanded)}
        >
          <div className="space-y-2">
            {webPreviews.map((preview) => (
              <div key={preview.id} className="rounded border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-xs">
                  <Globe size={12} className="text-gray-500" />
                  <span className="text-gray-700">{preview.title || '预览'}</span>
                  <a 
                    href={preview.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline ml-auto"
                  >
                    打开
                  </a>
                </div>
                <div className="h-48 bg-gray-100 flex items-center justify-center">
                  <iframe
                    src={preview.url}
                    title={preview.title || 'Preview'}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </div>
            ))}
          </div>
        </TaskLayerCard>
      )}
    </TaskLayerContainer>
  )
}
