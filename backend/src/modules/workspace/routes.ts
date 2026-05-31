import { Router } from 'express';
import { readFile } from 'fs/promises';
import { openWorkspace, getWorkspace, rescanWorkspace } from './controller';
import { workspaceCache } from './controller';
import { HTTP_STATUS, ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';

const router = Router();

router.post('/open', openWorkspace);

router.get('/:id', getWorkspace);

router.post('/:id/scan', rescanWorkspace);

router.get('/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = req.query.path as string;

    if (!filePath) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'file path is required',
      });
      return;
    }

    const workspace = workspaceCache.get(id);
    if (!workspace) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_CODES.WORKSPACE_NOT_FOUND,
        message: 'Workspace not found',
      });
      return;
    }

    logger.info({ workspaceId: id, filePath }, 'Reading file content');

    const content = await readFile(filePath, 'utf-8');

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', java: 'java', go: 'go', rs: 'rust', cpp: 'cpp', c: 'c',
      h: 'c', hpp: 'cpp', json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml',
      html: 'html', css: 'css', scss: 'scss', less: 'less', md: 'markdown',
      sql: 'sql', sh: 'shell', bash: 'shell', ps1: 'powershell',
    };

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        content,
        language: langMap[ext] || 'plaintext',
        path: filePath,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to read file');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to read file',
    });
  }
});

export { router as workspaceRoutes };
