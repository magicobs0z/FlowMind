import {
  ExecutionBlueprint,
  BlueprintNode,
  HumanGateway,
} from './types';
import { blueprintRepository } from './repository';
import { ERROR_CODES } from '../../constants';
import { logger } from '../../utils/logger';

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

type ExecutionCallback = (
  nodeId: string,
  node: BlueprintNode
) => Promise<Record<string, unknown> | void>;

export class ExecutionEngine {
  private blueprint: ExecutionBlueprint;
  private onExecuteNode?: ExecutionCallback;

  constructor(blueprintId: string, callback?: ExecutionCallback) {
    const blueprint = blueprintRepository.findExecution(blueprintId);
    if (!blueprint) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Execution blueprint '${blueprintId}' not found`,
        404
      );
    }

    this.blueprint = blueprint;
    this.onExecuteNode = callback;
    logger.info({ blueprintId }, 'Execution engine initialized');
  }

  static fromBlueprint(blueprintId: string, callback?: ExecutionCallback): ExecutionEngine {
    return new ExecutionEngine(blueprintId, callback);
  }

  async execute(): Promise<void> {
    if (this.blueprint.status === 'running') {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_INVALID,
        'Blueprint is already running'
      );
    }

    if (this.blueprint.status === 'completed') {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_INVALID,
        'Blueprint is already completed'
      );
    }

    this.blueprint.status = 'running';
    this.blueprint.startedAt = new Date().toISOString();
    this.save();
    logger.info({ blueprintId: this.blueprint.id }, 'Execution started');

    let hasPending = true;
    while (hasPending) {
      const readyNodes = this.getNextExecutableNodes();
      if (readyNodes.length === 0) {
        const pending = this.blueprint.nodes.filter((n) => n.status === 'pending');
        if (pending.length > 0) {
          pending.forEach((n) => {
            n.status = 'skipped';
            n.error = 'Dependencies not met';
          });
          this.save();
        }
        hasPending = false;
        continue;
      }

      for (const node of readyNodes) {
        if (node.type === 'gateway') {
          const gateway = this.blueprint.humanGateways.find(
            (g) => g.nodeId === node.id
          );
          if (gateway && gateway.required) {
            this.triggerHumanGateway(gateway);
            hasPending = false;
            break;
          }
        }

        await this.executeNode(node);
      }

      const hasFailed = this.blueprint.nodes.some((n) => n.status === 'failed');
      if (hasFailed) {
        this.propagateFailure();
        break;
      }

      if (this.isComplete()) {
        hasPending = false;
      }
    }

    this.finalize();
  }

  async executeNode(node: BlueprintNode): Promise<void> {
    node.status = 'running';
    this.save();
    logger.info({ blueprintId: this.blueprint.id, nodeId: node.id }, 'Node execution started');

    try {
      let result: Record<string, unknown> | void;
      if (this.onExecuteNode) {
        result = await this.onExecuteNode(node.id, node);
      } else {
        result = {};
      }

      node.status = 'completed';
      if (result) {
        node.output = { ...node.output, ...result };
      }

      this.updateStage();
      this.save();
      logger.info({ blueprintId: this.blueprint.id, nodeId: node.id }, 'Node completed');
    } catch (error) {
      node.status = 'failed';
      node.error = error instanceof Error ? error.message : 'Unknown error';
      this.save();
      logger.error({ blueprintId: this.blueprint.id, nodeId: node.id, error }, 'Node failed');
    }
  }

  triggerHumanGateway(gateway: HumanGateway): void {
    logger.info(
      { gatewayId: gateway.id, nodeId: gateway.nodeId, gatewayType: gateway.type },
      'Human gateway triggered'
    );

    const node = this.blueprint.nodes.find((n) => n.id === gateway.nodeId);
    if (node) {
      node.status = 'running';
      this.save();
    }
  }

  async resolveHumanGateway(gatewayId: string, approved: boolean, input?: Record<string, unknown>): Promise<void> {
    const gateway = this.blueprint.humanGateways.find((g) => g.id === gatewayId);
    if (!gateway) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_INVALID,
        `Human gateway '${gatewayId}' not found`,
        404
      );
    }

    const node = this.blueprint.nodes.find((n) => n.id === gateway.nodeId);
    if (!node) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_INVALID,
        `Node '${gateway.nodeId}' not found for gateway`,
        404
      );
    }

    if (approved) {
      node.status = 'completed';
      if (input) {
        node.output = { ...node.output, ...input };
      }
    } else {
      node.status = 'failed';
      node.error = 'Human gateway rejected';
    }

    this.save();
    logger.info(
      { gatewayId, approved, blueprintId: this.blueprint.id },
      'Human gateway resolved'
    );
  }

  pause(): void {
    if (this.blueprint.status !== 'running') {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_INVALID,
        `Cannot pause blueprint with status '${this.blueprint.status}'`
      );
    }

    this.blueprint.status = 'paused';
    this.save();
    logger.info({ blueprintId: this.blueprint.id }, 'Execution paused');
  }

  async resume(): Promise<void> {
    if (this.blueprint.status !== 'paused') {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_INVALID,
        `Cannot resume blueprint with status '${this.blueprint.status}'`
      );
    }

    this.blueprint.status = 'running';
    this.save();
    logger.info({ blueprintId: this.blueprint.id }, 'Execution resumed');

    await this.execute();
  }

  cancel(): void {
    if (
      this.blueprint.status !== 'running' &&
      this.blueprint.status !== 'paused'
    ) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_INVALID,
        `Cannot cancel blueprint with status '${this.blueprint.status}'`
      );
    }

    this.blueprint.status = 'cancelled';
    this.blueprint.completedAt = new Date().toISOString();

    this.blueprint.nodes.forEach((node) => {
      if (node.status === 'pending' || node.status === 'running') {
        node.status = 'skipped';
        node.error = 'Blueprint cancelled';
      }
    });

    this.save();
    logger.info({ blueprintId: this.blueprint.id }, 'Execution cancelled');
  }

  getBlueprint(): ExecutionBlueprint {
    return {
      ...this.blueprint,
      nodes: [...this.blueprint.nodes],
      edges: [...this.blueprint.edges],
      humanGateways: [...this.blueprint.humanGateways],
    };
  }

  getPendingHumanGateways(): HumanGateway[] {
    return this.blueprint.humanGateways.filter((gateway) => {
      const node = this.blueprint.nodes.find((n) => n.id === gateway.nodeId);
      return node && node.status === 'running' && gateway.required;
    });
  }

  private getNextExecutableNodes(): BlueprintNode[] {
    return this.blueprint.nodes.filter((node) => {
      if (node.status !== 'pending') return false;

      return node.dependencies.every((depId) => {
        const depNode = this.blueprint.nodes.find((n) => n.id === depId);
        if (!depNode) return true;
        return depNode.status === 'completed' || depNode.status === 'skipped';
      });
    });
  }

  private propagateFailure(): void {
    const failedNodeIds = new Set<string>();

    this.blueprint.nodes.forEach((node) => {
      if (node.status === 'failed') {
        failedNodeIds.add(node.id);
      }
    });

    let changed = true;
    while (changed) {
      changed = false;
      this.blueprint.nodes.forEach((node) => {
        if (node.status !== 'pending') return;

        const hasFailedDep = node.dependencies.some((depId) =>
          failedNodeIds.has(depId)
        );
        if (hasFailedDep) {
          node.status = 'failed';
          node.error = `Dependency failed`;
          failedNodeIds.add(node.id);
          changed = true;
        }
      });
    }

    this.save();
  }

  private isComplete(): boolean {
    return this.blueprint.nodes.every(
      (n) =>
        n.status === 'completed' ||
        n.status === 'failed' ||
        n.status === 'skipped'
    );
  }

  private finalize(): void {
    const now = new Date().toISOString();
    this.blueprint.completedAt = now;

    const hasFailed = this.blueprint.nodes.some((n) => n.status === 'failed');
    if (hasFailed) {
      this.blueprint.status = 'failed';
    } else {
      this.blueprint.status = 'completed';
    }

    this.blueprint.progress = this.calculateProgress();
    this.save();
    logger.info(
      { blueprintId: this.blueprint.id, status: this.blueprint.status },
      'Execution finalized'
    );
  }

  private calculateProgress(): number {
    const total = this.blueprint.nodes.length;
    if (total === 0) return 100;

    const completed = this.blueprint.nodes.filter(
      (n) => n.status === 'completed' || n.status === 'skipped'
    ).length;

    return Math.round((completed / total) * 100);
  }

  private updateStage(): void {
    const stages = (this.blueprint as any).stages;
    if (!stages || stages.length === 0) return;

    const completedCount = this.blueprint.nodes.filter(
      (n) => n.status === 'completed' || n.status === 'skipped'
    ).length;
    const totalNodes = this.blueprint.nodes.length;
    const ratio = completedCount / totalNodes;

    let currentStageIndex = 0;
    for (let i = stages.length - 1; i >= 0; i--) {
      const stage = stages[i];
      const stageThreshold = stage.order / stages.length;
      if (ratio >= stageThreshold) {
        currentStageIndex = i;
        break;
      }
    }

    this.blueprint.currentStage = stages[currentStageIndex].name;
  }

  private save(): void {
    blueprintRepository.saveExecution(this.blueprint);
  }
}
