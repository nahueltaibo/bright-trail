import {
  LINE_THINGS,
  LineupSceneSchema,
  MAX_LINE,
  itemAnswer,
  lineupProblems,
  type ContentBundle,
  type Item,
  type LineupScene,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

// Flat, like the content schema: structured output follows it more reliably.
const TaggedLineupSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  line: z.array(z.enum(LINE_THINGS)),
  place: z.number().int(),
  ask: z.enum(['find', 'place']),
  name: z.string(),
  note: z.string(),
});
export const LineupTagOutputSchema = z.strictObject({ scenes: z.array(TaggedLineupSchema) });
export type TaggedLineup = z.infer<typeof TaggedLineupSchema>;

/** A place in a line, like "third in line" or "the last duck's place". */
const PLACE =
  /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|last)\b[^.?!]*\b(line|place|queue)\b|\b(line|place|queue)\b[^.?!]*\b(first|second|third|fourth|fifth|sixth|seventh|eighth|last)\b/i;

/** Items that might ask for a place in a line: a whole-number answer that fits the line. */
export function lineupCandidates(items: readonly Item[]): Item[] {
  return items.filter((i) => {
    if (i.game && i.game.kind !== 'lineup') return false;
    const answer = itemAnswer(i);
    if (typeof answer !== 'number' || !Number.isInteger(answer)) return false;
    if (answer < 1 || answer > MAX_LINE) return false;
    const words = `${i.prompt} ${i.narration}`;
    // "Steps of one fourth" on a number line is a fraction, not a place.
    if (/\bnumber line\b|\d\/\d/i.test(words)) return false;
    return PLACE.test(words);
  });
}

const SYSTEM = `You map math practice items for kids to a line-up scene. 2 to ${MAX_LINE} of the same kind of animal, or kids, walk in and stand in a line, front first, and a narrator counts their places: first, second, third. Then the child either taps the one in a given place ("find"), or says which place one is in ("place") with the item's own choices or keypad. The app checks that the asked place is the item's answer.

Rules:
- line: who stands in line, front first, from ${LINE_THINGS.join(', ')}. Use the animal the item names for the one asked about, and "kid" for a named person. Use the item's count when it gives one, like 5 for "Five ducks". Otherwise make the line a few longer than the asked place, so the asked one is not last, up to ${MAX_LINE}. Fill the rest with the same kind, or with other animals when the item picks one out by kind, like "The cat is second".
- place: the place the item asks about, counting from 1 at the front. It must equal the item's answer.
- ask: "place" when the item asks which place someone is in, and always for tap items. "find" when the item tells the place and asks to hop, type, or find it.
- name: the person's name, like "Ana", when the one asked about is named. Empty otherwise.
- Set fits to false when the item doesn't ask for one place in a line: what a number means, how many, ordering numbers by size, or anything a line of animals can't show. Fill the other fields with any valid value then.
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

export function lineupTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const inputSchema = z.toJSONSchema(LineupTagOutputSchema) as Record<string, unknown>;
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
    maxTokens: 4000,
  };
}

export type LineupTagResult = {
  scenes: Record<string, LineupScene>;
  rejected: Record<string, string>;
};

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptLineups(items: readonly Item[], output: unknown): LineupTagResult {
  const parsed = LineupTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: LineupTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const candidate = LineupSceneSchema.safeParse({
      kind: 'lineup',
      line: t.line,
      place: t.place,
      ask: t.ask,
      ...(t.name.trim() && { name: t.name.trim() }),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = lineupProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/** Adds stored line-ups to the bundle's items, dropping and reporting any that no longer fit. */
export function applyLineups(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, LineupScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'lineup', scenes, lineupProblems);
}
