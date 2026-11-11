import { describe, expect, it } from 'vitest';
import { packId, packsFor } from './packs';

describe('packId', () => {
  it('names a pack by subject and lower-case grade', () => {
    expect(packId('math', 'K')).toBe('math-k');
    expect(packId('math', '3')).toBe('math-3');
  });
});

describe('packsFor', () => {
  const grades = ['K', '1', '2', '3', '4', '5'] as const;
  const available = grades.map((grade) => ({
    id: packId('math', grade),
    subject: 'math' as const,
    grade,
  }));

  it('takes the child grade and one either side', () => {
    expect(packsFor({ subjects: ['math'], grade: '3' }, available)).toEqual([
      'math-2',
      'math-3',
      'math-4',
    ]);
  });

  it('starts JK and SK at Kindergarten', () => {
    expect(packsFor({ subjects: ['math'], grade: 'JK' }, available)).toEqual(['math-k', 'math-1']);
  });

  it('keeps to the packs that exist', () => {
    expect(packsFor({ subjects: ['math'], grade: '7' }, available)).toEqual([]);
    expect(packsFor({ subjects: ['math'], grade: '6' }, available)).toEqual(['math-5']);
  });

  it('adds extra grades, like ones where the child has gaps', () => {
    expect(packsFor({ subjects: ['math'], grade: '5' }, available, ['1'])).toEqual([
      'math-1',
      'math-4',
      'math-5',
    ]);
  });

  it('skips subjects the child does not learn', () => {
    expect(packsFor({ subjects: [], grade: '3' }, available)).toEqual([]);
  });
});
