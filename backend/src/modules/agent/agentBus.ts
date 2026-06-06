import {
  Agent,
  AgentStatus,
  AgentRequest,
  AgentResponse,
  AgentNotification,
  ConflictResult,
  NegotiationRequest,
  AgentType,
} from './types';
import { agentRegistry } from './agentRegistry';
import { conflictDetector } from './conflictDetector';
import { contractValidator } from './contractValidator';
import { logger } from '../../utils/logger';
import { ERROR_CODES, HTTP_STATUS } from '../../constants';

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

interface DelegatedTask {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  task: Record<string, unknown>;
  sessionId?: string;
  status: 'pending' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  timestamp: string;
}

class AgentBus {
  private requests = new Map<string, AgentRequest>();
  private notifications = new Map<string, AgentNotification>();
  private requestCounter = 0;
  private notificationCounter = 0;
  private delegatedTasks = new Map<string, DelegatedTask>();
  private taskCounter = 0;

  // 层级权重定义，数值越大层级越高
  private static readonly AGENT_HIERARCHY: Record<AgentType, number> = {
    lead: 3,
    sub_lead: 2,
    coder: 1,
    reviewer: 1,
    tester: 1,
    explorer: 0,
    custom: 0,
  };

  registerAgent(agent: Agent): void {
    agentRegistry.registerAgent(agent);
  }

  unregisterAgent(agentId: string): void {
    agentRegistry.unregisterAgent(agentId);
  }

  getAgent(agentId: string): Agent | null {
    return agentRegistry.getAgent(agentId);
  }

  listAgents(): Agent[] {
    return agentRegistry.listAgents();
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    agentRegistry.updateAgentStatus(agentId, status);
  }

  async sendRequest(
    request: Omit<AgentRequest, 'id' | 'status' | 'timestamp'>
  ): Promise<AgentResponse> {
    const fromAgent = agentRegistry.getAgent(request.from);
    const toAgent = agentRegistry.getAgent(request.to);

    if (!fromAgent) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Source agent ${request.from} not found`,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (!toAgent) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Target agent ${request.to} not found`,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (toAgent.status === 'offline') {
      throw new FlowMindError(
        ERROR_CODES.AGENT_INVALID,
        `Target agent ${request.to} is offline`,
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    if (request.contract) {
      const validation = contractValidator.validateContract(request.contract);
      if (!validation.isValid) {
        throw new FlowMindError(
          ERROR_CODES.CONTRACT_INVALID,
          `Invalid contract: ${validation.errors.join(', ')}`,
          HTTP_STATUS.UNPROCESSABLE_ENTITY
        );
      }
    }

    const conflictResult = conflictDetector.detectConflict({
      type: request.type as string,
      target: request.to,
      agentId: request.from,
    });

    if (conflictResult.resolution === 'human_intervention') {
      throw new FlowMindError(
        ERROR_CODES.VALIDATION_ERROR,
        `Conflict detected: ${conflictResult.conflicts[0]?.description}`,
        HTTP_STATUS.CONFLICT
      );
    }

    this.requestCounter += 1;
    const id = `req_${Date.now()}_${this.requestCounter}`;
    const timestamp = new Date().toISOString();
    const timeoutAt = request.timeoutAt;

    const agentRequest: AgentRequest = {
      ...request,
      id,
      status: 'pending',
      timestamp,
      timeoutAt,
    };

    this.requests.set(id, agentRequest);

    agentRegistry.updateAgentStatus(toAgent.id, 'busy');

    logger.info(
      { requestId: id, from: request.from, to: request.to, type: request.type },
      'Agent request sent'
    );

    const response: AgentResponse = {
      requestId: id,
      from: request.to,
      data: { status: 'acknowledged', message: 'Request received and processed' },
      contract: request.contract,
      timestamp: new Date().toISOString(),
    };

    agentRequest.status = 'resolved';

    agentRegistry.updateAgentStatus(toAgent.id, 'idle');

    return response;
  }

  broadcastNotification(
    notification: Omit<AgentNotification, 'id' | 'timestamp'>
  ): void {
    this.notificationCounter += 1;
    const id = `notif_${Date.now()}_${this.notificationCounter}`;
    const timestamp = new Date().toISOString();

    const agentNotification: AgentNotification = {
      ...notification,
      id,
      timestamp,
    };

    this.notifications.set(id, agentNotification);

    logger.info(
      { notificationId: id, type: notification.type, senderId: notification.senderId, recipientCount: notification.recipients.length },
      'Notification broadcasted'
    );
  }

  detectConflict(operation: {
    type: string;
    target: string;
    agentId: string;
  }): ConflictResult {
    return conflictDetector.detectConflict(operation);
  }

  async negotiate(
    req: NegotiationRequest
  ): Promise<{ accepted: boolean; data?: Record<string, unknown> }> {
    const requester = agentRegistry.getAgent(req.requesterId);
    const responder = agentRegistry.getAgent(req.responderId);

    if (!requester) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Requester agent ${req.requesterId} not found`,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (!responder) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Responder agent ${req.responderId} not found`,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (responder.status === 'offline' || responder.status === 'error') {
      return { accepted: false, data: { reason: `Agent ${responder.id} is ${responder.status}` } };
    }

    const conflictResult = conflictDetector.detectConflict({
      type: 'resource_lock',
      target: JSON.stringify(req.request),
      agentId: req.requesterId,
    });

    if (conflictResult.hasConflict && conflictResult.resolution === 'human_intervention') {
      return { accepted: false, data: { reason: 'Conflict requires human intervention' } };
    }

    // 基于智能体层级的协商策略
    const requesterLevel = AgentBus.AGENT_HIERARCHY[requester.type] ?? 0;
    const responderLevel = AgentBus.AGENT_HIERARCHY[responder.type] ?? 0;

    // lead 可以强制分配任务给 sub_lead 或更低层级
    if (requesterLevel > responderLevel && requester.type === 'lead') {
      logger.info(
        { requesterId: requester.id, responderId: responder.id },
        'Lead forced task assignment via hierarchy'
      );
      return { accepted: true, data: { message: 'Forced assignment by lead', responderId: responder.id } };
    }

    // coder 可以拒绝超载任务（假设 payload 中有 workload 字段）
    if (responder.type === 'coder') {
      const workload = req.request?.workload as number | undefined;
      if (workload && workload > 5) {
        logger.info(
          { responderId: responder.id, workload },
          'Coder rejected overloaded task'
        );
        return { accepted: false, data: { reason: 'Coder overloaded', workload } };
      }
    }

    const hasRequiredCapabilities = req.responderId.toLowerCase().includes(
      (req.request.role as string)?.toLowerCase() || ''
    );

    if (hasRequiredCapabilities) {
      return { accepted: true, data: { message: 'Negotiation accepted', responderId: req.responderId } };
    }

    return { accepted: false, data: { reason: 'Responder does not have required capabilities' } };
  }

  getRequestHistory(agentId?: string): AgentRequest[] {
    const allRequests = Array.from(this.requests.values());

    if (agentId) {
      return allRequests.filter(
        (r) => r.from === agentId || r.to === agentId
      );
    }

    return allRequests;
  }

  // 层级路由：根据请求类型和目标智能体类型自动路由
  async routeRequest(
    request: Omit<AgentRequest, 'id' | 'status' | 'timestamp'>
  ): Promise<AgentResponse> {
    const toAgent = agentRegistry.getAgent(request.to);
    if (!toAgent) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Target agent ${request.to} not found`,
        HTTP_STATUS.NOT_FOUND
      );
    }

    let finalRequest = { ...request };

    // lead 收到的任务分配请求 → 转发给 sub_lead
    if (toAgent.type === 'lead' && request.type === 'task_assignment') {
      const subLead = this.findAvailableAgentByType('sub_lead');
      if (subLead) {
        finalRequest.to = subLead.id;
        logger.info(
          { originalTarget: request.to, routedTo: subLead.id, type: request.type },
          'Routed task_assignment from lead to sub_lead'
        );
      }
    }

    // sub_lead 收到的请求按类型路由
    if (toAgent.type === 'sub_lead') {
      if (request.type === 'task_assignment') {
        // 任务分配请求可以留在 sub_lead，也可以进一步细分（这里保持不动，或根据 payload 决定）
      } else {
        const targetType = this.mapRequestTypeToAgentType(request.type);
        if (targetType) {
          const targetAgent = this.findAvailableAgentByType(targetType);
          if (targetAgent) {
            finalRequest.to = targetAgent.id;
            logger.info(
              { originalTarget: request.to, routedTo: targetAgent.id, type: request.type },
              `Routed ${request.type} from sub_lead to ${targetType}`
            );
          }
        }
      }
    }

    return this.sendRequest(finalRequest);
  }

  // 将请求类型映射到智能体类型（用于 sub_lead 路由）
  private mapRequestTypeToAgentType(requestType: string): AgentType | null {
    switch (requestType) {
      case 'code_generation':
      case 'code_refactor':
        return 'coder';
      case 'code_review':
      case 'review_request':
        return 'reviewer';
      case 'test_request':
      case 'test_execution':
        return 'tester';
      default:
        return null;
    }
  }

  private findAvailableAgentByType(type: AgentType): Agent | null {
    const agents = agentRegistry.listAgents().filter(
      (a) => a.type === type && a.status !== 'offline' && a.status !== 'error'
    );
    if (agents.length === 0) return null;
    // 优先选择 idle 状态的 agent
    const idle = agents.find((a) => a.status === 'idle');
    return idle ?? agents[0] ?? null;
  }

  // 任务委托
  async delegateTask(
    fromAgentId: string,
    toAgentId: string,
    task: Record<string, unknown>
  ): Promise<DelegatedTask> {
    const fromAgent = agentRegistry.getAgent(fromAgentId);
    const toAgent = agentRegistry.getAgent(toAgentId);

    if (!fromAgent) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Source agent ${fromAgentId} not found`,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (!toAgent) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Target agent ${toAgentId} not found`,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (toAgent.status === 'offline') {
      throw new FlowMindError(
        ERROR_CODES.AGENT_INVALID,
        `Target agent ${toAgentId} is offline`,
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    this.taskCounter += 1;
    const id = `task_${Date.now()}_${this.taskCounter}`;
    const delegatedTask: DelegatedTask = {
      id,
      fromAgentId,
      toAgentId,
      task,
      sessionId: task.sessionId as string | undefined,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    this.delegatedTasks.set(id, delegatedTask);

    logger.info(
      { taskId: id, from: fromAgentId, to: toAgentId },
      'Task delegated'
    );

    // 模拟异步处理：更新状态为完成
    delegatedTask.status = 'completed';
    delegatedTask.result = { message: 'Task processed', taskId: id };

    return delegatedTask;
  }

  // 汇总会话中所有任务结果
  aggregateResults(sessionId: string): {
    sessionId: string;
    total: number;
    completed: number;
    failed: number;
    pending: number;
    results: Array<{
      taskId: string;
      status: string;
      fromAgentId: string;
      toAgentId: string;
      result?: Record<string, unknown>;
    }>;
  } {
    const tasks = Array.from(this.delegatedTasks.values()).filter(
      (t) => t.sessionId === sessionId
    );

    const completed = tasks.filter((t) => t.status === 'completed').length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const pending = tasks.filter((t) => t.status === 'pending').length;

    return {
      sessionId,
      total: tasks.length,
      completed,
      failed,
      pending,
      results: tasks.map((t) => ({
        taskId: t.id,
        status: t.status,
        fromAgentId: t.fromAgentId,
        toAgentId: t.toAgentId,
        result: t.result,
      })),
    };
  }

  getDelegatedTask(taskId: string): DelegatedTask | undefined {
    return this.delegatedTasks.get(taskId);
  }
}

export const agentBus = new AgentBus();
