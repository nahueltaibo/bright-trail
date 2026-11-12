import {
  compareNumbers,
  compareValue,
  compareView,
  compareWinner,
  formatAmount,
  type CompareScene,
} from '@bright-trail/shared';

/** How far the target is from each value, written like the values. */
export function closerDistances(s: CompareScene): string[] {
  const t = compareValue(s.target!)!;
  const fractions = [...s.values, s.target!].some((v) => v.includes('/'));
  return compareNumbers(s).map((n) => {
    const d = Math.abs(n - t);
    return fractions ? formatAmount(d) : String(Number(d.toFixed(6)));
  });
}

/** What the play-out showed, for the feedback card. */
export function compareWords(s: CompareScene): string {
  const nums = compareNumbers(s);
  const w = s.values[compareWinner(s)];
  const two = nums.length === 2;
  const towers = compareView(s) === 'towers';
  switch (s.ask) {
    case 'greatest':
      return towers
        ? `${w} makes the ${two ? 'taller' : 'tallest'} tower, so ${w} is ${two ? 'greater' : 'greatest'}.`
        : `${w} is ${two ? 'farther' : 'farthest'} right on the number line, so ${w} is ${two ? 'greater' : 'greatest'}.`;
    case 'least':
      return towers
        ? `${w} makes the ${two ? 'shorter' : 'shortest'} tower, so ${w} is ${two ? 'less' : 'least'}.`
        : `${w} is ${two ? 'farther' : 'farthest'} left on the number line, so ${w} is ${two ? 'less' : 'least'}.`;
    case 'middle': {
      const order = s.values.map((v, i) => ({ v, n: nums[i] })).sort((a, b) => a.n - b.n);
      return `In order, they go ${order.map((o) => o.v).join(', ')}. ${w} is in the middle.`;
    }
    case 'closer': {
      const [da, db] = closerDistances(s);
      const [a, b] = s.values;
      return `${s.target} is ${da} from ${a} and ${db} from ${b}, so it is closer to ${w}.`;
    }
  }
}
