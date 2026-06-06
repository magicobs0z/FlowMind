import { useState, useEffect } from 'react'
import { X, ChevronRight, ExternalLink, Search, CheckCircle2, AlertCircle, Loader2, Sparkles, Settings, ArrowLeft } from 'lucide-react'
import { modelApi } from '../../services/api'

interface ProviderPreset {
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

interface AddModelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type Step = 'provider' | 'model' | 'config' | 'testing' | 'result'
type Branch = 'preset' | 'custom'

export default function AddModelModal({ isOpen, onClose, onSuccess }: AddModelModalProps) {
  const [step, setStep] = useState<Step>('provider')
  const [branch, setBranch] = useState<Branch>('preset')
  const [providers, setProviders] = useState<ProviderPreset[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderPreset | null>(null)
  const [selectedPresetModel, setSelectedPresetModel] = useState<ProviderPreset['models'][0] | null>(null)
  const [useCustomModelId, setUseCustomModelId] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ connected: boolean; error?: string } | null>(null)

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    modelId: '',
    apiKey: '',
    baseUrl: '',
    protocol: 'openai' as 'openai' | 'anthropic',
    useFullUrl: false,
    fullUrl: '',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096,
    contextWindow: 128000,
    isDefault: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      loadProviders()
    }
  }, [isOpen])

  const loadProviders = async () => {
    try {
      const res = await modelApi.getProviders()
      if (res.success) {
        setProviders(res.data)
      }
    } catch (e) {
      console.error('Failed to load providers', e)
    }
  }

  const resetForm = () => {
    setStep('provider')
    setBranch('preset')
    setSelectedProvider(null)
    setSelectedPresetModel(null)
    setUseCustomModelId(false)
    setSearchQuery('')
    setTestResult(null)
    setErrors({})
    setFormData({
      name: '',
      modelId: '',
      apiKey: '',
      baseUrl: '',
      protocol: 'openai',
      useFullUrl: false,
      fullUrl: '',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 4096,
      contextWindow: 128000,
      isDefault: false,
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.modelId.trim()) {
      newErrors.modelId = '模型ID不能为空'
    }
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'API Key不能为空'
    }
    if (branch === 'custom') {
      if (!formData.name.trim()) {
        newErrors.name = '模型别名不能为空'
      }
      if (formData.useFullUrl) {
        if (!formData.fullUrl.trim()) {
          newErrors.fullUrl = '完整URL不能为空'
        } else if (!formData.fullUrl.startsWith('http')) {
          newErrors.fullUrl = 'URL格式不正确'
        }
      } else {
        if (!formData.baseUrl.trim()) {
          newErrors.baseUrl = '接口地址不能为空'
        } else if (!formData.baseUrl.startsWith('http')) {
          newErrors.baseUrl = 'URL格式不正确'
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleTestConnection = async () => {
    if (!validateForm()) return

    setStep('testing')
    setIsLoading(true)
    setTestResult(null)

    try {
      const baseUrl = formData.useFullUrl ? formData.fullUrl : formData.baseUrl
      const res = await modelApi.testConnection({
        apiKey: formData.apiKey,
        baseUrl,
        modelName: formData.modelId,
        protocol: formData.protocol,
      })

      if (res.success) {
        setTestResult(res.data)
        if (res.data.connected) {
          // 自动保存
          await handleSave(true)
        } else {
          setStep('result')
        }
      }
    } catch (e: any) {
      setTestResult({ connected: false, error: e.message || '测试失败' })
      setStep('result')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (skipTest = false) => {
    if (!skipTest && !validateForm()) return

    const baseUrl = formData.useFullUrl ? formData.fullUrl : formData.baseUrl

    try {
      const res = await modelApi.create({
        name: formData.name || selectedPresetModel?.name || formData.modelId,
        provider: selectedProvider?.name || '自定义',
        type: 'llm',
        apiKey: formData.apiKey,
        baseUrl,
        modelName: formData.modelId,
        isDefault: formData.isDefault,
        temperature: formData.temperature,
        topP: formData.topP,
        maxTokens: formData.maxTokens,
        contextWindow: formData.contextWindow,
        protocol: formData.protocol,
        useFullUrl: formData.useFullUrl,
        fullUrl: formData.fullUrl,
      })

      if (res.success) {
        if (!skipTest) {
          setTestResult({ connected: true })
          setStep('result')
        }
        onSuccess()
      }
    } catch (e: any) {
      setTestResult({ connected: false, error: e.message || '保存失败' })
      setStep('result')
    }
  }

  const filteredProviders = searchQuery
    ? providers.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.models.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : providers

  const updateForm = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors(prev => { const next = { ...prev }; delete next[key]; return next })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">
              {step === 'provider' && '添加模型'}
              {step === 'model' && '选择模型'}
              {step === 'config' && '配置参数'}
              {step === 'testing' && '连通性测试'}
              {step === 'result' && (testResult?.connected ? '添加成功' : '添加失败')}
            </h3>
            <div className="flex items-center gap-1 mt-1">
              {['provider', 'model', 'config', 'testing'].map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    step === s ? 'bg-[var(--flowmind-primary)] text-white' :
                    ['testing', 'result'].includes(step) && ['provider', 'model', 'config'].indexOf(s) < ['provider', 'model', 'config'].indexOf(step === 'testing' || step === 'result' ? 'config' : step) ? 'bg-green-100 text-green-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}. {s === 'provider' ? '服务商' : s === 'model' ? '模型' : s === 'config' ? '配置' : '测试'}
                  </span>
                  {i < 3 && <ChevronRight size={12} className="text-gray-300" />}
                </span>
              ))}
            </div>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 1: Provider Selection */}
          {step === 'provider' && (
            <div className="space-y-4">
              {/* Branch Selection */}
              <div className="flex gap-3">
                <button
                  onClick={() => setBranch('preset')}
                  className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                    branch === 'preset'
                      ? 'border-[var(--flowmind-primary)] bg-[var(--flowmind-primary)]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Sparkles size={20} className={branch === 'preset' ? 'text-[var(--flowmind-primary)]' : 'text-gray-400'} />
                  <p className="font-medium text-gray-800 mt-2">官方预置服务商</p>
                  <p className="text-xs text-gray-500 mt-1">DeepSeek、OpenAI、Claude 等</p>
                </button>
                <button
                  onClick={() => setBranch('custom')}
                  className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                    branch === 'custom'
                      ? 'border-[var(--flowmind-primary)] bg-[var(--flowmind-primary)]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Settings size={20} className={branch === 'custom' ? 'text-[var(--flowmind-primary)]' : 'text-gray-400'} />
                  <p className="font-medium text-gray-800 mt-2">自定义配置</p>
                  <p className="text-xs text-gray-500 mt-1">私有 API、Ollama、中转站</p>
                </button>
              </div>

              {branch === 'preset' && (
                <>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索服务商或模型..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--flowmind-primary)] text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredProviders.map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => {
                          setSelectedProvider(provider)
                          setFormData(prev => ({
                            ...prev,
                            baseUrl: provider.baseUrl,
                            protocol: provider.protocol,
                          }))
                          setStep('model')
                        }}
                        className="p-4 rounded-xl border border-gray-200 hover:border-[var(--flowmind-primary)] hover:shadow-md transition-all text-left group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{provider.icon}</span>
                            <div>
                              <p className="font-medium text-gray-800 group-hover:text-[var(--flowmind-primary)]">{provider.name}</p>
                              <p className="text-xs text-gray-500">{provider.models.length} 个模型</p>
                            </div>
                          </div>
                          {provider.website && (
                            <ExternalLink
                              size={14}
                              className="text-gray-300 group-hover:text-[var(--flowmind-primary)]"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(provider.website, '_blank')
                              }}
                            />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{provider.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {provider.models.slice(0, 3).map(m => (
                            <span key={m.id} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{m.name}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {branch === 'custom' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">API 协议格式</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => updateForm('protocol', 'openai')}
                        className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${
                          formData.protocol === 'openai'
                            ? 'border-[var(--flowmind-primary)] bg-[var(--flowmind-primary)]/5 text-[var(--flowmind-primary)]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        OpenAI Chat
                      </button>
                      <button
                        onClick={() => updateForm('protocol', 'anthropic')}
                        className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${
                          formData.protocol === 'anthropic'
                            ? 'border-[var(--flowmind-primary)] bg-[var(--flowmind-primary)]/5 text-[var(--flowmind-primary)]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        Anthropic
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">使用完整 URL</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.useFullUrl}
                        onChange={(e) => updateForm('useFullUrl', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]"></div>
                      <span className="ml-2 text-xs text-gray-600">
                        {formData.useFullUrl ? '填入带 /chat/completions 后缀的完整地址' : '只填 Base 地址，自动拼接后缀'}
                      </span>
                    </label>
                  </div>

                  {formData.useFullUrl ? (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">完整请求地址 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.fullUrl}
                        onChange={(e) => updateForm('fullUrl', e.target.value)}
                        placeholder="https://api.example.com/v1/chat/completions"
                        className={`w-full px-4 py-3 bg-gray-50 rounded-lg border focus:outline-none focus:border-[var(--flowmind-primary)] text-sm ${errors.fullUrl ? 'border-red-300' : 'border-gray-200'}`}
                      />
                      {errors.fullUrl && <p className="text-xs text-red-500 mt-1">{errors.fullUrl}</p>}
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">接口地址 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.baseUrl}
                        onChange={(e) => updateForm('baseUrl', e.target.value)}
                        placeholder="https://api.example.com/v1"
                        className={`w-full px-4 py-3 bg-gray-50 rounded-lg border focus:outline-none focus:border-[var(--flowmind-primary)] text-sm ${errors.baseUrl ? 'border-red-300' : 'border-gray-200'}`}
                      />
                      {errors.baseUrl && <p className="text-xs text-red-500 mt-1">{errors.baseUrl}</p>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">模型别名 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => updateForm('name', e.target.value)}
                        placeholder="我的自定义模型"
                        className={`w-full px-4 py-3 bg-gray-50 rounded-lg border focus:outline-none focus:border-[var(--flowmind-primary)] text-sm ${errors.name ? 'border-red-300' : 'border-gray-200'}`}
                      />
                      {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">模型ID <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.modelId}
                        onChange={(e) => updateForm('modelId', e.target.value)}
                        placeholder="gpt-4、claude-3 等"
                        className={`w-full px-4 py-3 bg-gray-50 rounded-lg border focus:outline-none focus:border-[var(--flowmind-primary)] text-sm ${errors.modelId ? 'border-red-300' : 'border-gray-200'}`}
                      />
                      {errors.modelId && <p className="text-xs text-red-500 mt-1">{errors.modelId}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">API Key <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) => updateForm('apiKey', e.target.value)}
                      placeholder="sk-..."
                      className={`w-full px-4 py-3 bg-gray-50 rounded-lg border focus:outline-none focus:border-[var(--flowmind-primary)] text-sm ${errors.apiKey ? 'border-red-300' : 'border-gray-200'}`}
                    />
                    {errors.apiKey && <p className="text-xs text-red-500 mt-1">{errors.apiKey}</p>}
                  </div>

                  {/* Advanced Settings */}
                  <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <p className="text-sm font-medium text-gray-700">高级参数</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Temperature</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={formData.temperature}
                          onChange={(e) => updateForm('temperature', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Top P</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={formData.topP}
                          onChange={(e) => updateForm('topP', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Max Tokens</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.maxTokens}
                          onChange={(e) => updateForm('maxTokens', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Model Selection (Preset Branch) */}
          {step === 'model' && selectedProvider && branch === 'preset' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-2xl">{selectedProvider.icon}</span>
                <div>
                  <p className="font-medium text-gray-800">{selectedProvider.name}</p>
                  <p className="text-xs text-gray-500">{selectedProvider.description}</p>
                </div>
                <button
                  onClick={() => setStep('provider')}
                  className="ml-auto text-xs text-[var(--flowmind-primary)] hover:underline"
                >
                  更换
                </button>
              </div>

              <div className="space-y-2">
                {selectedProvider.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedPresetModel(model)
                      setFormData(prev => ({
                        ...prev,
                        name: model.name,
                        modelId: model.id,
                        temperature: model.temperature ?? 0.7,
                        topP: model.topP ?? 0.9,
                        maxTokens: model.maxTokens ?? 4096,
                      }))
                      setUseCustomModelId(false)
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      selectedPresetModel?.id === model.id && !useCustomModelId
                        ? 'border-[var(--flowmind-primary)] bg-[var(--flowmind-primary)]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800">{model.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{model.contextLength}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{model.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {model.capabilities.map(cap => (
                        <span key={cap} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{cap}</span>
                      ))}
                    </div>
                  </button>
                ))}

                {/* Use Other Model Option */}
                <button
                  onClick={() => {
                    setUseCustomModelId(true)
                    setSelectedPresetModel(null)
                  }}
                  className={`w-full p-4 rounded-xl border border-dashed text-left transition-all ${
                    useCustomModelId
                      ? 'border-[var(--flowmind-primary)] bg-[var(--flowmind-primary)]/5'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <p className="font-medium text-gray-700">使用其他模型</p>
                  <p className="text-xs text-gray-500">手动输入模型ID（厂商未收录的私有模型）</p>
                </button>
              </div>

              {useCustomModelId && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">自定义模型ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.modelId}
                    onChange={(e) => updateForm('modelId', e.target.value)}
                    placeholder="输入模型ID"
                    className={`w-full px-4 py-3 bg-gray-50 rounded-lg border focus:outline-none focus:border-[var(--flowmind-primary)] text-sm ${errors.modelId ? 'border-red-300' : 'border-gray-200'}`}
                  />
                  {errors.modelId && <p className="text-xs text-red-500 mt-1">{errors.modelId}</p>}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => window.open(selectedProvider.docsUrl, '_blank')}
                  className="flex items-center gap-1 text-xs text-[var(--flowmind-primary)] hover:underline"
                >
                  <ExternalLink size={12} />
                  查看文档
                </button>
                <button
                  onClick={() => window.open(selectedProvider.website, '_blank')}
                  className="flex items-center gap-1 text-xs text-[var(--flowmind-primary)] hover:underline"
                >
                  <ExternalLink size={12} />
                  获取 API Key
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Config */}
          {step === 'config' && (
            <div className="space-y-4">
              {(selectedProvider || branch === 'custom') && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    {selectedProvider && <span className="text-2xl">{selectedProvider.icon}</span>}
                    <div>
                      <p className="font-medium text-gray-800">
                        {selectedProvider?.name || '自定义'} - {formData.name || formData.modelId}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formData.protocol === 'openai' ? 'OpenAI 协议' : 'Anthropic 协议'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    <p>Base URL: <code className="bg-white px-1.5 py-0.5 rounded border">{formData.useFullUrl ? formData.fullUrl : formData.baseUrl}</code></p>
                    <p>模型ID: <code className="bg-white px-1.5 py-0.5 rounded border">{formData.modelId}</code></p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">API Key <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => updateForm('apiKey', e.target.value)}
                  placeholder={`请输入 API Key`}
                  className={`w-full px-4 py-3 bg-gray-50 rounded-lg border focus:outline-none focus:border-[var(--flowmind-primary)] text-sm ${errors.apiKey ? 'border-red-300' : 'border-gray-200'}`}
                />
                {errors.apiKey && <p className="text-xs text-red-500 mt-1">{errors.apiKey}</p>}
              </div>

              {branch === 'preset' && selectedPresetModel && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <p className="text-sm font-medium text-gray-700">高级参数</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Temperature</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={formData.temperature}
                        onChange={(e) => updateForm('temperature', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Top P</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={formData.topP}
                        onChange={(e) => updateForm('topP', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Max Tokens</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.maxTokens}
                        onChange={(e) => updateForm('maxTokens', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => updateForm('isDefault', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--flowmind-primary)]"></div>
                </label>
                <span className="text-xs text-gray-700">设为默认模型</span>
              </div>
            </div>
          )}

          {/* Step 4: Testing */}
          {step === 'testing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={48} className="text-[var(--flowmind-primary)] animate-spin mb-4" />
              <p className="text-gray-700 font-medium">正在测试连通性...</p>
              <p className="text-xs text-gray-500 mt-1">使用填写的 Key + 地址 + ModelID 发起测试请求</p>
            </div>
          )}

          {/* Step 5: Result */}
          {step === 'result' && testResult && (
            <div className="flex flex-col items-center justify-center py-12">
              {testResult.connected ? (
                <>
                  <CheckCircle2 size={48} className="text-green-500 mb-4" />
                  <p className="text-gray-700 font-medium">模型配置成功！</p>
                  <p className="text-xs text-gray-500 mt-1">已保存到模型列表，可直接使用</p>
                </>
              ) : (
                <>
                  <AlertCircle size={48} className="text-red-500 mb-4" />
                  <p className="text-gray-700 font-medium">连通性测试失败</p>
                  <p className="text-xs text-red-500 mt-1 max-w-md text-center">{testResult.error}</p>
                  <p className="text-xs text-gray-400 mt-2">请检查 API Key、接口地址和模型ID 是否正确</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          {step !== 'provider' && step !== 'testing' && step !== 'result' && (
            <button
              onClick={() => {
                if (step === 'model') setStep('provider')
                else if (step === 'config') setStep(branch === 'preset' ? 'model' : 'provider')
              }}
              className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft size={14} />
              上一步
            </button>
          )}
          {(step === 'provider' || step === 'testing' || step === 'result') && <div />}

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {step === 'result' ? '关闭' : '取消'}
            </button>

            {step === 'provider' && branch === 'preset' && (
              <button
                onClick={() => {
                  if (selectedPresetModel || (useCustomModelId && formData.modelId)) {
                    setStep('config')
                  }
                }}
                disabled={!selectedPresetModel && !(useCustomModelId && formData.modelId)}
                className="px-4 py-2 text-sm bg-[var(--flowmind-primary)] text-white rounded-lg hover:bg-[var(--flowmind-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步
              </button>
            )}

            {step === 'provider' && branch === 'custom' && (
              <button
                onClick={() => {
                  if (validateForm()) setStep('config')
                }}
                className="px-4 py-2 text-sm bg-[var(--flowmind-primary)] text-white rounded-lg hover:bg-[var(--flowmind-primary-hover)]"
              >
                下一步
              </button>
            )}

            {step === 'model' && (
              <button
                onClick={() => setStep('config')}
                disabled={!selectedPresetModel && !(useCustomModelId && formData.modelId)}
                className="px-4 py-2 text-sm bg-[var(--flowmind-primary)] text-white rounded-lg hover:bg-[var(--flowmind-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步
              </button>
            )}

            {step === 'config' && (
              <button
                onClick={handleTestConnection}
                disabled={!formData.apiKey || !formData.modelId}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--flowmind-primary)] text-white rounded-lg hover:bg-[var(--flowmind-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={14} />
                测试并添加
              </button>
            )}

            {step === 'result' && !testResult?.connected && (
              <button
                onClick={() => setStep('config')}
                className="px-4 py-2 text-sm bg-[var(--flowmind-primary)] text-white rounded-lg hover:bg-[var(--flowmind-primary-hover)]"
              >
                返回修改
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
