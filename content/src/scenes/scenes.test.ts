import type { ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptScenes, applyScenes, candidateItems, type TaggedScene } from './scenes';

const keypad = (id: string, narration: string, answer: number): Item => ({
  id,
  skillId: 's',
  difficulty: 1,
  narration,
  prompt: 'p',
  why: 'w',
  type: 'keypad',
  answer,
});

const tagged = (itemId: string, over: Partial<TaggedScene> = {}): TaggedScene => ({
  itemId,
  fits: true,
  ask: 'each',
  thing: 'cookie',
  one: 'cookie',
  many: 'cookies',
  container: 'plate',
  receivers: 'kids',
  total: 6,
  groups: 2,
  each: null,
  split: null,
  otherGroups: null,
  want: null,
  sharer: { name: 'Sam', look: 'boy' },
  named: null,
  otherSharer: null,
  note: '',
  ...over,
});

const share = keypad('share', 'Sam has 6 cookies. He shares them with 2 friends.', 3);

describe('candidateItems', () => {
  it('keeps sharing stories only', () => {
    const count = keypad('count', 'Count the ducks.', 4);
    expect(candidateItems([share, count]).map((i) => i.id)).toEqual(['share']);
  });
});

describe('acceptScenes', () => {
  it('keeps a matching scene and drops nulls', () => {
    const { scenes, rejected } = acceptScenes([share], { scenes: [tagged('share')] });
    expect(rejected).toEqual({});
    expect(scenes.share).toMatchObject({ ask: 'each', total: 6, sharer: { name: 'Sam' } });
    expect(scenes.share).not.toHaveProperty('each');
  });

  it('rejects a scene whose answer differs from the item', () => {
    const { scenes, rejected } = acceptScenes([share], {
      scenes: [tagged('share', { total: 8 })],
    });
    expect(scenes).toEqual({});
    expect(rejected.share).toBe('the scene answers 4 but the item answers 3');
  });

  it('records why the tagger said no', () => {
    const { rejected } = acceptScenes([share], {
      scenes: [tagged('share', { fits: false, note: 'not sharing' })],
    });
    expect(rejected.share).toBe('does not fit: not sharing');
  });
});

describe('applyScenes', () => {
  const bundle = { items: [share] } as unknown as ContentBundle;

  it('adds matching scenes', () => {
    const { scenes } = acceptScenes([share], { scenes: [tagged('share')] });
    const applied = applyScenes(bundle, scenes);
    expect(applied.bundle.items[0].scene?.total).toBe(6);
    expect(applied.dropped).toEqual([]);
  });

  it('drops a scene once its item changed', () => {
    const { scenes } = acceptScenes([share], { scenes: [tagged('share')] });
    const changed = { items: [{ ...share, answer: 4 }] } as unknown as ContentBundle;
    const applied = applyScenes(changed, scenes);
    expect(applied.bundle.items[0].scene).toBeUndefined();
    expect(applied.dropped).toEqual(['share: the scene answers 3 but the item answers 4']);
  });
});
