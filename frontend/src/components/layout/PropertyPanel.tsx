import { X, Trash2 } from 'lucide-react';
import type { Node as RFNode } from 'reactflow';

interface PropertyPanelProps {
  node: RFNode;
  onUpdate: (key: string, value: any) => void;
  onDelete: () => void;
  onClose: () => void;
}

const nodeConfigSchemas: Record<string, { fields: ConfigField[] }> = {
  event: {
    fields: [
      { key: 'trigger', label: '触发类型', type: 'select', options: ['manual', 'scheduled', 'webhook'] },
      { key: 'cron', label: 'Cron 表达式', type: 'text', placeholder: '0 0 * * *' },
    ],
  },
  sequence: {
    fields: [
      { key: 'outputCount', label: '输出数量', type: 'number', min: 2, max: 10 },
    ],
  },
  branch: {
    fields: [
      { key: 'condition', label: '条件表达式', type: 'text', placeholder: 'status === "success"' },
    ],
  },
  for_loop: {
    fields: [
      { key: 'first', label: '起始值', type: 'number' },
      { key: 'last', label: '结束值', type: 'number' },
    ],
  },
  while_loop: {
    fields: [
      { key: 'condition', label: '循环条件', type: 'text', placeholder: 'count < 10' },
    ],
  },
  times: {
    fields: [
      { key: 'count', label: '执行次数', type: 'number', min: 1 },
    ],
  },
  delay: {
    fields: [
      { key: 'duration', label: '延迟时间（秒）', type: 'number', min: 0 },
    ],
  },
  get_variable: {
    fields: [
      { key: 'variableName', label: '变量名', type: 'text', placeholder: 'myVar' },
    ],
  },
  set_variable: {
    fields: [
      { key: 'variableName', label: '变量名', type: 'text', placeholder: 'myVar' },
      { key: 'value', label: '变量值', type: 'text', placeholder: 'value' },
    ],
  },
  print: {
    fields: [
      { key: 'message', label: '消息内容', type: 'textarea', placeholder: 'Hello World' },
    ],
  },
  compare: {
    fields: [
      { key: 'operator', label: '运算符', type: 'select', options: ['==', '===', '!=', '!==', '>', '<', '>=', '<='] },
      { key: 'a', label: '值 A', type: 'text' },
      { key: 'b', label: '值 B', type: 'text' },
    ],
  },
  cast: {
    fields: [
      { key: 'targetType', label: '目标类型', type: 'select', options: ['string', 'number', 'boolean', 'object', 'array'] },
    ],
  },
  confirm: {
    fields: [
      { key: 'title', label: '标题', type: 'text', placeholder: '确认操作' },
      { key: 'description', label: '描述', type: 'textarea', placeholder: '请确认是否继续' },
    ],
  },
  notify: {
    fields: [
      { key: 'message', label: '通知内容', type: 'textarea', placeholder: '操作已完成' },
    ],
  },
  ai_call: {
    fields: [
      { key: 'agentId', label: '智能体 ID', type: 'text', placeholder: 'engineer' },
      { key: 'prompt', label: '提示词', type: 'textarea', placeholder: '生成用户登录接口' },
      { key: 'model', label: '模型', type: 'select', options: ['gpt-4', 'gpt-3.5-turbo', 'claude-3'] },
      { key: 'temperature', label: '温度', type: 'number', min: 0, max: 2, step: 0.1 },
    ],
  },
  ai_workflow: {
    fields: [
      { key: 'workflowId', label: '工作流 ID', type: 'text', placeholder: 'workflow_xxx' },
    ],
  },
  contract: {
    fields: [
      { key: 'schema', label: 'Schema', type: 'textarea', placeholder: '{"type": "object"}' },
      { key: 'mode', label: '校验模式', type: 'select', options: ['loose', 'strict'] },
      { key: 'maxRetries', label: '最大重试次数', type: 'number', min: 1, max: 5 },
    ],
  },
  merge_agent: {
    fields: [
      { key: 'strategy', label: '合并策略', type: 'select', options: ['auto', 'manual'] },
    ],
  },
  lock: {
    fields: [
      { key: 'assetPath', label: '资产路径', type: 'text', placeholder: 'src/types/user.ts' },
      { key: 'lockType', label: '锁定类型', type: 'select', options: ['file', 'content'] },
    ],
  },
  macro: {
    fields: [
      { key: 'macroId', label: '宏 ID', type: 'text', placeholder: 'macro_xxx' },
    ],
  },
};

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  options?: string[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export default function PropertyPanel({ node, onUpdate, onDelete, onClose }: PropertyPanelProps) {
  const nodeType = (node.data?.type as string) || 'unknown';
  const schema = nodeConfigSchemas[nodeType];
  const config = (node.data?.config as Record<string, any>) || {};

  const handleConfigChange = (key: string, value: any) => {
    onUpdate('config', { ...config, [key]: value });
  };

  const renderField = (field: ConfigField) => {
    const value = config[field.key] ?? '';

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full text-xs px-2 py-1.5 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-500 resize-none"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleConfigChange(field.key, parseFloat(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step}
            className="w-full text-xs px-2 py-1.5 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-500"
          />
        );
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-500"
          >
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full text-xs px-2 py-1.5 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-500"
          />
        );
    }
  };

  return (
    <div className="w-[250px] border-l border-gray-200 bg-white flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">节点属性</span>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={14} className="text-gray-500" />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 节点名称 */}
        <div>
          <label className="text-xs text-gray-600 block mb-1">名称</label>
          <input
            type="text"
            value={(node.data?.label as string) || ''}
            onChange={(e) => onUpdate('label', e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 节点类型 */}
        <div>
          <label className="text-xs text-gray-600 block mb-1">类型</label>
          <div className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50 rounded">
            {nodeType}
          </div>
        </div>

        {/* 配置字段 */}
        {schema?.fields.map((field) => (
          <div key={field.key}>
            <label className="text-xs text-gray-600 block mb-1">{field.label}</label>
            {renderField(field)}
          </div>
        ))}

        {/* 超时设置 */}
        <div>
          <label className="text-xs text-gray-600 block mb-1">超时时间（秒）</label>
          <input
            type="number"
            value={(node.data?.timeout as number) || 30}
            onChange={(e) => onUpdate('timeout', parseInt(e.target.value))}
            min={0}
            className="w-full text-xs px-2 py-1.5 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 失败策略 */}
        <div>
          <label className="text-xs text-gray-600 block mb-1">失败策略</label>
          <select
            value={(node.data?.failureStrategy as string) || 'abort'}
            onChange={(e) => onUpdate('failureStrategy', e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-white rounded border border-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="abort">中断执行</option>
            <option value="ignore">忽略</option>
            <option value="retry">重试</option>
            <option value="error_branch">走错误分支</option>
          </select>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={onDelete}
          className="flex items-center gap-1 w-full px-3 py-2 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100"
        >
          <Trash2 size={14} />
          删除节点
        </button>
      </div>
    </div>
  );
}
