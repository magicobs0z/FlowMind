import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ToolContext } from './types';

export const MAX_CAPTURE_CHARS = 20000;
export const DEFAULT_FILE_READ_CHARS = 100000;
export const DEFAULT_TIMEOUT_MS = 60000;
export const DEFAULT_IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '.cache',
  '.idea',
  '.vscode',
  '.DS_Store',
  'Thumbs.db',
]);

export function isInside(childPath: string, parentPath: string): boolean {
  const resolvedChild = path.resolve(childPath);
  const resolvedParent = path.resolve(parentPath);
  const relative = path.relative(resolvedParent, resolvedChild);
  if (!relative) {
    return true;
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function safeRealpathSync(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

export function resolveToolPath(
  filePath: string,
  context: ToolContext
): { ok: true; resolved: string } | { ok: false; error: string } {
  const resolved = path.resolve(context.directory, filePath);
  const realWorktree = safeRealpathSync(context.worktree);

  if (!context.allowOutsideWorktree && !isInside(resolved, realWorktree)) {
    return { ok: false, error: `Path traversal blocked: ${filePath}` };
  }

  return { ok: true, resolved };
}

export function toRelativePath(absolutePath: string, context: ToolContext): string {
  return path.relative(context.worktree, absolutePath);
}

export function isIgnoredRelativePath(relativePath: string): boolean {
  const parts = relativePath.split(path.sep);
  for (const part of parts) {
    if (DEFAULT_IGNORED_NAMES.has(part)) {
      return true;
    }
  }
  return false;
}

export function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeoutMs?: number;
    maxOutputChars?: number;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  truncated: boolean;
}> {
  const { cwd, timeoutMs = DEFAULT_TIMEOUT_MS, maxOutputChars = MAX_CAPTURE_CHARS, env } = options;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: env ?? process.env,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let truncated = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeoutMs);

    child.stdout?.on('data', (data: Buffer) => {
      if (truncated) return;
      stdout += data.toString('utf-8');
      if (stdout.length > maxOutputChars) {
        stdout = `${stdout.slice(0, maxOutputChars)}\n... [output truncated]`;
        truncated = true;
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      if (truncated) return;
      stderr += data.toString('utf-8');
      if (stderr.length > maxOutputChars) {
        stderr = `${stderr.slice(0, maxOutputChars)}\n... [output truncated]`;
        truncated = true;
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        stdout,
        stderr: stderr || err.message,
        exitCode: null,
        signal: null,
        truncated,
      });
    });

    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        ok: exitCode === 0,
        stdout,
        stderr,
        exitCode,
        signal: signal as string | null,
        truncated,
      });
    });
  });
}

export function readFileRange(
  filePath: string,
  startLine?: number,
  endLine?: number
): { ok: true; content: string } | { ok: false; error: string } {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return { ok: false, error: `Not a file: ${filePath}` };
    }
    if (stats.size > 10 * 1024 * 1024) {
      return { ok: false, error: `File too large (>10MB): ${filePath}` };
    }

    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(stats.size);
    fs.readSync(fd, buffer, 0, stats.size, 0);
    fs.closeSync(fd);

    if (buffer.includes(0)) {
      return { ok: false, error: `Binary file not readable: ${filePath}` };
    }

    let content = buffer.toString('utf-8');

    if (content.length > DEFAULT_FILE_READ_CHARS) {
      content = `${content.slice(0, DEFAULT_FILE_READ_CHARS)}\n... [content truncated]`;
    }

    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split('\n');
      const start = Math.max(0, (startLine ?? 1) - 1);
      const end = endLine !== undefined ? Math.min(lines.length, endLine) : lines.length;
      content = lines.slice(start, end).join('\n');
    }

    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: `Failed to read file: ${(err as Error).message}` };
  }
}

export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
}

export function listDirectoryEntries(
  dirPath: string,
  recursive: boolean,
  allowIgnored: boolean,
  maxResults: number,
  context: ToolContext
): { ok: true; entries: DirEntry[] } | { ok: false; error: string } {
  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return { ok: false, error: `Not a directory: ${dirPath}` };
    }

    const entries: DirEntry[] = [];

    function walk(currentPath: string) {
      if (entries.length >= maxResults) return;
      const items = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const item of items) {
        if (entries.length >= maxResults) break;
        const itemPath = path.join(currentPath, item.name);
        const relPath = toRelativePath(itemPath, context);
        if (!allowIgnored && isIgnoredRelativePath(relPath)) continue;

        let type: DirEntry['type'] = 'other';
        if (item.isFile()) type = 'file';
        else if (item.isDirectory()) type = 'directory';
        else if (item.isSymbolicLink()) type = 'symlink';

        entries.push({ name: item.name, path: relPath, type });

        if (recursive && item.isDirectory()) {
          walk(itemPath);
        }
      }
    }

    walk(dirPath);
    return { ok: true, entries };
  } catch (err) {
    return { ok: false, error: `Failed to list directory: ${(err as Error).message}` };
  }
}

export function safeWriteFile(
  filePath: string,
  content: string
): { ok: true } | { ok: false; error: string } {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    const stats = fs.lstatSync(filePath);
    if (stats.isSymbolicLink()) {
      return { ok: false, error: `Refusing to overwrite symlink: ${filePath}` };
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    return { ok: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
      return { ok: true };
    }
    return { ok: false, error: `Failed to write file: ${(err as Error).message}` };
  }
}

export function safeRemovePath(targetPath: string): { ok: true } | { ok: false; error: string } {
  try {
    const stats = fs.lstatSync(targetPath);
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(targetPath);
      return { ok: true };
    }
    if (stats.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return { ok: true };
    }
    fs.unlinkSync(targetPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Failed to remove path: ${(err as Error).message}` };
  }
}

export function statPath(
  targetPath: string
):
  | { ok: true; exists: false }
  | { ok: true; exists: true; isFile: boolean; isDirectory: boolean; size: number; mtime: Date } {
  try {
    const stats = fs.statSync(targetPath);
    return {
      ok: true,
      exists: true,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime,
    };
  } catch {
    return { ok: true, exists: false };
  }
}
