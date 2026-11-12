import { describe, expect, it } from 'vitest';
import { itemSays, repeats, sameText, textChoices } from './cards';
import { ItemSchema, type Item } from './item';
import { LabelSceneSchema, labelProblems, type LabelScene } from './label';
import { OrderSceneSchema, orderProblems, type OrderScene } from './order';
import { SortSceneSchema, sortProblems, type SortScene } from './sort';

const tap = (prompt: string, answer: string, ...others: string[]): Item =>
  ItemSchema.parse({
    id: 'i',
    skillId: 's',
    difficulty: 1,
    prompt,
    narration: prompt,
    why: 'w',
    type: 'tap',
    choices: [answer, ...others].map((text, i) => ({ id: 'abcd'[i], kind: 'text', text })),
    answerChoiceId: 'a',
  });

describe('card helpers', () => {
  it('matches text without case or extra spaces', () => {
    expect(sameText(' Not  living', 'not living')).toBe(true);
    expect(sameText('solid', 'solids')).toBe(false);
    expect(repeats(['Egg', 'egg', 'Frog'])).toEqual(['egg']);
  });

  it('finds whole words in the prompt or narration', () => {
    const item = tap('Where does the ice cube go?', 'Solid', 'Liquid');
    expect(itemSays(item, 'Ice cube')).toBe(true);
    expect(itemSays(item, 'ice')).toBe(true);
    expect(itemSays(item, 'cub')).toBe(false);
  });

  it('reads text choices only from tap items with no pictures as choices', () => {
    expect(textChoices(tap('p', 'a', 'b'))).toEqual({ texts: ['a', 'b'], answer: 'a' });
    const keypad = { ...tap('p', 'a', 'b'), type: 'keypad', answer: 1 } as unknown as Item;
    expect(textChoices(keypad)).toBeNull();
  });
});

const sort: SortScene = {
  kind: 'sort',
  bins: [{ text: 'Solid', emoji: '🧊' }, { text: 'Liquid' }],
  sorted: [{ card: { text: 'Rock' }, bin: 0 }],
  card: { text: 'Milk', emoji: '🥛' },
  bin: 1,
};

describe('SortSceneSchema', () => {
  it('parses a scene and rejects bad bins and repeats', () => {
    expect(SortSceneSchema.parse(sort)).toEqual(sort);
    expect(SortSceneSchema.safeParse({ ...sort, bin: 2 }).success).toBe(false);
    expect(SortSceneSchema.safeParse({ ...sort, bins: [sort.bins[0]] }).success).toBe(false);
    const repeat = { ...sort, sorted: [{ card: { text: 'milk' }, bin: 1 }] };
    expect(SortSceneSchema.safeParse(repeat).success).toBe(false);
    const lost = { ...sort, sorted: [{ card: { text: 'Rock' }, bin: 5 }] };
    expect(SortSceneSchema.safeParse(lost).success).toBe(false);
  });
});

describe('sortProblems', () => {
  it('fits an item whose choices are the bins and whose answer is the card bin', () => {
    expect(sortProblems(tap('Where does milk go?', 'liquid', 'solid'), sort)).toEqual([]);
  });

  it('flags a wrong bin, a choice with no bin, and a card the item never names', () => {
    expect(sortProblems(tap('Where does milk go?', 'Solid', 'Liquid'), sort)).toEqual([
      'the card goes in Liquid but the item answers Solid',
    ]);
    expect(sortProblems(tap('Where does milk go?', 'Liquid', 'Gas'), sort)).toEqual([
      'no bin for the choice Gas',
      'no choice for the bin Solid',
    ]);
    expect(sortProblems(tap('Where does it go?', 'Liquid', 'Solid'), sort)).toEqual([
      'the item never says Milk',
    ]);
  });
});

const order: OrderScene = {
  kind: 'order',
  cards: [{ text: 'Egg' }, { text: 'Tadpole' }, { text: 'Froglet' }, { text: 'Frog' }],
  missing: 2,
};

describe('OrderSceneSchema', () => {
  it('parses a scene and rejects a missing slot past the row or repeated cards', () => {
    expect(OrderSceneSchema.parse(order)).toEqual(order);
    expect(OrderSceneSchema.safeParse({ ...order, missing: 4 }).success).toBe(false);
    const twice = { ...order, cards: [...order.cards.slice(0, 3), { text: 'egg' }] };
    expect(OrderSceneSchema.safeParse(twice).success).toBe(false);
    expect(OrderSceneSchema.safeParse({ ...order, cards: order.cards.slice(0, 2) }).success).toBe(
      false,
    );
  });
});

describe('orderProblems', () => {
  it('fits an item that answers the missing card', () => {
    expect(orderProblems(tap('What comes next?', 'Froglet', 'Chick'), order)).toEqual([]);
  });

  it('flags a wrong answer and a choice already in the row', () => {
    expect(orderProblems(tap('What comes next?', 'Chick', 'Froglet'), order)).toEqual([
      'the missing card is Froglet but the item answers Chick',
    ]);
    expect(orderProblems(tap('What comes next?', 'Froglet', 'Egg'), order)).toEqual([
      'the choice Egg is already in the row',
    ]);
  });
});

const label: LabelScene = {
  kind: 'label',
  picture: 'plant',
  tags: [
    { part: 'flower', text: 'flower' },
    { part: 'stem', text: 'stem' },
    { part: 'roots', text: 'roots' },
  ],
  asked: 1,
};

describe('LabelSceneSchema', () => {
  it('parses a scene and rejects parts the picture lacks and repeated tags', () => {
    expect(LabelSceneSchema.parse(label)).toEqual(label);
    const wings = { ...label, tags: [...label.tags, { part: 'wings', text: 'wings' }] };
    expect(LabelSceneSchema.safeParse(wings).success).toBe(false);
    const twice = { ...label, tags: [...label.tags, { part: 'stem', text: 'stalk' }] };
    expect(LabelSceneSchema.safeParse(twice).success).toBe(false);
    expect(LabelSceneSchema.safeParse({ ...label, picture: 'robot' }).success).toBe(false);
    expect(LabelSceneSchema.safeParse({ ...label, asked: 3 }).success).toBe(false);
  });
});

describe('labelProblems', () => {
  it('fits an item that answers the asked tag', () => {
    expect(labelProblems(tap('What is this part?', 'stem', 'leaf', 'seed'), label)).toEqual([]);
  });

  it('flags a wrong answer and a choice already on the picture', () => {
    expect(labelProblems(tap('What is this part?', 'leaf', 'stem'), label)).toEqual([
      'the asked tag is stem but the item answers leaf',
    ]);
    expect(labelProblems(tap('What is this part?', 'stem', 'roots'), label)).toEqual([
      'the choice roots already labels the picture',
    ]);
  });
});
