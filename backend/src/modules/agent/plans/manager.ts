import type { Plan, PlanTask, PlanStorage } from './types';
import { FilePlanStorage } from './fileStorage';
import { logger } from '../../../utils/logger';

export class PlanManager {
  private storage: PlanStorage;
  private plans: Map<string, Plan> = new Map();
  private activePlanId: string | null = null;

  constructor(storage?: PlanStorage) {
    this.storage = storage || new FilePlanStorage();
    this.loadExistingPlans();
  }

  private async loadExistingPlans(): Promise<void> {
    try {
      const plans = await this.storage.list();
      for (const plan of plans) {
        this.plans.set(plan.id, plan);
        if (plan.status === 'active' && !this.activePlanId) {
          this.activePlanId = plan.id;
        }
      }
      logger.info({ count: plans.length }, 'Existing plans loaded');
    } catch (err) {
      logger.error({ err }, 'Failed to load existing plans');
    }
  }

  async createPlan(title: string, description: string): Promise<Plan> {
    const now = new Date();
    const plan: Plan = {
      id: `plan_${Date.now()}`,
      title,
      description,
      status: 'active',
      tasks: [],
      createdAt: now,
      updatedAt: now,
    };

    this.plans.set(plan.id, plan);
    await this.storage.save(plan);

    if (!this.activePlanId) {
      this.activePlanId = plan.id;
    }

    logger.info({ planId: plan.id }, 'Plan created');
    return plan;
  }

  getPlan(id: string): Plan | undefined {
    return this.plans.get(id);
  }

  async updatePlan(id: string, updates: Partial<Pick<Plan, 'title' | 'description' | 'status' | 'metadata'>>): Promise<Plan | null> {
    const plan = this.plans.get(id);
    if (!plan) return null;

    if (updates.title !== undefined) plan.title = updates.title;
    if (updates.description !== undefined) plan.description = updates.description;
    if (updates.status !== undefined) plan.status = updates.status;
    if (updates.metadata !== undefined) plan.metadata = { ...plan.metadata, ...updates.metadata };

    plan.updatedAt = new Date();

    await this.storage.save(plan);

    if (plan.status === 'active') {
      this.activePlanId = plan.id;
    } else if (this.activePlanId === id) {
      const nextActive = Array.from(this.plans.values()).find((p) => p.status === 'active');
      this.activePlanId = nextActive ? nextActive.id : null;
    }

    logger.info({ planId: id }, 'Plan updated');
    return plan;
  }

  listPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

  async archivePlan(id: string): Promise<boolean> {
    const success = await this.storage.archive(id);
    if (!success) return false;

    const plan = this.plans.get(id);
    if (plan) {
      plan.status = 'archived';
      plan.updatedAt = new Date();
    }

    if (this.activePlanId === id) {
      const nextActive = Array.from(this.plans.values()).find((p) => p.status === 'active');
      this.activePlanId = nextActive ? nextActive.id : null;
    }

    logger.info({ planId: id }, 'Plan archived');
    return true;
  }

  async deletePlan(id: string): Promise<boolean> {
    const success = await this.storage.delete(id);
    if (!success) return false;

    this.plans.delete(id);

    if (this.activePlanId === id) {
      const nextActive = Array.from(this.plans.values()).find((p) => p.status === 'active');
      this.activePlanId = nextActive ? nextActive.id : null;
    }

    logger.info({ planId: id }, 'Plan deleted');
    return true;
  }

  getActivePlan(): Plan | null {
    if (!this.activePlanId) return null;
    return this.plans.get(this.activePlanId) || null;
  }

  async setActivePlan(id: string): Promise<boolean> {
    const plan = this.plans.get(id);
    if (!plan) return false;

    if (plan.status === 'archived') {
      plan.status = 'active';
      plan.updatedAt = new Date();
      await this.storage.save(plan);
    }

    this.activePlanId = id;
    logger.info({ planId: id }, 'Active plan set');
    return true;
  }

  async addTaskToPlan(
    planId: string,
    description: string,
    assignedTo?: string
  ): Promise<PlanTask | null> {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    const task: PlanTask = {
      id: `plan_task_${Date.now()}`,
      description,
      status: 'pending',
      assignedTo,
    };

    plan.tasks.push(task);
    plan.updatedAt = new Date();
    await this.storage.save(plan);

    logger.info({ planId, taskId: task.id }, 'Task added to plan');
    return task;
  }

  async updateTaskStatus(
    planId: string,
    taskId: string,
    status: PlanTask['status'],
    result?: unknown,
    error?: string
  ): Promise<PlanTask | null> {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    const task = plan.tasks.find((t) => t.id === taskId);
    if (!task) return null;

    task.status = status;
    if (status === 'in_progress' && !task.startedAt) {
      task.startedAt = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date();
    }
    if (result !== undefined) task.result = result;
    if (error !== undefined) task.error = error;

    plan.updatedAt = new Date();
    await this.storage.save(plan);

    logger.info({ planId, taskId, status }, 'Task status updated');
    return task;
  }
}
