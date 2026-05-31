import { Router } from 'express';
import {
  listTemplates,
  createTemplate,
  getTemplate,
  generateExecutionBlueprint,
  getExecutionBlueprint,
  updateNodeStatus,
  listFunctions,
  addFunction,
} from './controller';

const router = Router();

router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.get('/templates/:id', getTemplate);
router.post('/execute', generateExecutionBlueprint);
router.get('/execute/:id', getExecutionBlueprint);
router.patch('/execute/:id/nodes/:nodeId', updateNodeStatus);
router.get('/functions', listFunctions);
router.post('/execute/:id/functions', addFunction);

export { router as blueprintRoutes };
