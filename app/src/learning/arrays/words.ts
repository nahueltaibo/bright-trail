import { arrayParts, type ArrayScene } from '@bright-trail/shared';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Counting by `step`, `times` times: "4, 8, 12". */
export const skipCount = (step: number, times: number) =>
  Array.from({ length: times }, (_, i) => step * (i + 1)).join(', ');

/** What the play-out showed, for the feedback card. */
export function arrayWords(s: ArrayScene): string {
  const total = s.rows * s.columns;
  const rows = plural(s.rows, 'row', 'rows');
  const one = s.rows === 1;
  switch (s.ask) {
    case 'total':
      return `${rows} of ${s.columns} ${one ? 'makes' : 'make'} ${total}. Count by ${s.columns}s: ${skipCount(s.columns, s.rows)}.`;
    case 'rows':
      return `${total} fills ${rows} of ${s.columns}. Count by ${s.columns}s: ${skipCount(s.columns, s.rows)}.`;
    case 'columns':
      return `${total} in ${rows} makes ${s.columns} in each row, because ${s.rows} × ${s.columns} = ${total}.`;
    case 'turn':
      return `${rows} of ${s.columns} ${one ? 'turns' : 'turn'} into ${plural(s.columns, 'row', 'rows')} of ${s.rows}. Both make ${total}, so ${s.rows} × ${s.columns} = ${s.columns} × ${s.rows}.`;
    case 'split': {
      const [a, b] = arrayParts(s).map((p) => ({ ...p, total: p.rows * p.columns }));
      return `${s.rows} × ${s.columns} splits into ${a.rows} × ${a.columns} = ${a.total} and ${b.rows} × ${b.columns} = ${b.total}. ${a.total} + ${b.total} = ${total}.`;
    }
  }
}

/** The fact over the array, before and after the play-out. */
export function factLine(s: ArrayScene, done: boolean): string {
  const total = s.rows * s.columns;
  if (!done)
    return s.ask === 'rows' || s.ask === 'columns' ? `${total} in all` : `${s.rows} × ${s.columns}`;
  if (s.ask === 'turn') return `${s.columns} × ${s.rows} = ${total}`;
  if (s.ask === 'split') {
    const [a, b] = arrayParts(s).map((p) => p.rows * p.columns);
    return `${a} + ${b} = ${total}`;
  }
  return `${s.rows} × ${s.columns} = ${total}`;
}

/** What the stage shouts once the play-out lands. */
export function shout(s: ArrayScene): string {
  const total = s.rows * s.columns;
  switch (s.ask) {
    case 'total':
      return `${total} in all!`;
    case 'rows':
      return `${plural(s.rows, 'row', 'rows')}!`;
    case 'columns':
      return `${s.columns} in each row!`;
    case 'turn':
      return `Still ${total}!`;
    case 'split':
      return `${total} in all!`;
  }
}
