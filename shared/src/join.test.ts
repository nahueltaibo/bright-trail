import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import { JoinSceneSchema, joinProblems, joinValue, type JoinScene } from './join';

const scene = (s: Partial<JoinScene> & Pick<JoinScene, 'ask' | 'start'>): JoinScene =>
  JoinSceneSchema.parse({
    kind: 'join',
    emoji: '🐟',
    one: 'fish',
    many: 'fish',
    place: 'tray',
    move: 'swim',
    ...s,
  });

const keypad = (answer: number, visual?: Extract<Item, { type: 'keypad' }>['visual']): Item => ({
  id: 'k',
  skillId: 's',
  difficulty: 1,
  narration: 'n',
  prompt: 'p',
  why: 'w',
  type: 'keypad',
  answer,
  ...(visual && { visual }),
});

describe('JoinSceneSchema', () => {
  it('needs the numbers each ask uses', () => {
    expect(() => scene({ ask: 'join', start: 3 })).toThrow(/needs more/);
    expect(() => scene({ ask: 'leave', start: 3, take: 4, leave: 'swim' })).toThrow(/take must be/);
    expect(() => scene({ ask: 'fill', start: 8, target: 8 })).toThrow(/above start/);
  });

  it('keeps 10-spot places to 10', () => {
    expect(() => scene({ ask: 'join', start: 8, more: 4, place: 'pond' })).toThrow(/holds 10/);
    expect(scene({ ask: 'join', start: 8, more: 4 }).more).toBe(4);
  });

  it('makes ten only across two frames', () => {
    expect(() => scene({ ask: 'make-ten', start: 6, more: 3 })).toThrow(/sum past 10/);
    expect(joinValue(scene({ ask: 'make-ten', start: 9, more: 5 }))).toBe(14);
  });
});

describe('joinValue', () => {
  it('answers each ask', () => {
    expect(joinValue(scene({ ask: 'count', start: 5 }))).toBe(5);
    expect(joinValue(scene({ ask: 'leave', start: 9, take: 5, leave: 'fly' }))).toBe(4);
    expect(joinValue(scene({ ask: 'part', start: 5, take: 4 }))).toBe(1);
    expect(joinValue(scene({ ask: 'fill', start: 8, target: 10 }))).toBe(2);
    expect(joinValue(scene({ ask: 'back', start: 9, more: 8 }))).toBe(17);
  });
});

describe('joinProblems', () => {
  it('accepts a scene that matches the item and its picture', () => {
    const item = keypad(3, { kind: 'objects', emoji: '🐟', count: 4 });
    expect(joinProblems(item, scene({ ask: 'leave', start: 4, take: 1, leave: 'swim' }))).toEqual(
      [],
    );
  });

  it('rejects a wrong answer or a different picture', () => {
    const item = keypad(3, { kind: 'objects', emoji: '🐟', count: 5 });
    expect(joinProblems(item, scene({ ask: 'leave', start: 4, take: 2, leave: 'swim' }))).toEqual([
      'the scene shows 2 but the item answers 3',
      'the picture has 5, the scene starts with 4',
    ]);
  });

  it('starts a ten-frame picture from its dots', () => {
    const item = keypad(2, { kind: 'ten-frame', filled: 8 });
    const s = scene({ ask: 'fill', start: 8, target: 10, emoji: undefined });
    expect(joinProblems(item, s)).toEqual([]);
  });
});
