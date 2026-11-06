import { describe, expect, it } from 'vitest';
import { addDays, localClock } from './dates';

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-11-29', 2)).toBe('2026-12-01');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2028-02-27', 2)).toBe('2028-02-29');
  });

  it('ignores daylight saving changes', () => {
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
  });

  it('rejects a malformed date', () => {
    expect(() => addDays('2026/11/06', 2)).toThrow('YYYY-MM-DD');
  });
});

describe('localClock', () => {
  it('uses the local calendar date and an offset date-time', () => {
    const date = new Date(2026, 10, 6, 23, 30, 5);
    const clock = localClock(date);
    expect(clock.today).toBe('2026-11-06');
    expect(clock.now).toMatch(/^2026-11-06T23:30:05[+-]\d{2}:\d{2}$/);
    expect(new Date(clock.now).getTime()).toBe(date.getTime());
  });
});
