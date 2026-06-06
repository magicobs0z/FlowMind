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
  executeCommand,
  gitOperation,
  getWorkspaceFiles,
  delegateTask,
  getSessionResults,
  acquireFileLock,
  releaseFileLock,
} from './controller';
import {
  createAgent,
  updateAgent,
  deleteAgent,
  createSession,
  startSession,
  pauseSession,
  getSession,
  listSessions,
  addTask,
  executeTask,
  getAgentPrompt,
  setAgentCustomPrompt,
  clearAgentCustomPrompt,
  createPlan,
  listPlans,
  getPlan,
  updatePlan,
  archivePlan,
  getActivePlan,
} from './orchestratorController';
import {
  createTask,
  listTasks,
  getTask,
  cancelTask,
  getTaskEvents,
} from './tasks/controller';

const router = Router();

router.post('/register', registerAgent);
router.get('/', listAgents);
router.get('/:id', getAgent);
router.get('/:id/status', getAgentStatus);
router.post('/bus/request', sendRequest);
router.post('/bus/negotiate', negotiate);
router.post('/bus/broadcast', broadcastNotification);
router.get('/bus/conflicts', getConflicts);
router.post('/bus/delegate', delegateTask);
router.get('/bus/results/:sessionId', getSessionResults);
router.post('/bus/lock', acquireFileLock);
router.delete('/bus/lock', releaseFileLock);
router.post('/execute', executeCommand);
router.post('/git', gitOperation);
router.get('/workspace/:workspaceId/files', getWorkspaceFiles);

router.post('/', createAgent);
router.put('/:id', updateAgent);
router.delete('/:id', deleteAgent);
router.post('/sessions', createSession);
router.get('/sessions', listSessions);
router.get('/sessions/:id', getSession);
router.post('/sessions/:id/start', startSession);
router.post('/sessions/:id/pause', pauseSession);
router.post('/sessions/:id/tasks', addTask);
router.post('/sessions/:id/tasks/:taskId/execute', executeTask);

router.get('/:id/prompt', getAgentPrompt);
router.post('/:id/prompt', setAgentCustomPrompt);
router.delete('/:id/prompt', clearAgentCustomPrompt);

router.post('/plans', createPlan);
router.get('/plans', listPlans);
router.get('/plans/active', getActivePlan);
router.get('/plans/:id', getPlan);
router.put('/plans/:id', updatePlan);
router.post('/plans/:id/archive', archivePlan);

router.post('/tasks', createTask);
router.get('/tasks', listTasks);
router.get('/tasks/:id', getTask);
router.post('/tasks/:id/cancel', cancelTask);
router.get('/tasks/:id/events', getTaskEvents);

export { router as agentRoutes };
