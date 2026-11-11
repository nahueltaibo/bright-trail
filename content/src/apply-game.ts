import type { ContentBundle, GameKind, GameOf, Item } from '@bright-trail/shared';

/**
 * Sets each item's stored game of one kind. A game that no longer matches its item, e.g. after
 * the item was regenerated, or that meets an item already playing another game, is dropped and
 * reported.
 */
export function applyGame<K extends GameKind>(
  bundle: ContentBundle,
  kind: K,
  games: Readonly<Record<string, GameOf<K>>>,
  problems: (item: Item, game: GameOf<K>) => string[],
): { bundle: ContentBundle; dropped: string[] } {
  const dropped: string[] = [];
  const items = bundle.items.map((item) => {
    const rest = { ...item };
    if (rest.game?.kind === kind) delete rest.game;
    const game = games[item.id];
    if (!game) return rest;
    const found = rest.game ? ['the item plays another minigame'] : problems(rest, game);
    if (found.length > 0) {
      dropped.push(`${item.id}: ${found.join('; ')}`);
      return rest;
    }
    return { ...rest, game } as Item;
  });
  return { bundle: { ...bundle, items }, dropped };
}
