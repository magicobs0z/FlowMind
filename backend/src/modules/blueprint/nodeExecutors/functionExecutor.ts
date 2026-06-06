import { BaseNodeExecutor, ExecutionContext, PinDefinition } from './baseExecutor';
import { BlueprintNode } from '../types';

export class PrintExecutor extends BaseNodeExecutor {
  execute(
    node: BlueprintNode,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const message = this.getConfigValue<string>(node.config, 'message', '') ?? '';
    const interpolatedMessage = this.interpolateTemplate(message, context.variables);
    
    console.log(`[Blueprint] ${interpolatedMessage}`);
    
    return Promise.resolve({
      status: 'completed',
      message: interpolatedMessage,
    });
  }

  validateConfig(config: Record<string, unknown>): boolean {
    return typeof config.message === 'string';
  }

  getInputPins(): PinDefinition[] {
    return [
      { id: 'exec_in', name: '执行', type: 'execution', direction: 'input' },
      { id: 'message', name: '消息', type: 'data', direction: 'input', dataType: 'string' },
    ];
  }

  getOutputPins(): PinDefinition[] {
    return [
      { id: 'exec_out', name: '执行', type: 'execution', direction: 'output' },
    ];
  }
}

export class CompareExecutor extends BaseNodeExecutor {
  execute(
    node: BlueprintNode,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const operator = this.getConfigValue<string>(node.config, 'operator', '==');
    const valueA = context.inputs['a'] ?? this.getConfigValue<unknown>(node.config, 'a', 0);
    const valueB = context.inputs['b'] ?? this.getConfigValue<unknown>(node.config, 'b', 0);
    
    let result: boolean;
    switch (operator) {
      case '==': result = valueA == valueB; break;
      case '===': result = valueA === valueB; break;
      case '!=': result = valueA != valueB; break;
      case '!==': result = valueA !== valueB; break;
      case '>': result = (valueA as number) > (valueB as number); break;
      case '<': result = (valueA as number) < (valueB as number); break;
      case '>=': result = (valueA as number) >= (valueB as number); break;
      case '<=': result = (valueA as number) <= (valueB as number); break;
      default: result = false;
    }

    return Promise.resolve({
      status: 'completed',
      result,
      operator,
      a: valueA,
      b: valueB,
    });
  }

  validateConfig(config: Record<string, unknown>): boolean {
    const validOperators = ['==', '===', '!=', '!==', '>', '<', '>=', '<='];
    return validOperators.includes(config.operator as string);
  }

  getInputPins(): PinDefinition[] {
    return [
      { id: 'a', name: '值A', type: 'data', direction: 'input' },
      { id: 'b', name: '值B', type: 'data', direction: 'input' },
    ];
  }

  getOutputPins(): PinDefinition[] {
    return [
      { id: 'result', name: '结果', type: 'data', direction: 'output', dataType: 'boolean' },
    ];
  }
}
