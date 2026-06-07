import React, { useState, useEffect } from 'react'
import { Plus, Play, Pause, Settings, Trash2, Edit, Activity, Cpu, Code } from 'lucide-react'
// @ts-ignore - API modules will be implemented
import { agentApi } from '../services/api'
// @ts-ignore
import { skillRegistry } from '../services/skillSystem'
// @ts-ignore
import { mcpManager } from '../services/mcpSystem'

interface Agent {
  id: string
  name: string
  type: string
  description: string
  status: string
  skills: string[]
  tools: string[]
  createdAt: string
}

interface Session {
  id: string
  title: string
  masterAgent: string
  participatingAgents: string[]
  tasks: any[]
  status: string
}

const AgentManagement: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'agents' | 'sessions' | 'skills' | 'mcp'>('agents')
  
  const [showCreateAgent, setShowCreateAgent] = useState(false)
  const [newAgent, setNewAgent] = useState({
    name: '',
    type: 'custom',
    description: '',
    skills: [] as string[],
    tools: ['read_file', 'write_file']
  })
  
  const [skills, setSkills] = useState<any[]>([])
  const [mcpServers, setMcpServers] = useState<any[]>([])
  
  useEffect(() => {
    loadAgents()
    loadSkills()
    loadMcpServers()
  }, [])
  
  const loadAgents = async () => {
    try {
      const result = await agentApi.list()
      if (result.success) {
        setAgents(result.data)
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }
  
  const loadSkills = () => {
    const allSkills = skillRegistry.listSkills()
    setSkills(allSkills)
  }
  
  const loadMcpServers = () => {
    const servers = mcpManager.listServers()
    setMcpServers(servers)
  }
  
  const handleCreateAgent = async () => {
    try {
      const result = await agentApi.create(newAgent)
      if (result.success) {
        setShowCreateAgent(false)
        setNewAgent({ name: '', type: 'custom', description: '', skills: [], tools: ['read_file', 'write_file'] })
        loadAgents()
      }
    } catch (error) {
      console.error('Failed to create agent:', error)
    }
  }
  
  const handleDeleteAgent = async (id: string) => {
    if (window.confirm('确定要删除这个智能体吗？')) {
      try {
        await agentApi.delete(id)
        loadAgents()
      } catch (error) {
        console.error('Failed to delete agent:', error)
      }
    }
  }
  
  const toggleSkill = (id: string, enabled: boolean) => {
    if (enabled) {
      skillRegistry.disableSkill(id)
    } else {
      skillRegistry.enableSkill(id)
    }
    loadSkills()
  }
  
  const toggleMcpServer = (id: string, enabled: boolean) => {
    if (enabled) {
      mcpManager.disableServer(id)
    } else {
      mcpManager.enableServer(id)
    }
    loadMcpServers()
  }
  
  const connectMcpServer = async (id: string) => {
    try {
      await mcpManager.connectServer(id)
      loadMcpServers()
    } catch (error) {
      console.error('Failed to connect MCP server:', error)
    }
  }
  
  const getStatusBadge = (status: string) => {
    const colors = {
      idle: 'bg-green-100 text-green-800',
      busy: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      offline: 'bg-gray-100 text-gray-800',
      connected: 'bg-blue-100 text-blue-800',
      disconnected: 'bg-gray-100 text-gray-800',
      connecting: 'bg-purple-100 text-purple-800'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }
  
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="p-4 border-b bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">智能体系统</h1>
            <p className="text-sm text-gray-500 mt-1">管理和配置你的 AI 智能体</p>
          </div>
        </div>
      </div>
      
      <div className="border-b bg-white">
        <nav className="flex space-x-4 px-4">
          {[
            { id: 'agents', label: '智能体', icon: Cpu },
            { id: 'sessions', label: '协作会话', icon: Activity },
            { id: 'skills', label: '技能', icon: Code },
            { id: 'mcp', label: 'MCP 服务器', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'agents' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">智能体列表</h2>
              <button
                onClick={() => setShowCreateAgent(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span>创建智能体</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <div key={agent.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{agent.type}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(agent.status)}
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{agent.description}</p>
                  
                  {agent.skills.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1">技能:</p>
                      <div className="flex flex-wrap gap-1">
                        {agent.skills.slice(0, 3).map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                        {agent.skills.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            +{agent.skills.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-3 pt-3 border-t flex justify-end space-x-2">
                    <button className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
                      <Edit size={14} className="inline mr-1" />
                      配置
                    </button>
                    <button className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
                      <Play size={14} className="inline mr-1" />
                      启动
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'sessions' && (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">协作会话</h3>
            <p className="text-gray-500 mt-2">在这里管理智能体协作会话</p>
            <button
              onClick={() => {}}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} className="inline mr-2" />
              创建会话
            </button>
          </div>
        )}
        
        {activeTab === 'skills' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills.map((skill) => (
              <div key={skill.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{skill.category} • v{skill.version}</p>
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={(e) => toggleSkill(skill.id, skill.enabled)}
                      className="rounded border-gray-300"
                    />
                  </label>
                </div>
                
                <p className="text-sm text-gray-600 mt-2">{skill.description}</p>
                
                <div className="mt-3 pt-3 border-t">
                  <span className="text-xs text-gray-500">
                    {skill.enabled ? '已启用' : '已禁用'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {activeTab === 'mcp' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mcpServers.map((server) => (
                <div key={server.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{server.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{server.type}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(server.status)}
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={server.enabled}
                          onChange={(e) => toggleMcpServer(server.id, server.enabled)}
                          className="rounded border-gray-300"
                        />
                      </label>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-2">{server.description}</p>
                  
                  <div className="mt-3 pt-3 border-t flex justify-end space-x-2">
                    {server.status === 'disconnected' && server.enabled && (
                      <button
                        onClick={() => connectMcpServer(server.id)}
                        className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
                      >
                        <Play size={14} className="inline mr-1" />
                        连接
                      </button>
                    )}
                    {server.status === 'connected' && (
                      <button
                        onClick={() => mcpManager.disconnectServer(server.id)}
                        className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
                      >
                        <Pause size={14} className="inline mr-1" />
                        断开
                      </button>
                    )}
                    <button className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
                      <Settings size={14} className="inline mr-1" />
                      配置
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h4 className="font-medium text-blue-800 mb-2">MCP 服务器说明</h4>
              <p className="text-sm text-blue-700">
                MCP (Model Context Protocol) 服务器允许智能体连接到外部服务和工具。
                启用并连接服务器后，智能体可以使用服务器提供的工具。
              </p>
            </div>
          </div>
        )}
      </div>
      
      {showCreateAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">创建新智能体</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="输入智能体名称"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                <select
                  value={newAgent.type}
                  onChange={(e) => setNewAgent({ ...newAgent, type: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="custom">自定义</option>
                  <option value="lead">主负责人</option>
                  <option value="sub_lead">副负责人</option>
                  <option value="coder">工程师</option>
                  <option value="reviewer">审查员</option>
                  <option value="tester">测试员</option>
                  <option value="explorer">探索者</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="描述智能体的功能"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateAgent(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateAgent}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentManagement
