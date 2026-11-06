import { greet } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { formatGreeting } from './format';

describe('formatGreeting', () => {
  it('formats a shared Greeting', () => {
    expect(formatGreeting(greet('Leo'))).toBe('[content] Hi Leo, welcome to BrightTrail!');
  });
});
