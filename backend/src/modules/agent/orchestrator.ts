import { logger } from '../../utils/logger';
import { AgentEngine } from './engine';
import type { LLMConfig } from './llm';
import { promptManager } from './prompts';
import { ToolRegistry } from './tools';
import { PlanManager } from './plans';
import { taskService } from './tasks';

export interface Agent {
  id: string;
  name: string;
  type: 'lead' | 'sub_lead' | 'coder' | 'reviewer' | 'tester' | 'explorer' | 'custom';
  description: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  skills: string[];
  tools: string[];
  llmConfig?: {
    apiKey: string;
    baseUrl: string;
    modelName: string;
  };
  customPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Task {
  id: string;
  description: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  subtasks: Task[];
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CollaborationSession {
  id: string;
  title: string;
  masterAgent: string;
  participatingAgents: string[];
  tasks: Task[];
  status: 'idle' | 'active' | 'paused' | 'completed';
  startTime?: Date;
  endTime?: Date;
  logs: Array<{
    timestamp: Date;
    agentId: string;
    event: string;
    data?: unknown;
  }>;
  planId?: string;
}

class MultiAgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private sessions: Map<string, CollaborationSession> = new Map();
  private toolRegistry: ToolRegistry;
  public planManager: PlanManager;

  constructor() {
    this.toolRegistry = new ToolRegistry();
    this.planManager = new PlanManager();
    this.initializeBuiltInAgents();
  }

  private initializeBuiltInAgents() {
    const builtInAgents: Agent[] = [
      {
        id: 'agent_lead',
        name: '主负责人',
        type: 'lead',
        description: '负责需求分析、PRD 撰写、任务拆解、进度跟踪和团队协调',
        status: 'idle',
        skills: [
          '需求分析',
          'PRD 撰写',
          '用户故事',
          '任务拆解',
          '进度跟踪',
          '风险评估',
          '资源分配',
        ],
        tools: [
          'read_file',
          'write_file',
          'list_directory',
          'analyze_code',
          'search_files',
          'execute_command',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'agent_sub_lead',
        name: '副负责人',
        type: 'sub_lead',
        description: '负责任务细化、智能体负载分析、任务分发和执行跟踪',
        status: 'idle',
        skills: ['任务细化', '负载分析', '任务分发', '进度跟踪', '瓶颈解决'],
        tools: ['read_file', 'list_directory', 'search_files', 'execute_command'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'agent_frontend_coder',
        name: '前端工程师',
        type: 'coder',
        description: '负责 React、Vue、HTML、CSS 前端开发',
        status: 'idle',
        skills: ['React', 'Vue', 'TypeScript', 'CSS', 'UI 组件', '前端状态管理'],
        tools: ['read_file', 'write_file', 'create_directory', 'analyze_code', 'execute_command'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'agent_backend_coder',
        name: '后端工程师',
        type: 'coder',
        description: '负责 Node.js、Python、API 开发',
        status: 'idle',
        skills: ['Node.js', 'Python', 'API 设计', '数据库', '架构设计', '后端安全'],
        tools: [
          'read_file',
          'write_file',
          'create_directory',
          'analyze_code',
          'execute_command',
          'git_operations',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'agent_reviewer',
        name: '代码审查员',
        type: 'reviewer',
        description: '负责代码质量检查、安全审计、最佳实践建议',
        status: 'idle',
        skills: ['代码审查', '安全审计', '性能优化', '最佳实践'],
        tools: ['read_file', 'analyze_code', 'search_files'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'agent_tester',
        name: '测试工程师',
        type: 'tester',
        description: '负责单元测试、集成测试、自动化测试',
        status: 'idle',
        skills: ['单元测试', '集成测试', '自动化测试', '性能测试', '安全测试'],
        tools: ['read_file', 'write_file', 'analyze_code', 'execute_command'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'agent_explorer',
        name: '代码探索者',
        type: 'explorer',
        description: '负责代码库结构分析、依赖梳理、技术债务发现',
        status: 'idle',
        skills: ['代码库分析', '依赖梳理', '技术债务识别', '代码检索', '架构文档'],
        tools: ['read_file', 'list_directory', 'search_files', 'analyze_code'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const agent of builtInAgents) {
      this.agents.set(agent.id, agent);
    }
  }

  registerAgent(agent: Agent): boolean {
    if (this.agents.has(agent.id)) {
      logger.warn({ agentId: agent.id }, 'Agent already exists');
      return false;
    }
    this.agents.set(agent.id, agent);
    logger.info({ agentId: agent.id }, 'Agent registered');
    return true;
  }

  updateAgent(id: string, updates: Partial<Agent>): boolean {
    const agent = this.agents.get(id);
    if (!agent) {
      logger.warn({ agentId: id }, 'Agent not found');
      return false;
    }
    this.agents.set(id, { ...agent, ...updates, updatedAt: new Date() });
    logger.info({ agentId: id }, 'Agent updated');
    return true;
  }

  deleteAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) {
      logger.warn({ agentId: id }, 'Agent not found');
      return false;
    }
    if (agent.type !== 'custom') {
      logger.warn({ agentId: id }, 'Cannot delete built-in agent');
      return false;
    }
    this.agents.delete(id);
    logger.info({ agentId: id }, 'Agent deleted');
    return true;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  createSession(
    title: string,
    masterAgentId: string,
    participatingAgentIds: string[],
    planId?: string
  ): CollaborationSession | null {
    const masterAgent = this.agents.get(masterAgentId);
    if (!masterAgent) {
      logger.warn({ agentId: masterAgentId }, 'Master agent not found');
      return null;
    }

    const validParticipants = participatingAgentIds.filter((id) => this.agents.has(id));
    if (validParticipants.length === 0) {
      logger.warn({ participatingAgentIds }, 'No valid participating agents found');
      return null;
    }

    if (planId) {
      const plan = this.planManager.getPlan(planId);
      if (!plan) {
        logger.warn({ planId }, 'Plan not found');
        return null;
      }
    }

    const session: CollaborationSession = {
      id: `session_${Date.now()}`,
      title,
      masterAgent: masterAgentId,
      participatingAgents: validParticipants,
      tasks: [],
      status: 'idle',
      logs: [],
      planId,
    };

    this.sessions.set(session.id, session);
    logger.info({ sessionId: session.id, planId }, 'Session created');

    return session;
  }

  startSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn({ sessionId }, 'Session not found');
      return false;
    }

    session.status = 'active';
    session.startTime = new Date();
    this.logSessionEvent(sessionId, session.masterAgent, 'session_started');

    logger.info({ sessionId }, 'Session started');
    return true;
  }

  pauseSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      logger.warn({ sessionId }, 'Session not found or not active');
      return false;
    }

    session.status = 'paused';
    this.logSessionEvent(sessionId, session.masterAgent, 'session_paused');

    logger.info({ sessionId }, 'Session paused');
    return true;
  }

  resumeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') {
      logger.warn({ sessionId }, 'Session not found or not paused');
      return false;
    }

    session.status = 'active';
    this.logSessionEvent(sessionId, session.masterAgent, 'session_resumed');

    logger.info({ sessionId }, 'Session resumed');
    return true;
  }

  completeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn({ sessionId }, 'Session not found');
      return false;
    }

    session.status = 'completed';
    session.endTime = new Date();
    this.logSessionEvent(sessionId, session.masterAgent, 'session_completed');

    logger.info({ sessionId }, 'Session completed');
    return true;
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values());
  }

  addTask(
    sessionId: string,
    taskDescription: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    assignedTo?: string
  ): Task | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn({ sessionId }, 'Session not found');
      return null;
    }

    if (assignedTo && !this.agents.has(assignedTo)) {
      logger.warn({ agentId: assignedTo }, 'Assigned agent not found');
      return null;
    }

    const task: Task = {
      id: `task_${Date.now()}`,
      description: taskDescription,
      assignedTo,
      status: 'pending',
      priority,
      subtasks: [],
    };

    session.tasks.push(task);
    this.logSessionEvent(sessionId, session.masterAgent, 'task_added', { taskId: task.id });

    logger.info({ sessionId, taskId: task.id }, 'Task added to session');
    return task;
  }

  assignTask(sessionId: string, taskId: string, agentId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn({ sessionId }, 'Session not found');
      return false;
    }

    const task = session.tasks.find((t) => t.id === taskId);
    if (!task) {
      logger.warn({ sessionId, taskId }, 'Task not found');
      return false;
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn({ agentId }, 'Agent not found');
      return false;
    }

    task.assignedTo = agentId;
    agent.status = 'busy';
    this.logSessionEvent(sessionId, session.masterAgent, 'task_assigned', { taskId, agentId });

    logger.info({ sessionId, taskId, agentId }, 'Task assigned to agent');
    return true;
  }

  async executeTask(
    sessionId: string,
    taskId: string,
    llmConfig?: { apiKey: string; baseUrl: string; modelName: string }
  ): Promise<Task | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn({ sessionId }, 'Session not found');
      return null;
    }

    const task = session.tasks.find((t) => t.id === taskId);
    if (!task || task.assignedTo) {
      logger.warn({ sessionId, taskId }, 'Task not found or already assigned');
      return null;
    }

    const masterAgent = this.agents.get(session.masterAgent);
    if (!masterAgent) {
      logger.warn({ sessionId, agentId: session.masterAgent }, 'Master agent not found');
      return null;
    }

    // Create background agent task
    const agentTask = taskService.createTask(
      task.description,
      task.description,
      session.masterAgent,
      sessionId,
      { originalTaskId: taskId },
      task.priority
    );

    // Start asynchronously
    taskService.startTask(agentTask.id);

    task.status = 'in_progress';
    task.startedAt = new Date();
    this.logSessionEvent(sessionId, session.masterAgent, 'task_started', { taskId, agentTaskId: agentTask.id });

    if (session.planId) {
      await this.planManager.addTaskToPlan(session.planId, task.description, task.assignedTo);
    }

    // Execute in background and update agent task status
    this.runBackgroundTask(sessionId, taskId, task, agentTask.id, llmConfig).catch((error) => {
      logger.error({ sessionId, taskId, agentTaskId: agentTask.id, error }, 'Background task execution error');
    });

    return task;
  }

  private async runBackgroundTask(
    sessionId: string,
    taskId: string,
    task: Task,
    agentTaskId: string,
    llmConfig?: { apiKey: string; baseUrl: string; modelName: string }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      taskService.failTask(agentTaskId, 'Session not found during background execution');
      return;
    }

    try {
      const bestAgentId = this.selectBestAgent(task.description);
      if (bestAgentId) {
        this.assignTask(sessionId, taskId, bestAgentId);
      }

      const result = await this.performTaskExecution(task, llmConfig);

      task.result = result;
      task.status = 'completed';
      task.completedAt = new Date();

      if (task.assignedTo) {
        const agent = this.agents.get(task.assignedTo);
        if (agent) agent.status = 'idle';
      }

      if (session.planId) {
        const planTasks = this.planManager.getPlan(session.planId)?.tasks;
        const planTask = planTasks?.find((t) => t.description === task.description);
        if (planTask) {
          await this.planManager.updateTaskStatus(
            session.planId,
            planTask.id,
            'completed',
            result
          );
        }
      }

      taskService.completeTask(agentTaskId, result);
      this.logSessionEvent(sessionId, session.masterAgent, 'task_completed', { taskId, agentTaskId });
      logger.info({ sessionId, taskId, agentTaskId }, 'Task completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      task.error = errorMessage;
      task.status = 'failed';
      task.completedAt = new Date();

      if (task.assignedTo) {
        const agent = this.agents.get(task.assignedTo);
        if (agent) agent.status = 'idle';
      }

      if (session.planId) {
        const planTasks = this.planManager.getPlan(session.planId)?.tasks;
        const planTask = planTasks?.find((t) => t.description === task.description);
        if (planTask) {
          await this.planManager.updateTaskStatus(
            session.planId,
            planTask.id,
            'failed',
            undefined,
            task.error
          );
        }
      }

      taskService.failTask(agentTaskId, errorMessage);
      this.logSessionEvent(sessionId, session.masterAgent, 'task_failed', {
        taskId,
        agentTaskId,
        error: errorMessage,
      });
      logger.error({ sessionId, taskId, agentTaskId, error: errorMessage }, 'Task failed');
    }
  }

  private selectBestAgent(taskDescription: string): string | null {
    const availableAgents = Array.from(this.agents.values()).filter((a) => a.status === 'idle');

    if (availableAgents.length === 0) return null;

    let bestAgent: Agent | null = null;
    let bestScore = 0;

    for (const agent of availableAgents) {
      let score = 0;

      const lowerDesc = taskDescription.toLowerCase();

      if (
        lowerDesc.includes('react') ||
        lowerDesc.includes('frontend') ||
        lowerDesc.includes('ui')
      ) {
        if (agent.skills.includes('React') || agent.skills.includes('UI 组件')) {
          score += 10;
        }
      }

      if (
        lowerDesc.includes('node') ||
        lowerDesc.includes('api') ||
        lowerDesc.includes('backend')
      ) {
        if (agent.skills.includes('Node.js') || agent.skills.includes('API 设计')) {
          score += 10;
        }
      }

      if (lowerDesc.includes('test') || lowerDesc.includes('testing')) {
        if (agent.skills.includes('单元测试') || agent.skills.includes('集成测试')) {
          score += 10;
        }
      }

      if (lowerDesc.includes('review') || lowerDesc.includes('quality')) {
        if (agent.skills.includes('代码审查') || agent.skills.includes('最佳实践')) {
          score += 10;
        }
      }

      if (lowerDesc.includes('prd') || lowerDesc.includes('requirement')) {
        if (agent.skills.includes('需求分析') || agent.skills.includes('PRD 撰写')) {
          score += 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent ? bestAgent.id : null;
  }

  private async performTaskExecution(
    task: Task,
    llmConfig?: { apiKey: string; baseUrl: string; modelName: string; provider?: string }
  ): Promise<unknown> {
    if (!llmConfig) {
      logger.warn('No LLM config provided, skipping AI execution');
      return { message: 'Task queued for execution' };
    }

    logger.info({ taskId: task.id, llmConfig }, 'Performing task execution');

    const agentId = task.assignedTo || 'agent_lead';
    const systemPrompt = this.getAgentPrompt(agentId);

    const config: LLMConfig = {
      provider: (llmConfig.provider as 'openai' | 'anthropic') || 'openai',
      apiKey: llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
      modelName: llmConfig.modelName,
      temperature: 0.7,
      maxTokens: 4096,
    };

    const engine = new AgentEngine({
      llmConfig: config,
      toolRegistry: this.toolRegistry,
      systemPrompt,
      maxIterations: 20,
      contextWindowSize: 10,
    });

    const toolContext = {
      worktree: process.cwd(),
      directory: process.cwd(),
      allowOutsideWorktree: false,
    };

    const result = await engine.execute(task.description, toolContext);

    if (!result.success) {
      throw new Error(result.error || 'Task execution failed');
    }

    return {
      message: 'Task execution completed',
      task: task.description,
      content: result.content,
      toolResults: result.toolResults,
      iterations: result.iterations,
      status: 'completed',
      timestamp: new Date().toISOString(),
    };
  }

  getAgentPrompt(agentId: string): string {
    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn({ agentId }, 'Agent not found when getting prompt');
      return '';
    }

    if (agent.customPrompt) {
      logger.info({ agentId }, 'Using custom prompt for agent');
      return agent.customPrompt;
    }

    const prompt = promptManager.getAgentPrompt(agentId, agent.type);
    logger.info({ agentId, type: agent.type }, 'Retrieved system prompt for agent');
    return prompt;
  }

  setAgentCustomPrompt(agentId: string, customPrompt: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn({ agentId }, 'Agent not found when setting custom prompt');
      return false;
    }

    if (agent.type !== 'custom') {
      logger.warn({ agentId }, 'Cannot set custom prompt for non-custom agent');
      return false;
    }

    agent.customPrompt = customPrompt;
    agent.updatedAt = new Date();
    promptManager.createCustomPrompt(agentId, agent.type, customPrompt);

    logger.info({ agentId }, 'Custom prompt set successfully');
    return true;
  }

  clearAgentCustomPrompt(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn({ agentId }, 'Agent not found when clearing custom prompt');
      return false;
    }

    agent.customPrompt = undefined;
    agent.updatedAt = new Date();
    promptManager.deleteCustomPrompt(agentId);

    logger.info({ agentId }, 'Custom prompt cleared');
    return true;
  }

  private logSessionEvent(sessionId: string, agentId: string, event: string, data?: unknown) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.logs.push({
        timestamp: new Date(),
        agentId,
        event,
        data,
      });
    }
  }
}

export const orchestrator = new MultiAgentOrchestrator();
