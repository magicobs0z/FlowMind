export interface ModelConfig {
  id: string
  name: string
  provider: string
  type: 'llm' | 'custom'
  apiKey: string
  baseUrl: string
  modelName: string
  icon?: string
  isDefault: boolean
  // 高级参数
  temperature?: number
  topP?: number
  maxTokens?: number
  contextWindow?: number
  // 自定义配置特有
  protocol?: 'openai' | 'anthropic'
  useFullUrl?: boolean
  fullUrl?: string
  // 元数据
  createdAt: string
  updatedAt: string
}

export interface ProviderPreset {
  id: string
  name: string
  description: string
  baseUrl: string
  website: string
  docsUrl: string
  icon: string
  color: string
  protocol: 'openai' | 'anthropic'
  models: Array<{
    id: string
    name: string
    description: string
    contextLength: string
    capabilities: string[]
    temperature?: number
    topP?: number
    maxTokens?: number
  }>
}
