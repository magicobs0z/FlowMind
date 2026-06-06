import { BaseNodeExecutor, ExecutionContext, PinDefinition } from './baseExecutor';
import { BlueprintNode } from '../types';

export class SequenceExecutor extends BaseNodeExecutor {
  execute(
    node: BlueprintNode,
    _context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const outputCount = this.getConfigValue<number>(node.config, 'outputCount', 2);
    
    return Promise.resolve({
      status: 'completed',
      outputCount,
    });
  }

  validateConfig(config: Record<string, unknown>): boolean {
    const outputCount = config.outputCount as number;
    return typeof outputCount === 'number' && outputCount >= 2 && outputCount <= 10;
  }

  getInputPins(): PinDefinition[] {
    return [
      { id: 'exec_in', name: '执行', type: 'execution', direction: 'input' },
    ];
  }

  getOutputPins(): PinDefinition[] {
    return [
      { id: 'exec_out_1', name: '输出1', type: 'execution', direction: 'output' },
      { id: 'exec_out_2', name: '输出2', type: 'execution', direction: 'output' },
    ];
  }
}
