export type AgentType = 'product_manager' | 'project_manager' | 'engineer' | 'tester' | 'reviewer';
export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';
export type RequestType = 'task_assignment' | 'dependency_request' | 'collaboration_request' | 'status_update';
export type ContractType = 'openapi' | 'typescript' | 'graphql' | 'custom';

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  capabilities: string[];
  status: AgentStatus;
  modelProvider?: 'openai' | 'anthropic' | 'ollama';
  model?: string;
  currentTaskId?: string;
  createdAt: string;
}

export interface StructuredContract {
  type: ContractType;
  schema: Record<string, unknown>;
  version: string;
}

export interface AgentRequest {
  id: string;
  from: string;
  to: string;
  type: RequestType;
  payload: Record<string, unknown>;
  contract?: StructuredContract;
  status: 'pending' | 'processing' | 'resolved' | 'rejected' | 'timeout';
  timestamp: string;
  timeoutAt?: string;
}

export interface AgentResponse {
  requestId: string;
  from: string;
  data: Record<string, unknown>;
  contract?: StructuredContract;
  timestamp: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Conflict[];
  resolution: 'auto_resolve' | 'human_intervention' | 'retry';
}

export interface Conflict {
  type: 'file_write' | 'resource_lock' | 'contract_mismatch';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface NegotiationRequest {
  id: string;
  requesterId: string;
  responderId: string;
  request: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected' | 'timeout';
  timeout: number;
  createdAt: string;
}

export interface AgentNotification {
  id: string;
  type: string;
  senderId: string;
  recipients: string[];
  payload: Record<string, unknown>;
  timestamp: string;
}
