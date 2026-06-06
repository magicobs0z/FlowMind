import {
  ProjectBlueprint,
  ExecutionBlueprint,
  BlueprintNode,
  BlueprintExecutionContext,
} from './types';
import { blueprintRepository } from './repository';
import { ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';
import { orchestrator } from '../agent/orchestrator';

class FlowMindError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'FlowMindError';
  }
}

export class BlueprintEngine {
  createTemplate(
    blueprint: Omit<ProjectBlueprint, 'id' | 'createdAt' | 'updatedAt'>
  ): ProjectBlueprint {
    const now = new Date().toISOString();
    const id = `bp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const template: ProjectBlueprint = {
      ...blueprint,
      id,
      createdAt: now,
      updatedAt: now,
    };

    blueprintRepository.saveTemplate(template);
    logger.info({ templateId: id }, 'Blueprint template created');
    return template;
  }

  getTemplate(templateId: string): ProjectBlueprint | null {
    const template = blueprintRepository.findTemplate(templateId);
    if (template) {
      logger.debug({ templateId }, 'Blueprint template retrieved');
    }
    return template;
  }

  listTemplates(category?: string): ProjectBlueprint[] {
    const templates = blueprintRepository.findAllTemplates(category);
    logger.info({ count: templates.length, category }, 'Blueprint templates listed');
    return templates;
  }

  generateExecutionBlueprint(
    templateId: string,
    taskDoc: { title: string; description: string; requirements: string[] }
  ): ExecutionBlueprint {
    const template = blueprintRepository.findTemplate(templateId);
    if (!template) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Template '${templateId}' not found`,
        404
      );
    }

    const now = new Date().toISOString();
    const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const nodes: BlueprintNode[] = template.nodes.map((node) => ({
      ...node,
      status: 'pending',
      output: {},
      error: undefined,
    }));

    const execution: ExecutionBlueprint = {
      id,
      templateId,
      taskId: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      workspaceId: 'default',
      title: taskDoc.title,
      nodes,
      edges: template.edges,
      humanGateways: template.humanGateways,
      status: 'draft',
      progress: 0,
      currentStage: template.stages[0]?.name,
      createdAt: now,
      updatedAt: now,
    };

    blueprintRepository.saveExecution(execution);
    logger.info({ executionId: id, templateId }, 'Execution blueprint generated');
    return execution;
  }

  updateNodeStatus(
    blueprintId: string,
    nodeId: string,
    status: BlueprintNode['status'],
    output?: Record<string, unknown>
  ): void {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (!execution) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Execution blueprint '${blueprintId}' not found`,
        404
      );
    }

    const node = execution.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_INVALID,
        `Node '${nodeId}' not found in blueprint`,
        404
      );
    }

    const now = new Date().toISOString();
    node.status = status;

    if (status === 'running') {
      execution.status = 'running';
      if (!execution.startedAt) {
        execution.startedAt = now;
      }
    } else if (status === 'completed' && output) {
      node.output = { ...node.output, ...output };
    } else if (status === 'failed' && output?.error) {
      node.error = output.error as string;
    }

    this.updateProgress(execution);
    execution.updatedAt = now;

    blueprintRepository.saveExecution(execution);
    logger.info({ blueprintId, nodeId, status }, 'Blueprint node status updated');
  }

  getExecutionBlueprint(blueprintId: string): ExecutionBlueprint | null {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (execution) {
      logger.debug({ blueprintId }, 'Execution blueprint retrieved');
    }
    return execution;
  }

  listExecutionBlueprints(workspaceId?: string): ExecutionBlueprint[] {
    const executions = blueprintRepository.findAllExecutions(workspaceId);
    logger.info({ count: executions.length, workspaceId }, 'Execution blueprints listed');
    return executions;
  }

  calculateProgress(blueprintId: string): number {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (!execution) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Execution blueprint '${blueprintId}' not found`,
        404
      );
    }

    return this.updateProgress(execution);
  }

  getNextNodes(blueprintId: string): BlueprintNode[] {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (!execution) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Execution blueprint '${blueprintId}' not found`,
        404
      );
    }

    return execution.nodes.filter((node) => {
      if (node.status !== 'pending') return false;

      return node.dependencies.every((depId) => {
        const depNode = execution.nodes.find((n) => n.id === depId);
        if (!depNode) return true;
        return depNode.status === 'completed' || depNode.status === 'skipped';
      });
    });
  }

  /**
   * 执行下一个可执行的 AI 调用节点
   * 打通蓝图系统与 Agent 系统
   */
  async executeNextAINode(
    blueprintId: string,
    llmConfig?: { apiKey: string; baseUrl: string; modelName: string }
  ): Promise<BlueprintNode | null> {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (!execution) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Execution blueprint '${blueprintId}' not found`,
        404
      );
    }

    const nextNodes = this.getNextNodes(blueprintId);
    const aiNode = nextNodes.find(
      (n) => n.type === 'ai_call' || n.type === 'agent'
    );

    if (!aiNode) {
      logger.info({ blueprintId }, 'No executable AI node found');
      return null;
    }

    // 更新节点状态为运行中
    this.updateNodeStatus(blueprintId, aiNode.id, 'running');

    try {
      // 构建执行上下文
      const context: BlueprintExecutionContext = {
        executionId: blueprintId,
        blueprintId: execution.templateId,
        currentNodeId: aiNode.id,
        agentId: aiNode.agentType,
        variables: {},
        outputs: {},
      };

      // 收集前置节点的输出作为变量
      for (const depId of aiNode.dependencies) {
        const depNode = execution.nodes.find((n) => n.id === depId);
        if (depNode?.output) {
          context.outputs[depId] = depNode.output;
        }
      }

      // 注入节点输入
      context.variables = { ...aiNode.input, ...context.outputs };

      logger.info(
        { blueprintId, nodeId: aiNode.id, agentId: aiNode.agentType },
        'Executing AI node via Agent system'
      );

      // 调用 Agent 系统执行任务
      const result = await this.invokeAgentForNode(aiNode, context, llmConfig);

      // 更新节点状态为完成
      this.updateNodeStatus(blueprintId, aiNode.id, 'completed', {
        result,
        context,
      });

      return aiNode;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { blueprintId, nodeId: aiNode.id, error: errorMessage },
        'AI node execution failed'
      );

      this.updateNodeStatus(blueprintId, aiNode.id, 'failed', {
        error: errorMessage,
      });

      throw new FlowMindError(
        ERROR_CODES.AGENT_ERROR,
        `AI node execution failed: ${errorMessage}`,
        500
      );
    }
  }

  /**
   * 调用 Agent 系统执行蓝图节点
   */
  private async invokeAgentForNode(
    node: BlueprintNode,
    context: BlueprintExecutionContext,
    llmConfig?: { apiKey: string; baseUrl: string; modelName: string }
  ): Promise<unknown> {
    // 确定目标 Agent
    const agentId = node.agentType || context.agentId;

    if (!agentId) {
      // 无指定 Agent，返回模拟执行结果
      return {
        message: 'Node executed without agent assignment',
        nodeTitle: node.title,
        nodeDescription: node.description,
        context,
      };
    }

    // 查找或创建会话
    let session = orchestrator.listSessions().find(
      (s) => s.title === `Blueprint_${context.executionId}`
    );

    if (!session) {
      const newSession = orchestrator.createSession(
        `Blueprint_${context.executionId}`,
        agentId,
        [agentId]
      );
      if (newSession) {
        orchestrator.startSession(newSession.id);
        session = newSession;
      }
    }

    if (!session) {
      throw new Error('Failed to create or find session for blueprint execution');
    }

    // 创建任务
    const task = orchestrator.addTask(
      session.id,
      `${node.title}: ${node.description}`,
      'high',
      agentId
    );

    if (!task) {
      throw new Error('Failed to add task for blueprint node');
    }

    // 执行任务
    const executedTask = await orchestrator.executeTask(
      session.id,
      task.id,
      llmConfig
    );

    if (!executedTask) {
      throw new Error('Task execution returned null');
    }

    if (executedTask.status === 'failed') {
      throw new Error(executedTask.error || 'Task execution failed');
    }

    return {
      taskId: executedTask.id,
      result: executedTask.result,
      agentId,
      sessionId: session.id,
    };
  }

  /**
   * 自动执行蓝图（按顺序执行所有可执行节点）
   */
  async autoExecute(
    blueprintId: string,
    llmConfig?: { apiKey: string; baseUrl: string; modelName: string }
  ): Promise<void> {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (!execution) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Execution blueprint '${blueprintId}' not found`,
        404
      );
    }

    logger.info({ blueprintId }, 'Starting auto-execution of blueprint');

    let hasMoreNodes = true;
    const maxIterations = 100; // 防止无限循环
    let iterations = 0;

    while (hasMoreNodes && iterations < maxIterations) {
      iterations++;
      const nextNodes = this.getNextNodes(blueprintId);

      if (nextNodes.length === 0) {
        hasMoreNodes = false;
        break;
      }

      // 优先执行 AI 节点
      const aiNodes = nextNodes.filter(
        (n) => n.type === 'ai_call' || n.type === 'agent'
      );
      const otherNodes = nextNodes.filter(
        (n) => n.type !== 'ai_call' && n.type !== 'agent'
      );

      // 执行 AI 节点
      for (const _aiNode of aiNodes) {
        await this.executeNextAINode(blueprintId, llmConfig);
      }

      // 自动完成其他类型节点（function/script/branch等）
      for (const node of otherNodes) {
        this.updateNodeStatus(blueprintId, node.id, 'completed', {
          autoCompleted: true,
          nodeType: node.type,
        });
      }
    }

    logger.info(
      { blueprintId, iterations, status: execution.status },
      'Blueprint auto-execution completed'
    );
  }

  private updateProgress(execution: ExecutionBlueprint): number {
    const totalNodes = execution.nodes.length;
    if (totalNodes === 0) {
      execution.progress = 100;
      return 100;
    }

    const completedNodes = execution.nodes.filter(
      (n) => n.status === 'completed' || n.status === 'skipped'
    ).length;
    const progress = Math.round((completedNodes / totalNodes) * 100);
    execution.progress = progress;

    const hasFailed = execution.nodes.some((n) => n.status === 'failed');
    if (hasFailed) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
    } else if (progress === 100) {
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
    } else if (progress > 0) {
      execution.status = 'running';
    }

    return progress;
  }
}

export const blueprintEngine = new BlueprintEngine();
