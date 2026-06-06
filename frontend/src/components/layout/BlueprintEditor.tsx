import { useState, useCallback, useRef, useEffect } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Square, Plus, Save, Trash2, Workflow } from 'lucide-react';
import BaseNode from '../nodes/BaseNode';
import NodeLibrary from './NodeLibrary';
import PropertyPanel from './PropertyPanel';
import ExecutionLog from './ExecutionLog';

const nodeTypes = {
  base: BaseNode,
};

interface BlueprintEditorProps {
  blueprintId?: string;
}

function BlueprintEditorInner({ blueprintId }: BlueprintEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState<RFNode | null>(null);
  const [showNodeLibrary, setShowNodeLibrary] = useState(true);
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [showExecutionLog, setShowExecutionLog] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // WebSocket 连接
  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:3001');
    websocket.onopen = () => {
      console.log('WebSocket connected');
    };
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'node.started':
        updateNodeStatus(data.nodeId, 'running');
        break;
      case 'node.completed':
        updateNodeStatus(data.nodeId, 'completed');
        break;
      case 'node.failed':
        updateNodeStatus(data.nodeId, 'failed');
        break;
      case 'execution.completed':
      case 'execution.failed':
        setIsExecuting(false);
        break;
    }
  };

  const updateNodeStatus = (nodeId: string, status: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, status } }
          : node
      )
    );
  };

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#999999', strokeWidth: 1 },
          },
          eds
        )
      ),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    setSelectedNode(node);
    setShowPropertyPanel(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setShowPropertyPanel(false);
  }, []);

  const addNode = (type: string, position: { x: number; y: number }) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newNode: RFNode = {
      id,
      type: 'base',
      position,
      data: {
        label: getNodeLabel(type),
        type,
        status: 'pending',
        config: {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const getNodeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      event: '事件',
      sequence: '序列',
      branch: '分支',
      switch: '多路开关',
      for_loop: 'For 循环',
      while_loop: 'While 循环',
      times: '执行 N 次',
      delay: '延迟',
      get_variable: '获取变量',
      set_variable: '设置变量',
      print: '打印日志',
      concat: '字符串拼接',
      compare: '比较',
      cast: '类型转换',
      confirm: '确认弹窗',
      notify: '通知',
      ai_call: 'AI 智能体调用',
      ai_workflow: 'AI 工作流',
      contract: '契约校验',
      merge_agent: '合并智能体',
      lock: '资产锁定',
      macro: '宏节点',
    };
    return labels[type] || '未命名';
  };

  const updateSelectedNodeData = (key: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, [key]: value } }
          : node
      )
    );
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, [key]: value } } : null
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
    );
    setSelectedNode(null);
    setShowPropertyPanel(false);
  };

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
    };

    fetch('/api/v1/blueprints/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blueprint),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('Blueprint saved:', data);
      })
      .catch((err) => {
        console.error('Failed to save blueprint:', err);
      });
  };

  const executeBlueprint = () => {
    if (nodes.length === 0) return;
    setIsExecuting(true);
    setShowExecutionLog(true);

    // 重置所有节点状态
    setNodes((nds) =>
      nds.map((node) => ({ ...node, data: { ...node.data, status: 'pending' } }))
    );

    // 发送执行请求
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'execution.start',
          blueprintId: blueprintId || 'default',
        })
      );
    }
  };

  const stopExecution = () => {
    setIsExecuting(false);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'execution.stop',
          executionId: blueprintId || 'default',
        })
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA]">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white h-[40px]">
        <div className="flex items-center gap-2">
          <Workflow size={18} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">蓝图编辑器</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNodeLibrary(!showNodeLibrary)}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            <Plus size={14} />
            节点库
          </button>
          <button
            onClick={saveBlueprint}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Save size={14} />
            保存
          </button>
          {isExecuting ? (
            <button
              onClick={stopExecution}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
            >
              <Square size={14} />
              停止
            </button>
          ) : (
            <button
              onClick={executeBlueprint}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              <Play size={14} />
              执行
            </button>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 节点库面板 */}
        {showNodeLibrary && (
          <NodeLibrary
            onAddNode={addNode}
            onClose={() => setShowNodeLibrary(false)}
          />
        )}

        {/* 画布 */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[10, 10]}
            minZoom={0.05}
            maxZoom={3}
          >
            <Background
              gap={20}
              size={1}
              color="#E5E5E5"
              style={{ backgroundColor: '#FAFAFA' }}
            />
            <Controls />
          </ReactFlow>
        </div>

        {/* 属性面板 */}
        {showPropertyPanel && selectedNode && (
          <PropertyPanel
            node={selectedNode}
            onUpdate={updateSelectedNodeData}
            onDelete={deleteSelectedNode}
            onClose={() => setShowPropertyPanel(false)}
          />
        )}
      </div>

      {/* 执行日志面板 */}
      {showExecutionLog && (
        <ExecutionLog
          onClose={() => setShowExecutionLog(false)}
          ws={ws}
        />
      )}
    </div>
  );
}

export default function BlueprintEditor(props: BlueprintEditorProps) {
  return (
    <ReactFlowProvider>
      <BlueprintEditorInner {...props} />
    </ReactFlowProvider>
  );
}
