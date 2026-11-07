import type { EndReason } from './controller';

/** What the end screen shows and says. No scores, just a friendly stop. */
export const END_MESSAGES: Record<EndReason, string> = {
  'placement-break': "Great work! That's all for today. We'll keep going next time.",
  'time-up': "Time's up for today. Great work!",
  'done-for-today': 'Great work today! See you next time.',
  'all-done': 'You did everything on the trail. Amazing!',
};
