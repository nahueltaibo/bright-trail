import { spawn } from 'node:child_process';
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

export const runCommand: RunCommand = (command, args, input, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
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
