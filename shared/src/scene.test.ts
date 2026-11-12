import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import {
  choiceTextValue,
  formatAmount,
  parseAmount,
  sceneAnswer,
  sceneProblems,
  SceneSchema,
  type Scene,
} from './scene';

const base = {
  kind: 'share',
  thing: 'cookie',
  one: 'cookie',
  many: 'cookies',
  container: 'plate',
  receivers: 'kids',
} as const;
const scene = (s: Partial<Scene>): Scene => SceneSchema.parse({ ...base, ask: 'each', ...s });

const tap = (answer: string, ...others: string[]): Item => ({
  id: 'i',
  skillId: 's',
  difficulty: 1,
  narration: 'n',
  prompt: 'p',
  why: 'w',
  type: 'tap',
  choices: [answer, ...others].map((text, i) => ({ id: 'abcd'[i], kind: 'text', text })),
  answerChoiceId: 'a',
});
const keypad = (answer: number): Item => ({
  id: 'i',
  skillId: 's',
  difficulty: 1,
  narration: 'n',
  prompt: 'p',
  why: 'w',
  type: 'keypad',
  answer,
});

describe('SceneSchema', () => {
  it('needs each for groups and total, and they must multiply out', () => {
    expect(SceneSchema.safeParse({ ...base, ask: 'groups', total: 12, groups: 3 }).success).toBe(
      false,
    );
    expect(
      SceneSchema.safeParse({ ...base, ask: 'total', total: 12, groups: 3, each: 5 }).success,
    ).toBe(false);
    expect(scene({ ask: 'total', total: 12, groups: 3, each: 4 }).each).toBe(4);
  });

  it('needs a split that adds up for fair', () => {
    expect(
      SceneSchema.safeParse({ ...base, ask: 'fair', total: 6, groups: 2, split: [4, 1] }).success,
    ).toBe(false);
  });
});

describe('sceneAnswer', () => {
  it.each([
    [{ ask: 'each', total: 5, groups: 2 }, 2.5],
    [{ ask: 'left', total: 14, groups: 4 }, 2],
    [{ ask: 'groups', total: 12, groups: 3, each: 4 }, 3],
    [{ ask: 'total', total: 8, groups: 4, each: 2 }, 8],
    [{ ask: 'fair', total: 6, groups: 2, split: [4, 2] }, false],
    [{ ask: 'compare', total: 12, groups: 2, otherGroups: 4, want: 'more' }, 2],
    [{ ask: 'compare', total: 1, groups: 3, otherGroups: 6, want: 'less' }, 6],
  ] as const)('%o answers %o', (s, answer) => {
    expect(sceneAnswer(scene(s as Partial<Scene>))).toBe(answer);
  });
});

describe('choiceTextValue', () => {
  it.each([
    ['Yes', true],
    ['no', false],
    ['1 1/2', 1.5],
    ['3/4', 0.75],
    ['0.50', 0.5],
    ['25%', 0.25],
    ['2 friends', 2],
    ['Mia', null],
    ['3 and 3', null],
  ])('reads %s', (text, value) => {
    expect(choiceTextValue(text)).toBe(value);
  });
});

describe('sceneProblems', () => {
  it('accepts a matching scene', () => {
    expect(sceneProblems(tap('1 1/2', '2', '1'), scene({ total: 3, groups: 2 }))).toEqual([]);
    expect(sceneProblems(keypad(3), scene({ total: 6, groups: 2 }))).toEqual([]);
  });

  it('rejects a wrong answer', () => {
    expect(sceneProblems(keypad(4), scene({ total: 6, groups: 2 }))).toEqual([
      'the scene answers 3 but the item answers 4',
    ]);
  });

  it('rejects cutting balls', () => {
    const balls = scene({ total: 14, groups: 4, thing: 'ball', one: 'ball', many: 'balls' });
    expect(sceneProblems(tap('3 1/2', '3', '4'), balls)).toContain('3.5 needs cutting a ball');
  });

  it('accepts wrong choices with other pieces, like halves among 3 friends', () => {
    expect(sceneProblems(tap('1 1/3', '1 1/2', '2'), scene({ total: 4, groups: 3 }))).toEqual([]);
  });

  it('rejects pieces too thin to show', () => {
    expect(sceneProblems(tap('1 1/2', '1 1/10'), scene({ total: 3, groups: 2 }))).toContain(
      '1.1 needs pieces smaller than 1/8',
    );
  });

  it('rejects choices the scene cannot show', () => {
    const compare = scene({ ask: 'compare', total: 12, groups: 3, otherGroups: 4, want: 'less' });
    expect(sceneProblems(tap('Leo', 'Mia'), compare)).toContain(
      'the item answer is not a number or yes/no',
    );
    expect(sceneProblems(keypad(4), compare)).toContain('ask compare needs choices');
  });
});

describe('amounts', () => {
  it('parses and formats', () => {
    expect(parseAmount('2 1/2')).toMatchObject({ whole: 2, parts: 1, den: 2 });
    expect(parseAmount('3/4')).toMatchObject({ whole: 0, parts: 3, den: 4 });
    expect(parseAmount('2/4')).toMatchObject({ whole: 0, parts: 1, den: 2 });
    expect(() => parseAmount('1 1/2', false)).toThrow();
    expect(() => parseAmount('two')).toThrow();
    expect(formatAmount(2.5)).toBe('2 1/2');
    expect(formatAmount(10 / 3)).toBe('3 1/3');
    expect(formatAmount(4)).toBe('4');
  });
});
