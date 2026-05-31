import { Dag } from './types';
import { logger } from '../../utils/logger';

class DagRepository {
  private store: Map<string, Dag> = new Map();

  save(dag: Dag): Dag {
    dag.updatedAt = new Date().toISOString();
    this.store.set(dag.id, dag);
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
      logger.info({ dagId: id }, 'DAG deleted from repository');
    } else {
      logger.warn({ dagId: id }, 'DAG not found for deletion');
    }
    return deleted;
  }
}

export const dagRepository = new DagRepository();
