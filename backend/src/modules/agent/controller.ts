import { Request, Response } from 'express';
import { agentBus } from './agentBus';
import {
  Agent,
  AgentType,
  NegotiationRequest,
  ConflictResult,
} from './types';
import { HTTP_STATUS, ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';

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

    if (!type || !['product_manager', 'project_manager', 'engineer', 'tester', 'reviewer'].includes(type)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.AGENT_INVALID,
        message: 'Agent type must be one of: product_manager, project_manager, engineer, tester, reviewer',
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

export {
  registerAgent,
  listAgents,
  getAgent,
  getAgentStatus,
  sendRequest,
  negotiate,
  broadcastNotification,
  getConflicts,
};
