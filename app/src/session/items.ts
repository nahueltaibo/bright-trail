import type { Item } from '@bright-trail/shared';

/**
 * Which items the child has seen, and how recently. Unseen items go first. Once a skill runs out,
 * the one seen longest ago comes back, so a skill with few items never repeats the last one.
 */
export class ItemHistory {
  private readonly lastSeen = new Map<string, number>();
  private clock = 0;

  constructor(seenInOrder: Iterable<string> = []) {
    for (const id of seenInOrder) this.see(id);
  }

  see(itemId: string) {
    this.lastSeen.set(itemId, ++this.clock);
  }

  has(itemId: string): boolean {
    return this.lastSeen.has(itemId);
  }

  /** Null only when the skill has no items. Ties keep bundle order. */
  pick(items: readonly Item[]): Item | null {
    let best: Item | null = null;
    let bestSeen = Infinity;
    for (const item of items) {
      const seen = this.lastSeen.get(item.id) ?? 0;
      if (seen < bestSeen) {
        best = item;
        bestSeen = seen;
      }
    }
    return best;
  }
}
