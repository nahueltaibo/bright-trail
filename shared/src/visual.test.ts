import { describe, expect, it } from 'vitest';
import { toSpeech } from './speech';
import { describeVisual, VisualSchema } from './visual';

describe('fraction visual', () => {
  it('accepts a shape cut into equal parts', () => {
    const visual = { kind: 'fraction', shape: 'circle', parts: 4, picked: 3, label: '3/4' };
    expect(VisualSchema.parse(visual)).toEqual(visual);
  });

  it('accepts more picked parts than one whole across several wholes', () => {
    expect(
      VisualSchema.safeParse({ kind: 'fraction', shape: 'bar', parts: 4, picked: 7, wholes: 2 })
        .success,
    ).toBe(true);
  });

  it('rejects more picked and eaten parts than the picture has', () => {
    const result = VisualSchema.safeParse({
      kind: 'fraction',
      shape: 'rectangle',
      parts: 4,
      picked: 3,
      eaten: 2,
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      '3 picked and 2 eaten but the picture has only 4 parts',
    );
  });

  it('rejects a food cut as another shape', () => {
    const result = VisualSchema.safeParse({
      kind: 'fraction',
      shape: 'rectangle',
      food: 'pizza',
      parts: 4,
      picked: 1,
    });
    expect(result.error!.issues[0].message).toBe('pizza is a circle, not a rectangle');
  });

  it.each([1, 13])('rejects %i parts', (parts) => {
    expect(
      VisualSchema.safeParse({ kind: 'fraction', shape: 'circle', parts, picked: 0 }).success,
    ).toBe(false);
  });

  it('still accepts the older kinds', () => {
    expect(VisualSchema.parse({ kind: 'ten-frame', filled: 3 })).toEqual({
      kind: 'ten-frame',
      filled: 3,
    });
  });

  it('describes itself in words toSpeech can read', () => {
    expect(
      toSpeech(
        describeVisual({ kind: 'fraction', shape: 'circle', food: 'pizza', parts: 4, picked: 3 }),
      ),
    ).toBe('a pizza cut into four equal parts, three picked');
    expect(describeVisual({ kind: 'fraction', shape: 'bar', parts: 3, picked: 4, wholes: 2 })).toBe(
      '2 bars, each cut into 3 equal parts, 4 picked',
    );
    expect(
      describeVisual({
        kind: 'fraction',
        shape: 'rectangle',
        food: 'brownies',
        parts: 8,
        picked: 0,
        eaten: 3,
        wholes: 2,
      }),
    ).toBe('2 pans of brownies, each cut into 8 equal parts, 0 picked, 3 eaten');
  });
});
