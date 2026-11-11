import type { Skill } from '@bright-trail/shared';
import type { SkillContext } from './prompts';
import type { GenCheck, GenChoice, GeneratedContent, GenItem, GenVisual } from './schema';

export const g1Skill: Skill = {
  id: 'g1-add-within-10',
  subject: 'math',
  framework: 'ontario-math-2020',
  grade: '1',
  strand: 'B',
  expectationCodes: ['B2.2'],
  title: 'Adding to 10',
  description: 'Put two small groups together and find how many there are.',
  prerequisiteIds: [],
};

export const g1Context: SkillContext = {
  skill: g1Skill,
  expectations: [
    { code: 'B2.2', kind: 'specific', topic: 'Math Facts', statement: 'add to 10', details: '' },
  ],
  prerequisites: [],
};

export const objects = (emoji: string, count: number): GenVisual => ({
  kind: 'objects',
  emoji,
  count,
  filled: null,
});
export const emoji = (e: string): GenVisual => ({
  kind: 'emoji',
  emoji: e,
  count: null,
  filled: null,
});

export const equals = (expr: string, choices: GenCheck['choices'] = []): GenCheck => ({
  rule: 'equals',
  expr,
  choices,
  note: '',
});

export const num = (id: GenChoice['id'], value: number): GenChoice => ({
  id,
  kind: 'number',
  value,
  text: null,
  visual: null,
  narration: null,
});
export const text = (id: GenChoice['id'], t: string): GenChoice => ({
  id,
  kind: 'text',
  value: null,
  text: t,
  visual: null,
  narration: null,
});

const blank = {
  visual: null,
  choices: [],
  answerChoiceId: '',
  answer: null,
  min: null,
  max: null,
  step: null,
  target: null,
};

export function tap(
  difficulty: number,
  a: number,
  b: number,
  wrong: [number, number],
  extra: Partial<GenItem> = {},
): GenItem {
  const right = a + b;
  return {
    ...blank,
    type: 'tap',
    difficulty,
    narration: `What is ${a} + ${b}? Is it ${wrong[0]}, ${right}, or ${wrong[1]}?`,
    prompt: `${a} + ${b} = ?`,
    why: `Start at ${a} and count on ${b} more. You get ${right}.`,
    choices: [num('a', wrong[0]), num('b', right), num('c', wrong[1])],
    answerChoiceId: 'b',
    check: equals(`${a} + ${b}`),
    ...extra,
  };
}

export function keypad(
  difficulty: number,
  a: number,
  b: number,
  extra: Partial<GenItem> = {},
): GenItem {
  return {
    ...blank,
    type: 'keypad',
    difficulty,
    narration: `Mia has ${a} shells. She finds ${b} more. How many shells now?`,
    prompt: `${a} + ${b} = ?`,
    why: `${a} and ${b} more make ${a + b}.`,
    answer: a + b,
    check: equals(`${a} + ${b}`),
    ...extra,
  };
}

export function line(
  difficulty: number,
  a: number,
  b: number,
  extra: Partial<GenItem> = {},
): GenItem {
  return {
    ...blank,
    type: 'number-line',
    difficulty,
    narration: `Hop the frog to ${a} + ${b}.`,
    prompt: `${a} + ${b}`,
    why: `Start at ${a} and hop ${b} times. You land on ${a + b}.`,
    min: 0,
    max: 10,
    step: 1,
    target: a + b,
    check: equals(`${a} + ${b}`),
    ...extra,
  };
}

/** A Grade 1 skill's content that passes every code check. */
export function goodContent(): GeneratedContent {
  return {
    cards: [
      { narration: 'Leo has 3 apples.', text: null, visual: objects('🍎', 3) },
      { narration: 'His friend gives him 2 more apples.', text: null, visual: objects('🍎', 2) },
      { narration: 'Put them together and count them all.', text: null, visual: objects('🍎', 5) },
      { narration: '3 + 2 = 5.', text: '3 + 2 = 5', visual: emoji('🧮') },
      { narration: 'Now you try adding with Leo!', text: null, visual: emoji('🎉') },
    ],
    items: [
      tap(1, 1, 1, [3, 4]),
      tap(1, 2, 1, [5, 6]),
      keypad(1, 1, 2),
      keypad(1, 2, 2),
      line(1, 1, 3),
      tap(2, 3, 2, [4, 7]),
      tap(2, 4, 2, [5, 8]),
      keypad(2, 3, 3),
      keypad(2, 5, 1),
      line(2, 4, 3),
      tap(3, 6, 3, [7, 10]),
      tap(3, 5, 4, [8, 10]),
      keypad(3, 7, 2),
      line(3, 6, 4),
      line(3, 5, 3),
    ],
  };
}
