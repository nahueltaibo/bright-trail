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

function choiceForApp(c: Choice, story: string): Choice {
  if (c.kind === 'number') return c;
  if (c.kind === 'text') return { ...c, text: pickedWords(c.text) };
  return {
    ...c,
    visual: withFood(c.visual, c.narration, story),
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
  const visual = withFood(item.visual, item.narration, item.prompt);
  if (item.type === 'keypad') return { ...item, ...words, ...(visual && { visual }) };
  return {
    ...item,
    ...words,
    ...(visual && { visual }),
    choices: item.choices.map((c) => choiceForApp(c, item.narration)),
  };
}

export function nuggetForApp(nugget: StoryNugget): StoryNugget {
  return {
    ...nugget,
    cards: nugget.cards.map((card) => ({
      ...card,
      narration: pickedWords(card.narration),
      ...(card.text && { text: pickedWords(card.text) }),
      ...(card.visual && { visual: withFood(card.visual, card.narration, card.text ?? '') }),
    })),
  };
}
