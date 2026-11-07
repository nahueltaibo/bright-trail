import { describe, expect, it } from 'vitest';
import { ClaudeCliLlm, parseCliOutput, resolveCommand, type RunCommand } from './cli-llm';
import type { LlmRequest } from './llm';

const ok = JSON.stringify({ type: 'result', is_error: false, structured_output: { answer: 5 } });

const request: LlmRequest = {
  model: 'claude-haiku-5-5',
  system: 'You add numbers.',
  prompt: 'What is 2 + 3?',
  tool: { name: 'submit', description: 'd', inputSchema: { type: 'object' } },
  maxTokens: 1000,
};

describe('parseCliOutput', () => {
  it('returns structured_output', () => {
    expect(parseCliOutput(ok)).toEqual({ answer: 5 });
  });

  it('skips warning lines before the JSON', () => {
    const stdout = `[claude-code:unrecognized_model] {"model":"claude-haiku-5-5"}\n${ok}\n`;
    expect(parseCliOutput(stdout)).toEqual({ answer: 5 });
  });

  it('throws when the CLI reports an error', () => {
    const stdout = JSON.stringify({ is_error: true, subtype: 'error_max_turns', result: 'Nope' });
    expect(() => parseCliOutput(stdout)).toThrow('Claude CLI failed (error_max_turns): Nope');
  });

  it('throws when structured_output is missing', () => {
    const stdout = JSON.stringify({ is_error: false, result: 'Plain text answer' });
    expect(() => parseCliOutput(stdout)).toThrow(
      'Claude CLI returned no structured_output: Plain text answer',
    );
  });

  it('throws when there is no JSON at all', () => {
    expect(() => parseCliOutput('Not logged in\n')).toThrow('Claude CLI printed no JSON');
  });
});

describe('ClaudeCliLlm', () => {
  it('passes the request as flags and stdin, without an API key', async () => {
    const calls: Parameters<RunCommand>[] = [];
    const run: RunCommand = async (...args) => {
      calls.push(args);
      return { code: 0, stdout: ok, stderr: '' };
    };
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    try {
      expect(await new ClaudeCliLlm(run, 'claude').call(request)).toEqual({ answer: 5 });
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }

    const [command, args, input, env] = calls[0];
    expect(command).toBe('claude');
    expect(args).toEqual([
      '-p',
      '--model',
      'claude-haiku-5-5',
      '--system-prompt',
      'You add numbers.',
      '--tools',
      '',
      '--strict-mcp-config',
      '--setting-sources',
      '',
      '--output-format',
      'json',
      '--json-schema',
      '{"type":"object"}',
    ]);
    expect(input).toBe('What is 2 + 3?');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe('1000');
  });

  it('adds the model, tool, exit code, and stderr to failures', async () => {
    const run: RunCommand = async () => ({ code: 1, stdout: '', stderr: 'Not logged in' });
    await expect(new ClaudeCliLlm(run).call(request)).rejects.toThrow(
      /claude-haiku-5-5, submit, exit 1: Claude CLI printed no JSON: \nNot logged in/,
    );
  });
});

describe('resolveCommand', () => {
  const lookup = (files: Record<string, string>, platform: NodeJS.Platform = 'win32') => ({
    platform,
    path: 'C:\\npm;C:\\bin',
    exists: (file: string) => file in files,
    read: (file: string) => files[file],
    node: 'C:\\node\\node.exe',
  });

  it('leaves the command alone off Windows', () => {
    expect(resolveCommand('claude', lookup({}, 'linux'))).toEqual({
      command: 'claude',
      prefix: [],
    });
  });

  it('prefers an .exe on PATH', () => {
    const files = { 'C:\\bin\\claude.exe': '' };
    expect(resolveCommand('claude', lookup(files))).toEqual({
      command: 'C:\\bin\\claude.exe',
      prefix: [],
    });
  });

  it('follows an npm shim to the .exe it runs', () => {
    const files = {
      'C:\\npm\\claude.cmd':
        '"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*',
    };
    expect(resolveCommand('claude', lookup(files))).toEqual({
      command: 'C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe',
      prefix: [],
    });
  });

  it('runs a shim script with node', () => {
    const files = {
      'C:\\npm\\claude.cmd':
        '"%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*',
    };
    expect(resolveCommand('claude', lookup(files))).toEqual({
      command: 'C:\\node\\node.exe',
      prefix: ['C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js'],
    });
  });

  it("throws on a shim it can't read", () => {
    expect(() => resolveCommand('claude', lookup({ 'C:\\npm\\claude.cmd': 'claude %*' }))).toThrow(
      'Set CLAUDE_BIN',
    );
  });

  it('keeps an explicit path', () => {
    expect(resolveCommand('D:\\tools\\claude.exe', lookup({}))).toEqual({
      command: 'D:\\tools\\claude.exe',
      prefix: [],
    });
  });
});
