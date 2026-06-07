import { useState, useCallback, useEffect, useRef } from 'react'
import { 
  ChevronRight, ChevronDown, Copy, Check, RefreshCw, MessageSquare, 
  ThumbsUp, ThumbsDown, AlertTriangle, Link as LinkIcon, FileCode,
  Brain, Terminal, FileEdit, Globe, Loader2, CheckCircle2, Circle,
  MoreHorizontal, ChevronRight as FoldIcon
} from 'lucide-react'
import { StreamingText, SkeletonCard } from './StreamingText'
import StatusIndicator from './StatusIndicator'
import MarkdownRenderer from './MarkdownRenderer'
import type { AIMessage, UserMessage, SystemMessage, MessageStatus } from '../../types/message'

// ============================================
// 纯文本树状结构消息组件（无气泡、无边框）
// ============================================

interface TreeNodeProps {
  id: string
  icon: React.ReactNode
  label: string
  content?: React.ReactNode
  status?: 'pending' | 'running' | 'completed' | 'failed'
  children?: React.ReactNode
  defaultExpanded?: boolean
  onToggle?: (expanded: boolean) => void
  indentLevel?: number
}

function TreeNode({
  id,
  icon,
  label,
  content,
  status,
  children,
  defaultExpanded = false,
  onToggle,
  indentLevel = 0
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const hasChildren = !!children

  const handleToggle = () => {
    if (!hasChildren) return
    const newExpanded = !expanded
    setExpanded(newExpanded)
    onToggle?.(newExpanded)
  }

  const statusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 size={10} className="text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle2 size={10} className="text-green-500" />
      case 'failed':
        return <AlertTriangle size={10} className="text-red-500" />
      default:
        return <Circle size={10} className="text-gray-300" />
    }
  }

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1.5 py-0.5 px-1 rounded cursor-pointer hover:bg-gray-50 transition-colors ${
          hasChildren ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{ paddingLeft: `${indentLevel * 16 + 4}px` }}
        onClick={handleToggle}
      >
        {hasChildren ? (
          <span className="text-gray-400 flex-shrink-0">
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
        ) : (
          <span className="w-[10px] flex-shrink-0" />
        )}
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-[11px] text-gray-600 truncate flex-1">{label}</span>
        <span className="flex-shrink-0">{statusIcon()}</span>
      </div>
      
      {expanded && hasChildren && (
        <div className="border-l border-gray-100 ml-2">
          {content || children}
        </div>
      )}
    </div>
  )
}

// 折叠结构容器
interface CollapsibleSectionProps {
  id: string
  title: string
  icon: React.ReactNode
  status?: 'pending' | 'running' | 'completed' | 'failed'
  defaultCollapsed?: boolean
  summary?: string
  children: React.ReactNode
  onCollapseChange?: (collapsed: boolean) => void
}

function CollapsibleSection({
  id,
  title,
  icon,
  status,
  defaultCollapsed = false,
  summary,
  children,
  onCollapseChange
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const prevStatusRef = useRef(status)

  // 当状态变为 completed 时自动折叠
  useEffect(() => {
    if (prevStatusRef.current !== 'completed' && status === 'completed') {
      setCollapsed(true)
      onCollapseChange?.(true)
    }
    prevStatusRef.current = status
  }, [status, onCollapseChange])

  const handleToggle = () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)
    onCollapseChange?.(newCollapsed)
  }

  const statusColor = () => {
    switch (status) {
      case 'running': return 'text-blue-500'
      case 'completed': return 'text-green-500'
      case 'failed': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="border-l-2 border-gray-100 ml-2 my-1">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded transition-colors text-left"
      >
        <span className={`transform transition-transform ${collapsed ? '-rotate-90' : ''}`}>
          <ChevronRight size={12} className="text-gray-400" />
        </span>
        <span className={statusColor()}>{icon}</span>
        <span className="text-[11px] font-medium text-gray-700">{title}</span>
        {collapsed && summary && (
          <span className="text-[10px] text-gray-400 truncate">— {summary}</span>
        )}
      </button>
      
      {!collapsed && (
        <div className="pl-4 pr-2 pb-2">
          {children}
        </div>
      )}
    </div>
  )
}

// ============================================
// 用户消息组件
// ============================================
interface UserMessageBubbleProps {
  message: UserMessage
  onEdit?: () => void
  onDelete?: () => void
}

export function UserMessageBubble({ message, onEdit, onDelete }: UserMessageBubbleProps) {
  const [showActions, setShowActions] = useState(false)

  // 使用 MarkdownRenderer 来渲染用户消息内容
  const parseContent = () => {
    return (
      <MarkdownRenderer
        content={message.content}
        className="text-[13px] text-gray-700 leading-relaxed"
      />
    )
  }

  return (
    <div className="group">
      <div
        className="flex items-start gap-2 py-2"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-[9px] font-bold">U</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-400 mb-1">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {parseContent()}
        </div>
        {showActions && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                title="编辑"
              >
                <FileCode size={12} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"
                title="删除"
              >
                <AlertTriangle size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// AI 消息组件 - 纯文字树状结构
// ============================================
interface AIMessageBubbleProps {
  message: AIMessage
  isStreaming?: boolean
  onRegenerate?: () => void
  onQuote?: () => void
  onFeedback?: (type: 'good' | 'bad', comment?: string) => void
  onApprovePlan?: () => void
  onLayerToggle?: (layerId: string, collapsed: boolean) => void
  onStop?: () => void
}

export function AIMessageBubble({
  message,
  isStreaming = false,
  onRegenerate,
  onQuote,
  onFeedback,
  onApprovePlan,
  onLayerToggle,
  onStop,
}: AIMessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSectionCollapse = useCallback((sectionId: string, collapsed: boolean) => {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: collapsed }))
    onLayerToggle?.(sectionId, collapsed)
  }, [onLayerToggle])

  // 判断消息状态
  const getStatus = (): 'running' | 'completed' | 'failed' => {
    switch (message.status) {
      case 'error': return 'failed'
      case 'thinking':
      case 'tool_call':
      case 'executing': return 'running'
      default: return 'completed'
    }
  }

  const status = getStatus()

  // 解析消息内容构建树状结构
  const renderTreeStructure = () => {
    const nodes: React.ReactNode[] = []

    // 思考过程
    if (message.think) {
      nodes.push(
        <CollapsibleSection
          key="think"
          id="think"
          title="思考过程"
          icon={<Brain size={12} className="text-blue-500" />}
          status="completed"
          defaultCollapsed={true}
          summary="已完成"
          onCollapseChange={(c) => handleSectionCollapse('think', c)}
        >
          <pre className="text-[11px] text-gray-600 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 p-2 rounded">
            {message.think}
          </pre>
        </CollapsibleSection>
      )
    }

    // 工具调用
    if (message.toolCalls && message.toolCalls.length > 0) {
      nodes.push(
        <CollapsibleSection
          key="tool_calls"
          id="tool_calls"
          title="工具调用"
          icon={<FileEdit size={12} className="text-purple-500" />}
          status={message.toolCalls.some(t => t.status === 'executing') ? 'running' : 'completed'}
          summary={`调用 ${message.toolCalls.length} 个工具`}
          onCollapseChange={(c) => handleSectionCollapse('tool_calls', c)}
        >
          <div className="space-y-1">
            {message.toolCalls.map((tool, index) => (
              <div key={tool.id || index} className="border-l-2 border-gray-200 pl-2 py-1">
                <div className="text-[11px] font-medium text-gray-700">
                  {tool.name}
                </div>
                {tool.input && (
                  <pre className="text-[10px] text-gray-500 font-mono mt-1 p-1.5 bg-gray-50 rounded overflow-auto max-h-32">
                    {typeof tool.input === 'string' ? tool.input : JSON.stringify(tool.input, null, 2)}
                  </pre>
                )}
                {tool.output && (
                  <pre className="text-[10px] text-green-600 font-mono mt-1 p-1.5 bg-green-50 rounded overflow-auto max-h-32">
                    {typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )
    }

    // 代码变更
    if (message.contents) {
      const codeContents = message.contents.filter(c => c.type === 'code')
      if (codeContents.length > 0) {
        nodes.push(
          <CollapsibleSection
            key="code_changes"
            id="code_changes"
            title="代码变更"
            icon={<FileCode size={12} className="text-green-500" />}
            status="completed"
            summary={`修改 ${codeContents.length} 个文件`}
            onCollapseChange={(c) => handleSectionCollapse('code_changes', c)}
          >
            <div className="space-y-2">
              {codeContents.map((content, index) => (
                <div key={index} className="rounded bg-gray-900">
                  <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-700">
                    <FileCode size={10} className="text-gray-400" />
                    <span className="text-[10px] text-gray-300 font-mono">
                      {content.filePath || 'unknown'}
                    </span>
                    <span className="text-[9px] text-gray-500 uppercase">
                      {content.language}
                    </span>
                  </div>
                  <pre className="p-2 text-[11px] font-mono text-gray-100 overflow-auto max-h-48">
                    <code>{content.content}</code>
                  </pre>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )
      }

      // 命令执行
      const commandContents = message.contents.filter(c => c.type === 'command')
      if (commandContents.length > 0) {
        nodes.push(
          <CollapsibleSection
            key="commands"
            id="commands"
            title="命令执行"
            icon={<Terminal size={12} className="text-orange-500" />}
            status="completed"
            summary={`执行 ${commandContents.length} 个命令`}
            onCollapseChange={(c) => handleSectionCollapse('commands', c)}
          >
            <div className="space-y-1">
              {commandContents.map((content, index) => (
                <div key={index} className="rounded bg-gray-900">
                  <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-700 text-[11px] font-mono text-green-400">
                    $ {content.content}
                  </div>
                  {content.output && (
                    <pre className="p-2 text-[11px] font-mono text-gray-300 whitespace-pre-wrap">
                      {content.output}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )
      }

      // 链接预览
      const linkContents = message.contents.filter(c => c.type === 'link')
      if (linkContents.length > 0) {
        nodes.push(
          <CollapsibleSection
            key="previews"
            id="previews"
            title="预览链接"
            icon={<Globe size={12} className="text-indigo-500" />}
            status="completed"
            summary={`${linkContents.length} 个预览`}
            onCollapseChange={(c) => handleSectionCollapse('previews', c)}
          >
            <div className="space-y-1">
              {linkContents.map((content, index) => (
                <a
                  key={index}
                  href={content.linkUrl || content.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-[11px] text-blue-600"
                >
                  <Globe size={10} />
                  <span className="truncate">{content.content}</span>
                </a>
              ))}
            </div>
          </CollapsibleSection>
        )
      }
    }

    return nodes.length > 0 ? (
      <div className="mt-2">
        {nodes}
      </div>
    ) : null
  }

  // 中间态加载
  if (message.status === 'thinking' && !message.content && !message.think) {
    return (
      <div className="flex items-start gap-2 py-2">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[9px] font-bold">AI</span>
        </div>
        <div className="flex-1">
          <div className="text-[10px] text-gray-400 mb-1">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="flex items-center gap-1">
            <SkeletonCard type="thinking" className="py-1 px-2" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group">
      <div className="flex items-start gap-2 py-2">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[9px] font-bold">AI</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-400 mb-1">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            {message.model && <span className="ml-1">· {message.model}</span>}
          </div>

          {/* 状态指示组件 */}
          {message.status && message.status !== 'result' && (
            <StatusIndicator
              status={message.status}
              message={message.statusDetail}
              detail={message.statusDetail}
              toolName={message.toolName}
              progress={message.statusProgress}
              logs={message.statusLogs}
              onRetry={onRegenerate}
              onStop={onStop}
            />
          )}

          {/* 主要内容 - Markdown 渲染 */}
          {message.content && (
            isStreaming ? (
              <StreamingText
                content={message.content}
                isStreaming={isStreaming}
                className="text-[13px] text-gray-700 leading-relaxed"
              />
            ) : (
              <MarkdownRenderer
                content={message.content}
                className="text-[13px] leading-relaxed"
              />
            )
          )}

          {/* 树状结构内容 */}
          {renderTreeStructure()}

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              title="复制"
            >
              {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                title="重新生成"
              >
                <RefreshCw size={11} />
              </button>
            )}
            {onQuote && (
              <button
                onClick={onQuote}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                title="引用"
              >
                <MessageSquare size={11} />
              </button>
            )}
            {onFeedback && (
              <div className="relative">
                <button
                  onClick={() => setShowFeedback(!showFeedback)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                >
                  <ThumbsUp size={11} />
                </button>
                {showFeedback && (
                  <div className="absolute top-full left-0 mt-1 p-1.5 bg-white rounded shadow-lg border border-gray-200 z-10 flex gap-1">
                    <button
                      onClick={() => { onFeedback('good'); setShowFeedback(false) }}
                      className="p-1 hover:bg-green-50 rounded text-green-600"
                    >
                      <ThumbsUp size={10} />
                    </button>
                    <button
                      onClick={() => { onFeedback('bad'); setShowFeedback(false) }}
                      className="p-1 hover:bg-red-50 rounded text-red-500"
                    >
                      <ThumbsDown size={10} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// 系统消息组件
// ============================================
interface SystemMessageBubbleProps {
  message: SystemMessage
}

export function SystemMessageBubble({ message }: SystemMessageBubbleProps) {
  const getStyles = () => {
    switch (message.type) {
      case 'error':
        return {
          bg: 'bg-red-50',
          text: 'text-red-700',
          icon: <AlertTriangle size={12} className="text-red-500" />
        }
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-700',
          icon: <AlertTriangle size={12} className="text-yellow-500" />
        }
      case 'success':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          icon: <CheckCircle2 size={12} className="text-green-500" />
        }
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-600',
          icon: null
        }
    }
  }

  const styles = getStyles()

  return (
    <div className="flex justify-center py-1">
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${styles.bg}`}>
        {styles.icon}
        <span className={`text-[11px] ${styles.text}`}>
          {message.content}
        </span>
      </div>
    </div>
  )
}

// 导出类型
export type { AIMessage, UserMessage, SystemMessage }
