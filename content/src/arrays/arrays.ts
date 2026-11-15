import {
  ARRAY_ASKS,
  ArraySceneSchema,
  arrayProblems,
  choiceTextValue,
  isArrayFact,
  itemAnswer,
  THING_IDS,
  type ArrayScene,
  type ContentBundle,
  type Item,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

// Flat with nullable fields, like the content schema: structured output follows it more reliably.
const TaggedArraySchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  ask: z.enum(ARRAY_ASKS),
  rows: z.number().int(),
  columns: z.number().int(),
  thing: z.enum(THING_IDS).nullable(),
  find: z.enum(['total', 'rows', 'columns', 'first', 'second']).nullable(),
  splitBy: z.enum(['rows', 'columns']).nullable(),
  splitAt: z.number().int().nullable(),
  note: z.string(),
});
export const ArrayTagOutputSchema = z.strictObject({ scenes: z.array(TaggedArraySchema) });
export type TaggedArray = z.infer<typeof TaggedArraySchema>;

const ARRAY_WORDS = /[×÷]|\b(rows?|columns?|arrays?|groups of|times)\b/i;

/**
 * Items that might be an array: a number answer, number choices, and times words. A picture must
 * be of objects, and a number line must hold a whole-number × or ÷ fact.
 */
export function arrayCandidates(items: readonly Item[]): Item[] {
  return items.filter((i) => {
    if (i.game && i.game.kind !== 'arrays') return false;
    if (i.type === 'number-line' && !isArrayFact(i.prompt)) return false;
    if ('visual' in i && i.visual && i.visual.kind !== 'objects') return false;
    if (typeof itemAnswer(i) !== 'number') return false;
    if (i.type === 'tap') {
      const numbers = i.choices.every(
        (c) =>
          c.kind === 'number' || (c.kind === 'text' && typeof choiceTextValue(c.text) === 'number'),
      );
      if (!numbers) return false;
    }
    return ARRAY_WORDS.test(`${i.prompt} ${i.narration}`);
  });
}

const SYSTEM = `You map math practice items for kids to an array scene. The app shows things in rows and columns, at most 10 by 10, then plays out the array after the child answers. The app works out the answer from the scene and checks it against the item's answer.

Asks:
- total: rows of columns, how many in all. "3 rows of 4", "6 × 7 = ?", "8 pairs of 2 socks".
- rows: the total fills rows of "columns" each. How many rows? "12 dots, 4 in each row, how many rows?", "40 ÷ 5 pucks, 5 in each bucket, how many buckets?".
- columns: the total deals into "rows" equal rows. How many in each row? "10 stickers in 2 equal rows", "24 ÷ 6 = ?".
- turn: the array turns a quarter, so rows × columns becomes columns × rows with the same total. For "you can multiply in any order" items: "3 × 5 = 5 × ?", "6 × 2 = 12, so what is 2 × 6?". rows and columns are the start array, the first fact the item says. find is "total" when the item wants the product, "rows" when it wants the start array's rows, "columns" when it wants its columns.
- split: a line cuts the array in two, for "split 7 into 5 and 2" or "5 × 8 plus one more row of 8". splitBy is the side the item splits: "columns" when it splits the second factor, "rows" when it splits the first or adds a row. splitAt is the first part's size along that side. find is "total" for the product, "first" or "second" for the size of a part the item leaves out, like 1 in "4 × 6 = 4 × 5 + 4 × ?".

Rules:
- rows is the first factor and columns the second, as the item writes them: "3 × 4" or "3 rows of 4" is rows 3, columns 4. For a division "a ÷ b", the total is a and b is the given rows (ask columns) or the given row size (ask rows). Pick rows when the item counts rows, buckets, teams, or boxes it fills, and columns when it asks how many go in each.
- rows and columns are 1 to 10. Set fits to false when either would be bigger.
- thing: the item's things when one of these fits, else null for plain dots or counters: ${THING_IDS.join(', ')}.
- picture: some items show count copies of one emoji. When count is the array's total, the picture shows the array's things, so use that thing. Any other count shows the groups, like 4 ducks with 2 legs each, so pick another thing or null.
- A number-line item plays as the array instead, and the child types the answer. Map the fact in its prompt.
- find, splitBy, splitAt: null unless the ask uses them.
- Set fits to false when the item doesn't ask for the total, a factor, or a part of one multiplication: comparing products, checking a fact with yes or no, picking a fact, adding or subtracting, fact families with text choices, or a part's product like "8 × 2 = ?" inside a split. Also when the scene's answer would differ from the item's answer. Fill the other fields with any valid value then.
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
    ...(item.type !== 'number-line' &&
      item.visual?.kind === 'objects' && {
        picture: `${item.visual.count} ${item.visual.emoji}`,
      }),
    answer: itemAnswer(item),
  };
}

export function arrayTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const inputSchema = z.toJSONSchema(ArrayTagOutputSchema) as Record<string, unknown>;
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

export type ArrayTagResult = {
  scenes: Record<string, ArrayScene>;
  rejected: Record<string, string>;
};

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptArrays(items: readonly Item[], output: unknown): ArrayTagResult {
  const parsed = ArrayTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: ArrayTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const takesFind = t.ask === 'turn' || t.ask === 'split';
    const candidate = ArraySceneSchema.safeParse({
      kind: 'arrays',
      ask: t.ask,
      rows: t.rows,
      columns: t.columns,
      ...(t.thing !== null && { thing: t.thing }),
      ...(takesFind && t.find !== null && { find: t.find }),
      ...(t.ask === 'split' &&
        t.splitBy !== null &&
        t.splitAt !== null && { split: { by: t.splitBy, at: t.splitAt } }),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = arrayProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/** Adds stored array scenes to the bundle's items, dropping and reporting any that no longer fit. */
export function applyArrays(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, ArrayScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'arrays', scenes, arrayProblems);
}
