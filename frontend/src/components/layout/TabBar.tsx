import { X, FileCode, Workflow, GitCompare, Home } from 'lucide-react'
import { useTabStore } from '../../store'

const tabIcons: Record<string, typeof FileCode> = {
  file: FileCode,
  blueprint: Workflow,
  dag: Workflow,
  diff: GitCompare,
  welcome: Home,
}

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore()

  return (
    <div className="flex items-center border-b overflow-x-auto" style={{ borderColor: 'var(--flowmind-border)', background: 'var(--flowmind-bg)' }}>
      {tabs.map((tab) => {
        const Icon = tabIcons[tab.type] || FileCode
        const isActive = activeTabId === tab.id

        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r transition-colors min-w-fit ${
              isActive
                ? 'bg-white text-[var(--flowmind-text)] border-t-2 border-t-[var(--flowmind-primary)]'
                : 'text-gray-500 hover:bg-gray-50 border-t-2 border-t-transparent'
            }`}
            style={{ borderColor: 'var(--flowmind-border)' }}
          >
            <Icon size={13} />
            <span className="truncate max-w-[120px]">{tab.title}</span>
            {tab.isDirty && <span className="text-[var(--flowmind-primary)]">●</span>}
            {tab.type !== 'welcome' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                className="ml-1 p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={11} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
