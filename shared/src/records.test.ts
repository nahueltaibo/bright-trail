import { describe, expect, it } from 'vitest';
import { AttemptSchema } from './attempt';
import { ChildProfileSchema } from './child';
import { MasteryStateSchema } from './mastery';
import { SkillSchema } from './skill';

describe('SkillSchema', () => {
  const skill = {
    id: 'g1-numbers-to-50',
    subject: 'math',
    framework: 'ontario-math-2020',
    grade: '1',
    strand: 'B',
    expectationCodes: ['B1.1'],
    title: 'Numbers to 50',
    description: 'Read and count numbers up to 50.',
    prerequisiteIds: [],
  };

  it('accepts a valid skill', () => {
    expect(SkillSchema.safeParse(skill).success).toBe(true);
  });

  it('rejects an expectation from another strand', () => {
    expect(SkillSchema.safeParse({ ...skill, expectationCodes: ['A6.4'] }).success).toBe(false);
  });

  it('rejects a Kindergarten framework on a Grade 1 skill', () => {
    expect(
      SkillSchema.safeParse({ ...skill, framework: 'ontario-kindergarten-2026' }).success,
    ).toBe(false);
  });
});

describe('MasteryStateSchema', () => {
  const state = {
    childId: 'mia',
    skillId: 'g1-numbers-to-50',
    status: 'learning',
    checkAnswered: 3,
    checkCorrect: 2,
    failedChecks: 1,
    reviewsPassed: 0,
    nextReviewOn: null,
    updatedAt: '2026-11-06T15:00:00-05:00',
  };

  it('accepts a check in progress', () => {
    expect(MasteryStateSchema.safeParse(state).success).toBe(true);
  });

  it('rejects more right answers than answered', () => {
    expect(MasteryStateSchema.safeParse({ ...state, checkCorrect: 4 }).success).toBe(false);
  });
});

describe('AttemptSchema', () => {
  it('accepts a flat attempt that survives a JSON round trip', () => {
    const attempt = {
      childId: 'mia',
      skillId: 'g1-numbers-to-50',
      itemId: 'g1-numbers-to-50-tap-1',
      answer: 'b',
      correct: true,
      timeToAnswerMs: 4200,
      narrationReplays: 1,
      sessionId: '6f1c2b1e-3a4d-4c55-9a0e-2f3b4c5d6e7f',
      phase: 'check',
      timestamp: '2026-11-06T20:00:00Z',
    };
    expect(AttemptSchema.parse(JSON.parse(JSON.stringify(attempt)))).toEqual(attempt);
  });
});

describe('ChildProfileSchema', () => {
  it('makes the grade override optional', () => {
    const child = {
      id: 'mia',
      firstName: 'Mia',
      birthdate: '2020-03-15',
      avatar: 'fox',
      readingMode: false,
      dyslexicFont: false,
    };
    expect(ChildProfileSchema.safeParse(child).success).toBe(true);
    expect(ChildProfileSchema.safeParse({ ...child, gradeOverride: 'SK' }).success).toBe(true);
    expect(ChildProfileSchema.safeParse({ ...child, gradeOverride: 'K' }).success).toBe(false);
  });
});
