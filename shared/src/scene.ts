import { z } from 'zod';
import type { Item } from './item';

/** Things a sharing scene can show. Only food can be cut into pieces. */
export const THINGS = {
  cookie: { emoji: '🍪', cuttable: true },
  apple: { emoji: '🍎', cuttable: true },
  pear: { emoji: '🍐', cuttable: true },
  peach: { emoji: '🍑', cuttable: true },
  orange: { emoji: '🍊', cuttable: true },
  banana: { emoji: '🍌', cuttable: true },
  strawberry: { emoji: '🍓', cuttable: true },
  berry: { emoji: '🫐', cuttable: false },
  grape: { emoji: '🍇', cuttable: false },
  pie: { emoji: '🥧', cuttable: true },
  pizza: { emoji: '🍕', cuttable: true },
  sandwich: { emoji: '🥪', cuttable: true },
  cracker: { emoji: '🍘', cuttable: true },
  muffin: { emoji: '🧁', cuttable: true },
  bar: { emoji: '🍫', cuttable: true },
  pancake: { emoji: '🥞', cuttable: true },
  egg: { emoji: '🥚', cuttable: false },
  fish: { emoji: '🐟', cuttable: false },
  duck: { emoji: '🦆', cuttable: false },
  bug: { emoji: '🐞', cuttable: false },
  ball: { emoji: '⚽', cuttable: false },
  marble: { emoji: '🔮', cuttable: false },
  teddy: { emoji: '🧸', cuttable: false },
  car: { emoji: '🚗', cuttable: false },
  sticker: { emoji: '🌟', cuttable: false },
  star: { emoji: '⭐', cuttable: false },
  pencil: { emoji: '✏️', cuttable: false },
  crayon: { emoji: '🖍️', cuttable: false },
  balloon: { emoji: '🎈', cuttable: false },
  card: { emoji: '🃏', cuttable: false },
  block: { emoji: '🧱', cuttable: false },
  flower: { emoji: '🌸', cuttable: false },
  counter: { emoji: '🔵', cuttable: false },
} as const satisfies Record<string, { emoji: string; cuttable: boolean }>;
export type ThingId = keyof typeof THINGS;
export const THING_IDS = Object.keys(THINGS) as [ThingId, ...ThingId[]];

export const CONTAINER_KINDS = [
  'plate',
  'bowl',
  'basket',
  'bucket',
  'box',
  'bag',
  'cup',
  'pond',
] as const;
export type ContainerKind = (typeof CONTAINER_KINDS)[number];

/** Who gets the shares: named kids, plain containers, or stores. */
export const RECEIVER_KINDS = ['kids', 'containers', 'stores'] as const;
export type ReceiverKind = (typeof RECEIVER_KINDS)[number];

/**
 * What the item asks about the scene:
 * - `each`: total shared by groups, how much each gets. Fractions mean cutting.
 * - `left`: whole things only, how many are left over.
 * - `groups`: `each` per group, how many groups.
 * - `total`: groups of `each`, how many in all.
 * - `fair`: is `split` an equal share, yes or no.
 * - `compare`: total shared by `groups` or by `otherGroups`, which gives `want` each.
 */
export const SCENE_ASKS = ['each', 'left', 'groups', 'total', 'fair', 'compare'] as const;
export type SceneAsk = (typeof SCENE_ASKS)[number];

export const SCENE_LIMITS = { total: 20, groups: 6, each: 10 } as const;

/** A kid the story names. `look` comes from the story's pronouns: kid when it uses none. */
export const PersonSchema = z.object({
  name: z.string().trim().min(1).max(20),
  look: z.enum(['girl', 'boy', 'kid']),
});
export type Person = z.infer<typeof PersonSchema>;

export const SceneSchema = z
  .object({
    kind: z.literal('share'),
    ask: z.enum(SCENE_ASKS),
    thing: z.enum(THING_IDS),
    /** The thing's name as the item says it, e.g. "granola bar". */
    one: z.string().trim().min(1),
    many: z.string().trim().min(1),
    container: z.enum(CONTAINER_KINDS),
    receivers: z.enum(RECEIVER_KINDS),
    total: z.number().int().min(1).max(SCENE_LIMITS.total),
    groups: z.number().int().min(2).max(SCENE_LIMITS.groups),
    each: z.number().int().min(1).max(SCENE_LIMITS.each).optional(),
    split: z.array(z.number().int().min(0).max(SCENE_LIMITS.each)).optional(),
    otherGroups: z.number().int().min(2).max(SCENE_LIMITS.groups).optional(),
    want: z.enum(['more', 'less']).optional(),
    /** Named in the story. The app fills in anyone the story leaves unnamed. */
    sharer: PersonSchema.optional(),
    /** Receivers the story names, in order. */
    named: z.array(PersonSchema).max(SCENE_LIMITS.groups).optional(),
    /** compare: who shares with `otherGroups`. */
    otherSharer: PersonSchema.optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if ((s.ask === 'groups' || s.ask === 'total') && s.each === undefined) {
      issue('each', `ask ${s.ask} needs each`);
    } else if ((s.ask === 'groups' || s.ask === 'total') && s.groups * s.each! !== s.total) {
      issue('total', `${s.groups} groups of ${s.each} is not ${s.total}`);
    }
    if (s.ask === 'fair') {
      if (!s.split || s.split.length !== s.groups)
        issue('split', 'split needs one count per group');
      else if (s.split.reduce((a, b) => a + b, 0) !== s.total)
        issue('split', 'split must add up to total');
    }
    if (s.named && s.named.length > s.groups) issue('named', 'more names than groups');
    if (s.ask === 'compare') {
      if (s.otherGroups === undefined || s.want === undefined) {
        issue('otherGroups', 'compare needs otherGroups and want');
      } else if (s.otherGroups === s.groups) {
        issue('otherGroups', 'otherGroups must differ from groups');
      }
    }
  });
export type Scene = z.infer<typeof SceneSchema>;

/** A number answer, or yes/no for `fair`. `compare` answers with a number of groups. */
export type SceneAnswer = number | boolean;

export function sceneAnswer(s: Scene): SceneAnswer {
  switch (s.ask) {
    case 'each':
      return s.total / s.groups;
    case 'left':
      return s.total % s.groups;
    case 'groups':
      return s.groups;
    case 'total':
      return s.total;
    case 'fair':
      return s.split!.every((n) => n === s.split![0]);
    case 'compare': {
      // Fewer groups means a bigger share each.
      const fewer = Math.min(s.groups, s.otherGroups!);
      return s.want === 'more' ? fewer : Math.max(s.groups, s.otherGroups!);
    }
  }
}

const MIXED = /^(?:(\d+)(?:\s+(\d+)\/(\d+))?|(\d+)\/(\d+))$/;

/** Reads "2", "2 1/2", or "3/4". Null for anything else. */
export function parseMixed(text: string): number | null {
  const m = MIXED.exec(text.trim());
  if (!m) return null;
  const whole = Number(m[1] ?? 0);
  const num = Number(m[2] ?? m[4] ?? 0);
  const den = Number(m[3] ?? m[5] ?? 1);
  return den === 0 ? null : whole + num / den;
}

/**
 * What a choice text is worth to a scene: "yes"/"no", an amount like "1 1/2" or "0.50", a
 * percent like "25%" as 0.25, or a group like "2 friends". Null when it is none of these.
 */
export function choiceTextValue(text: string): SceneAnswer | null {
  const t = text.trim().toLowerCase();
  if (t === 'yes') return true;
  if (t === 'no') return false;
  const amount = parseMixed(t);
  if (amount !== null) return amount;
  if (/^\d*\.\d+$/.test(t)) return Number(t);
  const percent = /^(\d+(?:\.\d+)?)\s?%$/.exec(t);
  if (percent) return Number(percent[1]) / 100;
  const group = /^(\d+) [a-z]+$/.exec(t);
  return group ? Number(group[1]) : null;
}

/** The item's answer as a scene answer. */
export function itemAnswer(item: Item): SceneAnswer | null {
  switch (item.type) {
    case 'keypad':
      return item.answer;
    case 'number-line':
      return item.target;
    case 'tap': {
      const choice = item.choices.find((c) => c.id === item.answerChoiceId)!;
      if (choice.kind === 'number') return choice.value;
      if (choice.kind === 'text') return choiceTextValue(choice.text);
      return null;
    }
  }
}

const same = (a: SceneAnswer, b: SceneAnswer) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;

/** Most pieces a thing gets cut into. Thinner pieces are too small to see on a phone. */
export const MAX_CUT = 8;

/** Why the scene can't play this item. Empty when it can. */
export function sceneProblems(item: Item, scene: Scene): string[] {
  const problems: string[] = [];
  const expected = sceneAnswer(scene);
  const actual = itemAnswer(item);
  if (actual === null) problems.push('the item answer is not a number or yes/no');
  else if (!same(expected, actual)) {
    problems.push(`the scene answers ${String(expected)} but the item answers ${String(actual)}`);
  }

  const values: SceneAnswer[] = [];
  if (item.type === 'tap') {
    for (const c of item.choices) {
      const v = c.kind === 'number' ? c.value : c.kind === 'text' ? choiceTextValue(c.text) : null;
      if (v === null) problems.push(`choice ${c.id} is not something the scene can show`);
      else values.push(v);
    }
  } else {
    if (scene.ask === 'fair' || scene.ask === 'compare') {
      problems.push(`ask ${scene.ask} needs choices`);
    }
    if (typeof actual === 'number' && !Number.isInteger(actual)) {
      problems.push('a typed answer must be a whole number');
    }
    if (actual !== null) values.push(actual);
  }

  const numbers = values.filter((v): v is number => typeof v === 'number');
  if (scene.ask === 'fair' && numbers.length > 0) problems.push('ask fair takes yes or no');
  if (scene.ask !== 'fair' && numbers.length !== values.length) {
    problems.push(`ask ${scene.ask} takes numbers`);
  }
  if (scene.ask === 'compare') {
    for (const n of numbers) {
      if (n !== scene.groups && n !== scene.otherGroups) {
        problems.push(`choice ${n} is neither ${scene.groups} nor ${scene.otherGroups} groups`);
      }
    }
  }
  if (scene.ask === 'each') {
    for (const n of numbers) {
      if (n > SCENE_LIMITS.each) problems.push(`${n} each is more than fits on a plate`);
      if (!Number.isInteger(n)) {
        if (!THINGS[scene.thing].cuttable) problems.push(`${n} needs cutting a ${scene.thing}`);
        if (toAmount(n) === null) problems.push(`${n} needs pieces smaller than 1/${MAX_CUT}`);
      }
    }
  } else if (numbers.some((n) => !Number.isInteger(n))) {
    problems.push(`ask ${scene.ask} takes whole numbers`);
  }
  return problems;
}

/**
 * An amount per receiver: `whole` things plus `parts` pieces of 1/`den`. "2 1/2" is 2 wholes and
 * 1 piece of 1/2. Whole amounts have den 1.
 */
export type Amount = { label: string; value: number; whole: number; parts: number; den: number };

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** A number as an amount with the smallest denominator up to MAX_CUT, or null. */
export function toAmount(value: number): Amount | null {
  for (let den = 1; den <= MAX_CUT; den++) {
    const pieces = value * den;
    if (Math.abs(pieces - Math.round(pieces)) > 1e-9) continue;
    const n = Math.round(pieces);
    const whole = Math.floor(n / den);
    const parts = n % den;
    const label = parts === 0 ? String(whole) : `${whole ? `${whole} ` : ''}${parts}/${den}`;
    return { label, value, whole, parts, den };
  }
  return null;
}

/** Reads "2", "2 1/2", or "3/4". Throws for anything else, or a cut a non-food thing can't take. */
export function parseAmount(label: string, cuttable = true): Amount {
  const value = parseMixed(label);
  const amount = value === null ? null : toAmount(value);
  if (!amount) throw new Error(`Bad amount "${label}"`);
  if (amount.parts > 0 && !cuttable)
    throw new Error(`"${label}" needs cutting, but this can't be cut`);
  return { ...amount, label: label.trim() };
}

/** A number as a reduced mixed-number label, e.g. 2.5 as "2 1/2". */
export function formatAmount(value: number): string {
  const amount = toAmount(value);
  if (!amount) return String(value);
  if (amount.parts === 0) return amount.label;
  const g = gcd(amount.parts, amount.den);
  const fraction = `${amount.parts / g}/${amount.den / g}`;
  return amount.whole ? `${amount.whole} ${fraction}` : fraction;
}
