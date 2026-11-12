import type { ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptJoins, applyJoins, joinCandidates, type TaggedJoin } from './join';

const keypad = (id: string, narration: string, answer: number, count?: number): Item => ({
  id,
  skillId: 's',
  difficulty: 1,
  narration,
  prompt: 'p',
  why: 'w',
  type: 'keypad',
  answer,
  ...(count !== undefined && { visual: { kind: 'objects', emoji: '🐟', count } }),
});

const tagged = (itemId: string, over: Partial<TaggedJoin> = {}): TaggedJoin => ({
  itemId,
  fits: true,
  ask: 'leave',
  emoji: '🐟',
  one: 'fish',
  many: 'fish',
  place: 'pond',
  move: 'swim',
  leave: 'swim',
  start: 4,
  more: null,
  take: 1,
  target: null,
  note: '',
  ...over,
});

const fish = keypad('fish', 'Pip has 4 fish. 1 fish swims away. How many fish are left?', 3, 4);

describe('joinCandidates', () => {
  it('keeps small whole-number stories and skips the rest', () => {
    const big = keypad('big', 'Ana has 25 stickers. She gets 6 more. How many now?', 31);
    const fact = keypad('fact', 'What is 7 times 8?', 56);
    expect(joinCandidates([fish, big, fact]).map((i) => i.id)).toEqual(['fish']);
  });

  it('keeps bare whole-number facts but not fraction sums', () => {
    const plus = keypad('plus', 'What is 9 + 1? Is it 8, 10, or 11?', 10);
    const minus = keypad('minus', 'Double 8 is 16. Use it. What is 16 - 8?', 8);
    const fraction = keypad('fraction', 'What is 3/4 + 1/4?', 1);
    expect(joinCandidates([plus, minus, fraction]).map((i) => i.id)).toEqual(['plus', 'minus']);
  });
});

describe('acceptJoins', () => {
  it('keeps a matching scene and drops nulls', () => {
    const { scenes, rejected } = acceptJoins([fish], { scenes: [tagged('fish')] });
    expect(rejected).toEqual({});
    expect(scenes.fish).toEqual({
      kind: 'join',
      ask: 'leave',
      emoji: '🐟',
      one: 'fish',
      many: 'fish',
      place: 'pond',
      move: 'swim',
      leave: 'swim',
      start: 4,
      take: 1,
    });
  });

  it('rejects a scene whose answer or picture differs from the item', () => {
    const { rejected } = acceptJoins([fish], { scenes: [tagged('fish', { start: 5, take: 2 })] });
    expect(rejected.fish).toBe('the picture has 4, the scene starts with 5');
  });
});

describe('applyJoins', () => {
  it('drops a scene once its item changed', () => {
    const { scenes } = acceptJoins([fish], { scenes: [tagged('fish')] });
    const changed = { items: [{ ...fish, answer: 2 }] } as unknown as ContentBundle;
    const applied = applyJoins(changed, scenes);
    expect(applied.bundle.items[0].game).toBeUndefined();
    expect(applied.dropped).toEqual(['fish: the scene shows 3 but the item answers 2']);
  });

  it('replaces its own game and keeps another game', () => {
    const { scenes } = acceptJoins([fish], { scenes: [tagged('fish')] });
    const stale = { ...scenes.fish, start: 9 };
    const own = applyJoins(
      { items: [{ ...fish, game: stale }] } as unknown as ContentBundle,
      scenes,
    );
    expect(own.bundle.items[0].game).toEqual(scenes.fish);

    const share = { kind: 'share' } as unknown as Item['game'];
    const other = { items: [{ ...fish, game: share }] } as unknown as ContentBundle;
    const applied = applyJoins(other, scenes);
    expect(applied.bundle.items[0].game).toBe(share);
    expect(applied.dropped).toEqual(['fish: the item plays another minigame']);
  });
});
