export type PlanStatus = 'active' | 'archived' | 'completed';
export type PlanTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface PlanTask {
  id: string;
  description: string;
  status: PlanTaskStatus;
  assignedTo?: string;
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  status: PlanStatus;
  tasks: PlanTask[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PlanStorage {
  load(planId: string): Promise<Plan | null>;
  save(plan: Plan): Promise<void>;
  list(): Promise<Plan[]>;
  archive(planId: string): Promise<boolean>;
  delete(planId: string): Promise<boolean>;
}
