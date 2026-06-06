import { useState } from 'react'
import { Brain, ChevronDown, ChevronUp } from 'lucide-react'

interface ThinkBlockProps {
  content: string
}

export function ThinkBlock({ content }: ThinkBlockProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <Brain size={14} />
        {expanded ? '收起思考' : '展开思考'}
      </button>
      {expanded && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}
