import { useState, useCallback, useRef, useEffect } from 'react'
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  type Node as RFNode,
  type Edge as RFEdge,
  type Connection,
  MarkerType,
  type NodeTypes,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Play,
  Square,
  Plus,
  Save,
  Trash2,
  Workflow,
  Maximize2,
  Minimize2,
  Zap,
  GitBranch,
  Variable,
  FunctionSquare,
  Bot,
  Shield,
  Merge,
  Repeat,
  Clock,
  AlertCircle,
  MessageSquare,
  Bell,
  FileCode,
  Sparkles,
  X,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import UnrealNode from '../nodes/UnrealNode'
import NodeLibrary from './NodeLibrary'
import PropertyPanel from './PropertyPanel'
import ExecutionLog from './ExecutionLog'

const nodeTypes: NodeTypes = {
  unreal: UnrealNode,
}

interface NodeCategory {
  id: string
  name: string
  nodes: Array<{ type: string; label: string }>
}

const nodeCategories: NodeCategory[] = [
  {
    id: 'event',
    name: '事件',
    nodes: [
      { type: 'event', label: '事件' },
    ],
  },
  {
    id: 'flow',
    name: '流程控制',
    nodes: [
      { type: 'sequence', label: '序列' },
      { type: 'branch', label: '分支' },
      { type: 'switch', label: '多路开关' },
      { type: 'for_loop', label: 'For 循环' },
      { type: 'while_loop', label: 'While 循环' },
      { type: 'times', label: '执行 N 次' },
    ],
  },
  {
    id: 'delay',
    name: '时序',
    nodes: [
      { type: 'delay', label: '延迟' },
    ],
  },
  {
    id: 'variable',
    name: '变量',
    nodes: [
      { type: 'get_variable', label: '获取变量' },
      { type: 'set_variable', label: '设置变量' },
    ],
  },
  {
    id: 'utility',
    name: '工具',
    nodes: [
      { type: 'print', label: '打印日志' },
      { type: 'concat', label: '字符串拼接' },
      { type: 'compare', label: '比较' },
      { type: 'cast', label: '类型转换' },
    ],
  },
  {
    id: 'interaction',
    name: '交互',
    nodes: [
      { type: 'confirm', label: '确认弹窗' },
      { type: 'notify', label: '通知' },
    ],
  },
  {
    id: 'ai',
    name: 'AI',
    nodes: [
      { type: 'ai_call', label: '智能体调用' },
      { type: 'ai_workflow', label: 'AI 工作流' },
    ],
  },
  {
    id: 'contract',
    name: '契约',
    nodes: [
      { type: 'contract', label: '契约校验' },
      { type: 'merge_agent', label: '合并智能体' },
      { type: 'lock', label: '资产锁定' },
    ],
  },
  {
    id: 'macro',
    name: '宏',
    nodes: [
      { type: 'macro', label: '宏节点' },
    ],
  },
]

interface BlueprintEditorProps {
  blueprintId?: string
}

function BlueprintEditorInner({ blueprintId }: BlueprintEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [selectedNode, setSelectedNode] = useState<RFNode | null>(null)
  const [showNodeLibrary, setShowNodeLibrary] = useState(true)
  const [showPropertyPanel, setShowPropertyPanel] = useState(false)
  const [showExecutionLog, setShowExecutionLog] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['event', 'flow'])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAIGenerate, setShowAIGenerate] = useState(false)
  const [aiRequirement, setAiRequirement] = useState('')
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:3001')
    websocket.onopen = () => {
      console.log('WebSocket connected')
    }
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleWebSocketMessage(data)
    }
    setWs(websocket)

    return () => {
      websocket.close()
    }
  }, [])

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'node.started':
        updateNodeStatus(data.nodeId, 'running')
        break
      case 'node.completed':
        updateNodeStatus(data.nodeId, 'completed')
        break
      case 'node.failed':
        updateNodeStatus(data.nodeId, 'failed')
        break
      case 'execution.completed':
      case 'execution.failed':
        setIsExecuting(false)
        break
    }
  }

  const updateNodeStatus = (nodeId: string, status: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, status } }
          : node
      )
    )
  }

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#333333', strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    setSelectedNode(node)
    setShowPropertyPanel(true)
    setContextMenu(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setShowPropertyPanel(false)
    setContextMenu(null)
  }, [])

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return
      setContextMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
    },
    []
  )

  const addNodeAtPosition = (type: string, label: string, x: number, y: number) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newNode: RFNode = {
      id,
      type: 'unreal',
      position: { x, y },
      data: {
        label,
        type,
        status: 'pending',
        config: {},
      },
    }
    setNodes((nds) => [...nds, newNode])
    setContextMenu(null)
  }

  const addNode = (type: string, position: { x: number; y: number }) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newNode: RFNode = {
      id,
      type: 'unreal',
      position,
      data: {
        label: getNodeLabel(type),
        type,
        status: 'pending',
        config: {},
      },
    }
    setNodes((nds) => [...nds, newNode])
  }

  const getNodeLabel = (type: string): string => {
    for (const cat of nodeCategories) {
      const node = cat.nodes.find((n) => n.type === type)
      if (node) return node.label
    }
    return type
  }

  const updateSelectedNodeData = (key: string, value: any) => {
    if (!selectedNode) return
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, [key]: value } }
          : node
      )
    )
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, [key]: value } } : null
    )
  }

  const deleteSelectedNode = () => {
    if (!selectedNode) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
    )
    setSelectedNode(null)
    setShowPropertyPanel(false)
  }

  const saveBlueprint = () => {
    const blueprint = {
      id: blueprintId || `bp_${Date.now()}`,
      name: '未命名蓝图',
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.type,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    }

    fetch('/api/v1/blueprints/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blueprint),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('Blueprint saved:', data)
      })
      .catch((err) => {
        console.error('Failed to save blueprint:', err)
      })
  }

  const executeBlueprint = () => {
    if (nodes.length === 0) return
    setIsExecuting(true)
    setShowExecutionLog(true)

    setNodes((nds) =>
      nds.map((node) => ({ ...node, data: { ...node.data, status: 'pending' } }))
    )

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'execution.start',
          blueprintId: blueprintId || 'default',
        })
      )
    }
  }

  const stopExecution = () => {
    setIsExecuting(false)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'execution.stop',
          executionId: blueprintId || 'default',
        })
      )
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    )
  }

  const filteredCategories = searchQuery.trim()
    ? nodeCategories.map((cat) => ({
        ...cat,
        nodes: cat.nodes.filter(
          (n) =>
            n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.type.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((cat) => cat.nodes.length > 0)
    : nodeCategories

  return (
    <div
      className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-[100]' : 'h-full'} bg-[#fafafa]`}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#e0e0e0] bg-white h-[44px]">
        <div className="flex items-center gap-3">
          <Workflow size={18} className="text-[#666666]" />
          <span className="text-sm font-medium text-[#333333]">蓝图编辑器</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNodeLibrary(!showNodeLibrary)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#f0f0f0] text-[#333333] rounded hover:bg-[#e0e0e0] transition-colors"
          >
            <Plus size={14} />
            节点库
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#f0f0f0] text-[#333333] rounded hover:bg-[#e0e0e0] transition-colors"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={() => setShowAIGenerate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#4a90d9] text-white rounded hover:bg-[#3a7bc8] transition-colors"
          >
            <Sparkles size={14} />
            AI 生成
          </button>
          <button
            onClick={saveBlueprint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#4a90d9] text-white rounded hover:bg-[#3a7bc8] transition-colors"
          >
            <Save size={14} />
            保存
          </button>
          {isExecuting ? (
            <button
              onClick={stopExecution}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#d94a4a] text-white rounded hover:bg-[#c83a3a] transition-colors"
            >
              <Square size={14} />
              停止
            </button>
          ) : (
            <button
              onClick={executeBlueprint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#4ad94a] text-white rounded hover:bg-[#3ac83a] transition-colors"
            >
              <Play size={14} />
              执行
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showNodeLibrary && (
          <div className="w-64 bg-white border-r border-[#e0e0e0] flex flex-col">
            <div className="p-3 border-b border-[#e0e0e0]">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999999]" />
                <input
                  type="text"
                  placeholder="搜索节点..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-[#f5f5f5] text-[#333333] text-xs rounded border border-[#e0e0e0] focus:border-[#4a90d9] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredCategories.map((cat) => (
                <div key={cat.id} className="mb-1">
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-[#666666] hover:text-[#333333] hover:bg-[#f0f0f0] rounded transition-colors"
                  >
                    {expandedCategories.includes(cat.id) ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                    {cat.name}
                  </button>
                  {expandedCategories.includes(cat.id) && (
                    <div className="ml-1 space-y-0.5">
                      {cat.nodes.map((node) => (
                        <div
                          key={node.type}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/reactflow/type', node.type)
                            e.dataTransfer.setData('application/reactflow/label', node.label)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          className="px-2.5 py-1.5 text-xs text-[#555555] hover:text-[#333333] hover:bg-[#f0f0f0] rounded cursor-grab active:cursor-grabbing transition-colors"
                        >
                          {node.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          ref={reactFlowWrapper}
          className="flex-1"
          onClick={() => setContextMenu(null)}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            minZoom={0.1}
            maxZoom={4}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              gap={20}
              size={1}
              color="#e0e0e0"
              style={{ backgroundColor: '#fafafa' }}
            />
            <Controls className="bg-white border border-[#e0e0e0] text-[#333333] shadow-lg" />

            {contextMenu && (
              <Panel
                position={contextMenu}
                className="bg-white rounded-lg shadow-xl border border-[#e0e0e0] py-1 w-72 overflow-hidden z-[1000]"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                <div className="p-2 border-b border-[#e0e0e0]">
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#999999]" />
                    <input
                      type="text"
                      placeholder="搜索节点..."
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 bg-[#f5f5f5] text-[#333333] text-xs rounded border border-[#e0e0e0] focus:border-[#4a90d9] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="max-h-[350px] overflow-y-auto py-1">
                  {filteredCategories.map((cat) => (
                    <div key={cat.id}>
                      <div className="px-3 py-1 text-[10px] font-semibold text-[#999999] uppercase tracking-wide">
                        {cat.name}
                      </div>
                      {cat.nodes.map((node) => (
                        <button
                          key={node.type}
                          onClick={() =>
                            addNodeAtPosition(node.type, node.label, contextMenu.x, contextMenu.y)
                          }
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#555555] hover:bg-[#f0f0f0] transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-[#4a90d9]" />
                          {node.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {showPropertyPanel && selectedNode && (
          <PropertyPanel
            node={selectedNode}
            onUpdate={updateSelectedNodeData}
            onDelete={deleteSelectedNode}
            onClose={() => setShowPropertyPanel(false)}
          />
        )}
      </div>

      {showExecutionLog && (
        <ExecutionLog
          onClose={() => setShowExecutionLog(false)}
          ws={ws}
        />
      )}

      {showAIGenerate && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAIGenerate(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-[520px] overflow-hidden border border-[#e0e0e0]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e0e0e0]">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#4a90d9]" />
                <h3 className="text-[15px] font-semibold text-[#333333]">AI 蓝图生成</h3>
              </div>
              <button
                onClick={() => setShowAIGenerate(false)}
                className="p-1.5 hover:bg-[#f0f0f0] rounded-full transition-colors"
              >
                <X size={16} className="text-[#666666]" />
              </button>
            </div>

            <div className="p-5">
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#666666] mb-2">
                  描述您的蓝图需求
                </label>
                <textarea
                  value={aiRequirement}
                  onChange={(e) => setAiRequirement(e.target.value)}
                  placeholder="例如：我需要一个代码审查的工作流，首先检查代码规范，然后运行测试，最后通知相关人员..."
                  className="w-full h-28 px-3 py-2.5 bg-[#f5f5f5] text-[#333333] text-xs rounded border border-[#e0e0e0] focus:border-[#4a90d9] focus:outline-none resize-none"
                />
              </div>

              <div className="bg-[#fff9e6] border border-[#ffe6a3] rounded-lg p-3.5 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="text-[#f0ad4e] mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-[#cc8800]">提示</p>
                    <p className="text-[11px] text-[#666666] mt-0.5">
                      Blueprint Agent 将根据您的需求自动生成蓝图节点和连线。此功能需要 Agent 系统集成完成后使用。
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setShowAIGenerate(false)}
                  className="px-4 py-2 text-xs text-[#666666] hover:text-[#333333] transition-colors"
                >
                  取消
                </button>
                <button
                  disabled={!aiRequirement.trim()}
                  className="px-4 py-2 text-xs bg-[#4a90d9] text-white rounded-lg hover:bg-[#3a7bc8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  开始生成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BlueprintEditor(props: BlueprintEditorProps) {
  return (
    <ReactFlowProvider>
      <BlueprintEditorInner {...props} />
    </ReactFlowProvider>
  )
}
