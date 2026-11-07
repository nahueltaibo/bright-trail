import { describe, expect, it } from 'vitest';
import { toSpeech } from './speech';
import { describeVisual, VisualSchema } from './visual';

describe('fraction visual', () => {
  it('accepts a shape cut into equal parts', () => {
    const visual = { kind: 'fraction', shape: 'circle', parts: 4, shaded: 3, label: '3/4' };
    expect(VisualSchema.parse(visual)).toEqual(visual);
  });

  it('accepts more shaded parts than one whole across several wholes', () => {
    expect(
      VisualSchema.safeParse({ kind: 'fraction', shape: 'bar', parts: 4, shaded: 7, wholes: 2 })
        .success,
    ).toBe(true);
  });

  it('rejects more shaded parts than the picture has', () => {
    const result = VisualSchema.safeParse({
      kind: 'fraction',
      shape: 'rectangle',
      parts: 4,
      shaded: 5,
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('shaded is 5 but the picture has only 4 parts');
  });

  it.each([1, 13])('rejects %i parts', (parts) => {
    expect(
      VisualSchema.safeParse({ kind: 'fraction', shape: 'circle', parts, shaded: 0 }).success,
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
      toSpeech(describeVisual({ kind: 'fraction', shape: 'circle', parts: 4, shaded: 3 })),
    ).toBe('a circle cut into four equal parts, three shaded');
    expect(describeVisual({ kind: 'fraction', shape: 'bar', parts: 3, shaded: 4, wholes: 2 })).toBe(
      '2 bars, each cut into 3 equal parts, 4 shaded',
    );
  });
});
