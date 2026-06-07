import React, { useMemo } from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const renderContent = useMemo(() => {
    // 首先处理代码块
    let processed = content
    const codeBlocks: { id: string; lang: string; code: string }[] = []
    
    // 替换代码块为占位符
    processed = processed.replace(/```(\w*)\s*([\s\S]*?)```/g, (match, lang, code) => {
      const id = `code-block-${codeBlocks.length}`
      codeBlocks.push({ id, lang: lang || 'text', code })
      return `__${id}__`
    })
    
    // 处理标题
    processed = processed.replace(/^(#+)\s+(.*)$/gm, (match, hashes, text) => {
      const level = hashes.length
      const sizes = ['text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs', 'text-xs']
      const weights = ['font-bold', 'font-semibold', 'font-medium', 'font-medium', 'font-medium', 'font-medium']
      return `<h${level} class="${sizes[level - 1]} ${weights[level - 1]} text-gray-900 mt-4 mb-2">${text}</h${level}>`
    })
    
    // 处理粗体
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
    
    // 处理斜体
    processed = processed.replace(/\*([^*]+)\*/g, '<em class="italic text-gray-700">$1</em>')
    
    // 处理代码
    processed = processed.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 text-pink-600 rounded text-sm font-mono">$1</code>')
    
    // 处理链接
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 hover:underline transition-colors">$1</a>')
    
    // 处理无序列表
    processed = processed.replace(/^([-*+])\s+(.*)$/gm, '<li class="ml-6 mb-1 list-disc text-gray-700">$2</li>')
    processed = processed.replace(/(<li.*<\/li>)/s, '<ul class="my-3">$1</ul>')
    
    // 处理有序列表
    processed = processed.replace(/^(\d+)\.\s+(.*)$/gm, '<li class="ml-6 mb-1 list-decimal text-gray-700">$2</li>')
    processed = processed.replace(/(<li.*<\/li>)/s, '<ol class="my-3">$1</ol>')
    
    // 处理引用
    processed = processed.replace(/^>\s+(.*)$/gm, '<blockquote class="border-l-4 border-blue-300 pl-4 my-3 text-gray-600 italic">$1</blockquote>')
    
    // 处理段落
    processed = processed.replace(/^(?!<[huolb])(.*)$/gm, (match, text) => {
      if (text.trim()) {
        return `<p class="my-2 text-gray-700 leading-relaxed">${text}</p>`
      }
      return ''
    })
    
    // 恢复代码块
    codeBlocks.forEach(({ id, lang, code }) => {
      const codeBlockHtml = `
        <div class="my-4 rounded-lg overflow-hidden bg-gray-900">
          <div class="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
            <span class="text-xs font-mono text-gray-400">${lang}</span>
          </div>
          <pre class="p-3 overflow-x-auto">
            <code class="text-sm font-mono text-gray-100 whitespace-pre-wrap">${escapeHtml(code.trim())}</code>
          </pre>
        </div>
      `
      processed = processed.replace(`__${id}__`, codeBlockHtml)
    })
    
    return processed
  }, [content])

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: renderContent }} 
    />
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default MarkdownRenderer
