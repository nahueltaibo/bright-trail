import type { Skill } from '@bright-trail/shared';
import type { GradeSource } from './sources';

/** Small K and Grade 1 sources for tests. */
export const tinySources: GradeSource[] = [
  {
    grade: 'K',
    subject: 'math',
    framework: 'ontario-kindergarten-2026',
    strand: 'A',
    file: 'kindergarten.md',
    expectations: [
      { code: 'A6', kind: 'overall', topic: '', statement: 'use numbers', details: '' },
      { code: 'A6.1', kind: 'specific', topic: '', statement: 'count to 20', details: '' },
      { code: 'A6.2', kind: 'specific', topic: '', statement: 'add to 5', details: '' },
    ],
  },
  {
    grade: '1',
    subject: 'math',
    framework: 'ontario-math-2020',
    strand: 'B',
    file: 'grade-1.md',
    expectations: [
      { code: 'B1', kind: 'overall', topic: '', statement: 'number sense', details: '' },
      {
        code: 'B1.1',
        kind: 'specific',
        topic: 'Whole Numbers',
        statement: 'read to 50',
        details: '',
      },
      { code: 'B2.1', kind: 'specific', topic: 'Math Facts', statement: 'add to 10', details: '' },
    ],
  },
];

export function skill(id: string, prerequisiteIds: string[] = [], codes?: string[]): Skill {
  const kindergarten = id.startsWith('k-');
  const grade = kindergarten ? 'K' : (id[1] as Skill['grade']);
  return {
    id,
    subject: 'math',
    framework: kindergarten ? 'ontario-kindergarten-2026' : 'ontario-math-2020',
    grade,
    strand: kindergarten ? 'A' : 'B',
    expectationCodes: codes ?? [kindergarten ? 'A6.1' : 'B1.1'],
    title: id,
    description: `Practise ${id}.`,
    prerequisiteIds,
  };
}

/** A valid graph over `tinySources`. */
export function validGraph(): Skill[] {
  return [
    skill('k-count', [], ['A6.1']),
    skill('k-add-to-5', ['k-count'], ['A6.2']),
    skill('g1-read-to-50', ['k-count'], ['B1.1']),
    skill('g1-add-to-10', ['k-add-to-5', 'g1-read-to-50'], ['B2.1']),
  ];
}
