import { Router } from 'express';
import { contextController } from './controller';

const router = Router();

router.get('/project', contextController.getProjectContext);
router.put('/project', contextController.updateProjectContext);

router.get('/conversations', contextController.listConversations);
router.post('/conversations', contextController.createConversation);
router.get('/conversations/:conversationId', contextController.getConversation);
router.delete('/conversations/:conversationId', contextController.deleteConversation);
router.put('/conversations/:conversationId/title', contextController.updateConversationTitle);

router.post('/conversations/:conversationId/messages', contextController.addMessage);
router.post('/conversations/:conversationId/memory', contextController.addMemory);
router.put('/conversations/:conversationId/model-context', contextController.updateModelContext);
router.post('/conversations/:conversationId/tasks', contextController.addTask);
router.put('/conversations/:conversationId/tasks/:taskId', contextController.updateTask);

export default router;
