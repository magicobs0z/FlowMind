import { ProjectBlueprint, ExecutionBlueprint } from './types';
import { logger } from '../../utils/logger';

class BlueprintRepository {
  private templateStore: Map<string, ProjectBlueprint> = new Map();
  private executionStore: Map<string, ExecutionBlueprint> = new Map();

  saveTemplate(blueprint: ProjectBlueprint): ProjectBlueprint {
    blueprint.updatedAt = new Date().toISOString();
    this.templateStore.set(blueprint.id, blueprint);
    logger.info({ templateId: blueprint.id }, 'Blueprint template saved');
    return blueprint;
  }

  findTemplate(id: string): ProjectBlueprint | null {
    const blueprint = this.templateStore.get(id);
    if (!blueprint) {
      logger.warn({ templateId: id }, 'Blueprint template not found');
    }
    return blueprint ?? null;
  }

  findAllTemplates(category?: string): ProjectBlueprint[] {
    let templates = Array.from(this.templateStore.values());
    if (category) {
      templates = templates.filter((t) => t.category === category);
    }
    return templates;
  }

  deleteTemplate(id: string): boolean {
    const deleted = this.templateStore.delete(id);
    if (deleted) {
      logger.info({ templateId: id }, 'Blueprint template deleted');
    } else {
      logger.warn({ templateId: id }, 'Blueprint template not found for deletion');
    }
    return deleted;
  }

  saveExecution(blueprint: ExecutionBlueprint): ExecutionBlueprint {
    blueprint.updatedAt = new Date().toISOString();
    this.executionStore.set(blueprint.id, blueprint);
    logger.info({ executionId: blueprint.id }, 'Execution blueprint saved');
    return blueprint;
  }

  findExecution(id: string): ExecutionBlueprint | null {
    const blueprint = this.executionStore.get(id);
    if (!blueprint) {
      logger.warn({ executionId: id }, 'Execution blueprint not found');
    }
    return blueprint ?? null;
  }

  findAllExecutions(workspaceId?: string): ExecutionBlueprint[] {
    let executions = Array.from(this.executionStore.values());
    if (workspaceId) {
      executions = executions.filter((e) => e.workspaceId === workspaceId);
    }
    return executions;
  }

  deleteExecution(id: string): boolean {
    const deleted = this.executionStore.delete(id);
    if (deleted) {
      logger.info({ executionId: id }, 'Execution blueprint deleted');
    } else {
      logger.warn({ executionId: id }, 'Execution blueprint not found for deletion');
    }
    return deleted;
  }
}

export const blueprintRepository = new BlueprintRepository();
