import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { writeFormatted } from './write';

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmRequest {
  model: string;
  system: string;
  prompt: string;
  /** The model must answer by calling this tool. Its input is the structured answer. */
  tool: ToolSpec;
  maxTokens: number;
}

/** Returns the raw tool input. Callers validate it, since the client may be a fake or a cache. */
export interface LlmClient {
  call(request: LlmRequest): Promise<unknown>;
}

export class AnthropicLlm implements LlmClient {
  private client: Anthropic | undefined;

  // Created on first call, so a fully cached rerun needs no API key.
  constructor(private readonly makeClient: () => Anthropic = () => new Anthropic()) {}

  async call({ model, system, prompt, tool, maxTokens }: LlmRequest): Promise<unknown> {
    this.client ??= this.makeClient();
    // Sonnet 5.5 rejects a forced tool_choice, so the tool is strict and the prompt asks for it.
    const message = await this.client.beta.messages
      .stream({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
        tools: [
          {
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
            strict: true,
          },
        ],
        tool_choice: { type: 'auto', disable_parallel_tool_use: true },
        ...(model.startsWith('claude-sonnet')
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
      })
      .finalMessage();

    if (message.stop_reason === 'max_tokens') {
      throw new Error(`${model} hit max_tokens (${maxTokens}) before finishing ${tool.name}`);
    }
    if (message.stop_reason === 'refusal') {
      throw new Error(`${model} refused ${tool.name}: ${message.stop_details?.explanation ?? ''}`);
    }
    const use = message.content.find(
      (block): block is Anthropic.Beta.BetaToolUseBlock =>
        block.type === 'tool_use' && block.name === tool.name,
    );
    if (!use) throw new Error(`${model} answered without calling ${tool.name}`);
    return use.input;
  }
}

export function cacheKey(request: LlmRequest): string {
  return createHash('sha256').update(JSON.stringify(request)).digest('hex').slice(0, 32);
}

/**
 * Wraps a client so each distinct request hits the API once. The key hashes the whole request,
 * so any prompt or schema change misses the cache and reruns that call only.
 */
export function withDiskCache(inner: LlmClient, dir: string): LlmClient {
  return {
    async call(request) {
      const file = join(dir, `${cacheKey(request)}.json`);
      try {
        const cached = JSON.parse(await readFile(file, 'utf8')) as { output: unknown };
        return cached.output;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const output = await inner.call(request);
      await mkdir(dir, { recursive: true });
      await writeFormatted(
        file,
        JSON.stringify({ model: request.model, tool: request.tool.name, output }),
      );
      return output;
    },
  };
}
