import { resolveToolPath, safeWriteFile } from './shared';
import type { ToolContext, ToolDefinition, ToolResult } from './types';

export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Write content to a file. Creates parent directories if needed.',
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Relative or absolute path to the file',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to write',
      required: true,
    },
  ],
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filePath = String(params.filePath ?? '');
    const content = String(params.content ?? '');

    const resolved = resolveToolPath(filePath, context);
    if (!resolved.ok) {
      return { ok: false, tool: 'write_file', summary: resolved.error };
    }

    const result = safeWriteFile(resolved.resolved, content);
    if (!result.ok) {
      return { ok: false, tool: 'write_file', summary: result.error };
    }

    return {
      ok: true,
      tool: 'write_file',
      summary: `Wrote ${filePath} (${content.length} chars)`,
    };
  },
};
