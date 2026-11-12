import { stoneStep, stepText, type StonesScene } from '@bright-trail/shared';

/** What the play-out showed, for the feedback card. */
export function stonesWords(s: StonesScene): string {
  const step = stepText(s);
  const up = stoneStep(s) > 0;
  const hidden = s.stones[s.missing];
  // Reach the missing stone from the one before it, or from the one after when it comes first.
  const first = s.missing === 0;
  const from = s.stones[first ? 1 : s.missing - 1];
  const more = up !== first;
  const reach = more
    ? `${from} and ${step} more is ${hidden}.`
    : `${step} less than ${from} is ${hidden}.`;
  return `Each hop ${up ? 'adds' : 'takes away'} ${step}. ${reach}`;
}
