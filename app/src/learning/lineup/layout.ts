import { ORDINALS, type Item, type LineThing, type LineupScene } from '@bright-trail/shared';

/** Room at the front of the line for the flag. */
export const FRONT_W = 30;
/** Most an animal grows, on a wide stage. */
const MAX_ART = 88;

export const SHORT = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/** "first" for place 1. */
export const ordinal = (place: number) => ORDINALS[place - 1] ?? `number ${place}`;

/**
 * Each place's column on a stage `width` wide, front at the left. A column is the whole tap
 * area for the one standing in it, so taps land even when the art is small.
 */
export function slotsOf(scene: LineupScene, width: number, height = Infinity) {
  const n = scene.line.length;
  const slot = Math.max(0, (width - FRONT_W - 4) / n);
  const art = Math.min(MAX_ART, slot * 0.86, height * 0.4);
  return { slot, art, x: (i: number) => FRONT_W + i * slot };
}

const WORD: Record<LineThing, string> = {
  frog: 'frog',
  duck: 'duck',
  cat: 'cat',
  dog: 'dog',
  bunny: 'bunny',
  bear: 'bear',
  kid: 'child',
};

export const thingWord = (thing: LineThing) => WORD[thing];

/** The one asked about, as the narrator names it: "Ana", "the cat", "the third frog". */
export function whoOf(scene: LineupScene): string {
  if (scene.name) return scene.name;
  const thing = scene.line[scene.place - 1];
  const word = WORD[thing];
  if (scene.line.filter((t) => t === thing).length === 1) return `the ${word}`;
  if (scene.place === scene.line.length) return `the last ${word}`;
  return `the ${ordinal(scene.place)} ${word}`;
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The question for a `find` line-up: the item's words without the hop, then where to tap. */
export function findQuestion(item: Item, scene: LineupScene): string {
  const kept = (item.narration.match(/[^.?!]+[.?!]*/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s && !/\b(hop|move|drag|type)\b/i.test(s));
  return [...kept, `Tap ${whoOf(scene)}.`].join(' ');
}

/** What the play-out showed, for the feedback card: the count up to the asked place. */
export function lineupWords(scene: LineupScene): string {
  // Long counts skip the middle, so the feedback card stays short.
  const count =
    scene.place <= 3
      ? ORDINALS.slice(0, scene.place).join(', ')
      : `first, second, … ${ordinal(scene.place)}`;
  return `${capital(count)}. ${capital(whoOf(scene))} is in place ${scene.place}.`;
}
