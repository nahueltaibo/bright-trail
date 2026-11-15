import {
  COMPARE_ASKS,
  CompareSceneSchema,
  RELATIONS,
  compareValue,
  compareProblems,
  choiceTextValue,
  itemAnswer,
  type Choice,
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
  claim: z.enum(RELATIONS).nullable(),
  note: z.string(),
});
export const CompareTagOutputSchema = z.strictObject({ scenes: z.array(TaggedCompareSchema) });
export type TaggedCompare = z.infer<typeof TaggedCompareSchema>;

const COMPARE_WORDS =
  /\b(greater|greatest|less|least|more|most|fewer|fewest|bigger|biggest|smaller|smallest|larger|largest|closer|closest|nearer|nearest|order|middle)\b/i;

const RELATION_WORDS = /\b(greater|less|more|fewer|bigger|smaller|larger|same|equal)\b/i;
const RELATION_CHOICE =
  /^(yes|no|true|false|(the )?(more|less|fewer|greater|bigger|smaller|larger|same|equal)( amount)?( (than|as) .+)?)$/i;
const NUMBER = /\d+(?:\.\d+)?(?:\/\d+)?/g;

/** The numbers the item says, like 44, 31, and 38 in "Least: 44, 31, 38". */
function saidNumbers(i: Item): number[] {
  const found = `${i.prompt} ${i.narration}`.match(NUMBER) ?? [];
  return [...new Set(found.map((t) => compareValue(t)!))];
}

/**
 * Items that might compare a few numbers: pick one of them, or say how two stand with word choices
 * like "the same" or "true". A number line counts when its target is one of two or more numbers
 * it says, which leaves out placements like "1 more than 4" that the frog hops.
 */
export function compareCandidates(items: readonly Item[]): Item[] {
  return items.filter((i) => {
    if (i.game && i.game.kind !== 'compare') return false;
    const words = `${i.prompt} ${i.narration}`;
    if (
      i.type === 'tap' &&
      i.choices.every((c) => c.kind === 'text' && RELATION_CHOICE.test(c.text.trim()))
    ) {
      return (!i.visual || i.visual.kind === 'objects') && RELATION_WORDS.test(words);
    }
    if (
      ('visual' in i && i.visual) ||
      typeof itemAnswer(i) !== 'number' ||
      !COMPARE_WORDS.test(words)
    )
      return false;
    if (i.type === 'tap') {
      return i.choices.every(
        (c) =>
          c.kind === 'number' || (c.kind === 'text' && typeof choiceTextValue(c.text) === 'number'),
      );
    }
    if (i.type === 'number-line') {
      const said = saidNumbers(i);
      return said.length >= 2 && said.some((n) => Math.abs(n - i.target) < 1e-9);
    }
    return true;
  });
}

const SYSTEM = `You map math practice items for kids to a compare scene. The app shows two to four numbers, then plays out the comparison after the child answers. Whole numbers up to 20 stand as cube towers side by side. Bigger numbers, fractions, and decimals drop as flags onto a number line, where the rightmost is greatest. The app works out the answer from the scene and checks it against the item's answer.

Asks:
- greatest: the item wants the greatest, greater, most, biggest, or largest of the values. Also "least to greatest, which is last" and "greatest to least, which is first".
- least: the item wants the least, less, fewest, smallest of the values. Also "least to greatest, which is first".
- middle: three values put in order, the item wants the one in the middle.
- closer: the item asks which of two values "target" is closer or nearer to, like "Is 190 closer to 100 or 200?".
- relation: the item asks how two values stand, with word choices. values[0] is the one the item asks about and values[1] the one it measures from. "Is 462 greater than 500 or less than 500?" is values ["462", "500"] and answers "less than 500". "Pip has 4. Mia has 4. More, less, or the same?" is values ["4", "4"]. For a yes-or-no or true-or-false item, claim is the relation it states: "Is 11/8 greater than 3/2?" is values ["11/8", "3/2"] with claim "more", and "Is 6.3 equal to 6.30?" has claim "same".

Rules:
- values: the numbers the item compares, written exactly as the item writes them, like "12", "0.06", "3/8", or "1 1/2". No units or words. For a tap item with number choices, values are exactly its choices. Otherwise they are the numbers the item lists.
- target: the number a closer ask measures from, as the item writes it. null for other asks.
- claim: "more", "less", or "same" for a relation ask with yes-or-no or true-or-false choices. null otherwise.
- A number-line item answers by moving the frog to one of its listed numbers. Its values are the numbers it lists.
- Set fits to false when the item doesn't compare its listed numbers by size: "1 more than 4", "between 38 and 40", "the second greatest", a missing digit or numerator, rounding, or adding and subtracting. Also for a relation between sums, products, or a number and its parts, like "Is 6 + 7 the same as 6 + 6 + 1?", and for choices that name people or things, like "Mia" or "Leo". Also when the values would be more than 4, or the scene's pick would differ from the item's answer. Fill the other fields with any valid value then.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

const choiceText = (c: Choice) => (c.kind === 'number' ? c.value : c.kind === 'text' ? c.text : '');

function describe(item: Item) {
  // Word answers like "the same" have no scene answer, so the LLM sees the choice itself.
  const answer =
    itemAnswer(item) ??
    (item.type === 'tap'
      ? choiceText(item.choices.find((c) => c.id === item.answerChoiceId)!)
      : null);
  return {
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    narration: item.narration,
    ...(item.type === 'tap'
      ? {
          choices: item.choices.map(choiceText),
        }
      : {}),
    answer,
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
      ...(t.ask === 'relation' && t.claim !== null && { claim: t.claim }),
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
