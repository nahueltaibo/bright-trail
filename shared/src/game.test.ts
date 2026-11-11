import { describe, expect, it } from 'vitest';
import { GAMES, gameProblems, type Game } from './game';
import { ItemSchema, type Item } from './item';

const join: Game = {
  kind: 'join',
  ask: 'join',
  start: 3,
  more: 2,
  emoji: '🐟',
  one: 'fish',
  many: 'fish',
  place: 'tray',
  move: 'swim',
};

const keypad = (answer: number, game?: unknown) => ({
  id: 'k',
  skillId: 's',
  difficulty: 1,
  narration: 'n',
  prompt: 'p',
  why: 'w',
  type: 'keypad',
  answer,
  ...(game !== undefined && { game }),
});

describe('GAMES', () => {
  it('keys each game by the kind its scene carries', () => {
    for (const [kind, { schema }] of Object.entries(GAMES)) {
      expect(schema.shape.kind.value).toBe(kind);
    }
  });
});

describe('gameProblems', () => {
  it("runs the game's own check", () => {
    const item = ItemSchema.parse(keypad(5, join));
    expect(gameProblems(item, join)).toEqual([]);
    expect(gameProblems({ ...item, answer: 4 } as Item, join)).toHaveLength(1);
  });
});

describe('ItemSchema game', () => {
  it('parses a game by its kind', () => {
    expect(ItemSchema.parse(keypad(5, join)).game?.kind).toBe('join');
  });

  it('rejects an unknown kind and the old scene fields', () => {
    expect(ItemSchema.safeParse(keypad(5, { ...join, kind: 'race' })).success).toBe(false);
    const old = ItemSchema.parse({ ...keypad(5), join });
    expect(old).not.toHaveProperty('join');
  });
});
