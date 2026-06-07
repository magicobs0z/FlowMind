export interface ProjectContext {
  projectPath: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  config: ProjectConfig;
}

export interface ProjectConfig {
  name?: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface ConversationContext {
  id: string;
  projectPath: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ContextMessage[];
  modelContext: ModelContext;
  tasks: TaskState[];
  metadata: Record<string, any>;
}

export interface ContextMessage {
  id: string;
  role: 'user' | 'ai' | 'system' | 'tool';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ModelContext {
  systemPrompt?: string;
  memory: MemoryItem[];
  settings: ModelSettings;
}

export interface MemoryItem {
  id: string;
  type: 'fact' | 'observation' | 'task' | 'error';
  content: string;
  timestamp: string;
  importance: number;
  tags?: string[];
}

export interface ModelSettings {
  provider?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface TaskState {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  result?: any;
  error?: string;
}
