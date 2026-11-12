import { z } from 'zod';
import { cardItemProblems, MAX_CARD_TEXT, repeats, sameText, textChoices } from './cards';
import type { Item } from './item';

/** The pictures the app can draw, and the parts each one has a spot for. */
export const PICTURES = {
  plant: ['flower', 'leaf', 'stem', 'roots', 'seed'],
  insect: ['head', 'thorax', 'abdomen', 'legs', 'antennae', 'wings'],
  body: ['head', 'arm', 'hand', 'chest', 'leg', 'foot'],
  organs: ['brain', 'lungs', 'heart', 'liver', 'stomach', 'intestines'],
  machines: ['lever', 'pulley', 'inclined plane', 'wheel and axle', 'wedge', 'screw'],
  planets: ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'],
  map: ['title', 'compass rose', 'mountains', 'forest', 'lake', 'river', 'legend', 'scale'],
} as const;
export type Picture = keyof typeof PICTURES;

const PictureSchema = z.enum(Object.keys(PICTURES) as [Picture, ...Picture[]]);

export const LabelSceneSchema = z
  .object({
    kind: z.literal('label'),
    picture: PictureSchema,
    /** Each part that gets a tag, and the tag's words, like "roots" or "root". */
    tags: z
      .array(z.object({ part: z.string(), text: z.string().trim().min(1).max(MAX_CARD_TEXT) }))
      .min(2)
      .max(6),
    /** The tag the child finds. The others show on the picture already. */
    asked: z.number().int().min(0),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const parts: readonly string[] = PICTURES[s.picture];
    for (const t of s.tags) {
      if (!parts.includes(t.part)) issue('tags', `the ${s.picture} has no ${t.part}`);
    }
    for (const p of repeats(s.tags.map((t) => t.part))) issue('tags', `${p} is tagged twice`);
    for (const t of repeats(s.tags.map((t) => t.text))) issue('tags', `${t} repeats`);
    if (s.asked >= s.tags.length) issue('asked', 'asked is past the last tag');
  });
export type LabelScene = z.infer<typeof LabelSceneSchema>;

/** Why the scene can't play this item. Empty when it can. */
export function labelProblems(item: Item, scene: LabelScene): string[] {
  const problems = cardItemProblems(item);
  const choices = textChoices(item);
  const asked = scene.tags[scene.asked]?.text;
  if (choices && asked) {
    if (!sameText(asked, choices.answer)) {
      problems.push(`the asked tag is ${asked} but the item answers ${choices.answer}`);
    }
    // A choice already on the picture would answer itself.
    scene.tags.forEach((t, i) => {
      if (i !== scene.asked && choices.texts.some((c) => sameText(c, t.text))) {
        problems.push(`the choice ${t.text} already labels the picture`);
      }
    });
  }
  return problems;
}
