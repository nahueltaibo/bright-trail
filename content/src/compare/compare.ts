import {
  COMPARE_ASKS,
  CompareSceneSchema,
  compareProblems,
  choiceTextValue,
  itemAnswer,
  type CompareScene,
  type ContentBundle,
  type Item,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

// Flat with nullable fields, like the content schema: structured output follows it more reliably.
const TaggedCompareSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  ask: z.enum(COMPARE_ASKS),
  values: z.array(z.string()),
  target: z.string().nullable(),
  note: z.string(),
});
export const CompareTagOutputSchema = z.strictObject({ scenes: z.array(TaggedCompareSchema) });
export type TaggedCompare = z.infer<typeof TaggedCompareSchema>;

const COMPARE_WORDS =
  /\b(greater|greatest|less|least|more|most|fewer|fewest|bigger|biggest|smaller|smallest|larger|largest|closer|closest|nearer|nearest|order|middle)\b/i;

/** Items that might pick one of a few numbers: a number answer, no picture, number choices. */
export function compareCandidates(items: readonly Item[]): Item[] {
  return items.filter((i) => {
    if ((i.game && i.game.kind !== 'compare') || i.type === 'number-line' || i.visual) return false;
    if (typeof itemAnswer(i) !== 'number') return false;
    if (i.type === 'tap') {
      const numbers = i.choices.every(
        (c) =>
          c.kind === 'number' || (c.kind === 'text' && typeof choiceTextValue(c.text) === 'number'),
      );
      if (!numbers) return false;
    }
    return COMPARE_WORDS.test(`${i.prompt} ${i.narration}`);
  });
}

const SYSTEM = `You map math practice items for kids to a compare scene. The app shows two to four numbers, then plays out the comparison after the child answers. Whole numbers up to 20 stand as cube towers side by side. Bigger numbers, fractions, and decimals drop as flags onto a number line, where the rightmost is greatest. The app works out the answer from the scene and checks it against the item's answer.

Asks:
- greatest: the item wants the greatest, greater, most, biggest, or largest of the values. Also "least to greatest, which is last" and "greatest to least, which is first".
- least: the item wants the least, less, fewest, smallest of the values. Also "least to greatest, which is first".
- middle: three values put in order, the item wants the one in the middle.
- closer: the item asks which of two values "target" is closer or nearer to, like "Is 190 closer to 100 or 200?".

Rules:
- values: the numbers the item compares, written exactly as the item writes them, like "12", "0.06", "3/8", or "1 1/2". No units or words. For a tap item, values are exactly its choices. For a keypad item, they are the numbers the item lists.
- target: the number a closer ask measures from, as the item writes it. null for other asks.
- Set fits to false when the item doesn't ask to pick one of its listed numbers by size: "1 more than 4", "between 38 and 40", "the second greatest", a missing digit or numerator, true or false, equal values, rounding, or adding and subtracting. Also when the values would be more than 4, or the scene's pick would differ from the item's answer. Fill the other fields with any valid value then.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

function describe(item: Item) {
  return {
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    narration: item.narration,
    ...(item.type === 'tap'
      ? {
          choices: item.choices.map((c) =>
            c.kind === 'number' ? c.value : c.kind === 'text' ? c.text : '',
          ),
        }
      : {}),
    answer: itemAnswer(item),
  };
}

export function compareTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const inputSchema = z.toJSONSchema(CompareTagOutputSchema) as Record<string, unknown>;
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

export type CompareTagResult = {
  scenes: Record<string, CompareScene>;
  rejected: Record<string, string>;
};

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptCompares(items: readonly Item[], output: unknown): CompareTagResult {
  const parsed = CompareTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: CompareTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const candidate = CompareSceneSchema.safeParse({
      kind: 'compare',
      ask: t.ask,
      values: t.values,
      ...(t.ask === 'closer' && t.target !== null && { target: t.target }),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = compareProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/** Adds stored compare scenes to the bundle's items, dropping and reporting any that no longer fit. */
export function applyCompares(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, CompareScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'compare', scenes, compareProblems);
}
