import { useState, useEffect } from 'react'
import { Settings, Cpu, MessageSquare, Workflow, Shield, Info, Plus, Trash2, CheckCircle2, Eye, Edit3, Bot, ChevronRight, ExternalLink, Search, X, Sparkles, Save } from 'lucide-react'
import { useAIStore } from '../../store'
import type { AIModel } from '../../store'
import { modelApi } from '../../services/api'
import AddModelModal from '../model/AddModelModal'

type SettingsTab = 'general' | 'mcp' | 'models' | 'flow' | 'rules' | 'agents' | 'about'

interface SettingsSection {
  key: SettingsTab
  label: string
  Icon: typeof Settings
}

const sections: SettingsSection[] = [
  { key: 'general', label: '通用', Icon: Settings },
  { key: 'models', label: 'AI模型', Icon: Cpu },
  { key: 'agents', label: '智能体', Icon: Bot },
  { key: 'flow', label: '对话流', Icon: MessageSquare },
  { key: 'mcp', label: 'MCP', Icon: Workflow },
  { key: 'rules', label: '命令规则', Icon: Shield },
  { key: 'about', label: '关于', Icon: Info },
]

interface ProviderModel {
  id: string
  name: string
  description: string
  baseUrl: string
  models: Array<{
    id: string
    name: string
    description: string
    contextLength: string
    capabilities: string[]
  }>
  website: string
  docsUrl: string
  icon: string
  color: string
}

const providers: ProviderModel[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '深度求索 - 国产之光，全球开源第一',
    baseUrl: 'https://api.deepseek.com/v1',
    website: 'https://platform.deepseek.com',
    docsUrl: 'https://platform.deepseek.com/docs',
    icon: '🔮',
    color: '#4F46E5',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V4', description: '最新旗舰模型，代码和推理能力顶尖', contextLength: '128K', capabilities: ['对话', '代码', '推理', '数学'] },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', description: '推理专用模型', contextLength: '128K', capabilities: ['推理', '数学', '代码'] },
      { id: 'deepseek-coder', name: 'DeepSeek-Coder', description: '代码专用模型', contextLength: '64K', capabilities: ['代码', '补全', '解释'] },
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
    models: [
      { id: 'gpt-5.5-turbo', name: 'GPT-5.5 Turbo', description: '最新旗舰，性能最强', contextLength: '256K', capabilities: ['对话', '视觉', '代码', '推理'] },
      { id: 'gpt-4o', name: 'GPT-4o', description: '全能旗舰', contextLength: '128K', capabilities: ['对话', '视觉', '代码'] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '轻量高效', contextLength: '128K', capabilities: ['对话', '代码'] },
      { id: 'o3-mini', name: 'o3-mini', description: '推理专用', contextLength: '200K', capabilities: ['推理', '数学', '代码'] },
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
    models: [
      { id: 'claude-4-7-opus', name: 'Claude Opus 4.7', description: '最强模型，SWE-bench 90%+', contextLength: '200K', capabilities: ['推理', '代码', '创作', '视觉'] },
      { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', description: '平衡性能与速度', contextLength: '200K', capabilities: ['对话', '代码', '分析'] },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: '极速响应', contextLength: '200K', capabilities: ['对话', '摘要'] },
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
    models: [
      { id: 'qwen3.6-plus', name: 'Qwen3.6-Plus', description: '最新旗舰模型', contextLength: '32K', capabilities: ['对话', '代码', '推理', '视觉'] },
      { id: 'qwen-max', name: 'Qwen-Max', description: '最强版本', contextLength: '32K', capabilities: ['对话', '代码', '推理'] },
      { id: 'qwen-plus', name: 'Qwen-Plus', description: '均衡选择', contextLength: '32K', capabilities: ['对话', '代码'] },
      { id: 'qwen-turbo', name: 'Qwen-Turbo', description: '极速响应', contextLength: '32K', capabilities: ['对话', '摘要'] },
      { id: 'qwen-coder', name: 'Qwen-Coder', description: '代码专用', contextLength: '32K', capabilities: ['代码', '补全'] },
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
    models: [
      { id: 'glm-5.5-plus', name: 'GLM-5.5 Plus', description: '最新旗舰，多模态', contextLength: '128K', capabilities: ['对话', '代码', '推理', '视觉'] },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', description: '旗舰模型', contextLength: '128K', capabilities: ['对话', '代码', '推理'] },
      { id: 'glm-4-air', name: 'GLM-4 Air', description: '高性价比', contextLength: '128K', capabilities: ['对话', '代码'] },
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
    models: [
      { id: 'kimi-2.0-pro', name: 'Kimi 2.0 Pro', description: '最新版本', contextLength: '200K', capabilities: ['长文本', '对话', '代码'] },
      { id: 'moonshot-v1-128k', name: 'Kimi-128k', description: '长文本专家', contextLength: '128K', capabilities: ['长文本', '对话', '代码'] },
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
    models: [
      { id: 'ernie-4.5', name: '文心4.5', description: '最新旗舰', contextLength: '64K', capabilities: ['对话', '代码', '创作', '视觉'] },
      { id: 'ernie-4.0', name: '文心4.0', description: '旗舰模型', contextLength: '8K', capabilities: ['对话', '代码', '创作'] },
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
    models: [
      { id: 'doubao-2-pro', name: '豆包2 Pro', description: '最新版本', contextLength: '32K', capabilities: ['对话', '代码', '推理'] },
      { id: 'doubao-pro', name: '豆包Pro', description: '专业版本', contextLength: '32K', capabilities: ['对话', '代码', '推理'] },
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
    models: [
      { id: 'yi-large-2', name: 'Yi-Large 2.0', description: '最新旗舰', contextLength: '32K', capabilities: ['对话', '代码', '推理'] },
      { id: 'yi-large', name: 'Yi-Large', description: '旗舰模型', contextLength: '32K', capabilities: ['对话', '代码', '推理'] },
    ]
  },
  {
    id: 'custom',
    name: '自定义',
    description: 'OpenAI兼容接口',
    baseUrl: '',
    website: '',
    docsUrl: '',
    icon: '⚙️',
    color: '#6B7280',
    models: [
      { id: 'custom', name: '自定义模型', description: '手动配置模型名', contextLength: '自定义', capabilities: ['自定义'] },
    ]
  },
]

interface AgentConfig {
  id: string
  name: string
  role: string
  icon: string
  description: string
  systemPrompt: string
  capabilities: string[]
  isBuiltin: boolean
  isActive: boolean
}

const builtinAgents: AgentConfig[] = [
  {
    id: 'product-manager',
    name: '产品经理',
    role: 'Product Manager',
    icon: '📋',
    description: '分析需求，制定产品规格和开发计划',
    capabilities: ['需求分析', '产品规划', '用户故事', 'PRD编写'],
    isBuiltin: true,
    isActive: true,
    systemPrompt: `你是 FlowMind 团队的产品经理 Agent。\n\n你的职责：\n1. 深入理解用户需求，将模糊需求转化为清晰、可执行的产品规格\n2. 编写详细的 PRD（产品需求文档）和用户故事\n3. 制定开发优先级和里程碑计划\n4. 协调团队内各角色的工作分配\n\n工作原则：\n- 始终从用户价值出发思考问题\n- 需求必须具体、可衡量、可实现、相关、有时限（SMART原则）\n- 优先聚焦核心 MVP 功能，再考虑扩展功能\n- 与架构师和工程师紧密协作，确保需求的技术可行性\n\n输出格式：\n- 使用清晰的标题和列表组织内容\n- 用户故事按"作为X，我希望Y，以便Z"格式\n- 验收标准必须具体可测试\n\n现在，请协助完成你的工作。`,
  },
  {
    id: 'architect',
    name: '架构师',
    role: 'System Architect',
    icon: '🏗️',
    description: '设计系统架构、技术选型和模块划分',
    capabilities: ['架构设计', '技术选型', '模块划分', '接口设计'],
    isBuiltin: true,
    isActive: true,
    systemPrompt: `你是 FlowMind 团队的系统架构师 Agent。\n\n你的职责：\n1. 根据产品需求设计系统整体架构\n2. 选择合适的技术栈和框架\n3. 划分模块、定义接口和数据结构\n4. 确保系统的可扩展性、可维护性和性能\n5. 编写架构设计文档和技术方案\n\n架构原则：\n- KISS 原则：保持简单，避免过度设计\n- SOLID 原则：单一职责、开闭原则、里氏替换、接口隔离、依赖倒置\n- 关注点分离：前端/后端/数据层职责清晰\n- 优先使用成熟、文档完善的技术栈\n\n技术方案输出格式：\n1. 技术选型（原因分析）\n2. 系统架构图（文字描述或 mermaid）\n3. 模块划分\n4. API 接口定义\n5. 数据结构设计\n\n现在，请协助完成架构设计工作。`,
  },
  {
    id: 'engineer',
    name: '工程师',
    role: 'Software Engineer',
    icon: '💻',
    description: '编写高质量代码，实现功能需求',
    capabilities: ['代码编写', '功能实现', 'Bug修复', '单元测试'],
    isBuiltin: true,
    isActive: true,
    systemPrompt: `你是 FlowMind 团队的软件工程师 Agent。\n\n你的职责：\n1. 根据需求和架构设计编写高质量的代码\n2. 实现功能模块，确保代码正确性和可维护性\n3. 编写充分的单元测试\n4. 遵循团队的代码规范和最佳实践\n\n代码规范：\n- 优先使用 TypeScript，确保类型安全\n- 代码必须清晰、可读、自注释\n- 使用现代 ES6+ 语法\n- 函数和变量名应该清楚表达意图\n- 错误处理要完善，考虑边界情况\n- 代码注释使用中文\n\n文件操作：\n- 使用 read_file 读取现有文件\n- 使用 write_file 创建新文件或完全重写\n- 使用 search_replace 精确修改部分代码\n- 每次修改前，先读取文件了解现有结构\n\n现在，请开始编码工作。`,
  },
  {
    id: 'tester',
    name: '测试工程师',
    role: 'QA Engineer',
    icon: '🧪',
    description: '编写测试用例，执行测试，确保质量',
    capabilities: ['测试用例', '自动化测试', 'Bug报告', '性能测试'],
    isBuiltin: true,
    isActive: true,
    systemPrompt: `你是 FlowMind 团队的测试工程师 Agent。\n\n你的职责：\n1. 根据需求编写全面的测试用例\n2. 执行功能测试、集成测试和回归测试\n3. 发现和报告 Bug，提供清晰的复现步骤\n4. 推动测试自动化\n\n测试原则：\n- 测试用例必须覆盖正常场景和异常场景\n- 边界条件必须充分测试\n- Bug报告要包含：复现步骤、预期结果、实际结果\n- 优先测试核心功能\n\n现在，请协助完成测试工作。`,
  },
  {
    id: 'reviewer',
    name: '代码审查员',
    role: 'Code Reviewer',
    icon: '🔍',
    description: '审查代码质量、安全性和最佳实践',
    capabilities: ['代码审查', '安全审计', '性能优化', '规范检查'],
    isBuiltin: true,
    isActive: true,
    systemPrompt: `你是 FlowMind 团队的代码审查员 Agent。\n\n你的职责：\n1. 审查代码质量和编码规范\n2. 检查安全漏洞和潜在风险\n3. 提出性能优化建议\n4. 确保代码符合最佳实践\n\n审查标准：\n- 代码的可读性和可维护性\n- 安全性：检查注入风险、XSS、CSRF等\n- 性能：算法复杂度、内存使用、避免不必要的计算\n- 完善的错误处理和边界条件处理\n- 类型安全和空值检查\n- 充分的测试覆盖\n\n审查反馈要具体、建设性、可操作。\n\n现在，请开始代码审查。`,
  },
  {
    id: 'devops',
    name: '运维工程师',
    role: 'DevOps Engineer',
    icon: '⚙️',
    description: '部署、监控和维护系统',
    capabilities: ['CI/CD', '部署脚本', '监控配置', '容器化'],
    isBuiltin: true,
    isActive: true,
    systemPrompt: `你是 FlowMind 团队的运维工程师 Agent。\n\n你的职责：\n1. 设计和维护 CI/CD 流水线\n2. 管理部署和发布流程\n3. 配置监控和告警\n4. 优化基础设施和成本\n\n工作原则：\n- 自动化一切可自动化的任务\n- 确保部署流程可靠和可回滚\n- 监控关键指标，提前发现问题\n- 文档化所有运维流程\n\n现在，请协助完成运维工作。`,
  },
]

function GeneralSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">界面设置</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">自动保存</p>
              <p className="text-xs text-gray-400">编辑文件时自动保存更改</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]"></div>
            </label>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">显示行号</p>
              <p className="text-xs text-gray-400">在代码编辑器中显示行号</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]"></div>
            </label>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">安全设置</h3>
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">工作区限制</p>
              <p className="text-xs text-gray-400">AI只能修改当前工作区内的文件</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]"></div>
            </label>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">危险操作确认</p>
              <p className="text-xs text-gray-400">删除文件等操作需要二次确认</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModelSettings() {
  const { models, deleteModel, setModels } = useAIStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 从后端加载模型配置
  const loadModels = async () => {
    setIsLoading(true)
    try {
      const res = await modelApi.list()
      if (res.success && res.data) {
        // 转换为前端格式
        const frontendModels: AIModel[] = res.data.map((m: any) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          type: m.type,
          apiKey: m.apiKey,
          baseUrl: m.baseUrl,
          modelName: m.modelName,
          icon: m.icon,
          isDefault: m.isDefault,
        }))
        setModels(frontendModels)
      }
    } catch (e) {
      console.error('Failed to load models', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  const handleAddSuccess = async () => {
    await loadModels()
    setShowAddModal(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await modelApi.delete(id)
      deleteModel(id)
    } catch (e) {
      console.error('Failed to delete model', e)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await modelApi.update(id, { isDefault: true })
      setModels(models.map(m => ({ ...m, isDefault: m.id === id })))
    } catch (e) {
      console.error('Failed to set default model', e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">AI模型配置</h3>
          <p className="text-xs text-gray-500 mt-1">支持国内国际主流模型，2025-2026最新版</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--flowmind-primary)] text-white rounded-lg hover:bg-[var(--flowmind-primary-hover)] transition-colors"
        >
          <Plus size={16} />
          添加模型
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--flowmind-primary)] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Cpu size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 font-medium mb-2">暂无配置的AI模型</p>
          <p className="text-xs text-gray-400 mb-4">点击上方按钮添加模型，支持 DeepSeek、GPT-5.5、Claude 4等最新模型</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-sm bg-[var(--flowmind-primary)] text-white rounded-lg hover:bg-[var(--flowmind-primary-hover)]"
          >
            立即添加
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {models.map(model => (
            <div key={model.id} className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Sparkles size={20} className="text-[var(--flowmind-primary)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{model.name}</span>
                      {model.isDefault && (
                        <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-600 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          默认
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{model.provider} • {model.modelName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!model.isDefault && (
                    <button
                      onClick={() => handleSetDefault(model.id)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      设为默认
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(model.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddModelModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}

function AgentsSettings() {
  const [agents, setAgents] = useState<AgentConfig[]>(builtinAgents)
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailAgent, setDetailAgent] = useState<AgentConfig | null>(null)

  const toggleAgent = (id: string) => {
    setAgents(agents.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a))
  }

  const handleEdit = (agent: AgentConfig) => {
    setEditingAgent({ ...agent })
    setShowEditModal(true)
  }

  const handleSaveEdit = () => {
    if (!editingAgent) return
    setAgents(agents.map(a => a.id === editingAgent.id ? editingAgent : a))
    setShowEditModal(false)
    setEditingAgent(null)
  }

  const handleViewDetail = (agent: AgentConfig) => {
    setDetailAgent(agent)
    setShowDetailModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">AI员工管理</h3>
          <p className="text-xs text-gray-500 mt-1">智能体统一使用对话中选择的模型，无需单独配置</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            已启用 {agents.filter(a => a.isActive).length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            已禁用 {agents.filter(a => !a.isActive).length}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">智能体</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">角色</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">专长</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={agent.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${!agent.isActive ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{agent.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{agent.name}</p>
                        <p className="text-xs text-gray-500">{agent.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600">{agent.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.map(cap => (
                        <span key={cap} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{cap}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAgent(agent.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        agent.isActive ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        agent.isActive ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleViewDetail(agent)}
                        className="p-1.5 hover:bg-gray-200 rounded text-gray-500"
                        title="查看系统提示词"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleEdit(agent)}
                        className="p-1.5 hover:bg-gray-200 rounded text-gray-500"
                        title="编辑"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDetailModal && detailAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{detailAgent.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-800">{detailAgent.name}</h3>
                  <p className="text-xs text-gray-500">{detailAgent.role}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">专长</p>
                <div className="flex flex-wrap gap-1">
                  {detailAgent.capabilities.map(cap => (
                    <span key={cap} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded">{cap}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">系统提示词</p>
                <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {detailAgent.systemPrompt}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{editingAgent.icon}</span>
                <h3 className="font-semibold text-gray-800">编辑 {editingAgent.name}</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">系统提示词</label>
                <textarea
                  value={editingAgent.systemPrompt}
                  onChange={(e) => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--flowmind-primary)] text-sm font-mono resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--flowmind-primary)] text-white rounded-lg hover:bg-[var(--flowmind-primary-hover)]"
              >
                <Save size={16} />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FlowSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">对话流设置</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">流式响应</p>
              <p className="text-xs text-gray-400">AI 回答时逐字显示</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]"></div>
            </label>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-gray-700">自动滚动</p>
              <p className="text-xs text-gray-400">新消息自动滚动到底部</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

function MCPSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">MCP 设置</h3>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">MCP (Model Context Protocol)</p>
          <p className="text-xs text-gray-500">配置 MCP 服务器连接，扩展 AI 能力</p>
        </div>
      </div>
    </div>
  )
}

function RulesSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">命令规则</h3>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">安全命令白名单</p>
          <p className="text-xs text-gray-500">配置 AI 可以执行的命令范围</p>
        </div>
      </div>
    </div>
  )
}

function AboutSettings() {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-xl bg-[var(--flowmind-primary)] flex items-center justify-center mx-auto mb-4">
          <Sparkles size={32} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">FlowMind</h3>
        <p className="text-sm text-gray-500 mt-1">AI 编程助手</p>
        <p className="text-xs text-gray-400 mt-4">版本 0.1.0</p>
      </div>
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500 text-center">FlowMind 是一个 AI 编程助手，帮助开发者更高效地编写代码。</p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('models')

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />
      case 'models':
        return <ModelSettings />
      case 'agents':
        return <AgentsSettings />
      case 'flow':
        return <FlowSettings />
      case 'mcp':
        return <MCPSettings />
      case 'rules':
        return <RulesSettings />
      case 'about':
        return <AboutSettings />
      default:
        return null
    }
  }

  return (
    <div className="h-full flex">
      <div className="w-48 border-r border-gray-200 bg-white">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">设置</h2>
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveTab(section.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === section.key
                    ? 'bg-[var(--flowmind-primary)]/10 text-[var(--flowmind-primary)] font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <section.Icon size={16} />
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
