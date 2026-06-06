import { BaseNodeExecutor, ExecutionContext, PinDefinition } from './baseExecutor';
import { BlueprintNode } from '../types';

export class EventExecutor extends BaseNodeExecutor {
  execute(
    node: BlueprintNode,
    _context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const trigger = this.getConfigValue<string>(node.config, 'trigger', 'manual');
    
    return Promise.resolve({
      status: 'triggered',
      trigger,
      timestamp: new Date().toISOString(),
    });
  }

  validateConfig(config: Record<string, unknown>): boolean {
    const validTriggers = ['manual', 'scheduled', 'webhook'];
    return validTriggers.includes(config.trigger as string);
  }

  getInputPins(): PinDefinition[] {
    return [];
  }

  getOutputPins(): PinDefinition[] {
    return [
      { id: 'exec_out', name: '执行', type: 'execution', direction: 'output' },
    ];
  }
}
