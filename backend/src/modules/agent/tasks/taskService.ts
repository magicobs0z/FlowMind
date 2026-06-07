import { EventEmitter } from 'events';
import { logger } from '../../../utils/logger';
import type { AgentTask, TaskEvent, TaskFilter, TaskEventType } from './types';

const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 10000; // 10 seconds

type LogType = 'info' | 'tool' | 'result' | 'error';

interface LogEntry {
  timestamp: string;
  type: LogType;
  message: string;
}

export class TaskService extends EventEmitter {
  private tasks: Map<string, AgentTask> = new Map();
  private events: Map<string, TaskEvent[]> = new Map();
  private logs: Map<string, LogEntry[]> = new Map();
  private timeoutTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.startTimeoutChecker();
  }

  addLog(taskId: string, type: LogType, message: string): void {
    if (!this.logs.has(taskId)) {
      this.logs.set(taskId, []);
    }
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
    };
    this.logs.get(taskId)!.push(entry);

    // Also emit as an event for SSE - include the log entry directly
    const event = {
      type: 'log' as const,
      taskId,
      timestamp: new Date(),
      data: { log: entry },
      log: entry, // 前端 watchTask 会直接读取这个字段
    };
    this.addEvent(taskId, 'progress', { log: entry });
    this.emit('task:log', event);
    this.emit('task:event', event);
  }

  getLogs(taskId: string): LogEntry[] {
    return this.logs.get(taskId) || [];
  }

  private startTimeoutChecker(): void {
    this.timeoutTimer = setInterval(() => {
      this.checkTimeouts();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private checkTimeouts(): void {
    const now = new Date();
    for (const task of this.tasks.values()) {
      if (
        task.status === 'running' &&
        task.timeoutAt &&
        task.timeoutAt < now
      ) {
        this.timedOutTaskInternal(task.id);
      }
    }
  }

  private timedOutTaskInternal(id: string): void {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'running') {
      return;
    }

    task.status = 'timed_out';
    task.completedAt = new Date();
    task.error = task.error || 'Task timed out';

    this.addEvent(id, 'timed_out', { error: task.error });
    this.emit('task:timed_out', task);
    logger.warn({ taskId: id }, 'Task timed out');
  }

  private addEvent(
    taskId: string,
    type: TaskEventType,
    data?: Record<string, unknown>
  ): void {
    const event: TaskEvent = {
      type,
      taskId,
      timestamp: new Date(),
      data,
    };

    if (!this.events.has(taskId)) {
      this.events.set(taskId, []);
    }
    this.events.get(taskId)!.push(event);
    this.emit('task:event', event);
  }

  createTask(
    title: string,
    description: string,
    agentId: string,
    sessionId: string,
    payload?: Record<string, unknown>,
    priority: 'low' | 'medium' | 'high' = 'medium',
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): AgentTask {
    const id = `agent_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const task: AgentTask = {
      id,
      title,
      description,
      agentId,
      sessionId,
      status: 'queued',
      priority,
      payload,
      progress: 0,
      createdAt: now,
      timeoutAt: new Date(now.getTime() + timeoutMs),
      childTaskIds: [],
    };

    this.tasks.set(id, task);
    this.addEvent(id, 'created', { title, description, agentId, sessionId, priority });
    this.emit('task:created', task);
    logger.info({ taskId: id, sessionId, agentId }, 'Agent task created');
    return task;
  }

  getTask(id: string): AgentTask | undefined {
    return this.tasks.get(id);
  }

  listTasks(filter?: TaskFilter): AgentTask[] {
    let tasks = Array.from(this.tasks.values());
    if (filter) {
      if (filter.sessionId) {
        tasks = tasks.filter((t) => t.sessionId === filter.sessionId);
      }
      if (filter.agentId) {
        tasks = tasks.filter((t) => t.agentId === filter.agentId);
      }
      if (filter.status) {
        tasks = tasks.filter((t) => t.status === filter.status);
      }
    }
    return tasks;
  }

  startTask(id: string): AgentTask | null {
    const task = this.tasks.get(id);
    if (!task) {
      logger.warn({ taskId: id }, 'Task not found when starting');
      return null;
    }
    if (task.status !== 'queued') {
      logger.warn({ taskId: id, status: task.status }, 'Task cannot be started from current status');
      return null;
    }

    task.status = 'dispatching';
    task.startedAt = new Date();

    // Immediately transition to running for simplicity; orchestrator may refine later
    task.status = 'running';
    task.heartbeatAt = new Date();

    this.addEvent(id, 'started', { status: task.status });
    this.emit('task:started', task);
    logger.info({ taskId: id }, 'Task started');
    return task;
  }

  updateProgress(id: string, progress: number): AgentTask | null {
    const task = this.tasks.get(id);
    if (!task) {
      logger.warn({ taskId: id }, 'Task not found when updating progress');
      return null;
    }
    if (task.status !== 'running') {
      logger.warn({ taskId: id, status: task.status }, 'Task progress update ignored: not running');
      return null;
    }

    const clamped = Math.max(0, Math.min(100, progress));
    task.progress = clamped;

    this.addEvent(id, 'progress', { progress: clamped });
    this.emit('task:progress', task);
    logger.info({ taskId: id, progress: clamped }, 'Task progress updated');
    return task;
  }

  completeTask(id: string, result?: unknown): AgentTask | null {
    const task = this.tasks.get(id);
    if (!task) {
      logger.warn({ taskId: id }, 'Task not found when completing');
      return null;
    }
    if (!['running', 'dispatching'].includes(task.status)) {
      logger.warn({ taskId: id, status: task.status }, 'Task cannot be completed from current status');
      return null;
    }

    task.status = 'completed';
    task.result = result;
    task.progress = 100;
    task.completedAt = new Date();

    this.addEvent(id, 'completed', { result });
    this.emit('task:completed', task);
    logger.info({ taskId: id }, 'Task completed');
    return task;
  }

  failTask(id: string, error: string): AgentTask | null {
    const task = this.tasks.get(id);
    if (!task) {
      logger.warn({ taskId: id }, 'Task not found when failing');
      return null;
    }
    if (!['running', 'dispatching'].includes(task.status)) {
      logger.warn({ taskId: id, status: task.status }, 'Task cannot be failed from current status');
      return null;
    }

    task.status = 'failed';
    task.error = error;
    task.completedAt = new Date();

    this.addEvent(id, 'failed', { error });
    this.emit('task:failed', task);
    logger.error({ taskId: id, error }, 'Task failed');
    return task;
  }

  cancelTask(id: string): AgentTask | null {
    const task = this.tasks.get(id);
    if (!task) {
      logger.warn({ taskId: id }, 'Task not found when cancelling');
      return null;
    }
    if (['completed', 'failed', 'timed_out', 'cancelled'].includes(task.status)) {
      logger.warn({ taskId: id, status: task.status }, 'Task cannot be cancelled from terminal status');
      return null;
    }

    task.status = 'cancelled';
    task.completedAt = new Date();

    this.addEvent(id, 'cancelled', {});
    this.emit('task:cancelled', task);
    logger.info({ taskId: id }, 'Task cancelled');
    return task;
  }

  heartbeat(id: string): AgentTask | null {
    const task = this.tasks.get(id);
    if (!task) {
      logger.warn({ taskId: id }, 'Task not found when updating heartbeat');
      return null;
    }
    if (task.status !== 'running') {
      return null;
    }

    task.heartbeatAt = new Date();
    return task;
  }

  getEvents(taskId: string): TaskEvent[] {
    return this.events.get(taskId) || [];
  }

  dispose(): void {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.removeAllListeners();
  }
}

export const taskService = new TaskService();
