import { BaseNodeExecutor, ExecutionContext, PinDefinition } from './baseExecutor';
import { BlueprintNode } from '../types';

export class GetVariableExecutor extends BaseNodeExecutor {
  execute(
    node: BlueprintNode,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const variableName = this.getConfigValue<string>(node.config, 'variableName', '') ?? '';
    const value = context.variables[variableName];
    
    return Promise.resolve({
      status: 'completed',
      value,
      variableName,
    });
  }

  validateConfig(config: Record<string, unknown>): boolean {
    return typeof config.variableName === 'string' && config.variableName.length > 0;
  }

  getInputPins(): PinDefinition[] {
    return [];
  }

  getOutputPins(): PinDefinition[] {
    return [
      { id: 'value', name: '值', type: 'data', direction: 'output' },
    ];
  }
}

export class SetVariableExecutor extends BaseNodeExecutor {
  execute(
    node: BlueprintNode,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const variableName = this.getConfigValue<string>(node.config, 'variableName', '');
    const value = this.getConfigValue<unknown>(node.config, 'value', '');
    
    const interpolatedValue = typeof value === 'string' 
      ? this.interpolateTemplate(value, context.variables)
      : value;
    
    return Promise.resolve({
      status: 'completed',
      variableName,
      value: interpolatedValue,
    });
  }

  validateConfig(config: Record<string, unknown>): boolean {
    return typeof config.variableName === 'string' && config.variableName.length > 0;
  }

  getInputPins(): PinDefinition[] {
    return [
      { id: 'exec_in', name: '执行', type: 'execution', direction: 'input' },
      { id: 'value', name: '值', type: 'data', direction: 'input' },
    ];
  }

  getOutputPins(): PinDefinition[] {
    return [
      { id: 'exec_out', name: '执行', type: 'execution', direction: 'output' },
    ];
  }
}
