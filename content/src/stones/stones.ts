import {
  MAX_STONES,
  StonesSceneSchema,
  choiceTextValue,
  itemAnswer,
  stonesProblems,
  type ContentBundle,
  type Item,
  type StonesScene,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

// Flat, like the content schema: structured output follows it more reliably.
const TaggedStonesSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  stones: z.array(z.string()),
  missing: z.number().int(),
  note: z.string(),
});
export const StonesTagOutputSchema = z.strictObject({ scenes: z.array(TaggedStonesSchema) });
export type TaggedStones = z.infer<typeof TaggedStonesSchema>;

/** A prompt with a run like "2, 4, ?" or "1/3, 2/3". Narration can't tell, since it lists choices. */
const RUN = /\d[\d/]*,\s*(\d|\?)/;
const COUNTING =
  /\bcount(s|ing)? (by|up|down|on|back)\b|\bcomes? (next|after|before)\b|\bjust before\b|\bmissing number\b|\bskip.count/i;

/** Items that might find one number in a counting run: a number answer, no picture, number choices. */
export function stonesCandidates(items: readonly Item[]): Item[] {
  return items.filter((i) => {
    if ((i.game && i.game.kind !== 'stones') || i.type === 'number-line' || i.visual) return false;
    if (typeof itemAnswer(i) !== 'number') return false;
    if (i.type === 'tap') {
      const numbers = i.choices.every(
        (c) =>
          c.kind === 'number' || (c.kind === 'text' && typeof choiceTextValue(c.text) === 'number'),
      );
      if (!numbers) return false;
    }
    return RUN.test(i.prompt) || COUNTING.test(`${i.prompt} ${i.narration}`);
  });
}

const SYSTEM = `You map math practice items for kids to a stepping-stones scene. A frog stands on the bank of a pond with a row of 2 to ${MAX_STONES} stones. Each stone shows a number, and the numbers change by the same step from stone to stone, like 2, 4, 6, 8 or 5, 4 or 1/3, 2/3, 3/3. One stone has no number: that is the one the child finds. After the child answers, the frog hops the row stone by stone and the missing number appears. The app works out the answer from the scene and checks it against the item's answer.

Rules:
- stones: every number in hop order, including the missing one, written exactly as the item writes them, like "12", "0.5", or "2/3". No units or words. Counting down goes down the row, like "5", "4".
- missing: the index in stones of the number the item asks for, starting at 0.
- Use only numbers the item says in its prompt or narration, plus the answer. Don't add stones the item never mentions. "Count up from 6. What comes next?" is ["6", "7"] with missing 1. "Count by 2s and stop at 50. What is just before 50?" is ["48", "50"] with missing 0.
- Set fits to false when the item doesn't ask for one number in a run with a fixed step: "how many hops", "count by 5s, do you land on 15", bigger or smaller, up or down, comparing, adding a start and a number of hops, or counting objects. Also when the run would need more than ${MAX_STONES} stones, or the missing stone would differ from the item's answer. Fill the other fields with any valid value then.
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

export function stonesTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const inputSchema = z.toJSONSchema(StonesTagOutputSchema) as Record<string, unknown>;
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

export type StonesTagResult = {
  scenes: Record<string, StonesScene>;
  rejected: Record<string, string>;
};

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptStones(items: readonly Item[], output: unknown): StonesTagResult {
  const parsed = StonesTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: StonesTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const candidate = StonesSceneSchema.safeParse({
      kind: 'stones',
      stones: t.stones,
      missing: t.missing,
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = stonesProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/** Adds stored stones scenes to the bundle's items, dropping and reporting any that no longer fit. */
export function applyStones(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, StonesScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'stones', scenes, stonesProblems);
}
