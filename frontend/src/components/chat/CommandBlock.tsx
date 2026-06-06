import { useState } from 'react'
import { Terminal, Copy, Check, Play, ChevronDown, ChevronUp } from 'lucide-react'
interface MessageContent {
  type: string
  content: string
  output?: string
}

interface CommandBlockProps {
  content: MessageContent
  onExecute?: (command: string) => void
}

export function CommandBlock({ content, onExecute }: CommandBlockProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [output, setOutput] = useState<string>(content.output || '')

  const command = content.content
  const showOutput = output.length > 0

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExecute = async () => {
    if (!onExecute) return
    setExecuting(true)
    try {
      const result = await onExecute(command)
      setOutput(typeof result === 'string' ? result : '')
    } catch (error) {
      setOutput(`Error: ${error}`)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="my-3 rounded-lg overflow-hidden bg-gray-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-green-400" />
          <span className="text-xs font-mono text-green-300">
            Terminal
          </span>
        </div>
        <div className="flex items-center gap-1">
          {showOutput && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-gray-800 rounded text-gray-400 transition-colors"
              title={expanded ? '折叠输出' : '展开输出'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 transition-colors"
            title="复制命令"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
          {onExecute && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="p-1.5 hover:bg-green-900 rounded text-green-400 transition-colors disabled:opacity-50"
              title="执行命令"
            >
              <Play size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="px-3 py-2">
        <code className="text-sm font-mono text-green-300">
          $ {command}
        </code>
      </div>
      {showOutput && expanded && (
        <div className="border-t border-gray-700 px-3 py-2 max-h-60 overflow-auto">
          <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed">
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}
