import { BaseNodeExecutor, ExecutionContext, PinDefinition } from './baseExecutor';
import { BlueprintNode } from '../types';

export class BranchExecutor extends BaseNodeExecutor {
  execute(
    node: BlueprintNode,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const condition = this.getConfigValue<string>(node.config, 'condition', '') ?? '';
    const interpolatedCondition = this.interpolateTemplate(condition, context.variables);
    
    let result: boolean;
    try {
      result = this.evaluateCondition(interpolatedCondition, context.variables);
    } catch {
      result = false;
    }

    return Promise.resolve({
      status: 'completed',
      result,
      branch: result ? 'true' : 'false',
    });
  }

  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    if (!condition) return false;
    
    try {
      const func = new Function('variables', `with(variables) { return ${condition}; }`);
      return Boolean(func(variables));
    } catch {
      return false;
    }
  }

  validateConfig(config: Record<string, unknown>): boolean {
    return typeof config.condition === 'string' && config.condition.length > 0;
  }

  getInputPins(): PinDefinition[] {
    return [
      { id: 'exec_in', name: '执行', type: 'execution', direction: 'input' },
      { id: 'condition', name: '条件', type: 'data', direction: 'input', dataType: 'boolean' },
    ];
  }

  getOutputPins(): PinDefinition[] {
    return [
      { id: 'true', name: 'True', type: 'execution', direction: 'output' },
      { id: 'false', name: 'False', type: 'execution', direction: 'output' },
    ];
  }
}
