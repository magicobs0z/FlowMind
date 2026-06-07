import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { ProjectContext, ProjectConfig } from './types';

const FLOWMIND_DIR = '.flowmind';
const CONFIG_FILE = 'config.json';
const CONVERSATIONS_INDEX_FILE = 'index.json';

export class ProjectStorage {
  private projectPath: string;
  private flowmindDir: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.flowmindDir = path.join(projectPath, FLOWMIND_DIR);
    this.ensureFlowmindDir();
  }

  private ensureFlowmindDir(): void {
    if (!fs.existsSync(this.flowmindDir)) {
      fs.mkdirSync(this.flowmindDir, { recursive: true });
      logger.info({ dir: this.flowmindDir }, 'Created .flowmind directory');
    }
  }

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  getProjectPath(): string {
    return this.projectPath;
  }

  getFlowmindDir(): string {
    return this.flowmindDir;
  }

  getConversationsDir(): string {
    const dir = path.join(this.flowmindDir, 'conversations');
    this.ensureDir(dir);
    return dir;
  }

  getConversationDir(conversationId: string): string {
    const dir = path.join(this.getConversationsDir(), conversationId);
    this.ensureDir(dir);
    return dir;
  }

  loadProjectContext(): ProjectContext {
    const configPath = path.join(this.flowmindDir, CONFIG_FILE);
    
    if (!fs.existsSync(configPath)) {
      const now = new Date().toISOString();
      const context: ProjectContext = {
        projectPath: this.projectPath,
        version: '1.0',
        createdAt: now,
        updatedAt: now,
        config: {}
      };
      this.saveProjectContext(context);
      return context;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error({ error }, 'Failed to load project context');
      const now = new Date().toISOString();
      return {
        projectPath: this.projectPath,
        version: '1.0',
        createdAt: now,
        updatedAt: now,
        config: {}
      };
    }
  }

  saveProjectContext(context: ProjectContext): void {
    const configPath = path.join(this.flowmindDir, CONFIG_FILE);
    context.updatedAt = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(context, null, 2), 'utf-8');
    logger.debug({ path: configPath }, 'Project context saved');
  }

  updateProjectConfig(config: Partial<ProjectConfig>): void {
    const context = this.loadProjectContext();
    context.config = { ...context.config, ...config };
    this.saveProjectContext(context);
  }

  listConversations(): string[] {
    const indexPath = path.join(this.flowmindDir, CONVERSATIONS_INDEX_FILE);
    if (!fs.existsSync(indexPath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error({ error }, 'Failed to load conversations index');
      return [];
    }
  }

  saveConversationsIndex(ids: string[]): void {
    const indexPath = path.join(this.flowmindDir, CONVERSATIONS_INDEX_FILE);
    fs.writeFileSync(indexPath, JSON.stringify(ids, null, 2), 'utf-8');
  }

  addToConversationsIndex(conversationId: string): void {
    const ids = this.listConversations();
    if (!ids.includes(conversationId)) {
      ids.unshift(conversationId);
      this.saveConversationsIndex(ids);
    }
  }

  removeFromConversationsIndex(conversationId: string): void {
    const ids = this.listConversations().filter(id => id !== conversationId);
    this.saveConversationsIndex(ids);
  }
}
