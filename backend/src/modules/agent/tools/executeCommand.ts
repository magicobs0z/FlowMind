import { resolveToolPath, runCommand } from './shared';
import type { ToolContext, ToolDefinition, ToolResult } from './types';

const DANGEROUS_PATTERNS = [
  /^rm\s+-rf\s+\//,
  /sudo\s/,
  />\s*\/dev\/null.*rm/,
  /:\(\)\{\s*:\|:\s*&\s*\};:\s*/,
  /curl.*\|.*sh/,
  /wget.*\|.*sh/,
];

function isDangerous(command: string, args: string[]): string | null {
  const full = `${command} ${args.join(' ')}`;
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(full)) {
      return `Dangerous command blocked: ${full}`;
    }
  }
  return null;
}

export const executeCommandTool: ToolDefinition = {
  name: 'execute_command',
  description: 'Execute a shell command with arguments. Dangerous commands are blocked.',
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: 'Command to execute',
      required: true,
    },
    {
      name: 'args',
      type: 'array',
      description: 'Command arguments',
      required: false,
    },
    {
      name: 'workingDirectory',
      type: 'string',
      description: 'Working directory for the command',
      required: false,
    },
    {
      name: 'timeoutMs',
      type: 'number',
      description: 'Timeout in milliseconds',
      required: false,
    },
  ],
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const command = String(params.command ?? '');
    const args = Array.isArray(params.args) ? params.args.map(String) : [];
    const workingDirectory =
      params.workingDirectory !== undefined ? String(params.workingDirectory) : undefined;
    const timeoutMs = params.timeoutMs !== undefined ? Number(params.timeoutMs) : undefined;

    if (!command) {
      return { ok: false, tool: 'execute_command', summary: 'Command is required' };
    }

    const danger = isDangerous(command, args);
    if (danger) {
      return { ok: false, tool: 'execute_command', summary: danger };
    }

    let cwd = context.directory;
    if (workingDirectory) {
      const resolved = resolveToolPath(workingDirectory, context);
      if (!resolved.ok) {
        return { ok: false, tool: 'execute_command', summary: resolved.error };
      }
      cwd = resolved.resolved;
    }

    const result = await runCommand(command, args, { cwd, timeoutMs });

    return {
      ok: result.ok,
      tool: 'execute_command',
      summary: result.ok ? 'Command succeeded' : `Command failed (exit ${result.exitCode})`,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? undefined,
    };
  },
};
