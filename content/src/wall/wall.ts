import {
  WALL_ASKS,
  WALL_BUILD_ASKS,
  WallSceneSchema,
  wallProblems,
  type ContentBundle,
  type Item,
  type WallScene,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

// Flat with nullable fields, like the content schema: structured output follows it more reliably.
const TaggedWallSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  ask: z.enum(WALL_ASKS),
  than: z.string(),
  amount: z.string().nullable(),
  parts: z.number().int().nullable(),
  note: z.string(),
});
export const WallTagOutputSchema = z.strictObject({ scenes: z.array(TaggedWallSchema) });
export type TaggedWall = z.infer<typeof TaggedWallSchema>;

const FRACTION = /\b\d+\/\d+\b/;
const WALL_WORDS =
  /\b(equivalent|equals?|same|greater|less|more|bigger|smaller|larger|compare|denominator|numerator|wholes?|fill|fits?)\b/i;

/** Items that might play on a fraction wall: no other game, no picture, fraction comparing words. */
export function wallCandidates(items: readonly Item[]): Item[] {
  return items.filter((i) => {
    if ((i.game && i.game.kind !== 'wall') || i.type === 'number-line' || i.visual) return false;
    if (i.type === 'tap' && i.choices.some((c) => c.kind === 'visual')) return false;
    const words = `${i.prompt} ${i.narration}`;
    return FRACTION.test(words) && WALL_WORDS.test(words);
  });
}

const SYSTEM = `You map math practice items for kids to a fraction wall. The wall shows one whole as a strip on top, and under it fraction strips cut into equal pieces. Equal fractions end at the same edge, and the bigger one reaches further. The app works out the answer from the scene and checks it against the item's answer.

Every scene has than: the top strip's fraction. The asks:
- fill: a keypad item that wants how many pieces of 1/parts make the same amount as than. The child fills a strip of parts pieces per whole up to than's edge. Like "1/2 = ?/4" (than "1/2", parts 4), "2/3 = ?/12", "6/3 = how many wholes?" (than "6/3", parts 1), "3 5/6 = ?/6" (than "3 5/6", parts 6), or "How many 1/4 cup scoops fill 1 cup?" (than "1", parts 4).
- pass: a keypad item that wants the smallest numerator over parts that is greater than than. Like "?/6 is greater than 1/2" (than "1/2", parts 6).
- more, less, same: a yes or no item asking whether amount is greater than, less than, or equal to than. Like "Is 11/8 greater than 3/2?" (ask more, amount "11/8", than "3/2").
- relation: a tap item whose choices each say less, more, or the same, about amount compared to than. Like "Is 3/8 less than 1/2 or more than 1/2?" (amount "3/8", than "1/2").
- match: a tap item whose choices are fractions or mixed numbers, and the answer is the one equal to than. Like "Which mixed number equals 5/4: 1 1/4, 1 1/2, 2 1/4?" (than "5/4").

Rules:
- than and amount: fractions, mixed numbers, or whole numbers exactly as the item writes them, like "3/8", "11/8", "2 1/3", or "1". No units or words. They must appear in the item's prompt or narration.
- amount: only for more, less, same, and relation. null otherwise.
- parts: only for fill and pass, 1 to 12. null otherwise.
- Pieces smaller than twelfths are too thin, and the wall holds at most 4 wholes and 24 pieces a strip.
- Set fits to false when the item isn't about the size of one fraction against another: adding or subtracting, multiplying, ordering three or more fractions, the whole number part or numerator of a mixed number, picking the greatest of several fractions, or comparing shares the item never writes as fractions. Also when the scene's answer would differ from the item's answer. Fill the other fields with any valid value then.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

const choiceText = (c: Extract<Item, { type: 'tap' }>['choices'][number]) =>
  c.kind === 'number' ? c.value : c.kind === 'text' ? c.text : '';

function describe(item: Item) {
  return {
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    narration: item.narration,
    ...(item.type === 'tap'
      ? {
          choices: item.choices.map(choiceText),
          answer: choiceText(item.choices.find((c) => c.id === item.answerChoiceId)!),
        }
      : item.type === 'keypad'
        ? { answer: item.answer }
        : {}),
  };
}

export function wallTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const inputSchema = z.toJSONSchema(WallTagOutputSchema) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    model: GENERATOR_MODEL,
    system: SYSTEM,
    prompt: `Skill ${skillId}. Map each item to a scene, or set fits to false.\n\n${JSON.stringify(items.map(describe), null, 1)}`,
    tool: {
      name: 'submit_scenes',
      description: 'Submit one scene entry per item. Call it exactly once.',
      inputSchema,
    },
    maxTokens: 8000,
  };
}

export type WallTagResult = {
  scenes: Record<string, WallScene>;
  rejected: Record<string, string>;
};

const COMPARE_ASKS = new Set(['more', 'less', 'same', 'relation']);

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptWalls(items: readonly Item[], output: unknown): WallTagResult {
  const parsed = WallTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: WallTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    // Fields an ask ignores are dropped here, so a stray value doesn't fail the schema.
    const candidate = WallSceneSchema.safeParse({
      kind: 'wall',
      ask: t.ask,
      than: t.than,
      ...(COMPARE_ASKS.has(t.ask) && t.amount !== null && { amount: t.amount }),
      ...(WALL_BUILD_ASKS.includes(t.ask) && t.parts !== null && { parts: t.parts }),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = wallProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/** Adds stored wall scenes to the bundle's items, dropping and reporting any that no longer fit. */
export function applyWalls(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, WallScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'wall', scenes, wallProblems);
}
