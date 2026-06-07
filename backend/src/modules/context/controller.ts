import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { getContextManager, initContextManager } from './contextManager';

export class ContextController {
  private ensureInitialized(): void {
    const projectPath = process.cwd();
    try {
      getContextManager();
    } catch {
      initContextManager(projectPath);
    }
  }

  getProjectContext(_req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const manager = getContextManager();
      const context = manager.getProjectContext();
      res.json({ success: true, data: context });
    } catch (error) {
      logger.error({ error }, 'Failed to get project context');
      next(error);
    }
  }

  updateProjectContext(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const manager = getContextManager();
      const updated = manager.updateProjectContext(req.body);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error({ error }, 'Failed to update project context');
      next(error);
    }
  }

  listConversations(_req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const manager = getContextManager();
      const conversations = manager.listConversationsWithMetadata();
      res.json({ success: true, data: conversations });
    } catch (error) {
      logger.error({ error }, 'Failed to list conversations');
      next(error);
    }
  }

  getConversation(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const { conversationId } = req.params;
      if (!conversationId) {
        res.status(400).json({ success: false, error: 'conversationId is required' });
        return;
      }
      const manager = getContextManager();
      const context = manager.loadConversationContext(conversationId);
      res.json({ success: true, data: context });
    } catch (error) {
      logger.error({ error }, 'Failed to get conversation');
      next(error);
    }
  }

  createConversation(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const { conversationId, title } = req.body;
      if (!conversationId) {
        res.status(400).json({ success: false, error: 'conversationId is required' });
        return;
      }
      const manager = getContextManager();
      const context = manager.createConversation(conversationId, title || 'New Conversation');
      res.json({ success: true, data: context });
    } catch (error) {
      logger.error({ error }, 'Failed to create conversation');
      next(error);
    }
  }

  deleteConversation(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const { conversationId } = req.params;
      if (!conversationId) {
        res.status(400).json({ success: false, error: 'conversationId is required' });
        return;
      }
      const manager = getContextManager();
      manager.deleteConversation(conversationId);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to delete conversation');
      next(error);
    }
  }

  updateConversationTitle(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const { conversationId } = req.params;
      const { title } = req.body;
      if (!conversationId || !title) {
        res.status(400).json({ success: false, error: 'conversationId and title are required' });
        return;
      }
      const manager = getContextManager();
      manager.updateConversationTitle(conversationId, title);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to update conversation title');
      next(error);
    }
  }

  addMessage(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const { conversationId } = req.params;
      const message = req.body;
      if (!conversationId || !message.id || !message.role || !message.content) {
        res.status(400).json({ success: false, error: 'Invalid message format' });
        return;
      }
      const manager = getContextManager();
      manager.addMessage(conversationId, {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to add message');
      next(error);
    }
  }

  addMemory(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const { conversationId } = req.params;
      const memory = req.body;
      if (!conversationId || !memory.id || !memory.content) {
        res.status(400).json({ success: false, error: 'Invalid memory format' });
        return;
      }
      const manager = getContextManager();
      manager.addMemory(conversationId, {
        ...memory,
        timestamp: memory.timestamp || new Date().toISOString(),
        importance: memory.importance || 1
      });
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to add memory');
      next(error);
    }
  }

  updateModelContext(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const { conversationId } = req.params;
      if (!conversationId) {
        res.status(400).json({ success: false, error: 'conversationId is required' });
        return;
      }
      const manager = getContextManager();
      manager.updateModelContext(conversationId, req.body);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to update model context');
      next(error);
    }
  }

  addTask(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const { conversationId } = req.params;
      const task = req.body;
      if (!conversationId || !task.id || !task.title) {
        res.status(400).json({ success: false, error: 'Invalid task format' });
        return;
      }
      const manager = getContextManager();
      manager.addTask(conversationId, {
        ...task,
        status: task.status || 'pending',
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: task.updatedAt || new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to add task');
      next(error);
    }
  }

  updateTask(req: Request, res: Response, next: NextFunction): void {
    try {
      this.ensureInitialized();
      const { conversationId, taskId } = req.params;
      if (!conversationId || !taskId) {
        res.status(400).json({ success: false, error: 'conversationId and taskId are required' });
        return;
      }
      const manager = getContextManager();
      manager.updateTask(conversationId, taskId, req.body);
      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, 'Failed to update task');
      next(error);
    }
  }
}

export const contextController = new ContextController();
