export type TaskStatus =
  | 'queued'
  | 'dispatching'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'cancelled';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  agentId: string;
  sessionId: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high';
  payload?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeoutAt?: Date;
  heartbeatAt?: Date;
  parentTaskId?: string;
  childTaskIds: string[];
}

export type TaskEventType =
  | 'created'
  | 'started'
  | 'progress'
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'cancelled';

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface TaskFilter {
  sessionId?: string;
  agentId?: string;
  status?: TaskStatus;
}
