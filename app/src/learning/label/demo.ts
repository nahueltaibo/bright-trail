import type { Item, LabelScene } from '@bright-trail/shared';

const base = { skillId: 'demo-label', difficulty: 1 } as const;
const tap = (answer: string, ...others: string[]) => ({
  type: 'tap' as const,
  choices: [answer, ...others].map((text, i) => ({ id: 'abcd'[i], kind: 'text' as const, text })),
  answerChoiceId: 'a',
});

/** One item per picture, for /dev/games/label. Each must pass `labelProblems`. */
export const LABEL_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-label-plant',
    prompt: 'What is this part of the plant?',
    narration: 'Look at the part with the question mark. Is it the stem, the seed, or the leaf?',
    why: 'The stem holds the plant up and carries water from the roots to the leaves.',
    ...tap('stem', 'seed', 'leaf'),
    game: {
      kind: 'label',
      picture: 'plant',
      tags: [
        { part: 'flower', text: 'flower' },
        { part: 'stem', text: 'stem' },
        { part: 'roots', text: 'roots' },
      ],
      asked: 1,
    } satisfies LabelScene,
  },
  {
    ...base,
    id: 'demo-label-insect',
    prompt: 'Which part is this?',
    narration: 'Every insect has three body parts. Is this part the abdomen, or the wings?',
    why: 'The abdomen is the biggest part, at the back of an insect.',
    ...tap('abdomen', 'wings'),
    game: {
      kind: 'label',
      picture: 'insect',
      tags: [
        { part: 'antennae', text: 'antennae' },
        { part: 'head', text: 'head' },
        { part: 'thorax', text: 'thorax' },
        { part: 'legs', text: 'legs' },
        { part: 'abdomen', text: 'abdomen' },
      ],
      asked: 4,
    } satisfies LabelScene,
  },
  {
    ...base,
    id: 'demo-label-body',
    prompt: 'What is this body part?',
    narration: 'What is this body part? Is it a hand, a foot, or a leg?',
    why: 'Your hand is at the end of your arm. You use it to hold things.',
    ...tap('hand', 'foot', 'leg'),
    game: {
      kind: 'label',
      picture: 'body',
      tags: [
        { part: 'head', text: 'head' },
        { part: 'arm', text: 'arm' },
        { part: 'hand', text: 'hand' },
        { part: 'chest', text: 'chest' },
      ],
      asked: 2,
    } satisfies LabelScene,
  },
];
