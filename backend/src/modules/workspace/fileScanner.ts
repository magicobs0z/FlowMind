import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { logger } from '../../utils/logger';
import type { FileNode } from './types';

const IGNORED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.output',
  '.nuxt',
  '.cache',
  'tmp',
  'temp',
];

function shouldIgnore(name: string): boolean {
  return IGNORED_DIRS.includes(name);
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

async function scanDirectory(
  dirPath: string,
  basePath: string,
  depth: number = 0,
  maxDepth: number = 10,
): Promise<FileNode | null> {
  if (depth > maxDepth) {
    return null;
  }

  const name = relative(basePath, dirPath) || 'root';

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const children: FileNode[] = [];

    for (const entry of entries) {
      if (shouldIgnore(entry.name)) {
        continue;
      }

      const entryPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const child = await scanDirectory(entryPath, basePath, depth + 1, maxDepth);
        if (child) {
          children.push(child);
        }
      } else {
        const size = await getFileSize(entryPath);
        children.push({
          name: entry.name,
          path: entryPath,
          type: 'file',
          size,
          status: 'unchanged',
        });
      }
    }

    return {
      name,
      path: dirPath,
      type: 'directory',
      children,
    };
  } catch (error) {
    logger.error({ err: error, path: dirPath }, 'Failed to scan directory');
    return null;
  }
}

function countFiles(node: FileNode | null): number {
  if (!node) return 0;
  if (node.type === 'file') return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

function calculateTotalSize(node: FileNode | null): number {
  if (!node) return 0;
  if (node.type === 'file') return node.size || 0;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + calculateTotalSize(child), 0);
}

function flattenFileTree(node: FileNode | null, fileList: string[] = []): string[] {
  if (!node) return fileList;
  if (node.type === 'file') {
    fileList.push(node.path);
  }
  if (node.children) {
    for (const child of node.children) {
      flattenFileTree(child, fileList);
    }
  }
  return fileList;
}

export {
  scanDirectory,
  countFiles,
  calculateTotalSize,
  flattenFileTree,
};
