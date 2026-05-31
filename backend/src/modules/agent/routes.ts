import { Router } from 'express';
import {
  registerAgent,
  listAgents,
  getAgent,
  getAgentStatus,
  sendRequest,
  negotiate,
  broadcastNotification,
  getConflicts,
} from './controller';

const router = Router();

router.post('/register', registerAgent);

router.get('/', listAgents);

router.get('/:id', getAgent);

router.get('/:id/status', getAgentStatus);

router.post('/bus/request', sendRequest);

router.post('/bus/negotiate', negotiate);

router.post('/bus/broadcast', broadcastNotification);

router.get('/bus/conflicts', getConflicts);

export { router as agentRoutes };
