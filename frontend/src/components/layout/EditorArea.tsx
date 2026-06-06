import { useCallback, useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useTabStore } from '../../store'
import { workspaceApi } from '../../services/api'
import SettingsPage from './SettingsPage'
import BlueprintEditor from './BlueprintEditor'
import TerminalPanel from './TerminalPanel'

export default function EditorArea() {
  const { tabs, activeTabId, updateTabContent, markTabDirty } = useTabStore()
  const [isLoading, setIsLoading] = useState(false)

  const activeTab = tabs.find((t) => t.id === activeTabId)

  useEffect(() => {
    if (activeTab?.type === 'file' && activeTab.path && !activeTab.content) {
      setIsLoading(true)
      workspaceApi.readFile(activeTab.path)
        .then((response) => {
          if (response.success) {
            updateTabContent(activeTab.id, response.data.content)
          }
        })
        .catch(() => {
          updateTabContent(activeTab.id, '// 无法加载文件内容')
        })
        .finally(() => setIsLoading(false))
    }
  }, [activeTab, updateTabContent])

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeTab && value !== undefined) {
        updateTabContent(activeTab.id, value)
        markTabDirty(activeTab.id, true)
      }
    },
    [activeTab, updateTabContent, markTabDirty]
  )

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p className="text-sm">没有打开的文件</p>
      </div>
    )
  }

  if (activeTab.type === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--flowmind-primary)]/10 flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--flowmind-primary)" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">FlowMind</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          多智能体协作开发平台。打开一个项目开始工作，或使用 AI 助手获取帮助。
        </p>
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="p-3 rounded-lg bg-gray-50" style={{ border: '1px solid #f0f0f0' }}>
            <p className="text-xs font-medium text-gray-700 mb-1">打开项目</p>
            <p className="text-[11px] text-gray-400">从文件浏览器加载本地项目</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50" style={{ border: '1px solid #f0f0f0' }}>
            <p className="text-xs font-medium text-gray-700 mb-1">AI 助手</p>
            <p className="text-[11px] text-gray-400">使用智能助手编写和优化代码</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50" style={{ border: '1px solid #f0f0f0' }}>
            <p className="text-xs font-medium text-gray-700 mb-1">蓝图编排</p>
            <p className="text-[11px] text-gray-400">可视化设计和执行工作流</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50" style={{ border: '1px solid #f0f0f0' }}>
            <p className="text-xs font-medium text-gray-700 mb-1">DAG 管理</p>
            <p className="text-[11px] text-gray-400">管理任务依赖和执行状态</p>
          </div>
        </div>
      </div>
    )
  }

  if (activeTab.type === 'settings') {
    return <SettingsPage />
  }

  if (activeTab.type === 'file') {
    return (
      <div className="h-full flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-[var(--flowmind-primary)] rounded-full animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          </div>
        ) : (
          <Editor
            height="100%"
            language={activeTab.language || 'plaintext'}
            value={activeTab.content || ''}
            onChange={handleEditorChange}
            theme="vs"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
            }}
            loading={
              <div className="flex items-center justify-center h-full">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-[var(--flowmind-primary)] rounded-full animate-spin" />
              </div>
            }
          />
        )}
      </div>
    )
  }

  if (activeTab.type === 'blueprint') {
    return <BlueprintEditor blueprintId={activeTab.id} />
  }

  if (activeTab.type === 'dag') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">DAG 可视化</p>
          <p className="text-xs text-gray-400">任务依赖图</p>
        </div>
      </div>
    )
  }

  if (activeTab.type === 'diff') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">代码差异</p>
          <p className="text-xs text-gray-400">使用 react-diff-view 查看差异</p>
        </div>
      </div>
    )
  }

  if (activeTab.type === 'terminal') {
    return <TerminalPanel />
  }

  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <p className="text-sm">未知标签类型</p>
    </div>
  )
}
