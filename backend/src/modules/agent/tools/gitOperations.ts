import { resolveToolPath, runCommand } from './shared';
import type { ToolContext, ToolDefinition, ToolResult } from './types';

const ALLOWED_OPERATIONS = new Set([
  'status',
  'diff',
  'log',
  'branch',
  'checkout',
  'add',
  'commit',
  'pull',
  'push',
  'fetch',
  'merge',
  'rebase',
  'stash',
  'show',
  'remote',
]);

export const gitOperationsTool: ToolDefinition = {
  name: 'git_operations',
  description: 'Run safe git commands. Only a subset of operations is allowed.',
  parameters: [
    {
      name: 'operation',
      type: 'string',
      description:
        'Git operation name (e.g., status, diff, log, branch, checkout, add, commit, pull, push)',
      required: true,
    },
    {
      name: 'args',
      type: 'array',
      description: 'Additional arguments for the git command',
      required: false,
    },
  ],
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const operation = String(params.operation ?? '');
    const args = Array.isArray(params.args) ? params.args.map(String) : [];

    if (!ALLOWED_OPERATIONS.has(operation)) {
      return {
        ok: false,
        tool: 'git_operations',
        summary: `Git operation "${operation}" is not allowed`,
      };
    }

    const resolved = resolveToolPath('.', context);
    const cwd = resolved.ok ? resolved.resolved : context.directory;

    const result = await runCommand('git', [operation, ...args], {
      cwd,
      timeoutMs: 60000,
    });

    return {
      ok: result.ok,
      tool: 'git_operations',
      summary: result.ok ? `git ${operation} succeeded` : `git ${operation} failed`,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? undefined,
    };
  },
};
