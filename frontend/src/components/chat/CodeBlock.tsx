import { useState } from 'react'
import { Copy, Check, Play, FileCode, ChevronDown, ChevronUp } from 'lucide-react'
interface MessageContent {
  type: string
  content: string
  language?: string
  filePath?: string
  output?: string
}

interface CodeBlockProps {
  content: MessageContent
  onRun?: (code: string) => void
  onViewFile?: (path: string) => void
}

export function CodeBlock({ content, onRun, onViewFile }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const code = content.content
  const language = content.language || 'javascript'
  const filePath = content.filePath
  const isLongCode = code.length > 500

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileCode size={14} className="text-gray-500" />
          <span className="text-xs font-medium text-gray-600 uppercase">
            {language}
          </span>
          {filePath && (
            <span className="text-xs text-gray-400 ml-2">
              {filePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isLongCode && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title={expanded ? '折叠' : '展开'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {onRun && (
            <button
              onClick={() => onRun(code)}
              className="p-1.5 hover:bg-green-100 rounded text-green-600 transition-colors"
              title="运行代码"
            >
              <Play size={14} />
            </button>
          )}
          {filePath && onViewFile && (
            <button
              onClick={() => onViewFile(filePath)}
              className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors"
              title="查看文件"
            >
              <FileCode size={14} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors"
            title="复制代码"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <div className={`overflow-auto ${isLongCode && !expanded ? 'max-h-48' : ''}`}>
        <pre className="p-3 text-sm font-mono text-gray-800 leading-relaxed overflow-x-auto">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}
