import { BlueprintNode } from '../types';

export interface ExecutionContext {
  executionId: string;
  blueprintId: string;
  currentNodeId: string;
  variables: Record<string, unknown>;
  outputs: Record<string, unknown>;
  inputs: Record<string, unknown>;
  sessionId?: string;
}

export interface PinDefinition {
  id: string;
  name: string;
  type: 'execution' | 'data';
  direction: 'input' | 'output';
  dataType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

export abstract class BaseNodeExecutor {
  abstract execute(
    node: BlueprintNode,
    context: ExecutionContext
  ): Promise<Record<string, unknown>>;

  abstract validateConfig(config: Record<string, unknown>): boolean;

  abstract getInputPins(): PinDefinition[];
  abstract getOutputPins(): PinDefinition[];

  protected getConfigValue<T>(
    config: Record<string, unknown>,
    key: string,
    defaultValue?: T
  ): T | undefined {
    return (config[key] as T) ?? defaultValue;
  }

  protected interpolateTemplate(
    template: string,
    variables: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });
  }
}
