import { describe, expect, it } from 'vitest';
import { evaluate, literalsOf, usesCount } from './expr';
import { numbersMentioned, numberWord, parseNumberText } from './numbers';
import { Rational } from './rational';

const val = (expr: string, count?: number) => {
  const v = evaluate(expr, { count });
  return typeof v === 'boolean' ? v : v.toString();
};

describe('Rational', () => {
  it('keeps exact fractions and decimals', () => {
    expect(Rational.parse('0.1')!.add(Rational.parse('0.2')!).eq(Rational.parse('0.3')!)).toBe(
      true,
    );
    expect(new Rational(2n, -4n).toString()).toBe('-1/2');
    expect(Rational.of(1e-7).toString()).toBe('1/10000000');
    expect(Rational.parse('abc')).toBeNull();
  });

  it('floors negatives down', () => {
    expect(new Rational(-7n, 2n).floor().toString()).toBe('-4');
  });
});

describe('evaluate', () => {
  it('follows the order of operations, with brackets', () => {
    expect(val('3 + 4 * 2')).toBe('11');
    expect(val('(3 + 4) × 2')).toBe('14');
    expect(val('2 ^ 3 ^ 1')).toBe('8');
    expect(val('-6 + 10')).toBe('4');
    expect(val('12 ÷ 3 − 1')).toBe('3');
  });

  it('computes exactly with fractions and decimals', () => {
    expect(val('1/2 + 3/4')).toBe('5/4');
    expect(val('0.1 + 0.2 == 0.3')).toBe(true);
    expect(val('235 * 0.3')).toBe('141/2');
    expect(val('5 / 0.5')).toBe('10');
  });

  it('rounds halves away from zero', () => {
    expect(val('roundTo(237, 10)')).toBe('240');
    expect(val('roundTo(235, 10)')).toBe('240');
    expect(val('roundTo(2.5, 1)')).toBe('3');
    expect(val('roundTo(56.25, 0.1)')).toBe('563/10');
    expect(val('roundTo(-2.5, 1)')).toBe('-3');
  });

  it('has comparisons, logic, and number tests', () => {
    expect(val('isEven(14) and not isOdd(14)')).toBe(true);
    expect(val('isPrime(97)')).toBe(true);
    expect(val('isPrime(91)')).toBe(false);
    expect(val('3/4 > 2/3')).toBe(true);
    expect(val('17 % 5')).toBe('2');
    expect(val('max(3, 9, 4) - min(3, 9, 4)')).toBe('6');
    expect(val('floor(33 / 4) + ceil(0.2) + abs(-3)')).toBe('12');
  });

  it('reads the picture count', () => {
    expect(val('count + 1', 7)).toBe('8');
    expect(() => val('count')).toThrow(/no count/);
    expect(usesCount('count - 2')).toBe(true);
  });

  it('rejects bad expressions', () => {
    expect(() => val('')).toThrow();
    expect(() => val('3 +')).toThrow();
    expect(() => val('foo(3)')).toThrow(/Unknown name/);
    expect(() => val('1 / 0')).toThrow(/zero/);
    expect(() => val('isPrime(2.5)')).toThrow(/whole/);
    expect(() => val('3 $ 4')).toThrow(/Unexpected/);
    expect(() => val('roundTo(3)')).toThrow(/argument/);
  });

  it('lists literals', () => {
    expect(literalsOf('roundTo(237, 10) + 0.5').map(String)).toEqual(['237', '10', '1/2']);
  });
});

describe('parseNumberText', () => {
  const values = (t: string) => parseNumberText(t)?.map(String) ?? null;

  it('reads every Ontario number format', () => {
    expect(values('24 336')).toEqual(['24336']);
    expect(values('-6')).toEqual(['-6']);
    expect(values('−6')).toEqual(['-6']);
    expect(values('3/4')).toEqual(['3/4']);
    expect(values('1 3/4')).toEqual(['7/4']);
    expect(values('0.25')).toEqual(['1/4']);
    expect(values('25%')).toEqual(['1/4', '25']);
    expect(values('$2.50')).toEqual(['5/2', '250']);
    expect(values('75¢')).toEqual(['75', '3/4']);
    expect(values('seven')).toEqual(['7']);
    expect(values('forty-two')).toEqual(['42']);
  });

  it('returns null for words that are not one number', () => {
    expect(values('closer to 10')).toBeNull();
    expect(values('even')).toBeNull();
    expect(values('3 and 4')).toBeNull();
  });
});

describe('numbersMentioned', () => {
  it('finds digits, words, fraction parts, and percents', () => {
    const found = numbersMentioned('Is 3/4 more than half of 24 336? Seven frogs, 25%.').map(
      String,
    );
    expect(found).toEqual(
      expect.arrayContaining(['3', '4', '3/4', '24336', '7', '25', '1/4', '1/2']),
    );
  });

  it('reads number words to 99', () => {
    expect(numberWord('ninety-nine')).toBe(99);
    expect(numberWord('twenty')).toBe(20);
    expect(numberWord('twenty-ten')).toBeNull();
    expect(numberWord('cat')).toBeNull();
  });
});
