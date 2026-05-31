export type BlueprintNodeType = 'agent' | 'script' | 'gateway' | 'condition' | 'parallel' | 'sequential';
export type BlueprintStatus = 'draft' | 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

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
}

export interface BlueprintEdge {
  id: string;
  from: string;
  to: string;
  type: 'flow' | 'conditional' | 'parallel';
  condition?: string;
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

export interface ProjectBlueprint {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
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
