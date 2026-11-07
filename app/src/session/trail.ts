import type { MasteryState } from '@bright-trail/shared';

/** One star per mastered skill, a due review included. Placement-proven skills count too. */
export function countStars(mastery: Iterable<Pick<MasteryState, 'status'>>): number {
  let stars = 0;
  for (const m of mastery) if (m.status === 'mastered' || m.status === 'review-due') stars++;
  return stars;
}
