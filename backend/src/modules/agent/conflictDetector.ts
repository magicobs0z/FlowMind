import { ConflictResult, Conflict } from './types';
import { logger } from '../../utils/logger';

interface ResourceLock {
  target: string;
  agentId: string;
  lockedAt: string;
  timeoutAt: string;
}

interface FileLock {
  filePath: string;
  agentId: string;
  lockedAt: string;
  timeoutAt: string;
}

class ConflictDetector {
  private locks = new Map<string, ResourceLock>();
  private fileWrites = new Map<string, string[]>();
  private fileLocks = new Map<string, FileLock>();
  private readonly DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000; // 默认 5 分钟

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
      case 'file_lock':
        this.detectFileLockConflict(operation, conflicts);
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

    // 同时检测文件锁冲突
    const fileLock = this.fileLocks.get(operation.target);
    if (fileLock && fileLock.agentId !== operation.agentId) {
      const isExpired = new Date(fileLock.timeoutAt) < new Date();
      if (!isExpired) {
        conflicts.push({
          type: 'file_write',
          description: `File ${operation.target} is locked by agent ${fileLock.agentId} until ${fileLock.timeoutAt}`,
          severity: 'high',
        });
      }
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

  private detectFileLockConflict(
    operation: { type: string; target: string; agentId: string },
    conflicts: Conflict[]
  ): void {
    const fileLock = this.fileLocks.get(operation.target);
    if (fileLock && fileLock.agentId !== operation.agentId) {
      const isExpired = new Date(fileLock.timeoutAt) < new Date();
      if (!isExpired) {
        conflicts.push({
          type: 'resource_lock',
          description: `File ${operation.target} is locked by agent ${fileLock.agentId} until ${fileLock.timeoutAt}`,
          severity: 'high',
        });
      }
    }
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

  // 获取文件写入锁
  acquireFileLock(filePath: string, agentId: string, ttlMs: number = this.DEFAULT_LOCK_TTL_MS): boolean {
    this.cleanupExpiredFileLocks();

    const existingLock = this.fileLocks.get(filePath);
    if (existingLock && existingLock.agentId !== agentId) {
      const isExpired = new Date(existingLock.timeoutAt) < new Date();
      if (!isExpired) {
        logger.warn(
          { filePath, requestedBy: agentId, lockedBy: existingLock.agentId },
          'Failed to acquire file lock: already locked'
        );
        return false;
      }
    }

    const now = new Date();
    this.fileLocks.set(filePath, {
      filePath,
      agentId,
      lockedAt: now.toISOString(),
      timeoutAt: new Date(now.getTime() + ttlMs).toISOString(),
    });

    logger.info({ filePath, agentId, ttlMs }, 'File lock acquired');
    return true;
  }

  // 释放文件写入锁
  releaseFileLock(filePath: string, agentId: string): boolean {
    const lock = this.fileLocks.get(filePath);
    if (!lock) {
      logger.warn({ filePath, agentId }, 'Failed to release file lock: lock not found');
      return false;
    }

    if (lock.agentId !== agentId) {
      logger.warn(
        { filePath, requestedBy: agentId, lockedBy: lock.agentId },
        'Failed to release file lock: not owned by requester'
      );
      return false;
    }

    this.fileLocks.delete(filePath);
    logger.info({ filePath, agentId }, 'File lock released');
    return true;
  }

  // 检查文件是否被锁定
  checkFileLock(filePath: string, agentId: string): { locked: boolean; owner?: string; expired: boolean } {
    this.cleanupExpiredFileLocks();

    const lock = this.fileLocks.get(filePath);
    if (!lock) {
      return { locked: false, expired: true };
    }

    const isExpired = new Date(lock.timeoutAt) < new Date();
    if (isExpired) {
      return { locked: false, expired: true };
    }

    return {
      locked: lock.agentId !== agentId,
      owner: lock.agentId,
      expired: false,
    };
  }

  // 清理过期的文件锁
  private cleanupExpiredFileLocks(): void {
    const now = new Date();
    for (const [filePath, lock] of this.fileLocks.entries()) {
      if (new Date(lock.timeoutAt) < now) {
        this.fileLocks.delete(filePath);
        logger.info({ filePath, agentId: lock.agentId }, 'Expired file lock cleaned up');
      }
    }
  }

  // 获取某个 agent 持有的所有文件锁
  getAgentFileLocks(agentId: string): FileLock[] {
    this.cleanupExpiredFileLocks();
    return Array.from(this.fileLocks.values()).filter((lock) => lock.agentId === agentId);
  }
}

export const conflictDetector = new ConflictDetector();
