import { GRID_UNITS, gridFills, type GridScene, type GridUnit } from '@bright-trail/shared';

/** "1 tenth", "35 tenths", "1 hundredth". */
export function partsText(n: number, unit: GridUnit): string {
  return `${n} ${n === 1 ? unit.slice(0, -1) : unit}`;
}

/** Parts as a decimal, like 0.9, 3.5, or 0.25. */
export function decimalText(parts: number, unit: GridUnit): string {
  return String(Number((parts / GRID_UNITS[unit]).toFixed(2)));
}

/** Parts as a percent number, like 60 for 60%. */
const percentOf = (parts: number, unit: GridUnit) =>
  Number(((parts * 100) / GRID_UNITS[unit]).toFixed(2));

/** What pops up once the play-out fills everything. */
export function gridShout(s: GridScene): string {
  const [a, b] = gridFills(s);
  const counted = partsText(a, s.unit);
  switch (s.ask) {
    case 'decimal':
      return `${counted} = ${decimalText(a, s.unit)}`;
    case 'fraction':
      return `${counted} = ${a}/${GRID_UNITS[s.unit]}`;
    case 'percent':
      return `${counted} = ${percentOf(a, s.unit)}%`;
    case 'parts':
      return `${s.amount} = ${counted}`;
    case 'same':
      return a === b ? 'The same!' : 'Not the same!';
  }
}

/** What the play-out showed, for the feedback card. */
export function gridWords(s: GridScene): string {
  const [a, b] = gridFills(s);
  const size = GRID_UNITS[s.unit];
  const filled = `We filled ${partsText(a, s.unit)}.`;
  switch (s.ask) {
    case 'decimal':
      return `${filled} As a decimal, that's ${decimalText(a, s.unit)}.`;
    case 'fraction': {
      const fraction = `${a}/${size}`;
      const same = s.amount.includes('/') && s.amount !== fraction;
      return `${filled} As a fraction, that's ${fraction}${same ? `, the same as ${s.amount}` : ''}.`;
    }
    case 'percent': {
      const p = percentOf(a, s.unit);
      return `${filled} That's ${p} out of 100, or ${p}%.`;
    }
    case 'parts':
      return `${s.amount} fills ${partsText(a, s.unit)}.`;
    case 'same':
      return a === b
        ? `${s.amount} and ${s.other} both fill ${partsText(a, s.unit)}, so they are the same.`
        : `${s.amount} fills ${partsText(a, s.unit)}, but ${s.other} fills ${partsText(b, s.unit)}. They are not the same.`;
  }
}
