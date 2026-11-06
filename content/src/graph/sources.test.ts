import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSources, parseSource } from './sources';

describe('parseSource', () => {
  it('reads overall and specific expectations with their details', () => {
    const source = parseSource(
      'grade-2.md',
      [
        '# Grade 2',
        '## B1. Number Sense',
        '**B1.** understand numbers',
        '### Specific expectations',
        '#### B1.1 Whole Numbers',
        '**B1.1** read numbers to 200',
        '**Examples**',
        '- 135',
        '## B2. Operations',
      ].join('\n'),
    );
    expect(source).toMatchObject({ grade: '2', framework: 'ontario-math-2020', strand: 'B' });
    expect(source.expectations).toEqual([
      { code: 'B1', kind: 'overall', topic: '', statement: 'understand numbers', details: '' },
      {
        code: 'B1.1',
        kind: 'specific',
        topic: 'Whole Numbers',
        statement: 'read numbers to 200',
        details: '**Examples**\n- 135',
      },
    ]);
  });

  it('rejects files it does not know', () => {
    expect(() => parseSource('notes.md', '')).toThrow('Unexpected source file notes.md');
  });
});

describe('loadSources', () => {
  it('reads every official expectation, K to Grade 6', async () => {
    const sources = await loadSources(join(import.meta.dirname, '../../sources'));
    expect(sources.map((s) => [s.grade, s.strand])).toEqual([
      ['K', 'A'],
      ['1', 'B'],
      ['2', 'B'],
      ['3', 'B'],
      ['4', 'B'],
      ['5', 'B'],
      ['6', 'B'],
    ]);
    const specific = sources.map((s) => s.expectations.filter((e) => e.kind === 'specific'));
    expect(specific.map((list) => list.length)).toEqual([13, 13, 13, 16, 17, 16, 18]);
    for (const list of specific) {
      expect(list.every((e) => e.statement.length > 0)).toBe(true);
    }
    expect(sources[0].expectations[0]).toMatchObject({ code: 'A6', kind: 'overall' });
  });
});
