import { textChoices, type Card, type GameKind, type Item } from '@bright-trail/shared';
import { z } from 'zod';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

/** Tap items with only text choices, no picture, and no other game: what every card game needs. */
export function cardItems(items: readonly Item[], kind: GameKind): Item[] {
  return items.filter(
    (i) => (!i.game || i.game.kind === kind) && !('visual' in i && i.visual) && textChoices(i),
  );
}

const YES_NO = /^(true|false|yes|no)$/i;

/** Whether every choice is true, false, yes, or no. Those items ask about a claim, not cards. */
export const isYesNo = (item: Item) => textChoices(item)!.texts.every((t) => YES_NO.test(t.trim()));

/** A card the LLM writes. An empty or null emoji means none. */
export const TaggedCardSchema = z.strictObject({ text: z.string(), emoji: z.string().nullable() });

export function toCard(card: z.infer<typeof TaggedCardSchema>): Card {
  const emoji = card.emoji?.trim();
  return { text: card.text, ...(emoji && { emoji }) };
}

function describe(item: Item) {
  const { texts, answer } = textChoices(item)!;
  return {
    id: item.id,
    prompt: item.prompt,
    narration: item.narration,
    choices: texts,
    answer,
  };
}

/** One skill's call for a card game, with the game's system prompt and answer schema. */
export function cardTagRequest(
  system: string,
  output: z.ZodType,
  skillId: string,
  items: readonly Item[],
): LlmRequest {
  const inputSchema = z.toJSONSchema(output) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    model: GENERATOR_MODEL,
    system,
    prompt: `Skill ${skillId}. Map each item to a scene, or set fits to false.\n\n${JSON.stringify(items.map(describe), null, 1)}`,
    tool: {
      name: 'submit_scenes',
      description: 'Submit one scene entry per item. Call it exactly once.',
      inputSchema,
    },
    maxTokens: 8000,
  };
}
