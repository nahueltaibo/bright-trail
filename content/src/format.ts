import type { Greeting } from '@bright-trail/shared';

export function formatGreeting(greeting: Greeting): string {
  return `[content] ${greeting.message}`;
}
