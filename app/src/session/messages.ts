import type { EndReason } from './controller';

/** What the end screen shows and says. No scores, just a friendly stop. */
export const END_MESSAGES: Record<EndReason, { title: string; body: string }> = {
  'placement-break': {
    title: 'Good stopping spot!',
    body: 'Your place is saved. We’ll keep going next time.',
  },
  'time-up': { title: 'See you tomorrow!', body: 'Time’s up for today. Great work!' },
  'done-for-today': {
    title: 'See you tomorrow!',
    body: 'Great work today. Your trail is getting brighter.',
  },
  'all-done': { title: 'You did it!', body: 'You walked the whole trail. Amazing!' },
};
