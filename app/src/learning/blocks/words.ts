import {
  blocksAnswer,
  blocksValue,
  PLACES,
  type BlocksScene,
  type Place,
} from '@bright-trail/shared';
import { blocksPlan, type Mat } from './layout';

const ONE: Record<Place, string> = { hundreds: 'hundred', tens: 'ten', ones: 'one' };

/** "1 ten" or "14 ones". */
export function placeCount(n: number, place: Place): string {
  return `${n} ${n === 1 ? ONE[place] : place}`;
}

/** "3 hundreds, 0 tens, and 5 ones", from the highest place with blocks down to the ones. */
export function matWords(m: Mat): string {
  const top = Math.max(
    0,
    PLACES.findIndex((p) => m[p] > 0),
  );
  const parts = PLACES.slice(top).map((p) => placeCount(m[p], p));
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}

/** What the play-out showed, for the feedback card. */
export function blocksWords(s: BlocksScene): string {
  const plan = blocksPlan(s);
  const value = blocksValue(s);
  const answer = blocksAnswer(s);
  const did = (kind: 'trade' | 'break', place: Place) =>
    plan.some((p) => p.kind === kind && p.place === place);
  const moves = [
    did('trade', 'ones') && '10 ones trade for 1 ten',
    did('trade', 'tens') && '10 tens trade for 1 hundred',
    did('break', 'hundreds') && 'each hundred breaks into 10 tens',
    did('break', 'tens') && 'each ten breaks into 10 ones',
  ].filter((m): m is string => typeof m === 'string');
  const first = moves.length > 0 ? `${cap(moves.join(', and '))}. ` : '';
  const end = plan.at(-1)?.mat ?? s;
  switch (s.ask) {
    case 'total':
      return `${first}${cap(matWords(end))} ${value === 1 ? 'makes' : 'make'} ${value}.`;
    case 'count':
      return `${value} is ${matWords(s)}, so it has ${placeCount(answer, s.place!)}.`;
    case 'worth': {
      const digit = s[s.place!];
      return `The ${digit} in ${value} stands for ${placeCount(digit, s.place!)}, so it is worth ${answer}.`;
    }
    case 'make':
      return `${first}${value} makes ${placeCount(answer, s.place!)}.`;
  }
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
