import { Request, Response } from 'express';
import { DagEngine } from './dagEngine';
import { TaskStatus, EdgeType, TaskType } from './types';
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

const createDag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, workspaceId } = req.body;

    if (!blueprintId || typeof blueprintId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.DAG_INVALID,
        message: 'blueprintId is required',
      });
      return;
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.DAG_INVALID,
        message: 'workspaceId is required',
      });
      return;
    }

    logger.info({ blueprintId, workspaceId }, 'Creating DAG');

    const engine = new DagEngine(blueprintId, workspaceId);
    const dag = engine.getDag();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: dag,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create DAG');
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
          : 'Failed to create DAG',
    });
  }
};

const getDag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dagId } = req.params;
    if (!dagId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'dagId is required',
      });
      return;
    }

    const engine = DagEngine.fromExisting(dagId);
    const dag = engine.getDag();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: dag,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get DAG');
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
          : 'Failed to get DAG',
    });
  }
};

const createNode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dagId } = req.params;
    if (!dagId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'dagId is required',
      });
      return;
    }
    const { title, description, type, assignedAgent, agentType, dependencies, input, blueprintNodeId } = req.body;

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

    const validTaskTypes: TaskType[] = [
      'development',
      'testing',
      'review',
      'deployment',
      'analysis',
      'documentation',
    ];
    if (!type || !validTaskTypes.includes(type)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: `type must be one of: ${validTaskTypes.join(', ')}`,
      });
      return;
    }

    logger.info({ dagId, title, type }, 'Creating node');

    const engine = DagEngine.fromExisting(dagId);
    const node = engine.createNode({
      title,
      description,
      type,
      status: 'pending',
      assignedAgent,
      agentType,
      dependencies: dependencies || [],
      output: {},
      input: input || {},
      blueprintNodeId,
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: node,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create node');
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
          : 'Failed to create node',
    });
  }
};

const createEdge = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dagId } = req.params;
    if (!dagId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'dagId is required',
      });
      return;
    }
    const { from, to, type } = req.body;

    if (!from || typeof from !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'from (source node id) is required',
      });
      return;
    }

    if (!to || typeof to !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'to (target node id) is required',
      });
      return;
    }

    const validEdgeTypes: EdgeType[] = ['hard', 'soft'];
    const edgeType: EdgeType = type || 'hard';
    if (!validEdgeTypes.includes(edgeType)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: `type must be one of: ${validEdgeTypes.join(', ')}`,
      });
      return;
    }

    logger.info({ dagId, from, to, type: edgeType }, 'Creating edge');

    const engine = DagEngine.fromExisting(dagId);
    engine.addEdge(from, to, edgeType);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: { from, to, type: edgeType },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create edge');
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
          : 'Failed to create edge',
    });
  }
};

const getExecutableNodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dagId } = req.params;
    if (!dagId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'dagId is required',
      });
      return;
    }

    const engine = DagEngine.fromExisting(dagId);
    const nodes = engine.getExecutableNodes();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: nodes,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get executable nodes');
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
          : 'Failed to get executable nodes',
    });
  }
};

const updateNodeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dagId, nodeId } = req.params;
    const { status, output } = req.body;

    if (!dagId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'dagId is required',
      });
      return;
    }

    if (!nodeId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'nodeId is required',
      });
      return;
    }

    const validStatuses: TaskStatus[] = [
      'pending',
      'running',
      'completed',
      'failed',
      'blocked',
      'skipped',
    ];
    if (!status || !validStatuses.includes(status)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    logger.info({ dagId, nodeId, status }, 'Updating node status');

    const engine = DagEngine.fromExisting(dagId);
    engine.updateNodeStatus(nodeId, status, output);
    const node = engine.getNode(nodeId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: node,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update node status');
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
          : 'Failed to update node status',
    });
  }
};

const pruneNode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dagId, nodeId } = req.params;

    if (!dagId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'dagId is required',
      });
      return;
    }

    if (!nodeId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'nodeId is required',
      });
      return;
    }

    logger.info({ dagId, nodeId }, 'Pruning node');

    const engine = DagEngine.fromExisting(dagId);
    engine.pruneNode(nodeId);
    const node = engine.getNode(nodeId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: node,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to prune node');
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
          : 'Failed to prune node',
    });
  }
};

const growNode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dagId, parentId } = req.params;
    if (!dagId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'dagId is required',
      });
      return;
    }
    if (!parentId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'parentId is required',
      });
      return;
    }
    const { title, description, type, assignedAgent, agentType, dependencies, input, blueprintNodeId } = req.body;

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

    const validTaskTypes: TaskType[] = [
      'development',
      'testing',
      'review',
      'deployment',
      'analysis',
      'documentation',
    ];
    if (!type || !validTaskTypes.includes(type)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: `type must be one of: ${validTaskTypes.join(', ')}`,
      });
      return;
    }

    logger.info({ dagId, parentId, title, type }, 'Growing node');

    const engine = DagEngine.fromExisting(dagId);
    const node = engine.growNode(parentId, {
      title,
      description,
      type,
      status: 'pending',
      assignedAgent,
      agentType,
      dependencies: dependencies || [],
      output: {},
      input: input || {},
      blueprintNodeId,
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: node,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to grow node');
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
          : 'Failed to grow node',
    });
  }
};

const getDagMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dagId } = req.params;
    if (!dagId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'dagId is required',
      });
      return;
    }

    const engine = DagEngine.fromExisting(dagId);
    const metrics = engine.getMetrics();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get DAG metrics');
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
          : 'Failed to get DAG metrics',
    });
  }
};

export {
  createDag,
  getDag,
  createNode,
  createEdge,
  getExecutableNodes,
  updateNodeStatus,
  pruneNode,
  growNode,
  getDagMetrics,
};
