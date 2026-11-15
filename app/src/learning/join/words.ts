import type { JoinScene } from '@bright-trail/shared';

const name = (s: JoinScene, n: number) => `${n} ${n === 1 ? s.one : s.many}`;

/** What the play-out showed: an equation for the stage and a sentence for the feedback card. */
export function joinWords(s: JoinScene): { equation: string; summary: string } {
  const more = s.more ?? 0;
  const take = s.take ?? 0;
  switch (s.ask) {
    case 'count':
      return { equation: name(s, s.start), summary: `There are ${name(s, s.start)}.` };
    case 'join':
      return {
        equation: `${s.start} + ${more} = ${s.start + more}`,
        summary:
          more === 0
            ? `No more came, so there are still ${s.start}.`
            : `${s.start} and ${more} more make ${s.start + more}.`,
      };
    case 'back':
      return {
        equation: `${s.start} + ${more} = ${s.start + more}`,
        summary: `${s.start} are left. Bring back the ${more} and count on: ${s.start + more}.`,
      };
    case 'leave':
      return {
        equation: `${s.start} − ${take} = ${s.start - take}`,
        summary:
          take === 0
            ? `None went away, so there are still ${s.start}.`
            : `${s.start} take away ${take} leaves ${s.start - take}.`,
      };
    case 'part':
      if (take === 0)
        return {
          equation: `${s.start} = ${s.start} + 0`,
          summary: `None moved, so all ${s.start} stay.`,
        };
      return {
        equation: `${s.start} = ${take} + ${s.start - take}`,
        summary: `${s.start} is ${take} and ${s.start - take}.`,
      };
    case 'fill': {
      const d = s.target! - s.start;
      return {
        equation: `${s.start} + ${d} = ${s.target}`,
        summary: `${s.start} and ${d} more make ${s.target}.`,
      };
    }
    case 'make-ten': {
      const rest = s.start + more - 10;
      return {
        equation: `10 + ${rest} = ${s.start + more}`,
        summary: `Move ${10 - s.start} up to make 10. 10 and ${rest} make ${s.start + more}.`,
      };
    }
  }
}
