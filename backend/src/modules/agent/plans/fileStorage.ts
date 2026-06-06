import { mkdir, readdir, readFile, writeFile, rm, access } from 'fs/promises';
import { join } from 'path';
import type { Plan, PlanStorage, PlanStatus } from './types';
import { logger } from '../../../utils/logger';

const PLANS_DIR = join(process.cwd(), '.agent', 'plans');
const ACTIVE_MD_PATH = join(PLANS_DIR, 'active.md');

function planToMarkdown(plan: Plan): string {
  const lines: string[] = [];
  lines.push(`# ${plan.title}`);
  lines.push('');
  lines.push(`**ID:** ${plan.id}`);
  lines.push(`**Status:** ${plan.status}`);
  lines.push(`**Created:** ${plan.createdAt.toISOString()}`);
  lines.push(`**Updated:** ${plan.updatedAt.toISOString()}`);
  lines.push('');
  lines.push('## Description');
  lines.push(plan.description || '(no description)');
  lines.push('');
  lines.push('## Tasks');
  lines.push('');

  if (plan.tasks.length === 0) {
    lines.push('*No tasks yet.*');
    lines.push('');
  } else {
    for (const task of plan.tasks) {
      const statusIcon =
        task.status === 'completed'
          ? '[x]'
          : task.status === 'in_progress'
            ? '[~]'
            : task.status === 'failed'
              ? '[!]'
              : '[ ]';
      lines.push(`- ${statusIcon} **${task.id}** — ${task.description}`);
      if (task.assignedTo) {
        lines.push(`  - Assigned to: \`${task.assignedTo}\``);
      }
      if (task.startedAt) {
        lines.push(`  - Started: ${task.startedAt.toISOString()}`);
      }
      if (task.completedAt) {
        lines.push(`  - Completed: ${task.completedAt.toISOString()}`);
      }
      if (task.error) {
        lines.push(`  - Error: ${task.error}`);
      }
      lines.push('');
    }
  }

  if (plan.metadata && Object.keys(plan.metadata).length > 0) {
    lines.push('## Metadata');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(plan.metadata, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function reviveDates(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      typeof value === 'string' &&
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.test(value)
    ) {
      result[key] = new Date(value);
    } else if (typeof value === 'object') {
      result[key] = reviveDates(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class FilePlanStorage implements PlanStorage {
  private getPlanDir(planId: string): string {
    return join(PLANS_DIR, planId);
  }

  private getPlanJsonPath(planId: string): string {
    return join(this.getPlanDir(planId), 'plan.json');
  }

  async load(planId: string): Promise<Plan | null> {
    const jsonPath = this.getPlanJsonPath(planId);
    try {
      const raw = await readFile(jsonPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const revived = reviveDates(parsed) as Plan;
      return revived;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error({ planId, err }, 'Failed to load plan');
      throw err;
    }
  }

  async save(plan: Plan): Promise<void> {
    const planDir = this.getPlanDir(plan.id);
    const jsonPath = this.getPlanJsonPath(plan.id);

    await mkdir(planDir, { recursive: true });

    const serialized = JSON.stringify(plan, null, 2);
    await writeFile(jsonPath, serialized, 'utf-8');

    if (plan.status === 'active') {
      const md = planToMarkdown(plan);
      await writeFile(ACTIVE_MD_PATH, md, 'utf-8');
    }

    logger.info({ planId: plan.id }, 'Plan saved');
  }

  async list(): Promise<Plan[]> {
    try {
      await access(PLANS_DIR);
    } catch {
      return [];
    }

    const entries = await readdir(PLANS_DIR, { withFileTypes: true });
    const plans: Plan[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const plan = await this.load(entry.name);
      if (plan) plans.push(plan);
    }

    return plans;
  }

  async archive(planId: string): Promise<boolean> {
    const plan = await this.load(planId);
    if (!plan) return false;

    plan.status = 'archived' as PlanStatus;
    plan.updatedAt = new Date();
    await this.save(plan);

    logger.info({ planId }, 'Plan archived');
    return true;
  }

  async delete(planId: string): Promise<boolean> {
    const planDir = this.getPlanDir(planId);
    try {
      await rm(planDir, { recursive: true, force: true });
      logger.info({ planId }, 'Plan deleted');
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      logger.error({ planId, err }, 'Failed to delete plan');
      throw err;
    }
  }
}
