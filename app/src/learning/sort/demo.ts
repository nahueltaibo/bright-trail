import type { Item, SortScene } from '@bright-trail/shared';

const base = { skillId: 'demo-sort', difficulty: 1 } as const;
const tap = (answer: string, ...others: string[]) => ({
  type: 'tap' as const,
  choices: [answer, ...others].map((text, i) => ({ id: 'abcd'[i], kind: 'text' as const, text })),
  answerChoiceId: 'a',
});

/** One item per number of bins and subject, for /dev/games/sort. Each must pass `sortProblems`. */
export const SORT_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-sort-living',
    prompt: 'Is a tree living?',
    narration: 'A tree. Is it living, or not living?',
    why: 'A tree grows, drinks water, and needs sunlight. It is living.',
    ...tap('Living', 'Not living'),
    game: {
      kind: 'sort',
      bins: [
        { text: 'Living', emoji: '🌱' },
        { text: 'Not living', emoji: '🪨' },
      ],
      sorted: [
        { card: { text: 'Dog', emoji: '🐕' }, bin: 0 },
        { card: { text: 'Rock', emoji: '🪨' }, bin: 1 },
        { card: { text: 'Chair', emoji: '🪑' }, bin: 1 },
      ],
      card: { text: 'Tree', emoji: '🌳' },
      bin: 0,
    } satisfies SortScene,
  },
  {
    ...base,
    id: 'demo-sort-matter',
    prompt: 'Where does the juice go?',
    narration: 'Juice. Is it a solid, a liquid, or a gas?',
    why: 'Juice pours and takes the shape of its cup. It is a liquid.',
    ...tap('Liquid', 'Solid', 'Gas'),
    game: {
      kind: 'sort',
      bins: [{ text: 'Solid' }, { text: 'Liquid' }, { text: 'Gas' }],
      sorted: [
        { card: { text: 'Ice cube', emoji: '🧊' }, bin: 0 },
        { card: { text: 'Milk', emoji: '🥛' }, bin: 1 },
        { card: { text: 'Steam', emoji: '♨️' }, bin: 2 },
        { card: { text: 'Block', emoji: '🧱' }, bin: 0 },
      ],
      card: { text: 'Juice', emoji: '🧃' },
      bin: 1,
    } satisfies SortScene,
  },
  {
    ...base,
    id: 'demo-sort-wants',
    prompt: 'Is a toy car a need or a want?',
    narration: 'A toy car. Is it a need, or a want?',
    why: 'A toy car is fun, but we can live without it. It is a want.',
    ...tap('Want', 'Need'),
    game: {
      kind: 'sort',
      bins: [{ text: 'Need' }, { text: 'Want' }],
      sorted: [
        { card: { text: 'Water', emoji: '💧' }, bin: 0 },
        { card: { text: 'Home', emoji: '🏠' }, bin: 0 },
        { card: { text: 'Video game', emoji: '🎮' }, bin: 1 },
      ],
      card: { text: 'Toy car', emoji: '🚗' },
      bin: 1,
    } satisfies SortScene,
  },
  {
    ...base,
    id: 'demo-sort-food',
    prompt: 'Where does the apple go?',
    narration: 'An apple. Is it an everyday food, or a sometimes food?',
    why: 'Fruits like apples help your body grow. They are everyday foods.',
    ...tap('Everyday', 'Sometimes'),
    game: {
      kind: 'sort',
      bins: [{ text: 'Everyday' }, { text: 'Sometimes' }],
      sorted: [
        { card: { text: 'Carrot', emoji: '🥕' }, bin: 0 },
        { card: { text: 'Cake', emoji: '🍰' }, bin: 1 },
        { card: { text: 'Candy', emoji: '🍬' }, bin: 1 },
        { card: { text: 'Fish', emoji: '🐟' }, bin: 0 },
      ],
      card: { text: 'Apple', emoji: '🍎' },
      bin: 0,
    } satisfies SortScene,
  },
];
