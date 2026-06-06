import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ToolRegistry } from '../toolRegistry';
import type { ToolContext } from '../types';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let tmpDir: string;
  let context: ToolContext;

  beforeAll(() => {
    registry = new ToolRegistry();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowmind-registry-test-'));
    context = {
      worktree: tmpDir,
      directory: tmpDir,
      allowOutsideWorktree: false,
    };
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('tool registration', () => {
    it('registers all built-in tools', () => {
      const names = registry.getToolNames();
      expect(names).toContain('read_file');
      expect(names).toContain('write_file');
      expect(names).toContain('list_directory');
      expect(names).toContain('search_files');
      expect(names).toContain('execute_command');
      expect(names).toContain('git_operations');
    });

    it('retrieves a tool by name', () => {
      const tool = registry.getTool('read_file');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('read_file');
    });

    it('returns undefined for unknown tool', () => {
      const tool = registry.getTool('nonexistent_tool');
      expect(tool).toBeUndefined();
    });

    it('returns all tools', () => {
      const tools = registry.getAllTools();
      expect(tools.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('executeTool', () => {
    it('returns error for non-existent tool', async () => {
      const result = await registry.executeTool('nonexistent_tool', {}, context);
      expect(result.ok).toBe(false);
      expect(result.tool).toBe('nonexistent_tool');
      expect(result.summary).toContain('not found');
    });

    it('executes read_file correctly', async () => {
      const filePath = path.join(tmpDir, 'registry-read.txt');
      fs.writeFileSync(filePath, 'registry test content', 'utf-8');

      const result = await registry.executeTool(
        'read_file',
        { filePath: 'registry-read.txt' },
        context
      );
      expect(result.ok).toBe(true);
      expect(result.stdout).toBe('registry test content');
      expect(result.summary).toContain('Read registry-read.txt');
    });

    it('executes write_file correctly', async () => {
      const result = await registry.executeTool(
        'write_file',
        { filePath: 'registry-write.txt', content: 'written by registry' },
        context
      );
      expect(result.ok).toBe(true);
      expect(fs.readFileSync(path.join(tmpDir, 'registry-write.txt'), 'utf-8')).toBe(
        'written by registry'
      );
      expect(result.summary).toContain('Wrote registry-write.txt');
    });

    it('executes execute_command correctly', async () => {
      const result = await registry.executeTool(
        'execute_command',
        { command: process.platform === 'win32' ? 'cmd' : 'echo', args: process.platform === 'win32' ? ['/c', 'echo', 'registry echo'] : ['registry echo'] },
        context
      );
      expect(result.ok).toBe(true);
      expect(result.stdout?.trim()).toMatch(/registry echo/);
      expect(result.summary).toBe('Command succeeded');
    });
  });
});
