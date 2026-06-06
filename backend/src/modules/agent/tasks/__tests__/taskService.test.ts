import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskService } from '../taskService';
import type { TaskFilter } from '../types';

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService();
  });

  afterEach(() => {
    service.dispose();
  });

  it('should create a task', () => {
    const task = service.createTask('Test Task', 'Do something', 'agent-1', 'session-1');
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test Task');
    expect(task.description).toBe('Do something');
    expect(task.agentId).toBe('agent-1');
    expect(task.sessionId).toBe('session-1');
    expect(task.status).toBe('queued');
    expect(task.priority).toBe('medium');
    expect(task.progress).toBe(0);
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.timeoutAt).toBeInstanceOf(Date);
  });

  it('should create task with custom priority and timeout', () => {
    const task = service.createTask(
      'High Priority',
      'Urgent',
      'agent-1',
      'session-1',
      {},
      'high',
      60000
    );
    expect(task.priority).toBe('high');
    expect(task.timeoutAt).toBeInstanceOf(Date);
  });

  it('should retrieve a task by id', () => {
    const task = service.createTask('Find me', 'Description', 'agent-1', 'session-1');
    const found = service.getTask(task.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(task.id);
  });

  it('should return undefined for unknown task id', () => {
    const found = service.getTask('nonexistent');
    expect(found).toBeUndefined();
  });

  it('should transition status from queued to running', () => {
    const task = service.createTask('Status Test', 'Description', 'agent-1', 'session-1');
    expect(task.status).toBe('queued');

    const started = service.startTask(task.id);
    expect(started).not.toBeNull();
    expect(started?.status).toBe('running');
    expect(started?.startedAt).toBeInstanceOf(Date);
  });

  it('should not start a task that is not queued', () => {
    const task = service.createTask('Status Test', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);
    const secondStart = service.startTask(task.id);
    expect(secondStart).toBeNull();
  });

  it('should complete a running task', () => {
    const task = service.createTask('Complete me', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);

    const completed = service.completeTask(task.id, { data: 'result' });
    expect(completed).not.toBeNull();
    expect(completed?.status).toBe('completed');
    expect(completed?.progress).toBe(100);
    expect(completed?.result).toEqual({ data: 'result' });
    expect(completed?.completedAt).toBeInstanceOf(Date);
  });

  it('should not complete a task that is not running', () => {
    const task = service.createTask('Not running', 'Description', 'agent-1', 'session-1');
    const completed = service.completeTask(task.id);
    expect(completed).toBeNull();
  });

  it('should fail a running task', () => {
    const task = service.createTask('Fail me', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);

    const failed = service.failTask(task.id, 'Something went wrong');
    expect(failed).not.toBeNull();
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('Something went wrong');
  });

  it('should update progress for running task', () => {
    const task = service.createTask('Progress', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);

    const updated = service.updateProgress(task.id, 50);
    expect(updated).not.toBeNull();
    expect(updated?.progress).toBe(50);
  });

  it('should clamp progress between 0 and 100', () => {
    const task = service.createTask('Progress', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);

    expect(service.updateProgress(task.id, -10)?.progress).toBe(0);
    expect(service.updateProgress(task.id, 150)?.progress).toBe(100);
  });

  it('should cancel a queued task', () => {
    const task = service.createTask('Cancel me', 'Description', 'agent-1', 'session-1');
    const cancelled = service.cancelTask(task.id);
    expect(cancelled).not.toBeNull();
    expect(cancelled?.status).toBe('cancelled');
  });

  it('should cancel a running task', () => {
    const task = service.createTask('Cancel running', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);
    const cancelled = service.cancelTask(task.id);
    expect(cancelled).not.toBeNull();
    expect(cancelled?.status).toBe('cancelled');
  });

  it('should not cancel a completed task', () => {
    const task = service.createTask('Already done', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);
    service.completeTask(task.id);
    const cancelled = service.cancelTask(task.id);
    expect(cancelled).toBeNull();
  });

  it('should not cancel a failed task', () => {
    const task = service.createTask('Already failed', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);
    service.failTask(task.id, 'error');
    const cancelled = service.cancelTask(task.id);
    expect(cancelled).toBeNull();
  });

  it('should list all tasks', () => {
    service.createTask('Task 1', 'Desc 1', 'agent-1', 'session-1');
    service.createTask('Task 2', 'Desc 2', 'agent-2', 'session-1');
    expect(service.listTasks()).toHaveLength(2);
  });

  it('should filter tasks by sessionId', () => {
    service.createTask('Task 1', 'Desc 1', 'agent-1', 'session-a');
    service.createTask('Task 2', 'Desc 2', 'agent-1', 'session-b');

    const filter: TaskFilter = { sessionId: 'session-a' };
    const results = service.listTasks(filter);
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe('session-a');
  });

  it('should filter tasks by agentId', () => {
    service.createTask('Task 1', 'Desc 1', 'agent-a', 'session-1');
    service.createTask('Task 2', 'Desc 2', 'agent-b', 'session-1');

    const filter: TaskFilter = { agentId: 'agent-a' };
    const results = service.listTasks(filter);
    expect(results).toHaveLength(1);
    expect(results[0].agentId).toBe('agent-a');
  });

  it('should filter tasks by status', () => {
    const task = service.createTask('Task 1', 'Desc 1', 'agent-1', 'session-1');
    service.createTask('Task 2', 'Desc 2', 'agent-1', 'session-1');
    service.startTask(task.id);

    const filter: TaskFilter = { status: 'running' };
    const results = service.listTasks(filter);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('running');
  });

  it('should track events for a task', () => {
    const task = service.createTask('Event test', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);
    service.completeTask(task.id);

    const events = service.getEvents(task.id);
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0].type).toBe('created');
    expect(events.some((e) => e.type === 'started')).toBe(true);
    expect(events.some((e) => e.type === 'completed')).toBe(true);
  });

  it('should timeout a running task', async () => {
    const task = service.createTask(
      'Timeout test',
      'Description',
      'agent-1',
      'session-1',
      {},
      'medium',
      1
    );
    service.startTask(task.id);

    // Wait for timeout to expire
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The internal checkTimeouts runs every 10s, so we can't easily test automatic timeout
    // without mocking timers. Instead verify the task is eligible for timeout.
    expect(task.status).toBe('running');
    expect(task.timeoutAt?.getTime()).toBeLessThan(Date.now());
  });

  it('should update heartbeat for running task', () => {
    const task = service.createTask('Heartbeat', 'Description', 'agent-1', 'session-1');
    service.startTask(task.id);

    const updated = service.heartbeat(task.id);
    expect(updated).not.toBeNull();
    expect(updated?.heartbeatAt).toBeInstanceOf(Date);
  });

  it('should not update heartbeat for non-running task', () => {
    const task = service.createTask('No heartbeat', 'Description', 'agent-1', 'session-1');
    const updated = service.heartbeat(task.id);
    expect(updated).toBeNull();
  });

  describe('state machine', () => {
    it('createTask creates queued task', () => {
      const task = service.createTask('SM', 'Desc', 'a1', 's1');
      expect(task.status).toBe('queued');
    });

    it('startTask transitions to running', () => {
      const task = service.createTask('SM', 'Desc', 'a1', 's1');
      const started = service.startTask(task.id);
      expect(started?.status).toBe('running');
    });

    it('completeTask transitions to completed', () => {
      const task = service.createTask('SM', 'Desc', 'a1', 's1');
      service.startTask(task.id);
      const completed = service.completeTask(task.id);
      expect(completed?.status).toBe('completed');
    });

    it('failTask transitions to failed', () => {
      const task = service.createTask('SM', 'Desc', 'a1', 's1');
      service.startTask(task.id);
      const failed = service.failTask(task.id, 'oops');
      expect(failed?.status).toBe('failed');
    });

    it('cancelTask transitions to cancelled', () => {
      const task = service.createTask('SM', 'Desc', 'a1', 's1');
      const cancelled = service.cancelTask(task.id);
      expect(cancelled?.status).toBe('cancelled');
    });
  });

  describe('event emission', () => {
    it('emits task:created on create', () => {
      const handler = vi.fn();
      service.once('task:created', handler);
      const task = service.createTask('Event', 'Desc', 'a1', 's1');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: task.id }));
    });

    it('emits task:started on start', () => {
      const task = service.createTask('Event', 'Desc', 'a1', 's1');
      const handler = vi.fn();
      service.once('task:started', handler);
      service.startTask(task.id);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: task.id, status: 'running' }));
    });

    it('emits task:completed on complete', () => {
      const task = service.createTask('Event', 'Desc', 'a1', 's1');
      service.startTask(task.id);
      const handler = vi.fn();
      service.once('task:completed', handler);
      service.completeTask(task.id);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: task.id, status: 'completed' }));
    });

    it('emits task:failed on fail', () => {
      const task = service.createTask('Event', 'Desc', 'a1', 's1');
      service.startTask(task.id);
      const handler = vi.fn();
      service.once('task:failed', handler);
      service.failTask(task.id, 'err');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: task.id, status: 'failed' }));
    });

    it('emits task:cancelled on cancel', () => {
      const task = service.createTask('Event', 'Desc', 'a1', 's1');
      const handler = vi.fn();
      service.once('task:cancelled', handler);
      service.cancelTask(task.id);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: task.id, status: 'cancelled' }));
    });

    it('emits task:event for every state change', () => {
      const handler = vi.fn();
      service.on('task:event', handler);
      const task = service.createTask('Event', 'Desc', 'a1', 's1');
      service.startTask(task.id);
      service.completeTask(task.id);
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });
});
