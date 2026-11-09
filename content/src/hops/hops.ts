import {
  HopsSchema,
  hopsProblems,
  MAX_HOPS,
  type ContentBundle,
  type Hops,
  type Item,
  type NumberLineItem,
} from '@bright-trail/shared';
import { z } from 'zod';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

// Flat with nullable fields, like the content schema: structured output follows it more reliably.
const TaggedHopsSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  start: z.number(),
  legs: z.array(z.strictObject({ by: z.number(), times: z.number().int() })),
  note: z.string(),
});
export const HopsTagOutputSchema = z.strictObject({ paths: z.array(TaggedHopsSchema) });
export type TaggedHops = z.infer<typeof TaggedHopsSchema>;

/** Number-line items the frog plays out. Items another minigame plays keep that game. */
export function hopsCandidates(items: readonly Item[]): NumberLineItem[] {
  return items.filter(
    (i): i is NumberLineItem => i.type === 'number-line' && !i.scene && !i.slices && !i.join,
  );
}

const SYSTEM = `You plan how a frog hops along a number line to show kids why an answer is right. The child places the frog, then the frog starts on "start" and makes each leg's hops in turn, counting out loud where it lands. The last landing must be the item's answer.

How to plan a path:
- Start where the story starts: "starts at 20, hops back 6" starts at 20. "1 more than 4" or "count up from 4" starts at 4. "2 less than 8" or "count down from 8" starts at 8 and hops back.
- Adding a + b: start at a, hop b forward. Use hops of 1 when b is 10 or less, else tens then ones.
- Taking away a - b: start at a, hop back b, the same way.
- Skip counting, equal groups, and times: start at 0 and make one hop per group, each the group's size. "4 × 2, count by 2s" is 4 hops of 2. "7 hops of 5" is 7 hops of 5.
- Fractions and decimals counted in units: start at 0 and hop one unit at a time, e.g. 3 hops of 0.25 for 3/4.
- Set fits to false for anything else, like "move the frog to 27", sharing, comparing, or how many parts make a whole. The app then hops there from the line's start by itself.

Rules:
- by is the hop size, negative to go back. times is how many hops of that size. At most 4 legs and ${MAX_HOPS} hops in all.
- start and every landing must be on the line, between min and max, and on one of its steps (min + a whole number of steps).
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

const describe = (i: NumberLineItem) => ({
  id: i.id,
  narration: i.narration,
  line: { min: i.min, max: i.max, step: i.step },
  answer: i.target,
});

export function hopsTagRequest(skillId: string, items: readonly NumberLineItem[]): LlmRequest {
  const inputSchema = z.toJSONSchema(HopsTagOutputSchema) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    model: GENERATOR_MODEL,
    system: SYSTEM,
    prompt: `Skill ${skillId}. Plan a path for each item, or set fits to false.\n\n${JSON.stringify(items.map(describe), null, 1)}`,
    tool: {
      name: 'submit_paths',
      description: 'Submit one path entry per item. Call it exactly once.',
      inputSchema,
    },
    maxTokens: 16000,
  };
}

export type HopsTagResult = { paths: Record<string, Hops>; rejected: Record<string, string> };

/** Keeps the paths that parse and land on their item's answer. The rest go to `rejected`. */
export function acceptHops(items: readonly NumberLineItem[], output: unknown): HopsTagResult {
  const parsed = HopsTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: HopsTagResult = { paths: {}, rejected: {} };
  for (const t of parsed.paths) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const candidate = HopsSchema.safeParse({ start: t.start, legs: t.legs });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = hopsProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.paths[t.itemId] = candidate.data;
  }
  return result;
}

/** Adds stored paths to the bundle's number-line items. A path that no longer fits is dropped. */
export function applyHops(
  bundle: ContentBundle,
  paths: Readonly<Record<string, Hops>>,
): { bundle: ContentBundle; dropped: string[] } {
  const dropped: string[] = [];
  const items = bundle.items.map((item) => {
    if (item.type !== 'number-line') return item;
    const rest = { ...item };
    delete rest.hops;
    const path = paths[item.id];
    if (!path) return rest;
    const problems = hopsProblems(item, path);
    if (problems.length > 0) {
      dropped.push(`${item.id}: ${problems.join('; ')}`);
      return rest;
    }
    return { ...rest, hops: path };
  });
  return { bundle: { ...bundle, items }, dropped };
}
