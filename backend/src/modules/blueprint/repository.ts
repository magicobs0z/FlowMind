import { ProjectBlueprint, ExecutionBlueprint } from './types';
import { logger } from '../../utils/logger';
import { createModuleStorage } from '../../core/storage';

const MODULE_NAME = 'blueprint';
const TEMPLATES_FILE = 'templates.json';
const EXECUTIONS_FILE = 'executions.json';

const moduleStorage = createModuleStorage(MODULE_NAME);

class BlueprintRepository {
  private templateStore: Map<string, ProjectBlueprint> = new Map();
  private executionStore: Map<string, ExecutionBlueprint> = new Map();
  private initialized = false;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.initialized) return;

    try {
      const templates = moduleStorage.readJson<ProjectBlueprint[]>(TEMPLATES_FILE, []);
      if (templates && Array.isArray(templates)) {
        templates.forEach(t => this.templateStore.set(t.id, t));
      }

      const executions = moduleStorage.readJson<ExecutionBlueprint[]>(EXECUTIONS_FILE, []);
      if (executions && Array.isArray(executions)) {
        executions.forEach(e => this.executionStore.set(e.id, e));
      }

      this.initialized = true;
      logger.info(
        { templates: this.templateStore.size, executions: this.executionStore.size },
        'Blueprint repository loaded from disk'
      );
    } catch (error) {
      logger.error(error, 'Failed to load blueprint repository from disk');
    }
  }

  private persistTemplates(): void {
    const templates = Array.from(this.templateStore.values());
    moduleStorage.writeJson(TEMPLATES_FILE, templates);
  }

  private persistExecutions(): void {
    const executions = Array.from(this.executionStore.values());
    moduleStorage.writeJson(EXECUTIONS_FILE, executions);
  }

  saveTemplate(blueprint: ProjectBlueprint): ProjectBlueprint {
    blueprint.updatedAt = new Date().toISOString();
    this.templateStore.set(blueprint.id, blueprint);
    this.persistTemplates();
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
      this.persistTemplates();
      logger.info({ templateId: id }, 'Blueprint template deleted');
    } else {
      logger.warn({ templateId: id }, 'Blueprint template not found for deletion');
    }
    return deleted;
  }

  saveExecution(blueprint: ExecutionBlueprint): ExecutionBlueprint {
    blueprint.updatedAt = new Date().toISOString();
    this.executionStore.set(blueprint.id, blueprint);
    this.persistExecutions();
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
      this.persistExecutions();
      logger.info({ executionId: id }, 'Execution blueprint deleted');
    } else {
      logger.warn({ executionId: id }, 'Execution blueprint not found for deletion');
    }
    return deleted;
  }
}

export const blueprintRepository = new BlueprintRepository();
