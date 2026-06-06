import { ExecutionBlueprint, BlueprintNode } from './types';
import { blueprintRepository } from './repository';
import { getExecutor } from './nodeExecutors';
import WebSocket from 'ws';

interface ExecutionContext {
  executionId: string;
  blueprintId: string;
  currentNodeId: string;
  variables: Record<string, unknown>;
  outputs: Record<string, unknown>;
  inputs: Record<string, unknown>;
}

export class ExecutionEngine {
  private execution: ExecutionBlueprint;
  private wsClients: Set<WebSocket> = new Set();
  private breakpoints: Set<string> = new Set();
  private paused: boolean = false;
  private stepMode: boolean = false;

  constructor(executionId: string) {
    const execution = blueprintRepository.findExecution(executionId);
    if (!execution) {
      throw new Error(`Execution blueprint '${executionId}' not found`);
    }
    this.execution = execution;
  }

  addWsClient(ws: WebSocket): void {
    this.wsClients.add(ws);
    ws.on('close', () => this.wsClients.delete(ws));
  }

  private broadcast(event: Record<string, unknown>): void {
    const message = JSON.stringify(event);
    this.wsClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  async execute(): Promise<void> {
    this.execution.status = 'running';
    this.execution.startedAt = new Date().toISOString();
    this.save();

    this.broadcast({
      type: 'execution.started',
      executionId: this.execution.id,
    });

    try {
      while (true) {
        if (this.paused) {
          await this.waitForResume();
        }

        const readyNodes = this.getReadyNodes();
        if (readyNodes.length === 0) {
          break;
        }

        for (const node of readyNodes) {
          if (this.breakpoints.has(node.id)) {
            this.paused = true;
            this.broadcast({
              type: 'execution.paused',
              executionId: this.execution.id,
              nodeId: node.id,
            });
            await this.waitForResume();
          }

          await this.executeNode(node);

          if (this.stepMode) {
            this.paused = true;
            this.stepMode = false;
          }
        }
      }

      this.finalize();
    } catch (error) {
      this.execution.status = 'failed';
      this.broadcast({
        type: 'execution.failed',
        executionId: this.execution.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async executeNode(node: BlueprintNode): Promise<void> {
    node.status = 'running';
    this.save();

    this.broadcast({
      type: 'node.started',
      executionId: this.execution.id,
      nodeId: node.id,
    });

    const executor = getExecutor(node.type);
    if (!executor) {
      node.status = 'failed';
      node.error = `No executor found for node type: ${node.type}`;
      this.save();
      this.broadcast({
        type: 'node.failed',
        executionId: this.execution.id,
        nodeId: node.id,
        error: node.error,
      });
      return;
    }

    const context: ExecutionContext = {
      executionId: this.execution.id,
      blueprintId: this.execution.templateId,
      currentNodeId: node.id,
      variables: this.collectVariables(),
      outputs: this.collectOutputs(),
      inputs: this.collectInputs(node),
    };

    try {
      const result = await executor.execute(node, context);

      if (result.status === 'failed') {
        node.status = 'failed';
        node.error = result.error as string;
        this.save();
        this.broadcast({
          type: 'node.failed',
          executionId: this.execution.id,
          nodeId: node.id,
          error: node.error,
        });
      } else {
        node.status = 'completed';
        node.output = result;
        this.save();
        this.broadcast({
          type: 'node.completed',
          executionId: this.execution.id,
          nodeId: node.id,
          output: result,
        });
      }
    } catch (error) {
      node.status = 'failed';
      node.error = error instanceof Error ? error.message : 'Unknown error';
      this.save();
      this.broadcast({
        type: 'node.failed',
        executionId: this.execution.id,
        nodeId: node.id,
        error: node.error,
      });
    }
  }

  private getReadyNodes(): BlueprintNode[] {
    return this.execution.nodes.filter((node) => {
      if (node.status !== 'pending') return false;

      const incomingEdges = this.execution.edges.filter((e) => e.to === node.id);
      if (incomingEdges.length === 0) return true;

      return incomingEdges.every((edge) => {
        const sourceNode = this.execution.nodes.find((n) => n.id === edge.from);
        if (!sourceNode) return true;
        return sourceNode.status === 'completed';
      });
    });
  }

  private collectVariables(): Record<string, unknown> {
    const variables: Record<string, unknown> = {};
    this.execution.nodes.forEach((node) => {
      if (node.output && node.status === 'completed') {
        Object.entries(node.output).forEach(([key, value]) => {
          variables[`${node.id}_${key}`] = value;
          variables[key] = value;
        });
      }
    });
    return variables;
  }

  private collectOutputs(): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};
    this.execution.nodes.forEach((node) => {
      if (node.output && node.status === 'completed') {
        outputs[node.id] = node.output;
      }
    });
    return outputs;
  }

  private collectInputs(node: BlueprintNode): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const incomingEdges = this.execution.edges.filter((e) => e.to === node.id);
    
    incomingEdges.forEach((edge) => {
      const sourceNode = this.execution.nodes.find((n) => n.id === edge.from);
      if (sourceNode?.output) {
        inputs[sourceNode.id] = sourceNode.output;
      }
    });

    return inputs;
  }

  private finalize(): void {
    const hasFailed = this.execution.nodes.some((n) => n.status === 'failed');
    this.execution.status = hasFailed ? 'failed' : 'completed';
    this.execution.completedAt = new Date().toISOString();
    this.save();

    this.broadcast({
      type: hasFailed ? 'execution.failed' : 'execution.completed',
      executionId: this.execution.id,
    });
  }

  private save(): void {
    blueprintRepository.saveExecution(this.execution);
  }

  pause(): void {
    this.paused = true;
    this.broadcast({
      type: 'execution.paused',
      executionId: this.execution.id,
    });
  }

  resume(): void {
    this.paused = false;
    this.broadcast({
      type: 'execution.resumed',
      executionId: this.execution.id,
    });
  }

  step(): void {
    this.stepMode = true;
    this.paused = false;
  }

  stop(): void {
    this.execution.status = 'cancelled';
    this.execution.completedAt = new Date().toISOString();
    this.save();
    this.broadcast({
      type: 'execution.stopped',
      executionId: this.execution.id,
    });
  }

  setBreakpoint(nodeId: string): void {
    this.breakpoints.add(nodeId);
  }

  removeBreakpoint(nodeId: string): void {
    this.breakpoints.delete(nodeId);
  }

  private waitForResume(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.paused) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
}
