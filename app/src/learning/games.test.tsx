import { gameProblems, ItemSchema } from '@bright-trail/shared';
import { render, screen } from '@testing-library/react-native';
import { GAME_KINDS, GAME_VIEWS, isGameKind } from './games';
import { ItemView } from './ItemView';

describe('GAME_VIEWS', () => {
  it.each(GAME_KINDS)('%s demo items all play %s and fit their items', (kind) => {
    const { demo } = GAME_VIEWS[kind];
    expect(demo.length).toBeGreaterThan(0);
    for (const item of demo) {
      expect(item.game?.kind).toBe(kind);
      expect(gameProblems(item, item.game!)).toEqual([]);
    }
  });

  it.each(GAME_KINDS)('%s demo items pass the item schema', (kind) => {
    for (const item of GAME_VIEWS[kind].demo) {
      expect([item.id, ItemSchema.safeParse(item).error?.issues ?? []]).toEqual([item.id, []]);
    }
  });

  it.each(GAME_KINDS)('ItemView plays a %s item', async (kind) => {
    const item = GAME_VIEWS[kind].demo[0];
    await render(<ItemView item={item} shuffleSeed="test" />);
    expect(screen.getAllByText(item.prompt).length).toBeGreaterThan(0);
  });
});

describe('isGameKind', () => {
  it('accepts registered kinds only', () => {
    expect(GAME_KINDS.every(isGameKind)).toBe(true);
    expect(isGameKind('hops')).toBe(false);
    expect(isGameKind('toString')).toBe(false);
    expect(isGameKind(undefined)).toBe(false);
  });
});
