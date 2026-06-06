import { Request, Response } from 'express';
import { agentBus } from './agentBus';
import { conflictDetector } from './conflictDetector';
import {
  Agent,
  AgentType,
  NegotiationRequest,
  ConflictResult,
} from './types';
import { HTTP_STATUS, ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

class FlowMindError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'FlowMindError';
  }
}

const registerAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, type, name, capabilities, modelProvider, model, currentTaskId } = req.body;

    if (!id || typeof id !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.AGENT_INVALID,
        message: 'Agent id is required',
      });
      return;
    }

    if (!type || !['lead', 'sub_lead', 'coder', 'reviewer', 'tester', 'explorer', 'custom'].includes(type)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.AGENT_INVALID,
        message: 'Agent type must be one of: lead, sub_lead, coder, reviewer, tester, explorer, custom',
      });
      return;
    }

    if (!name || typeof name !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.AGENT_INVALID,
        message: 'Agent name is required',
      });
      return;
    }

    const agent: Agent = {
      id,
      type: type as AgentType,
      name,
      capabilities: Array.isArray(capabilities) ? capabilities : [],
      status: 'idle',
      modelProvider,
      model,
      currentTaskId,
      createdAt: new Date().toISOString(),
    };

    agentBus.registerAgent(agent);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to register agent');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to register agent',
    });
  }
};

const listAgents = async (_req: Request, res: Response): Promise<void> => {
  try {
    const agents = agentBus.listAgents();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: agents,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list agents');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to list agents',
    });
  }
};

const getAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.AGENT_INVALID,
        message: 'Agent id is required',
      });
      return;
    }
    const agent = agentBus.getAgent(id);

    if (!agent) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.AGENT_NOT_FOUND,
        message: `Agent ${id} not found`,
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get agent');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to get agent',
    });
  }
};

const getAgentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.AGENT_INVALID,
        message: 'Agent id is required',
      });
      return;
    }
    const agent = agentBus.getAgent(id);

    if (!agent) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.AGENT_NOT_FOUND,
        message: `Agent ${id} not found`,
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { agentId: id, status: agent.status },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get agent status');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to get agent status',
    });
  }
};

const sendRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, type, payload, contract, timeoutAt } = req.body;

    if (!from || typeof from !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'from is required',
      });
      return;
    }

    if (!to || typeof to !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'to is required',
      });
      return;
    }

    if (!type || !['task_assignment', 'dependency_request', 'collaboration_request', 'status_update'].includes(type)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'type must be one of: task_assignment, dependency_request, collaboration_request, status_update',
      });
      return;
    }

    logger.info({ from, to, type }, 'Sending agent request');

    const response = await agentBus.sendRequest({
      from,
      to,
      type: type as 'task_assignment' | 'dependency_request' | 'collaboration_request' | 'status_update',
      payload: payload || {},
      contract,
      timeoutAt,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to send agent request');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to send agent request',
    });
  }
};

const negotiate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { requesterId, responderId, request, timeout } = req.body;

    if (!requesterId || typeof requesterId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'requesterId is required',
      });
      return;
    }

    if (!responderId || typeof responderId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'responderId is required',
      });
      return;
    }

    logger.info({ requesterId, responderId }, 'Starting negotiation');

    const negotiationReq: NegotiationRequest = {
      id: `neg_${Date.now()}`,
      requesterId,
      responderId,
      request: request || {},
      status: 'pending',
      timeout: timeout || 30000,
      createdAt: new Date().toISOString(),
    };

    const result = await agentBus.negotiate(negotiationReq);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to negotiate');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to negotiate',
    });
  }
};

const broadcastNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, senderId, recipients, payload } = req.body;

    if (!type || typeof type !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Notification type is required',
      });
      return;
    }

    if (!senderId || typeof senderId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'senderId is required',
      });
      return;
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'recipients array is required',
      });
      return;
    }

    logger.info({ type, senderId, recipientCount: recipients.length }, 'Broadcasting notification');

    agentBus.broadcastNotification({
      type,
      senderId,
      recipients,
      payload: payload || {},
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { message: 'Notification broadcasted successfully' },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to broadcast notification');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to broadcast notification',
    });
  }
};

const getConflicts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, target, agentId } = req.query;

    if (!type || typeof type !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'type query parameter is required',
      });
      return;
    }

    if (!target || typeof target !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'target query parameter is required',
      });
      return;
    }

    if (!agentId || typeof agentId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'agentId query parameter is required',
      });
      return;
    }

    const result: ConflictResult = agentBus.detectConflict({
      type,
      target,
      agentId,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get conflicts');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to get conflicts',
    });
  }
};

const executeCommand = async (req: Request, res: Response): Promise<void> => {
  try {
    const { command, workingDirectory, timeout = 30000 } = req.body;

    if (!command || typeof command !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'command is required',
      });
      return;
    }

    const dangerousPatterns = [
      'rm -rf /',
      'rm -rf /*',
      ':(){:|:&};:',
      'mkfs',
      'dd if=',
    ];

    for (const pattern of dangerousPatterns) {
      if (command.includes(pattern)) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          error: 'FORBIDDEN_COMMAND',
          message: 'Dangerous command detected and blocked',
        });
        return;
      }
    }

    logger.info({ command, workingDirectory }, 'Executing command');

    const options: any = {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    };

    if (workingDirectory) {
      options.cwd = workingDirectory;
    }

    try {
      const { stdout, stderr } = await execAsync(command, options);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          output: stdout + (stderr ? '\n[STDERR]\n' + stderr : ''),
          exitCode: 0,
        },
      });
    } catch (error: any) {
      if (error.killed) {
        res.status(HTTP_STATUS.REQUEST_TIMEOUT).json({
          success: false,
          error: 'COMMAND_TIMEOUT',
          message: 'Command execution timed out',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          output: error.stdout || '' + '\n[ERROR]\n' + (error.stderr || error.message),
          exitCode: error.code || 1,
        },
      });
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to execute command');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to execute command',
    });
  }
};

const gitOperation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { operation, args } = req.body;

    if (!operation || typeof operation !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'operation is required',
      });
      return;
    }

    const allowedOperations = ['status', 'diff', 'log', 'branch', 'checkout', 'pull', 'push', 'add', 'commit', 'fetch', 'reset', 'stash'];
    
    if (!allowedOperations.includes(operation)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: `operation must be one of: ${allowedOperations.join(', ')}`,
      });
      return;
    }

    const forbiddenFlags = ['--force', '-f', '--force-with-lease'];
    if (args && typeof args === 'string') {
      for (const flag of forbiddenFlags) {
        if (args.includes(flag)) {
          logger.warn({ operation, args }, 'Git operation with force flag detected');
        }
      }
    }

    const gitCommand = `git ${operation}${args ? ' ' + args : ''}`;
    logger.info({ command: gitCommand }, 'Executing git operation');

    try {
      const { stdout, stderr } = await execAsync(gitCommand, { timeout: 60000 });
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          output: stdout + (stderr ? '\n[STDERR]\n' + stderr : ''),
          exitCode: 0,
        },
      });
    } catch (error: any) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          output: error.stdout || '' + '\n[ERROR]\n' + (error.stderr || error.message),
          exitCode: error.code || 1,
        },
      });
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to execute git operation');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to execute git operation',
    });
  }
};

const getWorkspaceFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId;
    
    if (!workspaceId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'workspaceId is required',
      });
      return;
    }

    const workspacePath = path.join(process.cwd(), 'workspaces', workspaceId);
    
    if (!fs.existsSync(workspacePath)) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'WORKSPACE_NOT_FOUND',
        message: `Workspace ${workspaceId} not found`,
      });
      return;
    }

    const listFiles = (dir: string, basePath: string = ''): Array<{ path: string; type: string }> => {
      const files: Array<{ path: string; type: string }> = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          files.push({ path: relativePath, type: 'directory' });
          files.push(...listFiles(path.join(dir, entry.name), relativePath));
        } else {
          files.push({ path: relativePath, type: 'file' });
        }
      }

      return files;
    };

    const files = listFiles(workspacePath);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { files },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get workspace files');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Failed to get workspace files',
    });
  }
};

const delegateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fromAgentId, toAgentId, task } = req.body;

    if (!fromAgentId || typeof fromAgentId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'fromAgentId is required',
      });
      return;
    }

    if (!toAgentId || typeof toAgentId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'toAgentId is required',
      });
      return;
    }

    if (!task || typeof task !== 'object') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'task is required and must be an object',
      });
      return;
    }

    logger.info({ fromAgentId, toAgentId }, 'Delegating task');

    const result = await agentBus.delegateTask(fromAgentId, toAgentId, task);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delegate task');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to delegate task',
    });
  }
};

const getSessionResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'sessionId is required',
      });
      return;
    }

    logger.info({ sessionId }, 'Getting session results');

    const result = agentBus.aggregateResults(sessionId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get session results');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to get session results',
    });
  }
};

const acquireFileLock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filePath, agentId, ttlMs } = req.body;

    if (!filePath || typeof filePath !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'filePath is required',
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

    logger.info({ filePath, agentId, ttlMs }, 'Acquiring file lock');

    const acquired = conflictDetector.acquireFileLock(filePath, agentId, ttlMs);

    if (!acquired) {
      const lockStatus = conflictDetector.checkFileLock(filePath, agentId);
      res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: `File ${filePath} is already locked by agent ${lockStatus.owner || 'unknown'}`,
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { message: 'File lock acquired', filePath, agentId },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to acquire file lock');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to acquire file lock',
    });
  }
};

const releaseFileLock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filePath, agentId } = req.body;

    if (!filePath || typeof filePath !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'filePath is required',
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

    logger.info({ filePath, agentId }, 'Releasing file lock');

    const released = conflictDetector.releaseFileLock(filePath, agentId);

    if (!released) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: `Failed to release lock for ${filePath}: not owned by ${agentId} or lock does not exist`,
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { message: 'File lock released', filePath, agentId },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to release file lock');
    const statusCode =
      error instanceof FlowMindError
        ? error.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode =
      error instanceof FlowMindError
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;

    res.status(statusCode).json({
      success: false,
      error: errorCode,
      message:
        error instanceof FlowMindError
          ? error.message
          : 'Failed to release file lock',
    });
  }
};

export {
  registerAgent,
  listAgents,
  getAgent,
  getAgentStatus,
  sendRequest,
  negotiate,
  broadcastNotification,
  getConflicts,
  executeCommand,
  gitOperation,
  getWorkspaceFiles,
  delegateTask,
  getSessionResults,
  acquireFileLock,
  releaseFileLock,
};
