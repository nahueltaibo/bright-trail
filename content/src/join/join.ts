import {
  itemAnswer,
  JOIN_ASKS,
  JOIN_LEAVES,
  JOIN_MAX,
  JOIN_MOVES,
  JOIN_PLACES,
  JoinSceneSchema,
  joinProblems,
  type ContentBundle,
  type Item,
  type JoinScene,
} from '@bright-trail/shared';
import { z } from 'zod';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

// Flat with nullable fields, like the content schema: structured output follows it more reliably.
const TaggedJoinSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  ask: z.enum(JOIN_ASKS),
  emoji: z.string().nullable(),
  one: z.string(),
  many: z.string(),
  place: z.enum(JOIN_PLACES),
  move: z.enum(JOIN_MOVES),
  leave: z.enum(JOIN_LEAVES).nullable(),
  start: z.number().int(),
  more: z.number().int().nullable(),
  take: z.number().int().nullable(),
  target: z.number().int().nullable(),
  note: z.string(),
});
export const JoinTagOutputSchema = z.strictObject({ scenes: z.array(TaggedJoinSchema) });
export type TaggedJoin = z.infer<typeof TaggedJoinSchema>;

/** Stories where things come, go, get counted, or fill a ten-frame. */
const JOIN_WORDS =
  /\b(more|join|joins|come|comes|arrive|left|away|leave|leaves|gone|eat|eats|pop|pops|fly|flies|hop|hops|swim|swims|count|how many|in all|altogether|total|ten.frame|make 10|make ten|gave|give|gives|get|gets|finds?)\b/i;

/** Items that might play on a ten-frame: a whole-number answer to 20, a story or counting picture. */
export function joinCandidates(items: readonly Item[]): Item[] {
  return items.filter((i) => {
    if (i.scene || i.slices || i.type === 'number-line') return false;
    const answer = itemAnswer(i);
    if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer > JOIN_MAX)
      return false;
    const v = i.visual;
    if (v && v.kind !== 'objects' && v.kind !== 'ten-frame') return false;
    return v !== undefined || JOIN_WORDS.test(i.narration);
  });
}

const SYSTEM = `You map math practice items for young kids to an animated ten-frame scene. Things (an emoji, or plain counters) sit in the spots of a ten-frame, filled left to right, top row first. They come in and leave the way the story says. The app plays the story after the child answers and counts out loud, so a scene must show exactly what the item says, with the same numbers.

Asks (the app checks the item's answer against the scene):
- count: "start" things sit in a pile, then hop into the frame one by one. Answers start. For "count the frogs" or "how many dots".
- join: "start" things are there, then "more" arrive. Answers start + more.
- leave: "start" things are there, then "take" leave. Answers start - take. "leave" says how they go.
- part: "start" things are there, "take" of them move aside (onto a leaf, into a box, a different color). Answers start - take, the ones that stay. For "5 bugs, 4 on a leaf, how many not" or "7 is 5 and what".
- fill: "start" things are there. Answers target - start, the empty spots up to target. For "how many more make 10".
- make-ten: "start" (under 10) in the top frame, "more" in a second frame below, with start + more past 10. Some move up to make 10. Answers start + more. Only when the item says to make 10 first.
- back: "start" things are left now, the "more" given away or eaten come back. Answers start + more. For "gave away 8, has 9 left, how many at the start".

Rules:
- Set fits to false when the story isn't one of these, when the scene's answer would differ from the item's answer, when a choice isn't a number, when it is about comparing two groups ("how many more does Leo have"), skip counting, number names, place value, or reading a number, or when the story would need more than ${JOIN_MAX} spots. Fill the other fields with any valid value then.
- If the item has an objects picture, emoji is that picture's emoji and start is its count. If it has a ten-frame picture, emoji is null (counters) and start is its filled count. Otherwise pick one emoji for the thing the story names, or null for dots and counters.
- one and many: the thing's name as the item says it, e.g. "fish" and "fish", "cookie" and "cookies".
- place: pond for frogs, ducks, fish, and turtles. bus for kids or people getting on and off. wires for birds. sky for balloons, kites, and butterflies. grass for bugs and flowers. tray for anything else. pond, bus, and wires hold 10, so use tray, sky, or grass when the story needs more than 10 spots.
- move: how a thing comes in. hop for frogs and bunnies, fly for birds and bugs, swim for fish and ducks, walk for people and animals that walk, float for balloons, drive for cars and trucks, slide for objects like apples, cookies, stickers, blocks, and counters.
- leave: how it goes, for leave asks: pop for balloons and bubbles, eat for food that gets eaten, otherwise one of the moves (fly away, swim away, walk away, slide for given away). null otherwise.
- more, take, target: null unless the ask uses them.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

function describe(item: Item) {
  const visual = 'visual' in item ? item.visual : undefined;
  return {
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    narration: item.narration,
    ...(visual?.kind === 'objects' && { picture: { emoji: visual.emoji, count: visual.count } }),
    ...(visual?.kind === 'ten-frame' && { picture: { tenFrameFilled: visual.filled } }),
    ...(item.type === 'tap'
      ? {
          choices: item.choices.map((c) =>
            c.kind === 'number' ? c.value : c.kind === 'text' ? c.text : `[picture] ${c.narration}`,
          ),
        }
      : {}),
    answer: itemAnswer(item),
  };
}

export function joinTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const inputSchema = z.toJSONSchema(JoinTagOutputSchema) as Record<string, unknown>;
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
    maxTokens: 16000,
  };
}

export type JoinTagResult = {
  scenes: Record<string, JoinScene>;
  rejected: Record<string, string>;
};

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptJoins(items: readonly Item[], output: unknown): JoinTagResult {
  const parsed = JoinTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: JoinTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const optional = {
      emoji: t.emoji,
      leave: t.ask === 'leave' ? t.leave : null,
      more: t.more,
      take: t.take,
      target: t.target,
    };
    const candidate = JoinSceneSchema.safeParse({
      kind: 'join',
      ask: t.ask,
      one: t.one,
      many: t.many,
      place: t.place,
      move: t.move,
      start: t.start,
      ...Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== null)),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = joinProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/**
 * Adds stored join scenes to the bundle's items. A scene that no longer matches its item, e.g.
 * after the item was regenerated, is dropped and reported.
 */
export function applyJoins(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, JoinScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  const dropped: string[] = [];
  const items = bundle.items.map((item) => {
    const rest = { ...item };
    delete rest.join;
    const scene = scenes[item.id];
    if (!scene) return rest as Item;
    const problems =
      item.scene || item.slices ? ['the item plays another minigame'] : joinProblems(item, scene);
    if (problems.length > 0) {
      dropped.push(`${item.id}: ${problems.join('; ')}`);
      return rest as Item;
    }
    return { ...rest, join: scene } as Item;
  });
  return { bundle: { ...bundle, items }, dropped };
}
