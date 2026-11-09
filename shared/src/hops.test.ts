import { describe, expect, it } from 'vitest';
import { defaultHops, hopLandings, hopsProblems } from './hops';

const line = (min: number, max: number, step: number, target: number) => ({
  min,
  max,
  step,
  target,
});

describe('defaultHops', () => {
  it('hops by the step when that is few hops', () => {
    expect(defaultHops(line(20, 50, 1, 27))).toEqual({ start: 20, legs: [{ by: 1, times: 7 }] });
    expect(defaultHops(line(0, 1, 0.25, 0.75))).toEqual({
      start: 0,
      legs: [{ by: 0.25, times: 3 }],
    });
  });

  it('hops by place value on a long trip', () => {
    expect(defaultHops(line(0, 200, 5, 165))).toEqual({
      start: 0,
      legs: [
        { by: 50, times: 3 },
        { by: 5, times: 3 },
      ],
    });
    expect(defaultHops(line(0, 2, 0.1, 1.4))).toEqual({
      start: 0,
      legs: [
        { by: 1, times: 1 },
        { by: 0.1, times: 4 },
      ],
    });
  });

  it('stays put when the answer is the start', () => {
    expect(defaultHops(line(0, 10, 1, 0))).toEqual({ start: 0, legs: [] });
  });
});

describe('hopsProblems', () => {
  it('accepts a path that lands on the answer', () => {
    const back = { start: 20, legs: [{ by: -1, times: 6 }] };
    expect(hopLandings(back).at(-1)).toBe(14);
    expect(hopsProblems(line(0, 30, 1, 14), back)).toEqual([]);
  });

  it('rejects a wrong landing, a hop off the line, or between steps', () => {
    expect(hopsProblems(line(0, 10, 1, 5), { start: 3, legs: [{ by: 1, times: 3 }] })).toEqual([
      'the frog lands on 6 but the answer is 5',
    ]);
    expect(hopsProblems(line(0, 10, 1, 8), { start: 12, legs: [{ by: -1, times: 4 }] })).toEqual([
      '12 is off the line',
    ]);
    expect(hopsProblems(line(0, 40, 5, 35), { start: 0, legs: [{ by: 7, times: 5 }] })).toEqual([
      "7 is between the line's steps",
    ]);
  });
});
