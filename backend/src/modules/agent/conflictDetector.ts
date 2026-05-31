import { ConflictResult, Conflict } from './types';
import { logger } from '../../utils/logger';

interface ResourceLock {
  target: string;
  agentId: string;
  lockedAt: string;
  timeoutAt: string;
}

class ConflictDetector {
  private locks = new Map<string, ResourceLock>();
  private fileWrites = new Map<string, string[]>();

  detectConflict(operation: { type: string; target: string; agentId: string }): ConflictResult {
    const conflicts: Conflict[] = [];

    switch (operation.type) {
      case 'file_write':
        this.detectFileWriteConflict(operation, conflicts);
        break;
      case 'resource_lock':
        this.detectResourceLockConflict(operation, conflicts);
        break;
      case 'contract_mismatch':
        this.detectContractMismatchConflict(operation, conflicts);
        break;
    }

    const result: ConflictResult = {
      hasConflict: conflicts.length > 0,
      conflicts,
      resolution: this.resolve(conflicts),
    };

    logger.info(
      { operation, hasConflict: result.hasConflict, conflictCount: conflicts.length },
      'Conflict detection completed'
    );

    return result;
  }

  private detectFileWriteConflict(
    operation: { type: string; target: string; agentId: string },
    conflicts: Conflict[]
  ): void {
    const existingWriters = this.fileWrites.get(operation.target) || [];
    if (existingWriters.length > 0 && !existingWriters.includes(operation.agentId)) {
      conflicts.push({
        type: 'file_write',
        description: `File ${operation.target} is being written by agents: ${existingWriters.join(', ')}`,
        severity: 'high',
      });
    }
  }

  private detectResourceLockConflict(
    operation: { type: string; target: string; agentId: string },
    conflicts: Conflict[]
  ): void {
    const lock = this.locks.get(operation.target);
    if (lock && lock.agentId !== operation.agentId) {
      const isExpired = new Date(lock.timeoutAt) < new Date();
      if (!isExpired) {
        conflicts.push({
          type: 'resource_lock',
          description: `Resource ${operation.target} is locked by agent ${lock.agentId} until ${lock.timeoutAt}`,
          severity: 'medium',
        });
      }
    }
  }

  private detectContractMismatchConflict(
    _operation: { type: string; target: string; agentId: string },
    conflicts: Conflict[]
  ): void {
    conflicts.push({
      type: 'contract_mismatch',
      description: `Contract validation failed for operation on target ${_operation.target}`,
      severity: 'low',
    });
  }

  private resolve(conflicts: Conflict[]): 'auto_resolve' | 'human_intervention' | 'retry' {
    if (conflicts.length === 0) return 'auto_resolve';

    const maxSeverity = conflicts.reduce((max, c) => {
      const order = { low: 0, medium: 1, high: 2 };
      return order[c.severity] > order[max.severity] ? c : max;
    });

    switch (maxSeverity.severity) {
      case 'high':
        return 'human_intervention';
      case 'medium':
        return 'retry';
      default:
        return 'auto_resolve';
    }
  }

  acquireLock(target: string, agentId: string, ttlMs: number = 300000): void {
    const now = new Date();
    this.locks.set(target, {
      target,
      agentId,
      lockedAt: now.toISOString(),
      timeoutAt: new Date(now.getTime() + ttlMs).toISOString(),
    });

    if (!this.fileWrites.has(target)) {
      this.fileWrites.set(target, []);
    }
    const writers = this.fileWrites.get(target)!;
    if (!writers.includes(agentId)) {
      writers.push(agentId);
    }

    logger.info({ target, agentId, ttlMs }, 'Resource lock acquired');
  }

  releaseLock(target: string, agentId: string): void {
    const lock = this.locks.get(target);
    if (lock && lock.agentId === agentId) {
      this.locks.delete(target);
      const writers = this.fileWrites.get(target);
      if (writers) {
        this.fileWrites.set(target, writers.filter((w) => w !== agentId));
        if (this.fileWrites.get(target)!.length === 0) {
          this.fileWrites.delete(target);
        }
      }
      logger.info({ target, agentId }, 'Resource lock released');
    }
  }
}

export const conflictDetector = new ConflictDetector();
