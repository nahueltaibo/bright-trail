import { describe, expect, it } from 'vitest';
import { greet } from './index';

describe('greet', () => {
  it('addresses the learner by name', () => {
    expect(greet('Ana')).toEqual({
      learnerName: 'Ana',
      message: 'Hi Ana, welcome to BrightTrail!',
    });
  });
});
