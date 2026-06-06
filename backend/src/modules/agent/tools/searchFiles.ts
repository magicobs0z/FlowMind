import fs from 'node:fs';
import path from 'node:path';
import { MAX_CAPTURE_CHARS, isIgnoredRelativePath, runCommand, toRelativePath } from './shared';
import type { ToolContext, ToolDefinition, ToolResult } from './types';

async function hasRipgrep(): Promise<boolean> {
  try {
    const result = await runCommand('rg', ['--version'], { timeoutMs: 5000 });
    return result.ok;
  } catch {
    return false;
  }
}

async function searchWithRipgrep(
  pattern: string,
  mode: string,
  caseSensitive: boolean,
  maxResults: number,
  context: ToolContext
): Promise<{ ok: true; lines: string[] } | { ok: false; error: string }> {
  const args: string[] = [
    '--line-number',
    '--with-filename',
    '--max-count',
    String(Math.ceil(maxResults / 10)),
    '--max-columns',
    '500',
    '-C',
    '2',
  ];

  if (!caseSensitive) args.push('-i');
  if (mode === 'whole-word') args.push('-w');
  if (mode === 'literal') args.push('-F');

  args.push(pattern);
  args.push('.');

  const result = await runCommand('rg', args, {
    cwd: context.directory,
    timeoutMs: 30000,
    maxOutputChars: MAX_CAPTURE_CHARS,
  });

  if (!result.ok && result.exitCode !== 1) {
    return { ok: false, error: result.stderr || 'ripgrep failed' };
  }

  const lines = result.stdout.split('\n').filter(Boolean).slice(0, maxResults);
  return { ok: true, lines };
}

async function searchWithNode(
  pattern: string,
  mode: string,
  caseSensitive: boolean,
  maxResults: number,
  context: ToolContext
): Promise<{ ok: true; lines: string[] } | { ok: false; error: string }> {
  const results: string[] = [];
  const flags = caseSensitive ? '' : 'i';
  let regex: RegExp;

  try {
    if (mode === 'literal') {
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    } else if (mode === 'whole-word') {
      regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, flags);
    } else {
      regex = new RegExp(pattern, flags);
    }
  } catch {
    return { ok: false, error: 'Invalid regex pattern' };
  }

  function walk(dir: string) {
    if (results.length >= maxResults) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (results.length >= maxResults) break;
      const itemPath = path.join(dir, item.name);
      const relPath = toRelativePath(itemPath, context);
      if (isIgnoredRelativePath(relPath)) continue;

      if (item.isDirectory()) {
        walk(itemPath);
      } else if (item.isFile()) {
        try {
          const content = fs.readFileSync(itemPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line !== undefined && regex.test(line)) {
              results.push(`${relPath}:${i + 1}: ${line.trim()}`);
              if (results.length >= maxResults) break;
            }
          }
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  walk(context.directory);
  return { ok: true, lines: results };
}

export const searchFilesTool: ToolDefinition = {
  name: 'search_files',
  description: 'Search for a pattern across files using ripgrep (or Node.js fallback).',
  parameters: [
    {
      name: 'pattern',
      type: 'string',
      description: 'Search pattern',
      required: true,
    },
    {
      name: 'mode',
      type: 'string',
      description: 'Search mode: literal, regex, whole-word',
      required: false,
    },
    {
      name: 'caseSensitive',
      type: 'boolean',
      description: 'Case-sensitive search',
      required: false,
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results',
      required: false,
    },
  ],
  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const pattern = String(params.pattern ?? '');
    const mode = String(params.mode ?? 'regex');
    const caseSensitive = Boolean(params.caseSensitive ?? false);
    const maxResults = Number(params.maxResults ?? 200);

    if (!pattern) {
      return { ok: false, tool: 'search_files', summary: 'Pattern is required' };
    }

    const useRg = await hasRipgrep();
    const result = useRg
      ? await searchWithRipgrep(pattern, mode, caseSensitive, maxResults, context)
      : await searchWithNode(pattern, mode, caseSensitive, maxResults, context);

    if (!result.ok) {
      return { ok: false, tool: 'search_files', summary: result.error };
    }

    return {
      ok: true,
      tool: 'search_files',
      summary: `Found ${result.lines.length} matches for "${pattern}"`,
      stdout: result.lines.join('\n'),
    };
  },
};
