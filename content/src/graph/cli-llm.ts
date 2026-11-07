import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { win32 } from 'node:path';
import type { LlmClient, LlmRequest } from './llm';

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export type RunCommand = (
  command: string,
  args: string[],
  input: string,
  env: NodeJS.ProcessEnv,
) => Promise<CommandResult>;

export interface ResolvedCommand {
  command: string;
  /** Arguments that go before the caller's, e.g. the script a `.cmd` shim runs. */
  prefix: string[];
}

export interface CommandLookup {
  platform: NodeJS.Platform;
  path: string;
  exists: (file: string) => boolean;
  read: (file: string) => string;
  node: string;
}

const defaultLookup = (): CommandLookup => ({
  platform: process.platform,
  path: process.env.PATH ?? process.env.Path ?? '',
  exists: existsSync,
  read: (file) => readFileSync(file, 'utf8'),
  node: process.execPath,
});

/**
 * On Windows, Node can't spawn a `.cmd` shim without a shell, and a shell would mangle the
 * multi-line system prompt and JSON schema. So this finds the `.exe` or script the shim runs.
 */
export function resolveCommand(command: string, lookup = defaultLookup()): ResolvedCommand {
  if (lookup.platform !== 'win32' || /[\\/]/.test(command)) return { command, prefix: [] };
  for (const dir of lookup.path.split(';').filter(Boolean)) {
    const exe = win32.join(dir, `${command}.exe`);
    if (lookup.exists(exe)) return { command: exe, prefix: [] };
    const shim = win32.join(dir, `${command}.cmd`);
    if (!lookup.exists(shim)) continue;
    // npm shims run "%dp0%\<target>", where the target is an .exe or a script for node.
    const target = /"%dp0%\\([^"]+\.(exe|js))"/i.exec(lookup.read(shim));
    if (!target) throw new Error(`Can't read ${shim}. Set CLAUDE_BIN to the claude executable.`);
    const file = win32.join(dir, target[1]);
    return target[2].toLowerCase() === 'exe'
      ? { command: file, prefix: [] }
      : { command: lookup.node, prefix: [file] };
  }
  return { command, prefix: [] };
}

export const runCommand: RunCommand = (command, args, input, env) =>
  new Promise((resolve, reject) => {
    const resolved = resolveCommand(command);
    const child = spawn(resolved.command, [...resolved.prefix, ...args], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });

/**
 * Pulls `structured_output` from `claude -p --output-format json`. The CLI may print warning
 * lines before the JSON, so parsing starts at the first line that opens an object.
 */
export function parseCliOutput(stdout: string): unknown {
  const start = stdout.search(/^\{/m);
  if (start < 0) throw new Error(`Claude CLI printed no JSON: ${stdout.slice(0, 300)}`);
  const result = JSON.parse(stdout.slice(start)) as {
    is_error?: boolean;
    subtype?: string;
    result?: string;
    structured_output?: unknown;
  };
  if (result.is_error) {
    throw new Error(`Claude CLI failed (${result.subtype ?? 'error'}): ${result.result ?? ''}`);
  }
  if (result.structured_output === undefined) {
    throw new Error(
      `Claude CLI returned no structured_output: ${(result.result ?? '').slice(0, 300)}`,
    );
  }
  return result.structured_output;
}

/**
 * Calls Claude through Claude Code in headless mode, so it runs on the owner's Claude Code login
 * instead of a billed API key.
 */
export class ClaudeCliLlm implements LlmClient {
  constructor(
    private readonly run: RunCommand = runCommand,
    private readonly command = process.env.CLAUDE_BIN ?? 'claude',
  ) {}

  async call({ model, system, prompt, tool, maxTokens }: LlmRequest): Promise<unknown> {
    // No tools, MCP servers, or settings: without these each call loads the user's whole context.
    const args = [
      '-p',
      '--model',
      model,
      '--system-prompt',
      system,
      '--tools',
      '',
      '--strict-mcp-config',
      '--setting-sources',
      '',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(tool.inputSchema),
    ];
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(maxTokens),
    };
    // An API key would take precedence over the Claude Code login and bill the key.
    delete env.ANTHROPIC_API_KEY;
    // The prompt goes through stdin: long grades overflow the Windows command-line limit.
    const { code, stdout, stderr } = await this.run(this.command, args, prompt, env);
    try {
      return parseCliOutput(stdout);
    } catch (error) {
      const detail = stderr.trim() ? `\n${stderr.trim()}` : '';
      throw new Error(
        `${model}, ${tool.name}, exit ${code}: ${(error as Error).message}${detail}`,
        {
          cause: error,
        },
      );
    }
  }
}
