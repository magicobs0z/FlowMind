import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

interface NodeData {
  label: string
  type?: string
  status?: 'pending' | 'running' | 'completed' | 'failed'
  config?: any
}

const UnrealNode: React.FC<NodeProps<NodeData>> = ({ data, selected }) => {
  const getNodeColors = () => {
    const colors: Record<string, { header: string; border: string }> = {
      event: { header: '#de4c4a', border: '#b33c3a' },
      sequence: { header: '#6dbc4d', border: '#509038' },
      branch: { header: '#6dbc4d', border: '#509038' },
      switch: { header: '#6dbc4d', border: '#509038' },
      for_loop: { header: '#6dbc4d', border: '#509038' },
      while_loop: { header: '#6dbc4d', border: '#509038' },
      times: { header: '#6dbc4d', border: '#509038' },
      delay: { header: '#a45fba', border: '#7d478f' },
      get_variable: { header: '#4a90d9', border: '#3a7bc8' },
      set_variable: { header: '#4a90d9', border: '#3a7bc8' },
      print: { header: '#f59642', border: '#cc7033' },
      concat: { header: '#f59642', border: '#cc7033' },
      compare: { header: '#f59642', border: '#cc7033' },
      cast: { header: '#f59642', border: '#cc7033' },
      confirm: { header: '#ffd93d', border: '#ccae31' },
      notify: { header: '#ffd93d', border: '#ccae31' },
      ai_call: { header: '#9b59b6', border: '#7d3c98' },
      ai_workflow: { header: '#9b59b6', border: '#7d3c98' },
      contract: { header: '#1abc9c', border: '#148f77' },
      merge_agent: { header: '#1abc9c', border: '#148f77' },
      lock: { header: '#95a5a6', border: '#7f8c8d' },
      macro: { header: '#34495e', border: '#2c3e50' },
    }
    return colors[data.type || 'default'] || { header: '#95a5a6', border: '#7f8c8d' }
  }

  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return '#4a90d9'
      case 'completed':
        return '#6dbc4d'
      case 'failed':
        return '#de4c4a'
      default:
        return 'transparent'
    }
  }

  const colors = getNodeColors()

  return (
    <div
      className={`min-w-[200px] bg-white rounded-md overflow-hidden shadow-md border-2 transition-all ${
        selected ? 'border-[#4a90d9] shadow-lg' : 'border-[#999999]'
      }`}
      style={{
        borderColor: selected ? '#4a90d9' : colors.border,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3.5 !h-3.5 !bg-white !border-2 !border-[#4a90d9] !shadow-sm"
      />

      <div
        className="px-3.5 py-2 text-white text-sm font-semibold select-none"
        style={{
          backgroundColor: colors.header,
        }}
      >
        {data.label}
      </div>

      <div className="px-3.5 py-2.5 bg-white">
        {data.status && data.status !== 'pending' && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getStatusColor() }}
            />
            <span className="text-xs text-[#666666]">
              {data.status === 'running' ? '运行中...' :
               data.status === 'completed' ? '已完成' :
               data.status === 'failed' ? '失败' : '等待'}
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3.5 !h-3.5 !bg-white !border-2 !border-[#4a90d9] !shadow-sm"
      />
    </div>
  )
}

export default UnrealNode
