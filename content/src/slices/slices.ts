import {
  FRACTION_FOOD_IDS,
  FRACTION_MAX_WHOLES,
  FRACTION_PARTS,
  FRACTION_SHAPES,
  SLICE_ASKS,
  SliceSceneSchema,
  sliceProblems,
  type ContentBundle,
  type Item,
  type SliceScene,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

const PersonOut = z.strictObject({ name: z.string(), look: z.enum(['girl', 'boy', 'kid']) });

// Flat with nullable fields, like the content schema: structured output follows it more reliably.
const TaggedSliceSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  ask: z.enum(SLICE_ASKS),
  shape: z.enum(FRACTION_SHAPES),
  food: z.enum(FRACTION_FOOD_IDS).nullable(),
  parts: z.number().int(),
  wholes: z.number().int().nullable(),
  picked: z.number().int().nullable(),
  eaten: z.number().int().nullable(),
  take: z.number().int().nullable(),
  more: z.number().int().nullable(),
  cutInto: z.number().int().nullable(),
  other: z.number().int().nullable(),
  want: z.enum(['bigger', 'smaller']).nullable(),
  friends: z.number().int().nullable(),
  who: PersonOut.nullable(),
  note: z.string(),
});
export const SliceTagOutputSchema = z.strictObject({ slices: z.array(TaggedSliceSchema) });
export type TaggedSlice = z.infer<typeof TaggedSliceSchema>;

/** Stories about one thing cut into equal parts. */
const SLICE_WORDS =
  /\b(slices?|pieces?|parts?|halves|half|thirds?|fourths?|quarters?|fifths?|sixths?|eighths?|tenths?|twelfths?|pizzas?|pies?|brownies?|pans?|chocolate|granola|strips?)\b/i;

/** Items that might play as a slices story: fraction words or a fraction picture, no sharing scene. */
export function sliceCandidates(items: readonly Item[]): Item[] {
  return items.filter(
    (i) =>
      i.game?.kind !== 'share' &&
      (SLICE_WORDS.test(i.narration) || ('visual' in i && i.visual?.kind === 'fraction')),
  );
}

const SYSTEM = `You map math practice items for kids to animated fraction scenes. A scene shows one or more equal wholes (a pizza, a pie, a cookie, a pan of brownies, a chocolate bar, a granola bar, or a plain circle, rectangle, or strip) cut into equal slices. The app animates the story and counts slices, so a scene must show exactly what the item says, with the same numbers.

Asks (the app checks the item's answer against the scene, as a count of slices or as a fraction):
- picked: "picked" slices pull out of "wholes" wholes of "parts" slices. Answers picked or picked/parts (e.g. 3 or 3/4, or 7/4 with 2 wholes).
- left: "eaten" slices are already gone (often 0), then "take" slices get eaten. Answers what is left, as a count or over parts.
- parts: the whole gets cut into "parts" equal slices. Answers parts.
- each: one whole of "parts" slices shared equally by "friends" kids (friends defaults to parts). Answers slices each, or that over parts (e.g. 1/4, or 2 pieces of 8).
- same: "picked" of "parts" slices, cut again (or joined) into "cutInto" slices per whole. Answers picked*cutInto/parts, as a count or over cutInto (e.g. 1/2 is 2 fourths).
- bigger: one slice of "parts" and one slice of "other" from same-size wholes. want "bigger" or "smaller". Answers that unit fraction (e.g. 1/2).
- add: "picked" slices, then "more" slices of the same whole. Answers the sum, as a count or over parts.

Rules:
- Set fits to false when the story is not one of these, when the scene's answer would differ from the item's answer, when a choice is a picture, when choices aren't numbers or fractions (bigger may have one "Same" choice), or when the item compares fractions with different parts other than one slice each. Fill the other fields with any valid value then.
- parts and cutInto are ${FRACTION_PARTS.min} to ${FRACTION_PARTS.max}. wholes is 1 to ${FRACTION_MAX_WHOLES}, null for 1. picked + eaten + take + more never exceed parts × wholes.
- If the item has a fraction picture, the scene must match it: same shape, parts, and wholes, and for picked the same picked count. Its picked slices are the ones the story is about.
- shape: circle for pizza, pie, cookie, cake, flatbread, or a circle. rectangle for a pan, a tray of brownies, a chocolate bar, or a rectangle cut into a grid. bar for a granola bar, a strip, a ribbon, a fraction strip, or a bar cut in one row.
- food: pizza, pie, or cookie for circles; brownies (any pan) or chocolate for rectangles; granola for bars. null when the story names no food or a food not in the list.
- who: the kid who picks, eats, or shares, when the story names one. look is girl or boy only when the story says she/her or he/him for that kid, otherwise kid. Never guess from the name.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

function describe(item: Item) {
  const visual = 'visual' in item ? item.visual : undefined;
  return {
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    narration: item.narration,
    ...(visual?.kind === 'fraction' && {
      picture: {
        shape: visual.shape,
        parts: visual.parts,
        picked: visual.picked,
        wholes: visual.wholes ?? 1,
      },
    }),
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
  };
}

export function sliceTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const inputSchema = z.toJSONSchema(SliceTagOutputSchema) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    model: GENERATOR_MODEL,
    system: SYSTEM,
    prompt: `Skill ${skillId}. Map each item to a scene, or set fits to false.\n\n${JSON.stringify(items.map(describe), null, 1)}`,
    tool: {
      name: 'submit_slices',
      description: 'Submit one scene entry per item. Call it exactly once.',
      inputSchema,
    },
    maxTokens: 16000,
  };
}

/** Why a scene can't stand in for the item, besides its answer: it must match the item's picture. */
export function slicePictureProblems(item: Item, s: SliceScene): string[] {
  const v = 'visual' in item ? item.visual : undefined;
  if (v?.kind !== 'fraction') return [];
  const problems: string[] = [];
  if (v.shape !== s.shape) problems.push(`the picture is a ${v.shape}, the scene a ${s.shape}`);
  if (v.parts !== s.parts) problems.push(`the picture has ${v.parts} parts, the scene ${s.parts}`);
  if ((v.wholes ?? 1) !== (s.wholes ?? 1))
    problems.push('the picture has another number of wholes');
  if (s.ask === 'picked' && v.picked !== s.picked) {
    problems.push(`the picture picks ${v.picked}, the scene ${s.picked}`);
  }
  return problems;
}

const allProblems = (item: Item, s: SliceScene) => [
  ...sliceProblems(item, s),
  ...slicePictureProblems(item, s),
];

export type SliceTagResult = {
  slices: Record<string, SliceScene>;
  rejected: Record<string, string>;
};

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptSlices(items: readonly Item[], output: unknown): SliceTagResult {
  const parsed = SliceTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: SliceTagResult = { slices: {}, rejected: {} };
  for (const t of parsed.slices) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const optional = {
      food: t.food,
      wholes: t.wholes && t.wholes > 1 ? t.wholes : null,
      picked: t.picked,
      eaten: t.eaten || null,
      take: t.take,
      more: t.more,
      cutInto: t.cutInto,
      other: t.other,
      want: t.want,
      friends: t.friends,
      who: t.who,
    };
    const candidate = SliceSceneSchema.safeParse({
      kind: 'slices',
      ask: t.ask,
      shape: t.shape,
      parts: t.parts,
      ...Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== null)),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = allProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.slices[t.itemId] = candidate.data;
  }
  return result;
}

/**
 * Adds stored slice scenes to the bundle's items. A scene that no longer matches its item, e.g.
 * after the item was regenerated, is dropped and reported.
 */
export function applySlices(
  bundle: ContentBundle,
  slices: Readonly<Record<string, SliceScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'slices', slices, allProblems);
}
