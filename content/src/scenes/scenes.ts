import {
  CONTAINER_KINDS,
  RECEIVER_KINDS,
  SCENE_ASKS,
  SCENE_LIMITS,
  SceneSchema,
  sceneProblems,
  THING_IDS,
  type ContentBundle,
  type Item,
  type Scene,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

const PersonOut = z.strictObject({ name: z.string(), look: z.enum(['girl', 'boy', 'kid']) });

// Flat with nullable fields, like the content schema: structured output follows it more reliably.
const TaggedSceneSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  ask: z.enum(SCENE_ASKS),
  thing: z.enum(THING_IDS),
  one: z.string(),
  many: z.string(),
  container: z.enum(CONTAINER_KINDS),
  receivers: z.enum(RECEIVER_KINDS),
  total: z.number().int(),
  groups: z.number().int(),
  each: z.number().int().nullable(),
  split: z.array(z.number().int()).nullable(),
  otherGroups: z.number().int().nullable(),
  want: z.enum(['more', 'less']).nullable(),
  sharer: PersonOut.nullable(),
  named: z.array(PersonOut).nullable(),
  otherSharer: PersonOut.nullable(),
  note: z.string(),
});
export const TagOutputSchema = z.strictObject({ scenes: z.array(TaggedSceneSchema) });
export type TaggedScene = z.infer<typeof TaggedSceneSchema>;

/**
 * Stories about sharing, groups, leftovers, and arrays, plus bare times and divide facts. Other
 * items never fit a sharing scene.
 */
const SHARING_WORDS =
  /\bshar|\beach\b|\bgroups? of\b|\bleft\b|\bin all\b|\bfair|\bequally\b|\bper\b|\brows?\b|\btimes\b|[×÷]/i;

export function candidateItems(items: readonly Item[]): Item[] {
  return items.filter((i) => SHARING_WORDS.test(i.narration));
}

const SYSTEM = `You map math practice items for kids to animated sharing scenes. A scene shows a kid (the sharer) with a container of things, and 2 to 6 receivers with their own containers. The app animates the story, so a scene must show exactly what the item says, with the same numbers.

Asks:
- each: "total" things shared equally by "groups" receivers. The answer is total / groups, and may be a fraction like 2 1/2: leftovers get cut into one piece per receiver.
- left: total shared by groups as whole things only. The answer is how many are left over (total mod groups).
- groups: total things, "each" per group. The answer is how many groups (groups = total / each).
- total: groups receivers with "each" things each. The answer is how many in all (total = groups * each).
- fair: receivers hold the counts in "split". The answer is yes or no: is it an equal share?
- compare: the same total shared by "groups" or by "otherGroups" receivers. "want" is more or less. The answer is the number of receivers that gives that share. Choices must name the receiver counts, like "2 friends".

Rules:
- Set fits to false when the item is not one of these stories, when its numbers or answer differ from the scene's, when the picture or choices are not numbers or yes/no, or when the thing has no close match in the thing list. Fill the other fields with any valid value then.
- total is 1 to ${SCENE_LIMITS.total}, groups and otherGroups are 2 to ${SCENE_LIMITS.groups}, each is 1 to ${SCENE_LIMITS.each}.
- thing: the closest match from the list for what the item shares ("granola bars" is bar, "toy cars" is car, "berries" is berry). one and many: the item's own words for one and several, e.g. "granola bar" and "granola bars".
- container: what the things sit in. Use the item's word if it names one (plates, bags, baskets, bowls, cups, ponds), otherwise plate for food, basket for fruit, bucket for balls, box for toys, bag for small things.
- receivers: kids for friends, kids, players, or people. containers when things go into bags, plates, bowls, cups, baskets, or ponds with no kids. stores for stores or shops.
- sharer: the kid who shares or has the things, when the story names one. named: receivers the story names, in order (e.g. "Mia gets 2. Sam gets 2."), else null. otherSharer: for compare, the second sharer when the story names one. look is girl or boy only when the story says she/her or he/him for that kid, otherwise kid. Never guess from the name. Grown-ups like a coach or a bakery are not sharers: use null.
- A bare fact with no story, like "What is 2 × 5?", plays with thing counter, one "counter", many "counters", container box, and receivers containers. a × b is total with groups a and each b. a ÷ b is groups with total a and each b.
- An array plays the same way, one group per row. Rows of dots or counters use thing counter. Rows of a named thing use that thing.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

export function tagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const lines = items.map((item) => ({
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    narration: item.narration,
    ...(item.type === 'tap'
      ? {
          choices: item.choices.map((c) =>
            c.kind === 'number' ? c.value : c.kind === 'text' ? c.text : `[picture] ${c.narration}`,
          ),
          answer: (() => {
            const c = item.choices.find((x) => x.id === item.answerChoiceId)!;
            return c.kind === 'number' ? c.value : c.kind === 'text' ? c.text : c.narration;
          })(),
        }
      : { answer: item.type === 'keypad' ? item.answer : item.target }),
  }));
  const inputSchema = z.toJSONSchema(TagOutputSchema) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    model: GENERATOR_MODEL,
    system: SYSTEM,
    prompt: `Skill ${skillId}. Map each item to a scene, or set fits to false.\n\n${JSON.stringify(lines, null, 1)}`,
    tool: {
      name: 'submit_scenes',
      description: 'Submit one scene entry per item. Call it exactly once.',
      inputSchema,
    },
    maxTokens: 16000,
  };
}

export type TagResult = { scenes: Record<string, Scene>; rejected: Record<string, string> };

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptScenes(items: readonly Item[], output: unknown): TagResult {
  const parsed = TagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: TagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const candidate = SceneSchema.safeParse({
      kind: 'share',
      ask: t.ask,
      thing: t.thing,
      one: t.one,
      many: t.many,
      container: t.container,
      receivers: t.receivers,
      total: t.total,
      groups: t.groups,
      ...(t.each !== null && { each: t.each }),
      ...(t.split !== null && { split: t.split }),
      ...(t.otherGroups !== null && { otherGroups: t.otherGroups }),
      ...(t.want !== null && { want: t.want }),
      ...(t.sharer !== null && { sharer: t.sharer }),
      ...(t.named !== null && t.named.length > 0 && { named: t.named }),
      ...(t.otherSharer !== null && { otherSharer: t.otherSharer }),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = sceneProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/**
 * Adds stored scenes to the bundle's items. A scene that no longer matches its item, e.g. after
 * the item was regenerated, is dropped and reported.
 */
export function applyScenes(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, Scene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'share', scenes, sceneProblems);
}
