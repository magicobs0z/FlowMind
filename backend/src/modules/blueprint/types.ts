export type BlueprintNodeType =
  | 'event'      // 事件节点（红色）- 蓝图入口
  | 'function'   // 函数节点（蓝色）- 纯逻辑/脚本
  | 'variable'   // 变量节点（绿色）- 数据传递
  | 'ai_call'    // AI 调用节点（黄色）- 调用智能体或工作流
  | 'branch'     // 分支/判断节点（灰色/菱形）- 条件分支
  | 'agent'      // 兼容旧版：agent 类型映射为 ai_call
  | 'script'     // 兼容旧版：script 类型映射为 function
  | 'gateway'    // 兼容旧版：gateway 类型映射为 event
  | 'condition'  // 兼容旧版：condition 类型映射为 branch
  | 'parallel'   // 兼容旧版：parallel 类型映射为 function（序列）
  | 'sequential'; // 兼容旧版

export type BlueprintStatus = 'draft' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type PinType = 'execution' | 'ai' | 'data';
export type WireType = 'execution' | 'ai' | 'data';

export interface BlueprintPin {
  id: string;
  name: string;
  type: PinType;
  direction: 'input' | 'output';
  // 数据类型约束（仅 data 类型需要）
  dataType?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
}

export interface BlueprintNode {
  id: string;
  type: BlueprintNodeType;
  title: string;
  description: string;
  agentType?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  dependencies: string[];
  config: Record<string, unknown>;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
  // 新增：引脚系统（适配 UE5 蓝图风格）
  pins?: BlueprintPin[];
  // 新增：节点位置（用于前端画布）
  position?: { x: number; y: number };
  // 新增：节点尺寸
  size?: { width: number; height: number };
}

export interface BlueprintEdge {
  id: string;
  from: string;
  to: string;
  type: 'flow' | 'conditional' | 'parallel';
  condition?: string;
  // 新增：连线类型（适配引脚系统）
  wireType?: WireType;
  // 新增：源引脚和目标引脚
  fromPin?: string;
  toPin?: string;
}

export interface HumanGateway {
  id: string;
  type: 'approval' | 'review' | 'input' | 'confirmation';
  nodeId: string;
  title: string;
  description: string;
  required: boolean;
  timeout?: number;
}

export interface BlueprintFunction {
  id: string;
  name: string;
  description: string;
  category: 'git' | 'api' | 'review' | 'test' | 'deploy';
  template: BlueprintNode[];
  parameters: Record<string, { type: string; required: boolean; default?: unknown }>;
}

// 五大蓝图分类
type BlueprintCategory =
  | 'task'        // 任务蓝图：每任务仅1份，任务全生命周期
  | 'agent'       // 智能体蓝图：每个智能体1份，全局可启停
  | 'function_lib' // 蓝图函数库：全局多份，纯函数无副作用
  | 'runtime'     // 运行蓝图：AI临时生成，单次运行
  | 'automation'; // 自动化蓝图：项目配置级，全局监听

export interface ProjectBlueprint {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  // 新增：蓝图分类
  blueprintType?: BlueprintCategory;
  // 新增：关联的智能体ID（agent 蓝图使用）
  agentId?: string;
  stages: {
    id: string;
    name: string;
    order: number;
    nodeIds: string[];
  }[];
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  humanGateways: HumanGateway[];
  functions: BlueprintFunction[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionBlueprint {
  id: string;
  templateId: string;
  taskId: string;
  workspaceId: string;
  title: string;
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  humanGateways: HumanGateway[];
  status: BlueprintStatus;
  progress: number;
  currentStage?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// 蓝图执行上下文（用于 Agent 适配）
export interface BlueprintExecutionContext {
  executionId: string;
  blueprintId: string;
  currentNodeId: string;
  agentId?: string;
  sessionId?: string;
  variables: Record<string, unknown>;
  outputs: Record<string, unknown>;
}
