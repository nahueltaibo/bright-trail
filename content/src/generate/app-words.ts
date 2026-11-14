import {
  FRACTION_FOODS,
  type Choice,
  type FractionFood,
  type Item,
  type StoryNugget,
  type Visual,
} from '@bright-trail/shared';

/**
 * Turns reviewed content into what the app shows. The generator and its cached prompts say
 * "shaded" and draw plain shapes. The app pulls those parts out of a food the story names.
 * This runs after review, so cached generator and reviewer calls keep their keys.
 */
export const pickedWords = (text: string) =>
  text.replace(/\bshaded\b/g, 'picked').replace(/\bShaded\b/g, 'Picked');

const FOOD_WORDS: [RegExp, FractionFood][] = [
  [/\bpizzas?\b/i, 'pizza'],
  [/\bpies?\b/i, 'pie'],
  [/\bcookies?\b/i, 'cookie'],
  [/\bbrownies?\b|\bpans?\b/i, 'brownies'],
  [/\bchocolate\b/i, 'chocolate'],
  [/\bgranola\b/i, 'granola'],
];

/**
 * The food the first text with one names first, cut like `shape`. Undefined keeps the shape
 * plain, e.g. for "a circle cut into 8 parts".
 */
export function foodFor(shape: string, ...texts: string[]): FractionFood | undefined {
  for (const text of texts) {
    let best: { at: number; food: FractionFood } | undefined;
    for (const [word, food] of FOOD_WORDS) {
      const at = text.search(word);
      if (at >= 0 && FRACTION_FOODS[food] === shape && (!best || at < best.at)) best = { at, food };
    }
    if (best) return best.food;
  }
  return undefined;
}

function withFood<V extends Visual | undefined>(visual: V, ...texts: string[]): V {
  if (visual?.kind !== 'fraction') return visual;
  const food = foodFor(visual.shape, ...texts);
  return (food ? { ...visual, food } : visual) as V;
}

const DOTS = 'dots';
const THING_WORDS: [RegExp, string][] = [
  [/\bdots?\b/i, DOTS],
  [/\bstars?\b/i, '⭐'],
  [/\bapples?\b/i, '🍎'],
  [/\bpears?\b/i, '🍐'],
  [/\bcookies?\b/i, '🍪'],
  [/\bballoons?\b/i, '🎈'],
  [/\bducks?\b/i, '🦆'],
  [/\bladybugs?\b/i, '🐞'],
  [/\bcards?\b/i, '🃏'],
  [/\bboards?\b/i, '🪵'],
];

/**
 * The emoji the first text naming a thing names first, or the story's `fallback` when none does.
 * Undefined when the words say dots, so the ten-frame keeps them.
 */
export function thingFor(texts: string[], fallback?: string): string | undefined {
  for (const text of texts) {
    let best: { at: number; thing: string } | undefined;
    for (const [word, thing] of THING_WORDS) {
      const at = text.search(word);
      if (at >= 0 && (!best || at < best.at)) best = { at, thing };
    }
    if (best) return best.thing === DOTS ? undefined : best.thing;
  }
  return fallback;
}

/** Fills a ten-frame with the thing its words count instead of dots. */
function withThing<V extends Visual | undefined>(visual: V, texts: string[], fallback?: string): V {
  if (visual?.kind !== 'ten-frame' || visual.emoji) return visual;
  const emoji = thingFor(texts, fallback);
  return (emoji ? { ...visual, emoji } : visual) as V;
}

/** The emoji a story's object pictures show, when they all show the same one. */
function storyThing(nugget: StoryNugget): string | undefined {
  const emojis = new Set(
    nugget.cards.flatMap((c) => (c.visual?.kind === 'objects' ? [c.visual.emoji] : [])),
  );
  return emojis.size === 1 ? [...emojis][0] : undefined;
}

function choiceForApp(c: Choice, story: string): Choice {
  if (c.kind === 'number') return c;
  if (c.kind === 'text') return { ...c, text: pickedWords(c.text) };
  return {
    ...c,
    visual: withThing(withFood(c.visual, c.narration, story), [c.narration, story]),
    narration: pickedWords(c.narration),
  };
}

export function itemForApp(item: Item): Item {
  const words = {
    narration: pickedWords(item.narration),
    prompt: pickedWords(item.prompt),
    why: pickedWords(item.why),
  };
  if (item.type === 'number-line') return { ...item, ...words };
  const visual = withThing(withFood(item.visual, item.narration, item.prompt), [
    item.narration,
    item.prompt,
  ]);
  if (item.type === 'keypad') return { ...item, ...words, ...(visual && { visual }) };
  return {
    ...item,
    ...words,
    ...(visual && { visual }),
    choices: item.choices.map((c) => choiceForApp(c, item.narration)),
  };
}

export function nuggetForApp(nugget: StoryNugget): StoryNugget {
  const thing = storyThing(nugget);
  return {
    ...nugget,
    cards: nugget.cards.map((card) => ({
      ...card,
      narration: pickedWords(card.narration),
      ...(card.text && { text: pickedWords(card.text) }),
      ...(card.visual && {
        visual: withThing(
          withFood(card.visual, card.narration, card.text ?? ''),
          [card.narration, card.text ?? ''],
          thing,
        ),
      }),
    })),
  };
}
