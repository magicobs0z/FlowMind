import { BaseNodeExecutor, ExecutionContext, PinDefinition } from './baseExecutor';
import { BlueprintNode } from '../types';
import { orchestrator } from '../../agent/orchestrator';
import { logger } from '../../../utils/logger';

export class AICallExecutor extends BaseNodeExecutor {
  async execute(
    node: BlueprintNode,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const agentId = this.getConfigValue<string>(node.config, 'agentId', '') ?? '';
    const prompt = this.getConfigValue<string>(node.config, 'prompt', '') ?? '';
    const interpolatedPrompt = this.interpolateTemplate(prompt, context.variables);

    if (!agentId) {
      return {
        status: 'failed',
        error: 'No agentId specified',
      };
    }

    try {
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
        throw new Error('Failed to create session for blueprint execution');
      }

      const task = orchestrator.addTask(
        session.id,
        interpolatedPrompt,
        'high',
        agentId
      );

      if (!task) {
        throw new Error('Failed to add task');
      }

      const executedTask = await orchestrator.executeTask(session.id, task.id);

      if (!executedTask || executedTask.status === 'failed') {
        throw new Error(executedTask?.error || 'Task execution failed');
      }

      return {
        status: 'completed',
        result: executedTask.result,
        agentId,
        sessionId: session.id,
      };
    } catch (error) {
      logger.error({ error, nodeId: node.id }, 'AI call execution failed');
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validateConfig(config: Record<string, unknown>): boolean {
    return typeof config.agentId === 'string' && config.agentId.length > 0;
  }

  getInputPins(): PinDefinition[] {
    return [
      { id: 'exec_in', name: '执行', type: 'execution', direction: 'input' },
      { id: 'task', name: '任务', type: 'data', direction: 'input', dataType: 'object' },
    ];
  }

  getOutputPins(): PinDefinition[] {
    return [
      { id: 'success', name: '成功', type: 'execution', direction: 'output' },
      { id: 'failed', name: '失败', type: 'execution', direction: 'output' },
      { id: 'result', name: '结果', type: 'data', direction: 'output' },
    ];
  }
}
