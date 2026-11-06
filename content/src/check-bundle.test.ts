import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { describe, expect, it } from 'vitest';
import { checkBundle } from './check-bundle';

describe('checkBundle', () => {
  it('summarizes the shared sample bundle', () => {
    expect(checkBundle(sample)).toEqual({
      ok: true,
      summary: 'Bundle sample-1: 3 skills, 3 nuggets, 9 items',
    });
  });

  it('lists each problem with its path', () => {
    const broken = structuredClone(sample);
    broken.skills[1].prerequisiteIds = ['k-missing'];
    expect(checkBundle(broken)).toEqual({
      ok: false,
      problems: ['skills.1.prerequisiteIds.0: Unknown prerequisite k-missing'],
    });
  });
});
