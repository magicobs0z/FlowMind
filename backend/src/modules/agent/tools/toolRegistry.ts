import { executeCommandTool } from './executeCommand';
import { gitOperationsTool } from './gitOperations';
import { listDirectoryTool } from './listDirectory';
import { readFileTool } from './readFile';
import { searchFilesTool } from './searchFiles';
import type { ToolContext, ToolDefinition, ToolResult } from './types';
import { writeFileTool } from './writeFile';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    this.register(readFileTool);
    this.register(writeFileTool);
    this.register(listDirectoryTool);
    this.register(searchFilesTool);
    this.register(executeCommandTool);
    this.register(gitOperationsTool);
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  async executeTool(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        ok: false,
        tool: name,
        summary: `Tool "${name}" not found`,
      };
    }

    try {
      const result = await tool.execute(params, context);
      return result;
    } catch (err) {
      return {
        ok: false,
        tool: name,
        summary: `Tool execution error: ${(err as Error).message}`,
      };
    }
  }
}
