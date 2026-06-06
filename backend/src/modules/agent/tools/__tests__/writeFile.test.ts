import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeFileTool } from '../writeFile';
import type { ToolContext } from '../types';

describe('write_file tool', () => {
  let tmpDir: string;
  let context: ToolContext;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowmind-writefile-test-'));
    context = {
      worktree: tmpDir,
      directory: tmpDir,
      allowOutsideWorktree: false,
    };
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a file normally', async () => {
    const result = await writeFileTool.execute(
      { filePath: 'test.txt', content: 'hello world' },
      context
    );
    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, 'test.txt'), 'utf-8')).toBe('hello world');
  });

  it('auto-creates parent directories', async () => {
    const result = await writeFileTool.execute(
      { filePath: 'deep/nested/dir/file.txt', content: 'nested content' },
      context
    );
    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, 'deep/nested/dir/file.txt'), 'utf-8')).toBe(
      'nested content'
    );
  });

  it('blocks path traversal', async () => {
    const result = await writeFileTool.execute(
      { filePath: '../../etc/passwd', content: 'evil' },
      context
    );
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('Path traversal blocked');
  });

  it('refuses to overwrite a symlink', async () => {
    const target = path.join(tmpDir, 'symlink-target.txt');
    const link = path.join(tmpDir, 'symlink-link.txt');
    fs.writeFileSync(target, 'target content');
    fs.symlinkSync(target, link);

    const result = await writeFileTool.execute(
      { filePath: 'symlink-link.txt', content: 'new content' },
      context
    );
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('Refusing to overwrite symlink');

    fs.unlinkSync(link);
    fs.unlinkSync(target);
  });
});
