import { Dag, DagNode, TaskStatus, EdgeType } from './types';
import { dagRepository } from './repository';
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

export class DagEngine {
  private dag: Dag;

  constructor(blueprintId: string, workspaceId: string, dagId?: string) {
    const now = new Date().toISOString();
    this.dag = {
      id: dagId || `dag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      blueprintId,
      workspaceId,
      nodes: [],
      edges: [],
      status: 'initializing',
      metadata: {
        totalNodes: 0,
        completedNodes: 0,
        runningNodes: 0,
        pendingNodes: 0,
        failedNodes: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
    dagRepository.save(this.dag);
    logger.info({ dagId: this.dag.id }, 'DAG engine initialized');
  }

  static fromExisting(dagId: string): DagEngine {
    const dag = dagRepository.findById(dagId);
    if (!dag) {
      throw new FlowMindError(ERROR_CODES.DAG_INVALID, 'DAG not found', 404);
    }
    const engine = new DagEngine(dag.blueprintId, dag.workspaceId, dag.id);
    engine.dag = dag;
    return engine;
  }

  createNode(node: Omit<DagNode, 'id' | 'createdAt' | 'updatedAt'>): DagNode {
    const now = new Date().toISOString();
    const newNode: DagNode = {
      ...node,
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.dag.nodes.push(newNode);
    this.recalculateMetadata();
    this.dagRepositorySave();

    logger.info({ dagId: this.dag.id, nodeId: newNode.id }, 'Node created');
    return newNode;
  }

  addEdge(from: string, to: string, type: EdgeType): void {
    if (!this.getNode(from)) {
      throw new FlowMindError(ERROR_CODES.DAG_INVALID, `Source node '${from}' not found`);
    }
    if (!this.getNode(to)) {
      throw new FlowMindError(ERROR_CODES.DAG_INVALID, `Target node '${to}' not found`);
    }

    const edgeExists = this.dag.edges.some(
      (e) => e.from === from && e.to === to
    );
    if (edgeExists) {
      throw new FlowMindError(ERROR_CODES.DAG_INVALID, 'Edge already exists');
    }

    this.dag.edges.push({ from, to, type });

    const toNode = this.getNode(to)!;
    if (!toNode.dependencies.includes(from)) {
      toNode.dependencies.push(from);
      toNode.updatedAt = new Date().toISOString();
    }

    if (this.detectCycle()) {
      this.dag.edges = this.dag.edges.filter(
        (e) => !(e.from === from && e.to === to)
      );
      toNode.dependencies = toNode.dependencies.filter((d) => d !== from);
      toNode.updatedAt = new Date().toISOString();
      throw new FlowMindError(
        ERROR_CODES.DAG_CYCLE_DETECTED,
        'Adding this edge would create a cycle'
      );
    }

    this.recalculateMetadata();
    this.dagRepositorySave();
    logger.info({ dagId: this.dag.id, from, to, type }, 'Edge added');
  }

  removeNode(nodeId: string): void {
    const node = this.getNode(nodeId);
    if (!node) {
      throw new FlowMindError(ERROR_CODES.DAG_INVALID, `Node '${nodeId}' not found`, 404);
    }

    const downstream = this.getDownstreamNodes(nodeId);

    this.dag.nodes = this.dag.nodes.filter((n) => n.id !== nodeId);

    this.dag.edges = this.dag.edges.filter(
      (e) => e.from !== nodeId && e.to !== nodeId
    );

    for (const downId of downstream) {
      const downNode = this.getNode(downId);
      if (downNode) {
        downNode.dependencies = downNode.dependencies.filter((d) => d !== nodeId);
        downNode.updatedAt = new Date().toISOString();
      }
    }

    this.recalculateMetadata();
    this.dagRepositorySave();
    logger.info({ dagId: this.dag.id, nodeId }, 'Node removed with cascade');
  }

  removeEdge(from: string, to: string): void {
    const edgeIndex = this.dag.edges.findIndex(
      (e) => e.from === from && e.to === to
    );
    if (edgeIndex === -1) {
      throw new FlowMindError(ERROR_CODES.DAG_INVALID, 'Edge not found', 404);
    }

    this.dag.edges.splice(edgeIndex, 1);

    const toNode = this.getNode(to);
    if (toNode) {
      toNode.dependencies = toNode.dependencies.filter((d) => d !== from);
      toNode.updatedAt = new Date().toISOString();
    }

    this.recalculateMetadata();
    this.dagRepositorySave();
    logger.info({ dagId: this.dag.id, from, to }, 'Edge removed');
  }

  detectCycle(): boolean {
    const adj: Map<string, string[]> = new Map();
    const nodeIds = new Set(this.dag.nodes.map((n) => n.id));

    for (const node of this.dag.nodes) {
      adj.set(node.id, []);
    }
    for (const edge of this.dag.edges) {
      if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
        adj.get(edge.from)!.push(edge.to);
      }
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  getExecutableNodes(): DagNode[] {
    return this.dag.nodes.filter((node) => {
      if (node.status !== 'pending') return false;

      const deps = node.dependencies;
      return deps.every((depId) => {
        const depNode = this.getNode(depId);
        if (!depNode) return true;

        const edge = this.dag.edges.find(
          (e) => e.from === depId && e.to === node.id
        );
        if (edge?.type === 'soft') {
          return depNode.status === 'completed' || depNode.status === 'skipped';
        }
        return depNode.status === 'completed' || depNode.status === 'skipped';
      });
    });
  }

  updateNodeStatus(
    nodeId: string,
    status: TaskStatus,
    output?: Record<string, unknown>
  ): void {
    const node = this.getNode(nodeId);
    if (!node) {
      throw new FlowMindError(ERROR_CODES.DAG_INVALID, `Node '${nodeId}' not found`, 404);
    }

    const now = new Date().toISOString();
    node.status = status;
    node.updatedAt = now;

    if (status === 'running') {
      node.startedAt = now;
    } else if (status === 'completed') {
      node.completedAt = now;
      if (output) {
        node.output = { ...node.output, ...output };
      }
    } else if (status === 'failed') {
      node.completedAt = now;
      if (output?.error) {
        node.error = output.error as string;
      }
    }

    if (status === 'failed') {
      this.blockDownstreamHardDeps(nodeId);
    }

    if (this.dag.status === 'initializing') {
      this.dag.status = 'running';
    }

    this.recalculateMetadata();
    this.dagRepositorySave();
    logger.info({ dagId: this.dag.id, nodeId, status }, 'Node status updated');
  }

  pruneNode(nodeId: string): void {
    const node = this.getNode(nodeId);
    if (!node) {
      throw new FlowMindError(ERROR_CODES.DAG_INVALID, `Node '${nodeId}' not found`, 404);
    }

    if (node.status === 'running') {
      throw new FlowMindError(
        ERROR_CODES.DAG_INVALID,
        'Cannot prune a running node'
      );
    }

    node.status = 'skipped';
    node.updatedAt = new Date().toISOString();

    const downstream = this.getDownstreamNodes(nodeId);
    for (const downId of downstream) {
      const downNode = this.getNode(downId);
      if (downNode && downNode.status === 'pending') {
        const hasHardPendingDep = downNode.dependencies.some((depId) => {
          const depNode = this.getNode(depId);
          const edge = this.dag.edges.find(
            (e) => e.from === depId && e.to === downId
          );
          if (!depNode) return false;
          if (edge?.type === 'soft') return false;
          return (
            depNode.status === 'skipped' ||
            depNode.status === 'failed' ||
            depNode.status === 'blocked'
          );
        });

        if (hasHardPendingDep) {
          downNode.status = 'skipped';
          downNode.updatedAt = new Date().toISOString();
        }
      }
    }

    this.recalculateMetadata();
    this.dagRepositorySave();
    logger.info({ dagId: this.dag.id, nodeId }, 'Node pruned');
  }

  growNode(
    parentId: string,
    node: Omit<DagNode, 'id' | 'createdAt' | 'updatedAt'>
  ): DagNode {
    const parent = this.getNode(parentId);
    if (!parent) {
      throw new FlowMindError(ERROR_CODES.DAG_INVALID, `Parent node '${parentId}' not found`, 404);
    }

    const newNode = this.createNode({
      ...node,
      dependencies: [...node.dependencies, parentId],
    });

    this.addEdge(parentId, newNode.id, 'hard');

    logger.info({ dagId: this.dag.id, parentId, childId: newNode.id }, 'Node grown');
    return newNode;
  }

  getDag(): Dag {
    return { ...this.dag, nodes: [...this.dag.nodes], edges: [...this.dag.edges] };
  }

  getMetrics(): Dag['metadata'] {
    return { ...this.dag.metadata };
  }

  getNode(nodeId: string): DagNode | null {
    return this.dag.nodes.find((n) => n.id === nodeId) ?? null;
  }

  getDownstreamNodes(nodeId: string): string[] {
    const result: string[] = [];
    const queue: string[] = [nodeId];
    const visited = new Set<string>([nodeId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const edges = this.dag.edges.filter((e) => e.from === current);

      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          result.push(edge.to);
          queue.push(edge.to);
        }
      }
    }

    return result;
  }

  private blockDownstreamHardDeps(failedNodeId: string): void {
    const downstream = this.getDownstreamNodes(failedNodeId);
    for (const downId of downstream) {
      const downNode = this.getNode(downId);
      if (!downNode) continue;

      const edge = this.dag.edges.find(
        (e) => e.from === failedNodeId && e.to === downId
      );
      if (edge?.type === 'hard' && downNode.status === 'pending') {
        downNode.status = 'blocked';
        downNode.updatedAt = new Date().toISOString();
        downNode.error = `Blocked due to failure in dependency: ${failedNodeId}`;
      }
    }
  }

  private recalculateMetadata(): void {
    const nodes = this.dag.nodes;
    this.dag.metadata = {
      totalNodes: nodes.length,
      completedNodes: nodes.filter((n) => n.status === 'completed').length,
      runningNodes: nodes.filter((n) => n.status === 'running').length,
      pendingNodes: nodes.filter((n) => n.status === 'pending').length,
      failedNodes: nodes.filter((n) => n.status === 'failed').length,
    };

    if (this.dag.metadata.failedNodes > 0) {
      this.dag.status = 'failed';
    } else if (this.dag.metadata.completedNodes === this.dag.metadata.totalNodes && this.dag.metadata.totalNodes > 0) {
      this.dag.status = 'completed';
    } else if (this.dag.metadata.runningNodes > 0) {
      this.dag.status = 'running';
    }

    this.dag.updatedAt = new Date().toISOString();
  }

  private dagRepositorySave(): void {
    dagRepository.save(this.dag);
  }
}
