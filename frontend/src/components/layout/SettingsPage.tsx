import { useState } from 'react'
import { Settings, Cpu, MessageSquare, Workflow, Shield, Info, ChevronRight } from 'lucide-react'

type SettingsTab = 'general' | 'mcp' | 'models' | 'flow' | 'rules' | 'about'

interface SettingsSection {
  key: SettingsTab
  label: string
  Icon: typeof Settings
}

const sections: SettingsSection[] = [
  { key: 'general', label: '通用', Icon: Settings },
  { key: 'mcp', label: 'MCP', Icon: Cpu },
  { key: 'models', label: '模型', Icon: Cpu },
  { key: 'flow', label: '对话流', Icon: MessageSquare },
  { key: 'rules', label: '命令规则与记忆', Icon: Shield },
  { key: 'about', label: '关于', Icon: Info },
]

/** 通用设置 */
function GeneralSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">界面设置</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">自动保存</p>
              <p className="text-[11px] text-gray-400">编辑文件时自动保存更改</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]" />
            </label>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">显示行号</p>
              <p className="text-[11px] text-gray-400">在代码编辑器中显示行号</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]" />
            </label>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">深色模式</p>
              <p className="text-[11px] text-gray-400">切换深色/浅色主题</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]" />
            </label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">编辑器设置</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">字体大小</p>
              <p className="text-[11px] text-gray-400">编辑器字体大小</p>
            </div>
            <select className="text-xs bg-gray-100 rounded px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-[var(--flowmind-primary)]">
              <option>12px</option>
              <option selected>13px</option>
              <option>14px</option>
              <option>15px</option>
              <option>16px</option>
            </select>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">制表符宽度</p>
              <p className="text-[11px] text-gray-400">缩进使用的空格数</p>
            </div>
            <select className="text-xs bg-gray-100 rounded px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-[var(--flowmind-primary)]">
              <option>2</option>
              <option selected>4</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

/** MCP 设置 */
function McpSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">MCP 服务</h3>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-2">MCP（Model Context Protocol）允许 AI 模型与外部工具和服务交互。</p>
          <button className="text-xs px-3 py-1.5 bg-[var(--flowmind-primary)] text-white rounded hover:bg-[var(--flowmind-primary-hover)] transition-colors">
            添加 MCP 服务
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-700">文件系统 MCP</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full">已连接</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <span className="text-sm text-gray-700">Git MCP</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">未连接</span>
        </div>
      </div>
    </div>
  )
}

/** 模型设置 */
function ModelsSettings() {
  const models = [
    { name: 'Qwen3.6-Plus', provider: '阿里云', status: 'active', key: 'qwen3.6-plus' },
    { name: 'GPT-4', provider: 'OpenAI', status: 'inactive', key: 'gpt-4' },
    { name: 'Claude 3', provider: 'Anthropic', status: 'inactive', key: 'claude-3' },
    { name: 'Llama 3', provider: 'Meta', status: 'inactive', key: 'llama-3' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">模型配置</h3>
        <div className="space-y-2">
          {models.map((m) => (
            <div key={m.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-700">{m.name}</p>
                <p className="text-[11px] text-gray-400">{m.provider}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  m.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {m.status === 'active' ? '默认' : '未启用'}
                </span>
                <button className="p-1 rounded hover:bg-gray-200 text-gray-500">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">API 密钥</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">OpenAI API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              className="w-full text-xs px-3 py-2 bg-gray-100 rounded border-0 focus:outline-none focus:ring-1 focus:ring-[var(--flowmind-primary)]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Anthropic API Key</label>
            <input
              type="password"
              placeholder="sk-ant-..."
              className="w-full text-xs px-3 py-2 bg-gray-100 rounded border-0 focus:outline-none focus:ring-1 focus:ring-[var(--flowmind-primary)]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** 对话流设置 */
function FlowSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">对话流配置</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">流式输出</p>
              <p className="text-[11px] text-gray-400">AI 回复实时流式显示</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]" />
            </label>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">自动上下文</p>
              <p className="text-[11px] text-gray-400">自动包含相关文件到对话上下文</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]" />
            </label>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">最大上下文长度</p>
              <p className="text-[11px] text-gray-400">保留的最大消息轮数</p>
            </div>
            <select className="text-xs bg-gray-100 rounded px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-[var(--flowmind-primary)]">
              <option>10</option>
              <option selected>20</option>
              <option>50</option>
              <option>100</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 命令规则与记忆 */
function RulesSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">命令规则</h3>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-2">自定义 AI 的行为规则和约束条件。</p>
          <textarea
            className="w-full text-xs px-3 py-2 bg-white rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[var(--flowmind-primary)] resize-none"
            rows={6}
            placeholder="例如：
- 始终使用 TypeScript
- 优先使用函数式编程
- 代码注释使用中文"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">项目记忆</h3>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-2">AI 对项目的长期记忆和知识库。</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-white rounded">
              <span className="text-xs text-gray-600">技术栈：React 19 + TypeScript + Express</span>
              <button className="text-[10px] text-red-500 hover:text-red-600">删除</button>
            </div>
            <div className="flex items-center justify-between p-2 bg-white rounded">
              <span className="text-xs text-gray-600">编码规范：Biome 格式化</span>
              <button className="text-[10px] text-red-500 hover:text-red-600">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 关于页面 */
function AboutSettings() {
  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--flowmind-primary)]/10 flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--flowmind-primary)" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">FlowMind</h2>
        <p className="text-xs text-gray-500 mt-1">多智能体协作开发平台</p>
        <p className="text-[11px] text-gray-400 mt-0.5">版本 1.0.0</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-600">前端框架</span>
          <span className="text-xs text-gray-500">React 19 + Vite</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-600">后端框架</span>
          <span className="text-xs text-gray-500">Express + TypeScript</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-600">状态管理</span>
          <span className="text-xs text-gray-500">Zustand</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-600">代码编辑器</span>
          <span className="text-xs text-gray-500">Monaco Editor</span>
        </div>
      </div>

      <div className="pt-4 border-t">
        <p className="text-[11px] text-gray-400 text-center">
          FlowMind 2025. 基于 MIT 许可证开源。
        </p>
      </div>
    </div>
  )
}

/** 设置页面主组件 */
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsTab>('general')

  const renderContent = () => {
    switch (activeSection) {
      case 'general': return <GeneralSettings />
      case 'mcp': return <McpSettings />
      case 'models': return <ModelsSettings />
      case 'flow': return <FlowSettings />
      case 'rules': return <RulesSettings />
      case 'about': return <AboutSettings />
      default: return <GeneralSettings />
    }
  }

  return (
    <div className="flex h-full bg-white">
      {/* 左侧导航 */}
      <div className="w-48 flex-shrink-0 border-r" style={{ borderColor: '#f0f0f0' }}>
        <div className="p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">设置</h2>
          <div className="space-y-0.5">
            {sections.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === key
                    ? 'bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          {sections.find((s) => s.key === activeSection)?.label}
        </h2>
        {renderContent()}
      </div>
    </div>
  )
}
