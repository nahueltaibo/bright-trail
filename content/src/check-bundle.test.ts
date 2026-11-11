import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { describe, expect, it } from 'vitest';
import { checkBundle } from './check-bundle';

describe('checkBundle', () => {
  it('summarizes the shared sample bundle', () => {
    expect(checkBundle(sample)).toEqual({
      ok: true,
      summary: 'Bundle sample-1: 3 skills, 3 nuggets, 9 items',
    });
  });

  it('lists each problem with its path', () => {
    const broken = structuredClone(sample);
    broken.skills[1].prerequisiteIds = ['k-missing'];
    expect(checkBundle(broken)).toEqual({
      ok: false,
      problems: ['skills.1.prerequisiteIds.0: Unknown prerequisite k-missing'],
    });
  });

  it("checks each item's game against its answer", () => {
    const broken = structuredClone(sample) as { items: Record<string, unknown>[] };
    const item = broken.items.find((i) => i.type === 'keypad')!;
    item.answer = 4;
    item.game = {
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
    expect(checkBundle(broken)).toEqual({
      ok: false,
      problems: [`${String(item.id)} join: the scene shows 5 but the item answers 4`],
    });
  });
});
