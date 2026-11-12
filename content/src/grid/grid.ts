import {
  GRID_ASKS,
  GridSceneSchema,
  gridProblems,
  itemAnswer,
  type ContentBundle,
  type GridScene,
  type Item,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

// Flat with nullable fields, like the content schema: structured output follows it more reliably.
const TaggedGridSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  unit: z.enum(['tenths', 'hundredths']),
  ask: z.enum(GRID_ASKS),
  amount: z.string(),
  other: z.string().nullable(),
  note: z.string(),
});
export const GridTagOutputSchema = z.strictObject({ scenes: z.array(TaggedGridSchema) });
export type TaggedGrid = z.infer<typeof TaggedGridSchema>;

const GRID_WORDS =
  /\b(tenths?|hundredths?|decimals?|percent|dimes?|equivalent)\b|%|\d\/(10|100)\b|\d?\.\d/i;

/** Items that might read a filled strip or grid: a number or yes-no answer, no picture, decimal words. */
export function gridCandidates(items: readonly Item[]): Item[] {
  return items.filter((i) => {
    if ((i.game && i.game.kind !== 'grid') || i.type === 'number-line' || i.visual) return false;
    if (itemAnswer(i) === null) return false;
    return GRID_WORDS.test(`${i.prompt} ${i.narration}`);
  });
}

const SYSTEM = `You map math practice items for kids to a grid scene. The app shows one whole as a strip cut into 10 tenths, or as a 10 by 10 grid of hundredths. After the child answers, it fills in the scene's amount part by part and counts it, then shows it as a decimal, a fraction, and a percent. The app works out the answer from the scene and checks it against the item's answer.

Units:
- tenths: up to 4 strips, for amounts in tenths like 0.7, 13/10, or 3.5.
- hundredths: up to 2 grids, for amounts in hundredths like 0.25, 30%, 3/4, or 1 1/4. Use it for percents, and whenever the amount isn't a whole number of tenths.

Asks:
- decimal: the item wants the amount as a decimal, like "Type the decimal for 9 tenths" or "Which decimal is the same as 1/2?".
- fraction: the item wants the amount as a fraction or mixed number, like "Which fraction is the same as 0.4?" or "Which fraction is equivalent to 3/4?".
- percent: the item wants the amount as a percent, like "What percent is 3/5?" or "18 out of 20 is what percent?".
- parts: the item wants how many tenths or hundredths the amount is, like "0.3 is how many hundredths?" or "0.8 is a fraction with denominator 100. What is the numerator?".
- same: the item asks yes or no whether two amounts are equal, like "Is 7/10 the same as 0.07?". amount and other are the two amounts. Use hundredths when either is in hundredths.

Rules:
- amount: the part the picture fills, written as the item writes it, like "9/10", "1/2", "0.25", "30%", or "18/20". No units or words. For "9 tenths", write "9/10". It must be a whole number of tenths or hundredths, more than 0, and fit in the strips or grids.
- other: the second amount for a same ask, as the item writes it. null for other asks.
- Set fits to false when the item isn't about reading or matching one amount of a whole: place value digits, comparing or ordering amounts, adding, money totals over 2 dollars, units like metres when the answer isn't the amount, amounts that need more strips or grids, or thirds and other parts a grid can't show. Also when the scene's answer would differ from the item's answer. Fill the other fields with any valid value then.
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
    answer:
      item.type === 'tap'
        ? item.choices
            .filter((c) => c.id === item.answerChoiceId)
            .map((c) => (c.kind === 'number' ? c.value : c.kind === 'text' ? c.text : ''))[0]
        : itemAnswer(item),
  };
}

export function gridTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const inputSchema = z.toJSONSchema(GridTagOutputSchema) as Record<string, unknown>;
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

export type GridTagResult = {
  scenes: Record<string, GridScene>;
  rejected: Record<string, string>;
};

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptGrids(items: readonly Item[], output: unknown): GridTagResult {
  const parsed = GridTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: GridTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const candidate = GridSceneSchema.safeParse({
      kind: 'grid',
      unit: t.unit,
      ask: t.ask,
      amount: t.amount,
      ...(t.ask === 'same' && t.other !== null && { other: t.other }),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = gridProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/** Adds stored grid scenes to the bundle's items, dropping and reporting any that no longer fit. */
export function applyGrids(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, GridScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'grid', scenes, gridProblems);
}
