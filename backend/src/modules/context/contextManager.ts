import { logger } from '../../utils/logger';
import { ProjectStorage } from './projectStorage';
import { ConversationStorage } from './conversationStorage';
import {
  ProjectContext,
  ConversationContext,
  ContextMessage,
  ModelContext,
  MemoryItem,
  TaskState
} from './types';

export class ContextManager {
  private projectStorage: ProjectStorage;
  private conversationStorages: Map<string, ConversationStorage> = new Map();

  constructor(projectPath: string) {
    this.projectStorage = new ProjectStorage(projectPath);
  }

  getProjectContext(): ProjectContext {
    return this.projectStorage.loadProjectContext();
  }

  updateProjectContext(updates: Partial<ProjectContext>): ProjectContext {
    const context = this.getProjectContext();
    const updated = { ...context, ...updates };
    this.projectStorage.saveProjectContext(updated);
    return updated;
  }

  getConversation(conversationId: string): ConversationStorage {
    if (!this.conversationStorages.has(conversationId)) {
      const storage = new ConversationStorage(this.projectStorage, conversationId);
      this.conversationStorages.set(conversationId, storage);
    }
    return this.conversationStorages.get(conversationId)!;
  }

  loadConversationContext(conversationId: string): ConversationContext {
    const storage = this.getConversation(conversationId);
    return storage.loadConversation();
  }

  saveConversationContext(context: ConversationContext): void {
    const storage = this.getConversation(context.id);
    storage.saveConversation(context);
  }

  createConversation(conversationId: string, title: string = 'New Conversation'): ConversationContext {
    const now = new Date().toISOString();
    const context: ConversationContext = {
      id: conversationId,
      projectPath: this.projectStorage.getProjectPath(),
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
      modelContext: {
        memory: [],
        settings: {}
      },
      tasks: [],
      metadata: {}
    };

    const storage = this.getConversation(conversationId);
    storage.saveConversation(context);
    logger.info({ conversationId, title }, 'Conversation created');
    return context;
  }

  deleteConversation(conversationId: string): void {
    const storage = this.getConversation(conversationId);
    storage.deleteConversation();
    this.conversationStorages.delete(conversationId);
  }

  listConversations(): string[] {
    return this.projectStorage.listConversations();
  }

  listConversationsWithMetadata(): Array<{ id: string; title: string; updatedAt: string }> {
    const ids = this.listConversations();
    return ids.map(id => {
      try {
        const context = this.loadConversationContext(id);
        return {
          id: context.id,
          title: context.title,
          updatedAt: context.updatedAt
        };
      } catch {
        return { id, title: 'Unknown', updatedAt: new Date().toISOString() };
      }
    });
  }

  addMessage(conversationId: string, message: ContextMessage): void {
    const storage = this.getConversation(conversationId);
    storage.addMessage(message);
  }

  addMemory(conversationId: string, memory: MemoryItem): void {
    const storage = this.getConversation(conversationId);
    storage.addMemory(memory);
  }

  updateModelContext(conversationId: string, modelContext: Partial<ModelContext>): void {
    const storage = this.getConversation(conversationId);
    storage.updateModelContext(modelContext);
  }

  addTask(conversationId: string, task: TaskState): void {
    const storage = this.getConversation(conversationId);
    storage.addTask(task);
  }

  updateTask(conversationId: string, taskId: string, updates: Partial<TaskState>): void {
    const storage = this.getConversation(conversationId);
    storage.updateTask(taskId, updates);
  }

  updateConversationTitle(conversationId: string, title: string): void {
    const storage = this.getConversation(conversationId);
    storage.updateTitle(title);
  }
}

let contextManagerInstance: ContextManager | null = null;

export function getContextManager(projectPath?: string): ContextManager {
  if (!contextManagerInstance && projectPath) {
    contextManagerInstance = new ContextManager(projectPath);
  }
  if (!contextManagerInstance) {
    throw new Error('ContextManager not initialized. Call getContextManager with projectPath first.');
  }
  return contextManagerInstance;
}

export function initContextManager(projectPath: string): ContextManager {
  contextManagerInstance = new ContextManager(projectPath);
  return contextManagerInstance;
}
