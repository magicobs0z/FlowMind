import { Router } from 'express';
import {
  openWorkspace,
  getWorkspace,
  rescanWorkspace,
  readFile,
  writeFile,
  deleteFile,
  listDirectory,
} from './controller';

const workspaceRouter = Router();

workspaceRouter.post('/open', openWorkspace);
workspaceRouter.get('/:id', getWorkspace);
workspaceRouter.post('/:id/rescan', rescanWorkspace);
workspaceRouter.post('/file/read', readFile);
workspaceRouter.post('/file/write', writeFile);
workspaceRouter.post('/file/delete', deleteFile);
workspaceRouter.post('/file/list', listDirectory);

export { workspaceRouter };
