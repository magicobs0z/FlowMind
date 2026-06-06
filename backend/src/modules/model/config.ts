import { ProviderPreset } from './types'

// 官方预置服务商配置
export const providerPresets: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '深度求索 - 国产之光，全球开源第一',
    baseUrl: 'https://api.deepseek.com/v1',
    website: 'https://platform.deepseek.com',
    docsUrl: 'https://platform.deepseek.com/docs',
    icon: '🔮',
    color: '#4F46E5',
    protocol: 'openai',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V4', description: '最新旗舰模型，代码和推理能力顶尖', contextLength: '128K', capabilities: ['对话', '代码', '推理', '数学'], temperature: 0.7, topP: 0.9, maxTokens: 8192 },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', description: '推理专用模型', contextLength: '128K', capabilities: ['推理', '数学', '代码'], temperature: 0.6, topP: 0.95, maxTokens: 8192 },
      { id: 'deepseek-coder', name: 'DeepSeek-Coder', description: '代码专用模型', contextLength: '64K', capabilities: ['代码', '补全', '解释'], temperature: 0.2, topP: 0.95, maxTokens: 4096 },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: '全球领先 - GPT-5.5最新发布',
    baseUrl: 'https://api.openai.com/v1',
    website: 'https://platform.openai.com',
    docsUrl: 'https://platform.openai.com/docs',
    icon: '🅾️',
    color: '#10A37F',
    protocol: 'openai',
    models: [
      { id: 'gpt-5.5-turbo', name: 'GPT-5.5 Turbo', description: '最新旗舰，性能最强', contextLength: '256K', capabilities: ['对话', '视觉', '代码', '推理'], temperature: 0.7, topP: 0.9, maxTokens: 16384 },
      { id: 'gpt-4o', name: 'GPT-4o', description: '全能旗舰', contextLength: '128K', capabilities: ['对话', '视觉', '代码'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '轻量高效', contextLength: '128K', capabilities: ['对话', '代码'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'o3-mini', name: 'o3-mini', description: '推理专用', contextLength: '200K', capabilities: ['推理', '数学', '代码'], temperature: 0.3, topP: 0.95, maxTokens: 100000 },
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Mythos - 最强模型但限量开放',
    baseUrl: 'https://api.anthropic.com/v1',
    website: 'https://console.anthropic.com',
    docsUrl: 'https://docs.anthropic.com',
    icon: '🅰️',
    color: '#D97757',
    protocol: 'anthropic',
    models: [
      { id: 'claude-4-7-opus', name: 'Claude Opus 4.7', description: '最强模型，SWE-bench 90%+', contextLength: '200K', capabilities: ['推理', '代码', '创作', '视觉'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', description: '平衡性能与速度', contextLength: '200K', capabilities: ['对话', '代码', '分析'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: '极速响应', contextLength: '200K', capabilities: ['对话', '摘要'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
    ]
  },
  {
    id: 'qwen',
    name: 'Qwen',
    description: '通义千问 - 阿里云出品',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    website: 'https://dashscope.aliyun.com',
    docsUrl: 'https://help.aliyun.com/dashscope',
    icon: '☁️',
    color: '#FF6A00',
    protocol: 'openai',
    models: [
      { id: 'qwen3.6-plus', name: 'Qwen3.6-Plus', description: '最新旗舰模型', contextLength: '32K', capabilities: ['对话', '代码', '推理', '视觉'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'qwen-max', name: 'Qwen-Max', description: '最强版本', contextLength: '32K', capabilities: ['对话', '代码', '推理'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'qwen-plus', name: 'Qwen-Plus', description: '均衡选择', contextLength: '32K', capabilities: ['对话', '代码'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'qwen-turbo', name: 'Qwen-Turbo', description: '极速响应', contextLength: '32K', capabilities: ['对话', '摘要'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'qwen-coder', name: 'Qwen-Coder', description: '代码专用', contextLength: '32K', capabilities: ['代码', '补全'], temperature: 0.2, topP: 0.95, maxTokens: 4096 },
    ]
  },
  {
    id: 'zhipu',
    name: '智谱AI',
    description: 'GLM-5.5 最新模型',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    website: 'https://open.bigmodel.cn',
    docsUrl: 'https://open.bigmodel.cn/dev/howuse',
    icon: '🧠',
    color: '#4263F6',
    protocol: 'openai',
    models: [
      { id: 'glm-5.5-plus', name: 'GLM-5.5 Plus', description: '最新旗舰，多模态', contextLength: '128K', capabilities: ['对话', '代码', '推理', '视觉'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', description: '旗舰模型', contextLength: '128K', capabilities: ['对话', '代码', '推理'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'glm-4-air', name: 'GLM-4 Air', description: '高性价比', contextLength: '128K', capabilities: ['对话', '代码'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
    ]
  },
  {
    id: 'moonshot',
    name: '月之暗面',
    description: 'Kimi - 长文本专家',
    baseUrl: 'https://api.moonshot.cn/v1',
    website: 'https://platform.moonshot.cn',
    docsUrl: 'https://platform.moonshot.cn/docs',
    icon: '🌙',
    color: '#000000',
    protocol: 'openai',
    models: [
      { id: 'kimi-2.0-pro', name: 'Kimi 2.0 Pro', description: '最新版本', contextLength: '200K', capabilities: ['长文本', '对话', '代码'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'moonshot-v1-128k', name: 'Kimi-128k', description: '长文本专家', contextLength: '128K', capabilities: ['长文本', '对话', '代码'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
    ]
  },
  {
    id: 'baidu',
    name: '百度',
    description: '文心一言 - 国内巨头',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    website: 'https://qianfan.cloud.baidu.com',
    docsUrl: 'https://cloud.baidu.com/doc/WENXINWORKSHOP',
    icon: '🔍',
    color: '#2932E1',
    protocol: 'openai',
    models: [
      { id: 'ernie-4.5', name: '文心4.5', description: '最新旗舰', contextLength: '64K', capabilities: ['对话', '代码', '创作', '视觉'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'ernie-4.0', name: '文心4.0', description: '旗舰模型', contextLength: '8K', capabilities: ['对话', '代码', '创作'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
    ]
  },
  {
    id: 'volcengine',
    name: '字节跳动',
    description: '豆包 - 火山引擎',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    website: 'https://www.volcengine.com/product/doubao',
    docsUrl: 'https://www.volcengine.com/docs/82379',
    icon: '🎵',
    color: '#00D4AA',
    protocol: 'openai',
    models: [
      { id: 'doubao-2-pro', name: '豆包2 Pro', description: '最新版本', contextLength: '32K', capabilities: ['对话', '代码', '推理'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'doubao-pro', name: '豆包Pro', description: '专业版本', contextLength: '32K', capabilities: ['对话', '代码', '推理'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
    ]
  },
  {
    id: '01ai',
    name: '零一万物',
    description: 'Yi - 轻量高效',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    website: 'https://platform.lingyiwanwu.com',
    docsUrl: 'https://platform.lingyiwanwu.com/docs',
    icon: '0️⃣',
    color: '#1E40AF',
    protocol: 'openai',
    models: [
      { id: 'yi-large-2', name: 'Yi-Large 2.0', description: '最新旗舰', contextLength: '32K', capabilities: ['对话', '代码', '推理'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
      { id: 'yi-large', name: 'Yi-Large', description: '旗舰模型', contextLength: '32K', capabilities: ['对话', '代码', '推理'], temperature: 0.7, topP: 0.9, maxTokens: 4096 },
    ]
  },
]
