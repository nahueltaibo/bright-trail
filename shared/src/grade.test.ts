import { describe, expect, it } from 'vitest';
import { deriveGrade } from './grade';

describe('deriveGrade', () => {
  it('starts Grade 1 on Sep 1 of the year the child turns 6', () => {
    expect(deriveGrade('2020-03-15', '2026-08-31')).toBe('SK');
    expect(deriveGrade('2020-03-15', '2026-09-01')).toBe('1');
  });

  it('puts a Dec 31 birthday a full grade ahead of a Jan 1 birthday the next day', () => {
    expect(deriveGrade('2019-12-31', '2026-11-06')).toBe('2');
    expect(deriveGrade('2020-01-01', '2026-11-06')).toBe('1');
  });

  it('starts a Dec 31 child in Grade 1 at age 5', () => {
    expect(deriveGrade('2020-12-31', '2026-09-01')).toBe('1');
  });

  it('covers JK and SK', () => {
    expect(deriveGrade('2022-06-01', '2026-09-01')).toBe('JK');
    expect(deriveGrade('2021-06-01', '2026-09-01')).toBe('SK');
  });

  it('clamps to JK and Grade 8', () => {
    expect(deriveGrade('2025-01-01', '2026-11-06')).toBe('JK');
    expect(deriveGrade('2010-01-01', '2026-11-06')).toBe('8');
  });

  it('reads a Date in local time', () => {
    expect(deriveGrade('2020-03-15', new Date(2026, 7, 31, 23, 59))).toBe('SK');
    expect(deriveGrade('2020-03-15', new Date(2026, 8, 1, 0, 0))).toBe('1');
  });

  it('rejects a malformed date', () => {
    expect(() => deriveGrade('2020/03/15', '2026-11-06')).toThrow('YYYY-MM-DD');
  });
});
