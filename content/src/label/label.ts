import {
  LabelSceneSchema,
  PICTURES,
  labelProblems,
  textChoices,
  type ContentBundle,
  type Item,
  type LabelScene,
  type Picture,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { cardItems, cardTagRequest } from '../games/cards';
import type { LlmRequest } from '../graph/llm';

const PICTURE_NAMES = Object.keys(PICTURES) as [Picture, ...Picture[]];

// Flat, like the content schema: structured output follows it more reliably.
const TaggedLabelSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  picture: z.enum(PICTURE_NAMES),
  part: z.string(),
  others: z.array(z.string()),
  note: z.string(),
});
export const LabelTagOutputSchema = z.strictObject({ scenes: z.array(TaggedLabelSchema) });
export type TaggedLabel = z.infer<typeof TaggedLabelSchema>;

const ARTICLE = /^(the|a|an|your)\s+/;

/** Whether the words name the part, without case, a leading "the", "a", or "your", or a plural. */
export function namesPart(words: string, part: string): boolean {
  const w = words.trim().toLowerCase().replace(/\s+/g, ' ').replace(ARTICLE, '');
  if (w === part) return true;
  const one = (p: string) => [p, `${p}s`, `${p}es`, p.replace(/f$/, 'ves')];
  return one(part).includes(w) || one(w).includes(part);
}

/** The pictures with a part the words name, like `plant` and `roots` for "the roots". */
export function partsNamed(words: string): { picture: Picture; part: string }[] {
  return PICTURE_NAMES.flatMap((picture) =>
    PICTURES[picture].filter((part) => namesPart(words, part)).map((part) => ({ picture, part })),
  );
}

/** Words that name what each picture shows. An item about its part says one of them. */
export const PICTURE_WORDS: Record<Picture, RegExp> = {
  plant: /\b(plants?|flowers?|trees?|seedlings?|beans?|sunflowers?)\b/i,
  insect: /\b(insects?|bugs?|ants?|bees?|butterfly|butterflies|beetles?|ladybugs?)\b/i,
  body: /\b(body|bodies|you|your)\b/i,
  organs: /\b(organs?|body|you|your)\b/i,
  machines: /\b(machines?)\b/i,
  planets: /\b(planets?|solar system|space|orbits?)\b/i,
  map: /\b(maps?)\b/i,
};

/**
 * Why the item isn't about the scene's picture. A choice that only shares a part's name, like
 * "a river" in "Which is natural?", would pass every other check.
 */
export function pictureProblems(item: Item, scene: Pick<LabelScene, 'picture'>): string[] {
  return PICTURE_WORDS[scene.picture].test(`${item.prompt} ${item.narration}`)
    ? []
    : [`the item never says what the ${scene.picture} picture shows`];
}

/** Items whose answer names a part of a picture the app can draw. */
export function labelCandidates(items: readonly Item[]): Item[] {
  return cardItems(items, 'label').filter((i) => partsNamed(textChoices(i)!.answer).length > 0);
}

const SYSTEM = `You map practice items for kids to a picture they label. The app draws one picture with a tag on some of its parts, and one part shows a question mark. The child picks the choice that names that part. The app checks the scene against the item.

The pictures and the only parts each one has:
${PICTURE_NAMES.map((p) => `- ${p}: ${PICTURES[p].join(', ')}`).join('\n')}

For each item give:
- picture: the picture the item is about.
- part: the part the item's answer names, spelled as in the list above. "the roots" is roots, "leaves" is leaf.
- others: 1 to 5 more parts of the same picture that show their tags as hints. Never a part that one of the item's choices names, since that would give the answer away.

Rules:
- Set fits to false unless the item asks the child to name one part of that picture, like "Which part holds a plant in the soil?" with the answer roots, or "Which organ pumps blood?" with the answer heart.
- Also set fits to false when the item is about another living thing or object than the picture, like a bird's wings or a fish's fins, when it asks which choice is not a part, or when it asks what a part does instead of which part it is. Fill the other fields with any valid value then.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

export function labelTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  return cardTagRequest(SYSTEM, LabelTagOutputSchema, skillId, items);
}

export type LabelTagResult = {
  scenes: Record<string, LabelScene>;
  rejected: Record<string, string>;
};

/** The scene for a tagged item: the asked tag says the item's answer, the others their part. */
function sceneFor(item: Item, t: TaggedLabel): { scene?: LabelScene; problems: string[] } {
  const { texts, answer } = textChoices(item)!;
  const problems = pictureProblems(item, t);
  if (!namesPart(answer, t.part)) problems.push(`the answer ${answer} does not name ${t.part}`);
  for (const p of t.others) {
    const named = texts.find((c) => namesPart(c, p));
    if (named) problems.push(`the hint ${p} names the choice ${named}`);
  }
  if (problems.length > 0) return { problems };
  const order: readonly string[] = PICTURES[t.picture];
  const parts = [t.part, ...t.others].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const candidate = LabelSceneSchema.safeParse({
    kind: 'label',
    picture: t.picture,
    tags: parts.map((part) => ({ part, text: part === t.part ? answer : part })),
    asked: parts.indexOf(t.part),
  });
  if (!candidate.success) return { problems: candidate.error.issues.map((i) => i.message) };
  return { scene: candidate.data, problems: labelProblems(item, candidate.data) };
}

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptLabels(items: readonly Item[], output: unknown): LabelTagResult {
  const parsed = LabelTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: LabelTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const { scene, problems } = sceneFor(item, t);
    if (problems.length > 0 || !scene) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = scene;
  }
  return result;
}

/** Adds stored label scenes to the bundle's items, dropping and reporting any that no longer fit. */
export function applyLabels(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, LabelScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'label', scenes, (item, scene) => [
    ...pictureProblems(item, scene),
    ...labelProblems(item, scene),
  ]);
}
