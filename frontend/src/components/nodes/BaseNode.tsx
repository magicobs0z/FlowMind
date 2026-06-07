import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

interface BaseNodeData {
  label: string;
  type: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  config?: Record<string, any>;
}

const nodeColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  event: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', icon: 'text-red-600' },
  function: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700', icon: 'text-blue-600' },
  variable: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', icon: 'text-green-600' },
  ai_call: { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-800', icon: 'text-yellow-600' },
  branch: { bg: 'bg-gray-50', border: 'border-gray-500', text: 'text-gray-700', icon: 'text-gray-600' },
  sequence: { bg: 'bg-gray-50', border: 'border-gray-500', text: 'text-gray-700', icon: 'text-gray-600' },
  contract: { bg: 'bg-cyan-50', border: 'border-cyan-600', text: 'text-cyan-700', icon: 'text-cyan-600' },
  merge_agent: { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-700', icon: 'text-orange-600' },
  lock: { bg: 'bg-red-50', border: 'border-red-800', text: 'text-red-800', icon: 'text-red-700' },
};

const BaseNode = memo(({ data, selected, id }: NodeProps<BaseNodeData>) => {
  const colors = nodeColors[data.type] || nodeColors.function;
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';

  return (
    <div
      className={`
        w-[180px] rounded shadow-sm transition-all duration-200
        ${colors.bg} border-2 ${colors.border}
        ${selected ? 'ring-2 ring-white shadow-md' : ''}
        ${isRunning ? 'animate-pulse' : ''}
        ${isCompleted ? 'opacity-90' : ''}
        ${isFailed ? 'border-red-600' : ''}
      `}
      style={{ borderRadius: '4px' }}
    >
      {/* 执行引脚 - 左侧输入 */}
      <Handle
        type="target"
        position={Position.Left}
        id="exec_in"
        style={{
          width: '8px',
          height: '8px',
          background: '#9CA3AF',
          border: '1px solid #6B7280',
          left: '-4px',
        }}
      />

      {/* 数据引脚 - 左侧输入 */}
      <Handle
        type="target"
        position={Position.Left}
        id="data_in"
        style={{
          width: '8px',
          height: '8px',
          background: '#3B82F6',
          border: '1px solid #2563EB',
          left: '-4px',
          top: '70%',
        }}
      />

      {/* 节点内容 */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${colors.text} truncate`}>
            {data.label || '未命名'}
          </span>
        </div>
        
        {/* 状态指示器 */}
        {isRunning && (
          <div className="mt-1 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] text-blue-600">执行中</span>
          </div>
        )}
        {isCompleted && (
          <div className="mt-1 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-green-600">已完成</span>
          </div>
        )}
        {isFailed && (
          <div className="mt-1 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-red-600">失败</span>
          </div>
        )}
      </div>

      {/* 执行引脚 - 右侧输出 */}
      <Handle
        type="source"
        position={Position.Right}
        id="exec_out"
        style={{
          width: '8px',
          height: '8px',
          background: '#9CA3AF',
          border: '1px solid #6B7280',
          right: '-4px',
        }}
      />

      {/* 数据引脚 - 右侧输出 */}
      <Handle
        type="source"
        position={Position.Right}
        id="data_out"
        style={{
          width: '8px',
          height: '8px',
          background: '#3B82F6',
          border: '1px solid #2563EB',
          right: '-4px',
          top: '70%',
        }}
      />
    </div>
  );
});

BaseNode.displayName = 'BaseNode';

export default BaseNode;
