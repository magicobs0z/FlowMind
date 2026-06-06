export interface ToolContext {
  worktree: string;
  directory: string;
  allowOutsideWorktree: boolean;
}

export interface ToolResult {
  ok: boolean;
  tool: string;
  summary: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
