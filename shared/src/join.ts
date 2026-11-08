import { z } from 'zod';
import type { Item } from './item';
import { choiceTextValue, itemAnswer } from './scene';

/**
 * What a join scene asks, and how the app plays it out on a ten-frame:
 * - `count`: `start` things sit in a pile, then hop into the frame one by one, counted.
 * - `join`: `start` things sit in the frame. `more` arrive, counted on.
 * - `leave`: `start` things sit in the frame. `take` leave the way the story says.
 * - `part`: `start` things sit in the frame. `take` move aside, and the rest get counted.
 * - `fill`: `start` things sit in the frame. The empty spots up to `target` get counted, then fill.
 * - `make-ten`: `start` sit in the top frame, `more` in the bottom one. Some move up to make 10.
 * - `back`: `start` things are left. The `more` given away come back, counted on.
 */
export const JOIN_ASKS = ['count', 'join', 'leave', 'part', 'fill', 'make-ten', 'back'] as const;
export type JoinAsk = (typeof JOIN_ASKS)[number];

/** How things come into the frame. */
export const JOIN_MOVES = ['hop', 'fly', 'swim', 'walk', 'slide', 'float', 'drive'] as const;
export type JoinMove = (typeof JOIN_MOVES)[number];
/** How things leave it. `pop` and `eat` leave the spot where it was. */
export const JOIN_LEAVES = [...JOIN_MOVES, 'pop', 'eat'] as const;
/**
 * Where the frame is. A pond has lily pads, a bus has windows, wires have spots for birds. Those
 * hold 10. The tray, sky, and grass hold a second frame for numbers past 10.
 */
export const JOIN_PLACES = ['tray', 'pond', 'bus', 'wires', 'sky', 'grass'] as const;
export type JoinPlace = (typeof JOIN_PLACES)[number];
export const TEN_ONLY_PLACES: readonly JoinPlace[] = ['pond', 'bus', 'wires'];
export const JOIN_MAX = 20;

const Count = z.number().int().min(0).max(JOIN_MAX);

export const JoinSceneSchema = z
  .object({
    kind: z.literal('join'),
    ask: z.enum(JOIN_ASKS),
    /** Without an emoji the things are plain counters, as on a ten-frame picture. */
    emoji: z.string().min(1).max(16).optional(),
    /** The thing's name as the item says it, e.g. "fish". */
    one: z.string().trim().min(1),
    many: z.string().trim().min(1),
    place: z.enum(JOIN_PLACES),
    move: z.enum(JOIN_MOVES),
    leave: z.enum(JOIN_LEAVES).optional(),
    start: Count,
    more: Count.optional(),
    take: Count.optional(),
    target: Count.optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const needs: Record<JoinAsk, (keyof typeof s)[]> = {
      count: [],
      join: ['more'],
      leave: ['take'],
      part: ['take'],
      fill: ['target'],
      'make-ten': ['more'],
      back: ['more'],
    };
    for (const key of needs[s.ask])
      if (s[key] === undefined) issue(key, `ask ${s.ask} needs ${key}`);
    const most = joinSpots(s);
    if (most > JOIN_MAX) issue('start', `the story needs ${most} spots, more than ${JOIN_MAX}`);
    if (most > 10 && TEN_ONLY_PLACES.includes(s.place)) {
      issue('place', `a ${s.place} holds 10, the story needs ${most}`);
    }
    if (s.ask === 'count' && s.start < 1) issue('start', 'count needs something to count');
    if ((s.ask === 'join' || s.ask === 'back' || s.ask === 'make-ten') && (s.more ?? 0) < 1) {
      issue('more', `ask ${s.ask} needs at least one more`);
    }
    if ((s.ask === 'leave' || s.ask === 'part') && ((s.take ?? 0) < 1 || s.take! > s.start)) {
      issue('take', `take must be 1 to ${s.start}`);
    }
    if (s.ask === 'leave' && !s.leave) issue('leave', 'ask leave needs leave');
    if (s.ask === 'part' && s.start > 10) issue('start', 'part sets things aside below one frame');
    if (s.ask === 'fill' && s.target !== undefined && s.target <= s.start) {
      issue('target', 'target must be above start');
    }
    if (s.ask === 'make-ten') {
      const sum = s.start + (s.more ?? 0);
      if (s.start >= 10 || sum <= 10)
        issue('start', 'make-ten needs start under 10 and a sum past 10');
    }
  });
export type JoinScene = z.infer<typeof JoinSceneSchema>;

/** The most spots the story fills at once. */
export function joinSpots(s: Omit<JoinScene, 'kind'>): number {
  switch (s.ask) {
    case 'join':
    case 'back':
    case 'make-ten':
      return s.start + (s.more ?? 0);
    case 'fill':
      return Math.max(s.start, s.target ?? 0);
    default:
      return s.start;
  }
}

/** The answer the scene shows. */
export function joinValue(s: JoinScene): number {
  switch (s.ask) {
    case 'count':
      return s.start;
    case 'join':
    case 'back':
    case 'make-ten':
      return s.start + s.more!;
    case 'leave':
    case 'part':
      return s.start - s.take!;
    case 'fill':
      return s.target! - s.start;
  }
}

/** Why the scene can't play this item. Empty when it can. */
export function joinProblems(item: Item, scene: JoinScene): string[] {
  const problems: string[] = [];
  const answer = itemAnswer(item);
  const value = joinValue(scene);
  if (typeof answer !== 'number') problems.push('the item answer is not a number');
  else if (answer !== value)
    problems.push(`the scene shows ${value} but the item answers ${answer}`);
  if (item.type === 'number-line') problems.push('number-line items keep their own screen');
  if (item.type === 'tap') {
    for (const c of item.choices) {
      const v = c.kind === 'number' ? c.value : c.kind === 'text' ? choiceTextValue(c.text) : null;
      if (typeof v !== 'number') problems.push(`choice ${c.id} is not a number`);
    }
  }
  // The stage replaces the item's picture, so it must start from the same picture.
  const v = 'visual' in item ? item.visual : undefined;
  if (v?.kind === 'objects') {
    if (scene.emoji !== v.emoji)
      problems.push(`the picture shows ${v.emoji}, the scene ${scene.emoji ?? 'counters'}`);
    // A joining story's picture may show the start or everything at the end.
    if (v.count !== scene.start && v.count !== joinSpots(scene)) {
      problems.push(`the picture has ${v.count}, the scene starts with ${scene.start}`);
    }
  } else if (v?.kind === 'ten-frame') {
    if (v.filled !== scene.start) {
      problems.push(`the ten-frame has ${v.filled}, the scene starts with ${scene.start}`);
    }
  } else if (v) {
    problems.push(`the item has a ${v.kind} picture`);
  }
  return problems;
}
