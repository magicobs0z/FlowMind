import { Request, Response } from 'express';
import { blueprintEngine } from './blueprintEngine';
import { functionLibrary } from './functionLibrary';
import { BlueprintNode, ProjectBlueprint } from './types';
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

const listTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const templates = blueprintEngine.listTemplates(category as string | undefined);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list blueprint templates');
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
          : 'Failed to list blueprint templates',
    });
  }
};

const createTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, category, version, stages, nodes, edges, humanGateways, functions } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'name is required',
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

    if (!category || typeof category !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'category is required',
      });
      return;
    }

    logger.info({ name, category }, 'Creating blueprint template');

    const blueprint: Omit<ProjectBlueprint, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      description,
      category,
      version: version || '1.0.0',
      stages: stages || [],
      nodes: nodes || [],
      edges: edges || [],
      humanGateways: humanGateways || [],
      functions: functions || [],
    };

    const template = blueprintEngine.createTemplate(blueprint);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create blueprint template');
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
          : 'Failed to create blueprint template',
    });
  }
};

const getTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Template id is required',
      });
      return;
    }
    const template = blueprintEngine.getTemplate(id);

    if (!template) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.BLUEPRINT_NOT_FOUND,
        message: `Template '${id}' not found`,
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get blueprint template');
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
          : 'Failed to get blueprint template',
    });
  }
};

const generateExecutionBlueprint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { templateId, taskDoc } = req.body;

    if (!templateId || typeof templateId !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'templateId is required',
      });
      return;
    }

    if (!taskDoc || typeof taskDoc !== 'object') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'taskDoc is required',
      });
      return;
    }

    if (!taskDoc.title || typeof taskDoc.title !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'taskDoc.title is required',
      });
      return;
    }

    logger.info({ templateId, taskTitle: taskDoc.title }, 'Generating execution blueprint');

    const execution = blueprintEngine.generateExecutionBlueprint(templateId, {
      title: taskDoc.title,
      description: taskDoc.description || '',
      requirements: taskDoc.requirements || [],
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: execution,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate execution blueprint');
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
          : 'Failed to generate execution blueprint',
    });
  }
};

const getExecutionBlueprint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Blueprint id is required',
      });
      return;
    }
    const execution = blueprintEngine.getExecutionBlueprint(id);

    if (!execution) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.BLUEPRINT_NOT_FOUND,
        message: `Execution blueprint '${id}' not found`,
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: execution,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get execution blueprint');
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
          : 'Failed to get execution blueprint',
    });
  }
};

const updateNodeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: blueprintId, nodeId } = req.params;
    const { status, output } = req.body;

    if (!blueprintId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Blueprint id is required',
      });
      return;
    }

    if (!nodeId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Node id is required',
      });
      return;
    }

    const validStatuses: BlueprintNode['status'][] = [
      'pending',
      'running',
      'completed',
      'failed',
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

    logger.info({ blueprintId, nodeId, status }, 'Updating blueprint node status');

    blueprintEngine.updateNodeStatus(blueprintId, nodeId, status, output);

    const execution = blueprintEngine.getExecutionBlueprint(blueprintId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: execution,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update blueprint node status');
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
          : 'Failed to update blueprint node status',
    });
  }
};

const listFunctions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;

    let functions = functionLibrary;
    if (category) {
      functions = functionLibrary.filter(
        (f) => f.category === category
      );
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: functions,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to list blueprint functions');
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
          : 'Failed to list blueprint functions',
    });
  }
};

const addFunction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: blueprintId } = req.params;
    if (!blueprintId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Blueprint id is required',
      });
      return;
    }
    const { functionName } = req.body;

    if (!functionName || typeof functionName !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'functionName is required',
      });
      return;
    }

    const execution = blueprintEngine.getExecutionBlueprint(blueprintId);
    if (!execution) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.BLUEPRINT_NOT_FOUND,
        message: `Execution blueprint '${blueprintId}' not found`,
      });
      return;
    }

    const func = functionLibrary.find((f) => f.name === functionName);
    if (!func) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.BLUEPRINT_INVALID,
        message: `Blueprint function '${functionName}' not found`,
      });
      return;
    }

    const newNodes: BlueprintNode[] = func.template.map((node): BlueprintNode => ({
      ...node,
      id: `${node.id}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: 'pending' as const,
      output: {},
      error: undefined,
    }));

    const nodeMapping = new Map<string, string>();
    func.template.forEach((originalNode, index) => {
      const newNode = newNodes[index];
      if (newNode) {
        nodeMapping.set(originalNode.id, newNode.id);
      }
    });

    newNodes.forEach((node) => {
      node.dependencies = node.dependencies
        .map((depId) => nodeMapping.get(depId) || depId)
        .filter((depId) => newNodes.some((n) => n.id === depId));
    });

    execution.nodes = [...execution.nodes, ...newNodes];

    execution.updatedAt = new Date().toISOString();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: execution,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to add function to blueprint');
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
          : 'Failed to add function to blueprint',
    });
  }
};

export {
  listTemplates,
  createTemplate,
  getTemplate,
  generateExecutionBlueprint,
  getExecutionBlueprint,
  updateNodeStatus,
  listFunctions,
  addFunction,
};
