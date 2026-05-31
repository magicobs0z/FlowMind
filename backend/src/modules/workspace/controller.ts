import { Request, Response } from 'express';
import { generateProjectSummary } from './index';
import { HTTP_STATUS, ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';

const workspaceCache = new Map<string, any>();
export { workspaceCache };

const openWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: projectPath } = req.body;

    if (!projectPath || typeof projectPath !== 'string') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.WORKSPACE_INVALID,
        message: 'Project path is required',
      });
      return;
    }

    logger.info({ path: projectPath }, 'Opening workspace');

    const summary = await generateProjectSummary(projectPath);
    workspaceCache.set(summary.id, summary);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to open workspace');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to open workspace',
    });
  }
};

const getWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const workspace = workspaceCache.get(id);

    if (!workspace) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.WORKSPACE_NOT_FOUND,
        message: 'Workspace not found',
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get workspace');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to get workspace',
    });
  }
};

const rescanWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existingWorkspace = workspaceCache.get(id);

    if (!existingWorkspace) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.WORKSPACE_NOT_FOUND,
        message: 'Workspace not found',
      });
      return;
    }

    logger.info({ id, path: existingWorkspace.path }, 'Re-scanning workspace');

    const summary = await generateProjectSummary(existingWorkspace.path);
    workspaceCache.set(id, summary);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to re-scan workspace');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to re-scan workspace',
    });
  }
};

export {
  openWorkspace,
  getWorkspace,
  rescanWorkspace,
};
