import { BaseNodeExecutor } from './baseExecutor';
import { EventExecutor } from './eventExecutor';
import { SequenceExecutor } from './sequenceExecutor';
import { BranchExecutor } from './branchExecutor';
import { GetVariableExecutor, SetVariableExecutor } from './variableExecutor';
import { PrintExecutor, CompareExecutor } from './functionExecutor';
import { AICallExecutor } from './aiCallExecutor';

export const executorRegistry: Record<string, BaseNodeExecutor> = {
  event: new EventExecutor(),
  sequence: new SequenceExecutor(),
  branch: new BranchExecutor(),
  get_variable: new GetVariableExecutor(),
  set_variable: new SetVariableExecutor(),
  print: new PrintExecutor(),
  compare: new CompareExecutor(),
  ai_call: new AICallExecutor(),
};

export function getExecutor(nodeType: string): BaseNodeExecutor | undefined {
  return executorRegistry[nodeType];
}

export function registerExecutor(nodeType: string, executor: BaseNodeExecutor): void {
  executorRegistry[nodeType] = executor;
}

export * from './baseExecutor';
