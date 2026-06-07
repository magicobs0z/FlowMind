import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { ProjectStorage } from './projectStorage';
import {
  ConversationContext,
  ContextMessage,
  ModelContext,
  MemoryItem,
  TaskState
} from './types';

const METADATA_FILE = 'metadata.json';
const CONTEXT_FILE = 'context.json';
const MODEL_CONTEXT_DIR = 'model_context';
const TASKS_DIR = 'tasks';

export class ConversationStorage {
  private projectStorage: ProjectStorage;
  private conversationId: string;

  constructor(projectStorage: ProjectStorage, conversationId: string) {
    this.projectStorage = projectStorage;
    this.conversationId = conversationId;
    this.ensureConversationDir();
  }

  private getConversationDir(): string {
    return this.projectStorage.getConversationDir(this.conversationId);
  }

  private getModelContextDir(): string {
    const dir = path.join(this.getConversationDir(), MODEL_CONTEXT_DIR);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private getTasksDir(): string {
    const dir = path.join(this.getConversationDir(), TASKS_DIR);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private ensureConversationDir(): void {
    this.getConversationDir();
  }

  loadConversation(): ConversationContext {
    const contextPath = path.join(this.getConversationDir(), CONTEXT_FILE);
    
    if (!fs.existsSync(contextPath)) {
      const now = new Date().toISOString();
      const context: ConversationContext = {
        id: this.conversationId,
        projectPath: this.projectStorage.getProjectPath(),
        title: 'New Conversation',
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
      this.saveConversation(context);
      return context;
    }

    try {
      const content = fs.readFileSync(contextPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error({ error, conversationId: this.conversationId }, 'Failed to load conversation context');
      const now = new Date().toISOString();
      return {
        id: this.conversationId,
        projectPath: this.projectStorage.getProjectPath(),
        title: 'New Conversation',
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
    }
  }

  saveConversation(context: ConversationContext): void {
    const contextPath = path.join(this.getConversationDir(), CONTEXT_FILE);
    context.updatedAt = new Date().toISOString();
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2), 'utf-8');
    logger.debug({ conversationId: this.conversationId }, 'Conversation context saved');

    const metadataPath = path.join(this.getConversationDir(), METADATA_FILE);
    const metadata = {
      id: context.id,
      title: context.title,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      messageCount: context.messages.length,
      taskCount: context.tasks.length
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    this.projectStorage.addToConversationsIndex(this.conversationId);
  }

  addMessage(message: ContextMessage): void {
    const context = this.loadConversation();
    context.messages.push(message);
    this.saveConversation(context);
  }

  updateMessages(messages: ContextMessage[]): void {
    const context = this.loadConversation();
    context.messages = messages;
    this.saveConversation(context);
  }

  addMemory(memory: MemoryItem): void {
    const context = this.loadConversation();
    context.modelContext.memory.push(memory);
    this.saveConversation(context);

    const memoryPath = path.join(this.getModelContextDir(), 'memory.json');
    fs.writeFileSync(memoryPath, JSON.stringify(context.modelContext.memory, null, 2), 'utf-8');
  }

  updateModelContext(modelContext: Partial<ModelContext>): void {
    const context = this.loadConversation();
    context.modelContext = { ...context.modelContext, ...modelContext };
    this.saveConversation(context);

    if (modelContext.systemPrompt) {
      const promptPath = path.join(this.getModelContextDir(), 'system_prompt.txt');
      fs.writeFileSync(promptPath, modelContext.systemPrompt, 'utf-8');
    }
  }

  addTask(task: TaskState): void {
    const context = this.loadConversation();
    context.tasks.push(task);
    this.saveConversation(context);

    const taskPath = path.join(this.getTasksDir(), `${task.id}.json`);
    fs.writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf-8');
  }

  updateTask(taskId: string, updates: Partial<TaskState>): void {
    const context = this.loadConversation();
    const task = context.tasks.find(t => t.id === taskId);
    if (task) {
      Object.assign(task, updates);
      task.updatedAt = new Date().toISOString();
      this.saveConversation(context);

      const taskPath = path.join(this.getTasksDir(), `${taskId}.json`);
      fs.writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf-8');
    }
  }

  updateTitle(title: string): void {
    const context = this.loadConversation();
    context.title = title;
    this.saveConversation(context);
  }

  deleteConversation(): void {
    const convDir = this.getConversationDir();
    if (fs.existsSync(convDir)) {
      fs.rmSync(convDir, { recursive: true, force: true });
      logger.info({ conversationId: this.conversationId }, 'Conversation deleted');
    }
    this.projectStorage.removeFromConversationsIndex(this.conversationId);
  }
}
