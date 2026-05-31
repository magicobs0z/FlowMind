import {
  ProjectBlueprint,
  ExecutionBlueprint,
  BlueprintNode,
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

export class BlueprintEngine {
  createTemplate(
    blueprint: Omit<ProjectBlueprint, 'id' | 'createdAt' | 'updatedAt'>
  ): ProjectBlueprint {
    const now = new Date().toISOString();
    const id = `bp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const template: ProjectBlueprint = {
      ...blueprint,
      id,
      createdAt: now,
      updatedAt: now,
    };

    blueprintRepository.saveTemplate(template);
    logger.info({ templateId: id }, 'Blueprint template created');
    return template;
  }

  getTemplate(templateId: string): ProjectBlueprint | null {
    const template = blueprintRepository.findTemplate(templateId);
    if (template) {
      logger.debug({ templateId }, 'Blueprint template retrieved');
    }
    return template;
  }

  listTemplates(category?: string): ProjectBlueprint[] {
    const templates = blueprintRepository.findAllTemplates(category);
    logger.info({ count: templates.length, category }, 'Blueprint templates listed');
    return templates;
  }

  generateExecutionBlueprint(
    templateId: string,
    taskDoc: { title: string; description: string; requirements: string[] }
  ): ExecutionBlueprint {
    const template = blueprintRepository.findTemplate(templateId);
    if (!template) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Template '${templateId}' not found`,
        404
      );
    }

    const now = new Date().toISOString();
    const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const nodes: BlueprintNode[] = template.nodes.map((node) => ({
      ...node,
      status: 'pending',
      output: {},
      error: undefined,
    }));

    const execution: ExecutionBlueprint = {
      id,
      templateId,
      taskId: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      workspaceId: 'default',
      title: taskDoc.title,
      nodes,
      edges: template.edges,
      humanGateways: template.humanGateways,
      status: 'draft',
      progress: 0,
      currentStage: template.stages[0]?.name,
      createdAt: now,
      updatedAt: now,
    };

    blueprintRepository.saveExecution(execution);
    logger.info({ executionId: id, templateId }, 'Execution blueprint generated');
    return execution;
  }

  updateNodeStatus(
    blueprintId: string,
    nodeId: string,
    status: BlueprintNode['status'],
    output?: Record<string, unknown>
  ): void {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (!execution) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Execution blueprint '${blueprintId}' not found`,
        404
      );
    }

    const node = execution.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_INVALID,
        `Node '${nodeId}' not found in blueprint`,
        404
      );
    }

    const now = new Date().toISOString();
    node.status = status;

    if (status === 'running') {
      execution.status = 'running';
      if (!execution.startedAt) {
        execution.startedAt = now;
      }
    } else if (status === 'completed' && output) {
      node.output = { ...node.output, ...output };
    } else if (status === 'failed' && output?.error) {
      node.error = output.error as string;
    }

    this.updateProgress(execution);
    execution.updatedAt = now;

    blueprintRepository.saveExecution(execution);
    logger.info({ blueprintId, nodeId, status }, 'Blueprint node status updated');
  }

  getExecutionBlueprint(blueprintId: string): ExecutionBlueprint | null {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (execution) {
      logger.debug({ blueprintId }, 'Execution blueprint retrieved');
    }
    return execution;
  }

  listExecutionBlueprints(workspaceId?: string): ExecutionBlueprint[] {
    const executions = blueprintRepository.findAllExecutions(workspaceId);
    logger.info({ count: executions.length, workspaceId }, 'Execution blueprints listed');
    return executions;
  }

  calculateProgress(blueprintId: string): number {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (!execution) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Execution blueprint '${blueprintId}' not found`,
        404
      );
    }

    return this.updateProgress(execution);
  }

  getNextNodes(blueprintId: string): BlueprintNode[] {
    const execution = blueprintRepository.findExecution(blueprintId);
    if (!execution) {
      throw new FlowMindError(
        ERROR_CODES.BLUEPRINT_NOT_FOUND,
        `Execution blueprint '${blueprintId}' not found`,
        404
      );
    }

    return execution.nodes.filter((node) => {
      if (node.status !== 'pending') return false;

      return node.dependencies.every((depId) => {
        const depNode = execution.nodes.find((n) => n.id === depId);
        if (!depNode) return true;
        return depNode.status === 'completed' || depNode.status === 'skipped';
      });
    });
  }

  private updateProgress(execution: ExecutionBlueprint): number {
    const totalNodes = execution.nodes.length;
    if (totalNodes === 0) {
      execution.progress = 100;
      return 100;
    }

    const completedNodes = execution.nodes.filter(
      (n) => n.status === 'completed' || n.status === 'skipped'
    ).length;
    const progress = Math.round((completedNodes / totalNodes) * 100);
    execution.progress = progress;

    const hasFailed = execution.nodes.some((n) => n.status === 'failed');
    if (hasFailed) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
    } else if (progress === 100) {
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
    } else if (progress > 0) {
      execution.status = 'running';
    }

    return progress;
  }
}

export const blueprintEngine = new BlueprintEngine();
