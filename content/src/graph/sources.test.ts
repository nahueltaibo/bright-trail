import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { OFFERED_SUBJECTS, SUBJECTS } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { loadAllSources, loadSources, parseSource } from './sources';

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
      'math',
    );
    expect(source).toMatchObject({
      grade: '2',
      subject: 'math',
      framework: 'ontario-math-2020',
      strands: ['B'],
    });
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

  it('reads every strand in a file, in order', () => {
    const source = parseSource(
      'grade-3.md',
      [
        '#### C1.1 Patterns',
        '**C1.1** identify patterns',
        '#### B1.1 Whole Numbers',
        '**B1.1** read numbers to 1000',
        '#### C1.2 Patterns',
        '**C1.2** extend patterns',
      ].join('\n'),
      'math',
    );
    expect(source.strands).toEqual(['C', 'B']);
    expect(source.expectations.map((e) => e.code)).toEqual(['C1.1', 'B1.1', 'C1.2']);
  });

  it('uses the Kindergarten framework for Kindergarten files', () => {
    const source = parseSource('kindergarten.md', '#### A6.1\n**A6.1** count to 20', 'math');
    expect(source).toMatchObject({ subject: 'math', framework: 'ontario-kindergarten-2026' });
  });

  it('rejects files it does not know', () => {
    expect(() => parseSource('notes.md', '', 'math')).toThrow('Unexpected source file notes.md');
  });
});

const root = join(import.meta.dirname, '../../sources');

describe('loadSources', () => {
  it('reads every official expectation, K to Grade 6', async () => {
    const sources = await loadSources(root, 'math');
    expect(sources.map((s) => [s.grade, s.strands])).toEqual([
      ['K', ['A']],
      ['1', ['B']],
      ['2', ['B']],
      ['3', ['B']],
      ['4', ['B']],
      ['5', ['B']],
      ['6', ['B']],
    ]);
    expect(sources.every((s) => s.subject === 'math')).toBe(true);
    const specific = sources.map((s) => s.expectations.filter((e) => e.kind === 'specific'));
    expect(specific.map((list) => list.length)).toEqual([13, 13, 13, 16, 17, 16, 18]);
    for (const list of specific) {
      expect(list.every((e) => e.statement.length > 0)).toBe(true);
    }
    expect(sources[0].expectations[0]).toMatchObject({ code: 'A6', kind: 'overall' });
  });
});

describe('loadAllSources', () => {
  it('gives every subject its own folder and loads the offered ones, Kindergarten to Grade 6', async () => {
    const folders = (await readdir(root, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(folders.sort()).toEqual([...SUBJECTS].sort());

    const sources = await loadAllSources(root);
    expect([...sources.keys()]).toEqual([...OFFERED_SUBJECTS]);
    for (const subject of OFFERED_SUBJECTS) {
      expect(sources.get(subject)?.map((s) => s.grade)).toEqual([
        'K',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
      ]);
      expect(sources.get(subject)?.every((s) => s.subject === subject)).toBe(true);
    }
  });

  it('names the subject whose folder is missing', async () => {
    await expect(loadSources(root, 'art' as never)).rejects.toThrow(
      'No curriculum sources for art',
    );
  });
});
