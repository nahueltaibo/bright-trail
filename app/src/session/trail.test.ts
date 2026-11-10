import type { MasteryState, MasteryStatus } from '@bright-trail/shared';
import { buildTrail, countStars } from './trail';

const skills = [
  { id: 'a', grade: 'K' as const, prerequisiteIds: [], title: 'Count to 10' },
  { id: 'b', grade: 'K' as const, prerequisiteIds: ['a'], title: 'Count to 20' },
  { id: 'c', grade: '1' as const, prerequisiteIds: ['b'], title: 'Ten-frames' },
  { id: 'd', grade: '1' as const, prerequisiteIds: ['b'], title: 'Teen numbers' },
  { id: 'e', grade: '1' as const, prerequisiteIds: ['c'], title: 'Count to 50' },
];

function row(
  skillId: string,
  status: MasteryStatus,
  updatedAt = '2026-11-01T10:00:00.000Z',
  nextReviewOn: string | null = null,
): MasteryState {
  return {
    childId: 'kid',
    skillId,
    status,
    checkAnswered: 0,
    checkCorrect: 0,
    failedChecks: 0,
    reviewsPassed: 0,
    nextReviewOn,
    updatedAt,
  };
}

const TODAY = '2026-11-09';

describe('buildTrail', () => {
  it('shows a start stone before placement finishes', () => {
    const trail = buildTrail(skills, [], false, TODAY);
    expect(trail.mode).toBe('new');
    expect(trail.stops[0]).toEqual({ title: 'Start here', state: 'next' });
    expect(trail.stops.at(-1)?.state).toBe('locked');
  });

  it('walks stars in mastery order, then next, ahead, and locked', () => {
    const trail = buildTrail(
      skills,
      [row('b', 'mastered', '2026-11-03T00:00:00.000Z'), row('a', 'mastered')],
      true,
      TODAY,
    );
    expect(trail.mode).toBe('returning');
    expect(trail.stops).toEqual([
      { title: 'Count to 10', state: 'mastered' },
      { title: 'Count to 20', state: 'mastered' },
      { title: 'Ten-frames', state: 'next' },
      { title: 'Teen numbers', state: 'ahead' },
      { title: 'Count to 50', state: 'locked' },
    ]);
  });

  it('marks a due review and switches to review mode', () => {
    const trail = buildTrail(
      skills,
      [
        row('a', 'mastered', undefined, '2026-11-05'),
        row('b', 'mastered', '2026-11-02T00:00:00.000Z'),
      ],
      true,
      TODAY,
    );
    expect(trail.mode).toBe('review');
    expect(trail.stops[0]).toEqual({ title: 'Count to 10', state: 'review' });
    expect(trail.stops[2]).toEqual({ title: 'Ten-frames', state: 'next' });
  });

  it('counts assumed skills as open prerequisites without drawing them', () => {
    const trail = buildTrail(skills, [row('a', 'assumed'), row('b', 'assumed')], true, TODAY);
    expect(trail.stops.map((s) => s.state)).toEqual(['next', 'ahead', 'locked']);
  });
});

describe('countStars', () => {
  it('counts mastered skills and due reviews', () => {
    expect(countStars([row('a', 'mastered'), row('b', 'review-due'), row('c', 'learning')])).toBe(
      2,
    );
  });
});
