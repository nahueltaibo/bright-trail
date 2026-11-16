import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SUBJECTS } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import {
  GRAPH_SUBJECTS,
  idPrefix,
  loadAllSources,
  loadSources,
  MATH,
  parseSource,
  subjectOfId,
} from './sources';

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
      MATH,
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
      MATH,
    );
    expect(source.strands).toEqual(['C', 'B']);
    expect(source.expectations.map((e) => e.code)).toEqual(['C1.1', 'B1.1', 'C1.2']);
  });

  it('uses the Kindergarten framework for Kindergarten files', () => {
    const source = parseSource('kindergarten.md', '#### A6.1\n**A6.1** count to 20', MATH);
    expect(source).toMatchObject({ subject: 'math', framework: 'ontario-kindergarten-2026' });
  });

  it('rejects files it does not know', () => {
    expect(() => parseSource('notes.md', '', MATH)).toThrow('Unexpected source file notes.md');
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
  it('gives every subject its own folder and loads the graph subjects', async () => {
    const folders = (await readdir(root, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(folders.sort()).toEqual([...SUBJECTS].sort());

    const sources = await loadAllSources(root);
    expect([...sources.keys()]).toEqual(GRAPH_SUBJECTS.map((s) => s.subject));
    for (const [subject, list] of sources) {
      // Only math reads Kindergarten, so the other graphs start at Grade 1.
      expect(list.map((s) => s.grade)).toEqual(
        subject === 'math' ? ['K', '1', '2', '3', '4', '5', '6'] : ['1', '2', '3', '4', '5', '6'],
      );
      expect(list.every((s) => s.subject === subject)).toBe(true);
    }
    expect(sources.get('science')?.every((s) => s.strands.join() === 'A,B,C,D,E')).toBe(true);
  });

  it('names the subject whose folder is missing', async () => {
    await expect(loadSources(root, 'art' as never)).rejects.toThrow(
      'No curriculum sources for art',
    );
  });
});

describe('other subjects', () => {
  const spec = (subject: string) => GRAPH_SUBJECTS.find((s) => s.subject === subject)!;
  const file = [
    '# Grade 2',
    '## Strand A: Heritage and Identity',
    '### A1. Application: Traditions',
    '**A1.** compare traditions',
    '#### A1.1',
    '**A1.1** compare family traditions',
    '### A2. Inquiry: Past and Present',
    '**A2.** investigate traditions',
    '#### A2.1',
    '**A2.1** formulate questions',
    '## Strand C: Not Kept',
    '### C1. Something',
    '#### C1.1',
    '**C1.1** something else',
  ].join('\n');

  it('keeps the listed strands, Inquiry expectations included', () => {
    const source = parseSource('grade-2.md', file, {
      ...spec('social-studies'),
      strands: ['A'],
    });
    expect(source).toMatchObject({
      subject: 'social-studies',
      framework: 'ontario-social-studies-2026',
      strands: ['A'],
    });
    expect(source.expectations.map((e) => e.code)).toEqual(['A1', 'A1.1', 'A2', 'A2.1']);
  });

  it('marks Human Development and Sexual Health for a parent opt-in', async () => {
    const sources = await loadSources(root, 'health');
    const specific = sources.flatMap((s) => s.expectations.filter((e) => e.kind === 'specific'));
    const optIn = specific.filter((e) => e.parentOptIn === 'human-development');
    expect(optIn.length).toBeGreaterThan(0);
    expect(optIn.every((e) => /sexual health/i.test(e.topic))).toBe(true);
    expect(specific.some((e) => !e.parentOptIn && /sexual health/i.test(e.topic))).toBe(false);
    expect(sources.every((s) => s.strands.join() === 'D')).toBe(true);
  });

  it('tags ids by subject', () => {
    expect(idPrefix('3')).toBe('g3-');
    expect(idPrefix('K')).toBe('k-');
    expect(idPrefix('3', 'science')).toBe('g3-sci-');
    expect(subjectOfId('g3-sci-plant-needs')).toBe('science');
    expect(subjectOfId('g4-hlth-food-groups')).toBe('health');
    expect(subjectOfId('g3-add-within-100')).toBe('math');
  });
});
