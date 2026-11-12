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
  {
    ...base,
    id: 'demo-label-organs',
    prompt: 'Which organ is this?',
    narration: 'Which organ is this? Is it the heart, the stomach, or the brain?',
    why: 'The heart pumps blood all around your body.',
    ...tap('heart', 'stomach', 'brain'),
    game: {
      kind: 'label',
      picture: 'organs',
      tags: [
        { part: 'lungs', text: 'lungs' },
        { part: 'heart', text: 'heart' },
        { part: 'intestines', text: 'intestines' },
      ],
      asked: 1,
    } satisfies LabelScene,
  },
  {
    ...base,
    id: 'demo-label-machines',
    prompt: 'Which simple machine is this?',
    narration: 'Which simple machine is this? Is it a pulley, a lever, or a wedge?',
    why: 'A pulley is a wheel with a rope around it. Pulling down on the rope lifts the load.',
    ...tap('pulley', 'lever', 'wedge'),
    game: {
      kind: 'label',
      picture: 'machines',
      tags: [
        { part: 'pulley', text: 'pulley' },
        { part: 'inclined plane', text: 'inclined plane' },
        { part: 'wheel and axle', text: 'wheel and axle' },
        { part: 'screw', text: 'screw' },
      ],
      asked: 0,
    } satisfies LabelScene,
  },
  {
    ...base,
    id: 'demo-label-planets',
    prompt: 'Which planet is this?',
    narration: 'Count the planets out from the Sun. Is this one Earth, Mars, or Venus?',
    why: 'Earth is the third planet from the Sun.',
    ...tap('Earth', 'Mars', 'Venus'),
    game: {
      kind: 'label',
      picture: 'planets',
      tags: [
        { part: 'sun', text: 'Sun' },
        { part: 'mercury', text: 'Mercury' },
        { part: 'earth', text: 'Earth' },
        { part: 'jupiter', text: 'Jupiter' },
        { part: 'saturn', text: 'Saturn' },
      ],
      asked: 2,
    } satisfies LabelScene,
  },
  {
    ...base,
    id: 'demo-label-map',
    prompt: 'What is this part of the map?',
    narration: 'What is this part of the map? Is it the compass rose, the legend, or the scale?',
    why: 'The compass rose shows which way is north, south, east, and west.',
    ...tap('compass rose', 'legend', 'scale'),
    game: {
      kind: 'label',
      picture: 'map',
      tags: [
        { part: 'title', text: 'title' },
        { part: 'compass rose', text: 'compass rose' },
        { part: 'lake', text: 'lake' },
        { part: 'river', text: 'river' },
      ],
      asked: 1,
    } satisfies LabelScene,
  },
];
