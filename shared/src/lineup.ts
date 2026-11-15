import { z } from 'zod';
import type { Item } from './item';
import { itemAnswer } from './scene';

/** Who can stand in a line. The app draws each one walking toward the front. */
export const LINE_THINGS = ['frog', 'duck', 'cat', 'dog', 'bunny', 'bear', 'kid'] as const;
export type LineThing = (typeof LINE_THINGS)[number];

/** Most in a line. More get too narrow to tap on a phone. */
export const MAX_LINE = 8;

export const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
] as const;

/**
 * What a line-up asks about the one at `place`:
 * - `find`: the child taps the one in that place.
 * - `place`: the child says which place it's in, from the item's choices or keypad.
 */
export const LINEUP_ASKS = ['find', 'place'] as const;

export const LineupSceneSchema = z
  .object({
    kind: z.literal('lineup'),
    /** Who stands in line, front first. */
    line: z.array(z.enum(LINE_THINGS)).min(2).max(MAX_LINE),
    /** The place the item asks about, counting from 1 at the front. */
    place: z.number().int().min(1),
    ask: z.enum(LINEUP_ASKS),
    /** The name of the one at `place`, like "Ana", when the item gives one. */
    name: z.string().trim().min(1).max(12).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.place > s.line.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['place'],
        message: 'place is past the end of the line',
      });
    }
  });
export type LineupScene = z.infer<typeof LineupSceneSchema>;

/** The words an item may use for each one in line. */
const NAMES: Record<LineThing, RegExp> = {
  frog: /\bfrogs?\b/i,
  duck: /\bducks?\b/i,
  cat: /\bcats?\b|\bkittens?\b/i,
  dog: /\bdogs?\b|\bpupp(y|ies)\b/i,
  bunny: /\bbunn(y|ies)\b|\brabbits?\b/i,
  bear: /\bbears?\b/i,
  kid: /\bkids?\b|\bchild(ren)?\b|\bboys?\b|\bgirls?\b/i,
};

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Why the scene can't play this item. Empty when it can. */
export function lineupProblems(item: Item, scene: LineupScene): string[] {
  const problems: string[] = [];
  const answer = itemAnswer(item);
  if (answer !== scene.place) {
    problems.push(`the line asks about place ${scene.place} but the item answers ${answer}`);
  }
  // A tap answers with a choice id, which the line can't hand back.
  if (scene.ask === 'find' && item.type === 'tap') {
    problems.push('a tap item answers from its choices, so it asks for the place');
  }

  const words = `${item.prompt} ${item.narration}`;
  const one = scene.line[scene.place - 1];
  const named = scene.name
    ? new RegExp(`\\b${escape(scene.name)}\\b`, 'i').test(words)
    : one !== undefined && NAMES[one].test(words);
  if (!named) problems.push(`the item never names ${scene.name ?? `the ${one}`}`);

  // The item must say the place in words, or call it the last one when it is.
  const ordinal = ORDINALS[scene.place - 1];
  const last = scene.place === scene.line.length && /\blast\b/i.test(words);
  if (!last && !(ordinal && new RegExp(`\\b${ordinal}\\b`, 'i').test(words))) {
    problems.push(`the item never says ${ordinal ?? `place ${scene.place}`}`);
  }

  // The line replaces the item's picture, so a counted picture must show the same line.
  const visual = 'visual' in item ? item.visual : undefined;
  if (visual?.kind === 'objects' && visual.count !== scene.line.length) {
    problems.push(`the picture shows ${visual.count} but the line has ${scene.line.length}`);
  }
  return problems;
}
