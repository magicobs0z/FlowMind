import { listDirectoryEntries, resolveToolPath } from './shared';
import type { ToolContext, ToolDefinition, ToolResult } from './types';

export const listDirectoryTool: ToolDefinition = {
  name: 'list_directory',
  description: 'List files and directories. Optionally recurse into subdirectories.',
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Relative or absolute path to the directory',
      required: true,
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: 'Recursively list subdirectories',
      required: false,
    },
    {
      name: 'allowIgnored',
      type: 'boolean',
      description: 'Include ignored directories like node_modules',
      required: false,
    },
  ],
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filePath = String(params.filePath ?? '.');
    const recursive = Boolean(params.recursive ?? false);
    const allowIgnored = Boolean(params.allowIgnored ?? false);

    const resolved = resolveToolPath(filePath, context);
    if (!resolved.ok) {
      return { ok: false, tool: 'list_directory', summary: resolved.error };
    }

    const result = listDirectoryEntries(resolved.resolved, recursive, allowIgnored, 5000, context);
    if (!result.ok) {
      return { ok: false, tool: 'list_directory', summary: result.error };
    }

    const lines = result.entries.map((e) => {
      const prefix = e.type === 'directory' ? '[D]' : e.type === 'symlink' ? '[L]' : '[F]';
      return `${prefix} ${e.path}`;
    });

    return {
      ok: true,
      tool: 'list_directory',
      summary: `Listed ${result.entries.length} entries in ${filePath}`,
      stdout: lines.join('\n'),
    };
  },
};
