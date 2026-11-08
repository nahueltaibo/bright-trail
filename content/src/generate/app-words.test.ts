import type { Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { foodFor, itemForApp, pickedWords } from './app-words';

describe('pickedWords', () => {
  it('says picked where the generator said shaded', () => {
    expect(pickedWords('Shaded parts: 3 slices are shaded.')).toBe(
      'Picked parts: 3 slices are picked.',
    );
    expect(pickedWords('Mia unshaded nothing')).toBe('Mia unshaded nothing');
  });
});

describe('foodFor', () => {
  it('takes the first food the words name that fits the shape', () => {
    expect(foodFor('circle', 'Ana eats a pie, then pizza.')).toBe('pie');
    expect(foodFor('rectangle', 'A pan is cut into 4 parts.')).toBe('brownies');
    expect(foodFor('rectangle', 'A chocolate bar has 10 pieces.')).toBe('chocolate');
  });

  it('falls back to later texts, then to a plain shape', () => {
    expect(foodFor('circle', '1/2 of the circle', 'Two friends share a pie.')).toBe('pie');
    expect(foodFor('circle', 'A circle is cut into 8 parts.')).toBeUndefined();
    expect(foodFor('bar', 'A chocolate bar')).toBeUndefined();
  });
});

describe('itemForApp', () => {
  it('rewords the item and picks the food for its picture', () => {
    const item: Item = {
      id: 'k',
      skillId: 's',
      difficulty: 1,
      narration: 'A pizza has 4 slices. 3 are shaded. How many are shaded?',
      prompt: 'How many shaded?',
      why: 'Count the shaded slices.',
      type: 'keypad',
      visual: { kind: 'fraction', shape: 'circle', parts: 4, picked: 3 },
      answer: 3,
    };
    expect(itemForApp(item)).toMatchObject({
      narration: 'A pizza has 4 slices. 3 are picked. How many are picked?',
      prompt: 'How many picked?',
      why: 'Count the picked slices.',
      visual: { food: 'pizza', picked: 3 },
    });
  });
});
