import type { Item, OrderScene } from '@bright-trail/shared';

const base = { skillId: 'demo-order', difficulty: 1 } as const;
const tap = (answer: string, ...others: string[]) => ({
  type: 'tap' as const,
  choices: [answer, ...others].map((text, i) => ({ id: 'abcd'[i], kind: 'text' as const, text })),
  answerChoiceId: 'a',
});

/** One item per kind of row, for /dev/games/order. Each must pass `orderProblems`. */
export const ORDER_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-order-frog',
    prompt: 'What comes after the tadpole?',
    narration: 'Egg, then tadpole, then what? Froglet, chick, or caterpillar?',
    why: 'A tadpole grows legs and becomes a froglet. Then it grows into a frog.',
    ...tap('Froglet', 'Chick', 'Caterpillar'),
    game: {
      kind: 'order',
      cards: [
        { text: 'Egg', emoji: '🥚' },
        { text: 'Tadpole' },
        { text: 'Froglet' },
        { text: 'Frog', emoji: '🐸' },
      ],
      missing: 2,
    } satisfies OrderScene,
  },
  {
    ...base,
    id: 'demo-order-seasons',
    prompt: 'Which season comes after summer?',
    narration: 'Winter, spring, summer, and then? Fall, or night?',
    why: 'The seasons go winter, spring, summer, fall, and then winter again.',
    ...tap('Fall', 'Night'),
    game: {
      kind: 'order',
      cards: [
        { text: 'Winter', emoji: '⛄' },
        { text: 'Spring', emoji: '🌷' },
        { text: 'Summer', emoji: '☀️' },
        { text: 'Fall', emoji: '🍂' },
      ],
      missing: 3,
      cycle: true,
    } satisfies OrderScene,
  },
  {
    ...base,
    id: 'demo-order-first',
    prompt: 'What do you do first?',
    narration: 'Washing your hands. What do you do first? Wet your hands, or dry your hands?',
    why: 'First wet your hands. Then soap, scrub, rinse, and dry.',
    ...tap('Wet hands', 'Dry hands'),
    game: {
      kind: 'order',
      cards: [
        { text: 'Wet hands', emoji: '🚰' },
        { text: 'Soap', emoji: '🧼' },
        { text: 'Scrub', emoji: '👐' },
        { text: 'Rinse', emoji: '💧' },
        { text: 'Towel', emoji: '🧻' },
      ],
      missing: 0,
    } satisfies OrderScene,
  },
];
