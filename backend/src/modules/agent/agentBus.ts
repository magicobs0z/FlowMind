import {
  Agent,
  AgentStatus,
  AgentRequest,
  AgentResponse,
  AgentNotification,
  ConflictResult,
  NegotiationRequest,
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

class AgentBus {
  private requests = new Map<string, AgentRequest>();
  private notifications = new Map<string, AgentNotification>();
  private requestCounter = 0;
  private notificationCounter = 0;

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
}

export const agentBus = new AgentBus();
