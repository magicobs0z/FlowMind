import { useState, useRef, useEffect, useCallback } from 'react'
import { Terminal, Maximize2, Minimize2, Trash2, Play, Copy, Check } from 'lucide-react'
import { useTabStore } from '../../store'

interface TerminalLine {
  id: string
  type: 'input' | 'output' | 'error' | 'info'
  content: string
  timestamp: Date
}

export default function TerminalPanel() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 'welcome', type: 'info', content: 'FlowMind Terminal v1.0.0 - 输入 "help" 查看可用命令', timestamp: new Date() },
  ])
  const [input, setInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const { openTab } = useTabStore()

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, { id: `${Date.now()}_${Math.random()}`, type, content, timestamp: new Date() }])
  }, [])

  const executeCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    addLine('input', `$ ${trimmed}`)

    const parts = trimmed.split(' ')
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)

    switch (command) {
      case 'help':
        addLine('info', `可用命令:
  help          - 显示此帮助
  clear         - 清空终端
  echo <text>   - 输出文本
  date          - 显示当前时间
  agents        - 列出所有智能体
  agent <name>  - 查看智能体详情
  task <desc>   - 创建新任务
  status        - 查看系统状态
  workspace     - 显示当前工作区
  open <file>   - 打开文件
  ls            - 列出文件
  pwd           - 显示当前路径`)
        break
      case 'clear':
        setLines([])
        break
      case 'echo':
        addLine('output', args.join(' ') || '')
        break
      case 'date':
        addLine('output', new Date().toLocaleString('zh-CN'))
        break
      case 'agents':
        addLine('output', `已注册智能体:
  🎯 主负责人 (lead) - 活跃
  📋 副负责人 (sub-lead) - 活跃
  💻 工程师 (coder) - 活跃
  🔍 代码审查员 (reviewer) - 活跃
  🧪 测试工程师 (tester) - 活跃
  🗺️ 探索者 (explorer) - 活跃`)
        break
      case 'agent':
        if (args.length === 0) {
          addLine('error', '用法: agent <name>')
        } else {
          const agentName = args[0]
          addLine('output', `智能体: ${agentName}\n状态: 活跃\n当前任务: 等待分配\n最近活动: 2分钟前`)
        }
        break
      case 'task':
        if (args.length === 0) {
          addLine('error', '用法: task <description>')
        } else {
          const taskDesc = args.join(' ')
          addLine('output', `✓ 任务已创建: ${taskDesc}\n  正在分配给产品经理分析...`)
          setTimeout(() => {
            addLine('info', '📋 产品经理: 已接收任务，开始分析需求...')
          }, 1000)
          setTimeout(() => {
            addLine('info', '🏗️ 架构师: 正在设计技术方案...')
          }, 2000)
        }
        break
      case 'status':
        addLine('output', `系统状态:
  运行时间: 正常
  智能体: 6/6 活跃
  内存使用: 正常
  工作区: 已加载`)
        break
      case 'workspace':
        addLine('output', `当前工作区: FlowMind\n路径: d:\\AI\\FlowMind\\flowmind\n文件数: 120+\n状态: 已扫描`)
        break
      case 'open':
        if (args.length === 0) {
          addLine('error', '用法: open <filename>')
        } else {
          const filename = args.join(' ')
          openTab({
            id: `file:${filename}`,
            type: 'file',
            title: filename,
            path: filename,
          })
          addLine('output', `已打开文件: ${filename}`)
        }
        break
      case 'ls':
        addLine('output', `src/\n  components/\n  store/\n  services/\n  utils/\npublic/\npackage.json\ntsconfig.json`)
        break
      case 'pwd':
        addLine('output', 'd:\\AI\\FlowMind\\flowmind')
        break
      default:
        addLine('error', `未知命令: ${command}\n输入 "help" 查看可用命令`)
    }
  }, [addLine, openTab])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    executeCommand(input)
    setInput('')
  }

  const handleCopy = () => {
    const text = lines.map(l => l.content).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex flex-col bg-gray-900 text-gray-100 font-mono text-sm ${isExpanded ? 'h-[500px]' : 'h-[200px]'}`}>
      {/* 终端标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-green-400" />
          <span className="text-xs text-gray-400">终端</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200"
            title="复制全部"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
          <button
            onClick={() => setLines([{ id: 'cleared', type: 'info', content: '终端已清空', timestamp: new Date() }])}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200"
            title="清空"
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200"
            title={isExpanded ? '缩小' : '展开'}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* 终端输出区域 */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-all ${
              line.type === 'input'
                ? 'text-green-400'
                : line.type === 'error'
                ? 'text-red-400'
                : line.type === 'info'
                ? 'text-blue-400'
                : 'text-gray-300'
            }`}
          >
            {line.content}
          </div>
        ))}
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-t border-gray-700">
        <span className="text-green-400 text-sm">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent text-gray-100 text-sm focus:outline-none font-mono"
          placeholder="输入命令..."
          autoFocus
        />
        <button
          type="submit"
          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200"
        >
          <Play size={12} />
        </button>
      </form>
    </div>
  )
}
