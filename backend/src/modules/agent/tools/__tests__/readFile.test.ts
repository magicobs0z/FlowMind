import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readFileTool } from '../readFile';
import type { ToolContext } from '../types';

describe('read_file tool', () => {
  let tmpDir: string;
  let context: ToolContext;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowmind-readfile-test-'));
    context = {
      worktree: tmpDir,
      directory: tmpDir,
      allowOutsideWorktree: false,
    };
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads a normal file', async () => {
    const filePath = path.join(tmpDir, 'sample.txt');
    fs.writeFileSync(filePath, 'Hello, World!', 'utf-8');

    const result = await readFileTool.execute({ filePath: 'sample.txt' }, context);
    expect(result.ok).toBe(true);
    expect(result.stdout).toBe('Hello, World!');
    expect(result.summary).toContain('Read sample.txt');
  });

  it('reads a specific line range', async () => {
    const filePath = path.join(tmpDir, 'lines.txt');
    fs.writeFileSync(filePath, 'line1\nline2\nline3\nline4\nline5\n', 'utf-8');

    const result = await readFileTool.execute(
      { filePath: 'lines.txt', startLine: 2, endLine: 4 },
      context
    );
    expect(result.ok).toBe(true);
    expect(result.stdout).toBe('line2\nline3\nline4');
  });

  it('rejects binary file', async () => {
    const filePath = path.join(tmpDir, 'binary.bin');
    fs.writeFileSync(filePath, Buffer.from([0x00, 0x01, 0x02, 0x03]));

    const result = await readFileTool.execute({ filePath: 'binary.bin' }, context);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('Binary file not readable');
  });

  it('truncates oversized file content', async () => {
    const filePath = path.join(tmpDir, 'huge.txt');
    fs.writeFileSync(filePath, 'a'.repeat(200_000), 'utf-8');

    const result = await readFileTool.execute({ filePath: 'huge.txt' }, context);
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('... [content truncated]');
  });

  it('blocks path traversal', async () => {
    const result = await readFileTool.execute({ filePath: '../../etc/passwd' }, context);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('Path traversal blocked');
  });

  it('returns error for non-existent file', async () => {
    const result = await readFileTool.execute({ filePath: 'nonexistent.txt' }, context);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('Failed to read file');
  });
});
