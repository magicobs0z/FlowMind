import { Dag } from './types';
import { logger } from '../../utils/logger';
import { createModuleStorage } from '../../core/storage';

const MODULE_NAME = 'dag';
const DAGS_FILE = 'dags.json';

const moduleStorage = createModuleStorage(MODULE_NAME);

class DagRepository {
  private store: Map<string, Dag> = new Map();
  private initialized = false;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.initialized) return;

    try {
      const dags = moduleStorage.readJson<Dag[]>(DAGS_FILE, []);
      if (dags && Array.isArray(dags)) {
        dags.forEach(d => this.store.set(d.id, d));
      }

      this.initialized = true;
      logger.info({ count: this.store.size }, 'DAG repository loaded from disk');
    } catch (error) {
      logger.error(error, 'Failed to load DAG repository from disk');
    }
  }

  private persist(): void {
    const dags = Array.from(this.store.values());
    moduleStorage.writeJson(DAGS_FILE, dags);
  }

  save(dag: Dag): Dag {
    dag.updatedAt = new Date().toISOString();
    this.store.set(dag.id, dag);
    this.persist();
    logger.info({ dagId: dag.id }, 'DAG saved to repository');
    return dag;
  }

  findById(id: string): Dag | null {
    const dag = this.store.get(id);
    if (!dag) {
      logger.warn({ dagId: id }, 'DAG not found in repository');
    }
    return dag ?? null;
  }

  findAll(filter?: { blueprintId?: string; workspaceId?: string }): Dag[] {
    let dags = Array.from(this.store.values());

    if (filter?.blueprintId) {
      dags = dags.filter((d) => d.blueprintId === filter.blueprintId);
    }
    if (filter?.workspaceId) {
      dags = dags.filter((d) => d.workspaceId === filter.workspaceId);
    }

    return dags;
  }

  delete(id: string): boolean {
    const deleted = this.store.delete(id);
    if (deleted) {
      this.persist();
      logger.info({ dagId: id }, 'DAG deleted from repository');
    } else {
      logger.warn({ dagId: id }, 'DAG not found for deletion');
    }
    return deleted;
  }
}

export const dagRepository = new DagRepository();
