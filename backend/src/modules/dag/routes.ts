import { Router } from 'express';
import {
  createDag,
  getDag,
  createNode,
  createEdge,
  getExecutableNodes,
  updateNodeStatus,
  pruneNode,
  growNode,
  getDagMetrics,
} from './controller';

const router = Router();

router.post('/', createDag);

router.get('/:dagId', getDag);

router.post('/:dagId/nodes', createNode);

router.post('/:dagId/edges', createEdge);

router.get('/:dagId/executable', getExecutableNodes);

router.patch('/:dagId/nodes/:nodeId/status', updateNodeStatus);

router.delete('/:dagId/nodes/:nodeId', pruneNode);

router.post('/:dagId/nodes/:parentId/children', growNode);

router.get('/:dagId/metrics', getDagMetrics);

export { router as dagRoutes };
