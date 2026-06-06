import { readFileRange, resolveToolPath } from './shared';
import type { ToolContext, ToolDefinition, ToolResult } from './types';

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file. Optionally specify a line range.',
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Relative or absolute path to the file',
      required: true,
    },
    {
      name: 'startLine',
      type: 'number',
      description: 'Start line number (1-based, inclusive)',
      required: false,
    },
    {
      name: 'endLine',
      type: 'number',
      description: 'End line number (1-based, inclusive)',
      required: false,
    },
  ],
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const filePath = String(params.filePath ?? '');
    const startLine = params.startLine !== undefined ? Number(params.startLine) : undefined;
    const endLine = params.endLine !== undefined ? Number(params.endLine) : undefined;

    const resolved = resolveToolPath(filePath, context);
    if (!resolved.ok) {
      return { ok: false, tool: 'read_file', summary: resolved.error };
    }

    const result = readFileRange(resolved.resolved, startLine, endLine);
    if (!result.ok) {
      return { ok: false, tool: 'read_file', summary: result.error };
    }

    return {
      ok: true,
      tool: 'read_file',
      summary: `Read ${filePath}`,
      stdout: result.content,
    };
  },
};
