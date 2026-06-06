import { useState } from 'react';
import { X, Search, Zap, GitBranch, Variable, FunctionSquare, Bot, Shield, Merge, Repeat, Clock, AlertCircle, MessageSquare, Bell, FileCode } from 'lucide-react';

interface NodeLibraryProps {
  onAddNode: (type: string, position: { x: number; y: number }) => void;
  onClose: () => void;
}

interface NodeCategory {
  name: string;
  nodes: NodeDefinition[];
}

interface NodeDefinition {
  type: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const nodeCategories: NodeCategory[] = [
  {
    name: '事件',
    nodes: [
      { type: 'event', label: '事件', icon: <Zap size={16} />, description: '蓝图入口，可绑定多种触发源' },
    ],
  },
  {
    name: '流程控制',
    nodes: [
      { type: 'sequence', label: '序列', icon: <GitBranch size={16} />, description: '将执行流按顺序分出多个输出' },
      { type: 'branch', label: '分支', icon: <GitBranch size={16} />, description: '根据布尔条件选择执行路径' },
      { type: 'switch', label: '多路开关', icon: <GitBranch size={16} />, description: '根据整型或枚举值选择输出' },
      { type: 'for_loop', label: 'For 循环', icon: <Repeat size={16} />, description: '从 First 到 Last 循环' },
      { type: 'while_loop', label: 'While 循环', icon: <Repeat size={16} />, description: '当条件为真时持续执行' },
      { type: 'times', label: '执行 N 次', icon: <Repeat size={16} />, description: '固定次数循环' },
      { type: 'delay', label: '延迟', icon: <Clock size={16} />, description: '暂停执行流指定秒数' },
    ],
  },
  {
    name: '变量',
    nodes: [
      { type: 'get_variable', label: '获取变量', icon: <Variable size={16} />, description: '读取变量当前值' },
      { type: 'set_variable', label: '设置变量', icon: <Variable size={16} />, description: '修改变量值' },
    ],
  },
  {
    name: '函数',
    nodes: [
      { type: 'print', label: '打印日志', icon: <FileCode size={16} />, description: '向控制台输出文本' },
      { type: 'concat', label: '字符串拼接', icon: <FunctionSquare size={16} />, description: '将多个字符串合并' },
      { type: 'compare', label: '比较', icon: <FunctionSquare size={16} />, description: '比较两个值' },
      { type: 'cast', label: '类型转换', icon: <FunctionSquare size={16} />, description: '将数据转换为指定类型' },
      { type: 'confirm', label: '确认弹窗', icon: <AlertCircle size={16} />, description: '暂停执行流等待用户确认' },
      { type: 'notify', label: '通知', icon: <Bell size={16} />, description: '向用户发送系统通知' },
    ],
  },
  {
    name: 'AI',
    nodes: [
      { type: 'ai_call', label: 'AI 智能体调用', icon: <Bot size={16} />, description: '调用指定智能体处理任务' },
      { type: 'ai_workflow', label: 'AI 工作流', icon: <Bot size={16} />, description: '调用预编排的 AI 工作流' },
    ],
  },
  {
    name: '高级',
    nodes: [
      { type: 'contract', label: '契约校验', icon: <Shield size={16} />, description: '依据 Schema 进行结构验证' },
      { type: 'merge_agent', label: '合并智能体', icon: <Merge size={16} />, description: '并行分支产物合并' },
      { type: 'lock', label: '资产锁定', icon: <Shield size={16} />, description: '保护关键设计产物' },
      { type: 'macro', label: '宏节点', icon: <MessageSquare size={16} />, description: '可折叠子图' },
    ],
  },
];

export default function NodeLibrary({ onAddNode, onClose }: NodeLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['事件', '流程控制'])
  );

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e: React.DragEvent, nodeType: string) => {
    const position = { x: e.clientX, y: e.clientY };
    onAddNode(nodeType, position);
  };

  const filteredCategories = nodeCategories.map((category) => ({
    ...category,
    nodes: category.nodes.filter(
      (node) =>
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((category) => category.nodes.length > 0);

  return (
    <div className="w-[250px] border-r border-gray-200 bg-white flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">节点库</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X size={14} className="text-gray-500" />
        </button>
      </div>

      {/* 搜索 */}
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索节点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 rounded border border-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 分类列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredCategories.map((category) => (
          <div key={category.name} className="border-b border-gray-100">
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50"
            >
              <span className="text-xs font-medium text-gray-600">{category.name}</span>
              <span className="text-xs text-gray-400">
                {expandedCategories.has(category.name) ? '−' : '+'}
              </span>
            </button>
            {expandedCategories.has(category.name) && (
              <div className="px-2 pb-2">
                {category.nodes.map((node) => (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node.type)}
                    onDragEnd={(e) => handleDragEnd(e, node.type)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-move"
                  >
                    <span className="text-gray-500">{node.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-700 truncate">{node.label}</div>
                      <div className="text-[10px] text-gray-400 truncate">{node.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
