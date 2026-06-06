// 提示词类型定义
export interface Prompt {
  agentType: string
  content: string
  version: string
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown>
}

export interface AgentPrompt {
  id: string
  agentType: 'lead' | 'sub_lead' | 'coder' | 'reviewer' | 'tester' | 'explorer' | 'custom'
  content: string
  version: string
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

// 提示词配置接口
export interface PromptConfig {
  [key: string]: {
    name: string
    description: string
    skills: string[]
  }
}
