import type { Item, SliceScene } from '@bright-trail/shared';

const scene = (s: Omit<SliceScene, 'kind'>): SliceScene => ({ kind: 'slices', ...s });
const base = { skillId: 'demo-slices', difficulty: 2 } as const;
const tap = (answer: string, ...others: string[]) => ({
  type: 'tap' as const,
  choices: [answer, ...others].map((text, i) => ({ id: 'abcd'[i], kind: 'text' as const, text })),
  answerChoiceId: 'a',
});

/** One item per kind of slice question, for /dev/games/slices. Each must pass `sliceProblems`. */
export const SLICE_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-slices-picked',
    prompt: 'What part did Mia pick?',
    narration:
      'A pizza is cut into 4 equal slices. Mia picks 3 of them. What part of the pizza did she pick? 1/4, 3/4, or 4/3?',
    why: 'Each slice is 1/4. Mia picked 3 slices, so she has 3/4.',
    ...tap('3/4', '1/4', '4/3'),
    game: scene({
      ask: 'picked',
      shape: 'circle',
      food: 'pizza',
      parts: 4,
      picked: 3,
      who: { name: 'Mia', look: 'girl' },
    }),
  },
  {
    ...base,
    id: 'demo-slices-left',
    prompt: 'How many pieces are left?',
    narration:
      'A pan of brownies has 8 equal pieces. The team eats 3 pieces. How many pieces are left?',
    why: '3 pieces are gone. Count what stays in the pan: 5 pieces.',
    type: 'keypad',
    answer: 5,
    game: scene({ ask: 'left', shape: 'rectangle', food: 'brownies', parts: 8, take: 3 }),
  },
  {
    ...base,
    id: 'demo-slices-parts',
    prompt: 'How many slices?',
    narration: 'Leo cuts a pizza into sixths. How many equal slices does it have? 3, 6, or 8?',
    why: 'Sixths means 6 equal slices.',
    ...tap('6', '3', '8'),
    game: scene({ ask: 'parts', shape: 'circle', food: 'pizza', parts: 6 }),
  },
  {
    ...base,
    id: 'demo-slices-each',
    prompt: 'What part does each friend get?',
    narration:
      '4 friends share one pie fairly. What part of the pie does each friend get? 1/2, 1/4, or 4/4?',
    why: 'The pie is cut into 4 equal slices, one for each friend. That is 1/4 each.',
    ...tap('1/4', '1/2', '4/4'),
    game: scene({ ask: 'each', shape: 'circle', food: 'pie', parts: 4 }),
  },
  {
    ...base,
    id: 'demo-slices-same',
    prompt: 'How many fourths?',
    narration:
      'Ana picks 1/2 of a pizza. If the pizza was cut into fourths, how many fourths would she have?',
    why: 'Cut the half in two and you get 2 fourths.',
    type: 'keypad',
    answer: 2,
    game: scene({
      ask: 'same',
      shape: 'circle',
      food: 'pizza',
      parts: 2,
      picked: 1,
      cutInto: 4,
      who: { name: 'Ana', look: 'girl' },
    }),
  },
  {
    ...base,
    id: 'demo-slices-bigger',
    prompt: 'Which slice is bigger?',
    narration:
      'Two pizzas are the same size. Which slice is bigger: 1/2 of a pizza or 1/4 of a pizza? Or are they the same?',
    why: 'Fewer slices means bigger slices.',
    ...tap('1/2', '1/4', 'Same'),
    game: scene({ ask: 'bigger', shape: 'circle', food: 'pizza', parts: 2, other: 4 }),
  },
  {
    ...base,
    id: 'demo-slices-wholes',
    prompt: 'What fraction is that?',
    narration:
      'Two pizzas are each cut into 4 slices. Leo picks 7 slices. What fraction of a pizza is that? 7/4, 7/8, or 4/7?',
    why: 'Each slice is 1/4 of a pizza. 7 slices are 7/4.',
    ...tap('7/4', '7/8', '4/7'),
    game: scene({
      ask: 'picked',
      shape: 'circle',
      food: 'pizza',
      parts: 4,
      wholes: 2,
      picked: 7,
      who: { name: 'Leo', look: 'boy' },
    }),
  },
  {
    ...base,
    id: 'demo-slices-take',
    prompt: 'How much is left?',
    narration:
      'A pizza has 6 slices. One is already gone, so 5/6 is left. Ben eats 2/6. How much is left now? 2/6, 3/6, or 7/6?',
    why: "5 slices minus Ben's 2 slices leaves 3 slices, so 3/6.",
    ...tap('3/6', '2/6', '7/6'),
    game: scene({
      ask: 'left',
      shape: 'circle',
      food: 'pizza',
      parts: 6,
      eaten: 1,
      take: 2,
      who: { name: 'Ben', look: 'boy' },
    }),
  },
  {
    ...base,
    id: 'demo-slices-add',
    prompt: 'How much does Kai have?',
    narration:
      'Kai picks 2/8 of a chocolate bar. Then he picks 3/8 more. How much does he have? 5/8, 5/16, or 6/8?',
    why: 'The pieces stay eighths. 2 eighths and 3 eighths make 5 eighths.',
    ...tap('5/8', '5/16', '6/8'),
    game: scene({
      ask: 'add',
      shape: 'rectangle',
      food: 'chocolate',
      parts: 8,
      picked: 2,
      more: 3,
      who: { name: 'Kai', look: 'boy' },
    }),
  },
];
