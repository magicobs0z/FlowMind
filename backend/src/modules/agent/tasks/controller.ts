import { Request, Response } from 'express';
import { taskService } from './taskService';
import { HTTP_STATUS, ERROR_CODES } from '../../../constants';
import { logger } from '../../../utils/logger';
import type { TaskFilter, TaskStatus } from './types';

const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      agentId,
      sessionId,
      payload,
      priority,
      timeoutMs,
    } = req.body;

    if (!title || typeof title !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'title is required',
      });
      return;
    }

    if (!description || typeof description !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'description is required',
      });
      return;
    }

    if (!agentId || typeof agentId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'agentId is required',
      });
      return;
    }

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'sessionId is required',
      });
      return;
    }

    const validPriorities = ['low', 'medium', 'high'] as const;
    const resolvedPriority =
      priority && validPriorities.includes(priority)
        ? priority
        : 'medium';

    const task = taskService.createTask(
      title,
      description,
      agentId,
      sessionId,
      payload,
      resolvedPriority,
      typeof timeoutMs === 'number' ? timeoutMs : undefined
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create task');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to create task',
    });
  }
};

const listTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, agentId, status } = req.query;
    const filter: TaskFilter = {};

    if (sessionId && typeof sessionId === 'string') {
      filter.sessionId = sessionId;
    }
    if (agentId && typeof agentId === 'string') {
      filter.agentId = agentId;
    }
    if (status && typeof status === 'string') {
      filter.status = status as TaskStatus;
    }

    const tasks = taskService.listTasks(filter);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list tasks');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to list tasks',
    });
  }
};

const getTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Task id is required',
      });
      return;
    }

    const task = taskService.getTask(id);
    if (!task) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.AGENT_NOT_FOUND,
        message: `Task ${id} not found`,
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get task');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to get task',
    });
  }
};

const cancelTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Task id is required',
      });
      return;
    }

    const task = taskService.cancelTask(id);
    if (!task) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.AGENT_NOT_FOUND,
        message: `Task ${id} not found or cannot be cancelled`,
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to cancel task');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to cancel task',
    });
  }
};

const getTaskEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Task id is required',
      });
      return;
    }

    const task = taskService.getTask(id);
    if (!task) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.AGENT_NOT_FOUND,
        message: `Task ${id} not found`,
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: { type: string; taskId: string; timestamp: Date; data?: Record<string, unknown> }) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Send existing events
    const existingEvents = taskService.getEvents(id);
    for (const event of existingEvents) {
      sendEvent(event);
    }

    // Send current state if already terminal
    if (
      task.status === 'completed' ||
      task.status === 'failed' ||
      task.status === 'timed_out' ||
      task.status === 'cancelled'
    ) {
      sendEvent({
        type: 'terminal',
        taskId: id,
        timestamp: new Date(),
        data: { status: task.status },
      });
      res.end();
      return;
    }

    const onEvent = (event: { type: string; taskId: string; timestamp: Date; data?: Record<string, unknown> }) => {
      if (event.taskId === id) {
        sendEvent(event);
      }
    };

    const onTerminal = (task: { id: string; status: string }) => {
      if (task.id === id) {
        sendEvent({
          type: 'terminal',
          taskId: id,
          timestamp: new Date(),
          data: { status: task.status },
        });
        cleanup();
        res.end();
      }
    };

    const cleanup = () => {
      taskService.off('task:event', onEvent);
      taskService.off('task:completed', onTerminal);
      taskService.off('task:failed', onTerminal);
      taskService.off('task:timed_out', onTerminal);
      taskService.off('task:cancelled', onTerminal);
    };

    req.on('close', () => {
      cleanup();
    });

    taskService.on('task:event', onEvent);
    taskService.on('task:completed', onTerminal);
    taskService.on('task:failed', onTerminal);
    taskService.on('task:timed_out', onTerminal);
    taskService.on('task:cancelled', onTerminal);
  } catch (error) {
    logger.error({ err: error }, 'Failed to stream task events');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to stream task events',
    });
  }
};

export { createTask, listTasks, getTask, cancelTask, getTaskEvents };
