import { Agent, AgentStatus } from './types';
import { logger } from '../../utils/logger';
import { ERROR_CODES } from '../../constants';

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

class AgentRegistry {
  private registry = new Map<string, Agent>();

  registerAgent(agent: Agent): void {
    if (this.registry.has(agent.id)) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_INVALID,
        `Agent ${agent.id} already registered`,
        409
      );
    }

    this.registry.set(agent.id, agent);
    logger.info({ agentId: agent.id, type: agent.type, name: agent.name }, 'Agent registered');
  }

  unregisterAgent(agentId: string): void {
    if (!this.registry.has(agentId)) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Agent ${agentId} not found`,
        404
      );
    }

    this.registry.delete(agentId);
    logger.info({ agentId }, 'Agent unregistered');
  }

  getAgent(agentId: string): Agent | null {
    return this.registry.get(agentId) ?? null;
  }

  listAgents(): Agent[] {
    return Array.from(this.registry.values());
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    const agent = this.registry.get(agentId);
    if (!agent) {
      throw new FlowMindError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Agent ${agentId} not found`,
        404
      );
    }

    agent.status = status;
    logger.info({ agentId, status }, 'Agent status updated');
  }

  findAgentsByCapability(capability: string): Agent[] {
    return this.listAgents().filter((a) =>
      a.capabilities.includes(capability) && a.status !== 'offline'
    );
  }
}

export const agentRegistry = new AgentRegistry();
export { FlowMindError };
