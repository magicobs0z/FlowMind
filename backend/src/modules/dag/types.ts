export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'skipped';
export type TaskType = 'development' | 'testing' | 'review' | 'deployment' | 'analysis' | 'documentation';
export type EdgeType = 'hard' | 'soft';
export type AgentType = 'product_manager' | 'project_manager' | 'engineer' | 'tester' | 'reviewer';

export interface DagNode {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  assignedAgent?: string;
  agentType?: AgentType;
  dependencies: string[];
  output: Record<string, unknown>;
  input: Record<string, unknown>;
  error?: string;
  blueprintNodeId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DagEdge {
  from: string;
  to: string;
  type: EdgeType;
}

export interface Dag {
  id: string;
  blueprintId: string;
  workspaceId: string;
  nodes: DagNode[];
  edges: DagEdge[];
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed';
  metadata: {
    totalNodes: number;
    completedNodes: number;
    runningNodes: number;
    pendingNodes: number;
    failedNodes: number;
  };
  createdAt: string;
  updatedAt: string;
}
