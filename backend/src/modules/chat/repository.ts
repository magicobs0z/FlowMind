import { logger } from '../../utils/logger';
import { createModuleStorage } from '../../core/storage';

const MODULE_NAME = 'chat';
const CONVERSATIONS_FILE = 'conversations.json';

const moduleStorage = createModuleStorage(MODULE_NAME);

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
  model?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

class ChatRepository {
  private conversations = new Map<string, Conversation>();
  private initialized = false;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.initialized) return;

    try {
      const conversations = moduleStorage.readJson<Conversation[]>(CONVERSATIONS_FILE, []);
      if (conversations && Array.isArray(conversations)) {
        conversations.forEach(c => this.conversations.set(c.id, c));
      }

      this.initialized = true;
      logger.info({ count: this.conversations.size }, 'Chat repository loaded from disk');
    } catch (error) {
      logger.error(error, 'Failed to load chat repository from disk');
    }
  }

  private persist(): void {
    const conversations = Array.from(this.conversations.values());
    moduleStorage.writeJson(CONVERSATIONS_FILE, conversations);
  }

  get(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  set(conversation: Conversation): void {
    this.conversations.set(conversation.id, conversation);
    this.persist();
  }

  has(id: string): boolean {
    return this.conversations.has(id);
  }

  delete(id: string): boolean {
    const deleted = this.conversations.delete(id);
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  list(): Conversation[] {
    return Array.from(this.conversations.values());
  }

  getMessages(id: string): ChatMessage[] | undefined {
    const conversation = this.conversations.get(id);
    return conversation?.messages;
  }

  addMessage(conversationId: string, message: ChatMessage): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.messages.push(message);
      conversation.updatedAt = new Date().toISOString();
      this.persist();
    }
  }
}

export const chatRepository = new ChatRepository();
