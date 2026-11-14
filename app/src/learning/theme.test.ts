import { fitFontSize } from './theme';

describe('fitFontSize', () => {
  const opts = { base: 48, min: 14 };

  it('keeps the base size when the text fits on one line', () => {
    expect(fitFontSize('7', { width: 200, height: 80 }, opts)).toBe(48);
  });

  it('shrinks until the longest word fits a line', () => {
    const size = fitFontSize('Caterpillar', { width: 120, height: 60 }, opts);
    expect(size).toBeLessThan(48);
    expect(size).toBeGreaterThan(14);
    expect(11 * size * 0.62).toBeLessThanOrEqual(120);
  });

  it('wraps words instead of shrinking when the lines fit the height', () => {
    const oneLine = fitFontSize('holds the tens place', { width: 120, height: 30 }, opts);
    const wrapped = fitFontSize('holds the tens place', { width: 120, height: 90 }, opts);
    expect(wrapped).toBeGreaterThan(oneLine);
  });

  it('respects maxLines', () => {
    const text = 'makes the number bigger';
    const box = { width: 100, height: 200 };
    expect(fitFontSize(text, box, { ...opts, maxLines: 1 })).toBeLessThan(
      fitFontSize(text, box, { ...opts, maxLines: 4 }),
    );
  });

  it('returns min when nothing fits', () => {
    expect(fitFontSize('Supercalifragilistic', { width: 40, height: 20 }, opts)).toBe(14);
  });
});
