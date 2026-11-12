import { describe, expect, it } from 'vitest';
import type { Skill } from '@bright-trail/shared';
import {
  checkContent,
  checkGraph,
  deadEnds,
  findWarnings,
  longestChain,
  reachableFromRoots,
  removeTransitivePrerequisites,
  titleWords,
} from './checks';
import { skill, tinySources, validGraph } from './fixtures';
import type { GradeSource } from './sources';

const messages = (skills = validGraph()) => checkGraph(skills, tinySources).map((p) => p.message);

describe('checkGraph', () => {
  it('passes a valid graph', () => {
    expect(messages()).toEqual([]);
  });

  it('reports schema problems from the shared schema', () => {
    const skills = validGraph();
    skills[1] = { ...skills[1], id: 'K-Bad' };
    expect(messages(skills)).toContain(
      'Schema: K-Bad: id Use a kebab-case id, e.g. "g1-add-within-10"',
    );
  });

  it('reports unknown prerequisites', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', ['k-missing'], ['B1.1']);
    expect(messages(skills)).toContain(
      'Schema: g1-read-to-50: prerequisiteIds.0 Unknown prerequisite k-missing',
    );
  });

  it('reports a cycle and the skills it cuts off', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', ['g1-add-to-10'], ['B1.1']);
    skills[3] = skill('g1-add-to-10', ['g1-read-to-50'], ['B2.1']);
    const found = messages(skills);
    expect(found).toContain('Cycle: g1-read-to-50 -> g1-add-to-10 -> g1-read-to-50');
    expect(found).toContain('g1-read-to-50: not reachable from a Kindergarten root');
    expect(found).toContain('g1-add-to-10: not reachable from a Kindergarten root');
  });

  it('reports orphans above Kindergarten', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', [], ['B1.1']);
    expect(messages(skills)).toContain(
      'g1-read-to-50: orphan, only Kindergarten skills may have no prerequisites',
    );
  });

  it('reports a prerequisite in a higher grade', () => {
    const skills = validGraph();
    skills[1] = skill('k-add-to-5', ['k-count', 'g1-read-to-50'], ['A6.2']);
    expect(messages(skills)).toContain(
      'k-add-to-5: prerequisite g1-read-to-50 is in a higher grade (1)',
    );
  });

  it('reports expectation codes missing from that grade', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', ['k-count'], ['B1.1', 'B1.9']);
    expect(messages(skills)).toContain('g1-read-to-50: expectation B1.9 is not in Grade 1');
  });

  it('reports specific expectations no skill covers', () => {
    const skills = validGraph().filter((s) => s.id !== 'g1-add-to-10');
    expect(messages(skills)).toEqual(['Expectation B2.1 (Grade 1) has no skill']);
  });

  it('reports ids without their grade prefix', () => {
    const skills = validGraph();
    skills[2] = { ...skills[2], id: 'g2-read-to-50' };
    skills[3] = { ...skills[3], prerequisiteIds: ['k-add-to-5', 'g2-read-to-50'] };
    expect(messages(skills)).toEqual(['g2-read-to-50: id must start with g1-']);
  });

  it('tags each problem with its grade', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', [], ['B1.1']);
    expect(new Set(checkGraph(skills, tinySources).map((p) => p.grade))).toEqual(new Set(['1']));
  });
});

describe('graph helpers', () => {
  it('finds everything reachable from Kindergarten roots', () => {
    expect([...reachableFromRoots(validGraph())].sort()).toEqual(
      ['g1-add-to-10', 'g1-read-to-50', 'k-add-to-5', 'k-count'].sort(),
    );
  });

  it('removes prerequisites another prerequisite already implies', () => {
    const skills = validGraph();
    skills[3] = skill('g1-add-to-10', ['k-count', 'k-add-to-5', 'g1-read-to-50'], ['B2.1']);
    const { skills: reduced, removed } = removeTransitivePrerequisites(skills);
    expect(reduced[3].prerequisiteIds).toEqual(['k-add-to-5', 'g1-read-to-50']);
    expect(removed).toEqual([
      { skillId: 'g1-add-to-10', prerequisiteId: 'k-count', via: 'k-add-to-5' },
    ]);
    expect(reduced[0]).toBe(skills[0]);
  });

  it('finds the longest chain, root first', () => {
    expect(longestChain(validGraph())).toEqual(['k-count', 'g1-read-to-50', 'g1-add-to-10']);
  });

  it('lists dead ends below Grade 6', () => {
    const skills = [...validGraph(), skill('k-coins', [], ['A6.1'])];
    expect(deadEnds(skills).map((s) => s.id)).toEqual(['g1-add-to-10', 'k-coins']);
  });
});

describe('checkContent', () => {
  const contentMessages = (skills: Skill[], sources: GradeSource[] = tinySources, allowed = {}) =>
    checkContent(skills, sources, {
      allowedTokens: new Map(
        Object.entries(allowed).map(([id, t]) => [id, new Set(t as string[])]),
      ),
    }).map((p) => p.message);
  const withText = (description: string, title = 'Count') => {
    const skills = validGraph();
    skills[0] = { ...skills[0], title, description };
    return skills;
  };

  it('passes a valid graph', () => {
    expect(contentMessages(validGraph())).toEqual([]);
  });

  it.each([
    ['Count out loud to 20.', 'out loud'],
    ['Say how much each friend gets.', 'say'],
    ['Draw a picture to share.', 'draw'],
    ['Use drawings to compare.', 'draw'],
    ['Read and write numbers.', 'write'],
    ['Add in your head, and tell how you did it.', 'tell how'],
    ['Explain your answer.', 'explain'],
    ['Show how the two match.', 'show how'],
  ])('flags risky tokens: %s', (description, token) => {
    expect(contentMessages(withText(description))).toEqual([
      `k-count: description says "${token}", which no tap, keypad, or number-line item can check`,
    ]);
  });

  it('flags risky tokens in titles', () => {
    expect(contentMessages(withText('Count.', 'Write numbers'))).toEqual([
      'k-count: title says "write", which no tap, keypad, or number-line item can check',
    ]);
  });

  it('allows "tell how many" and words that only contain a token', () => {
    expect(
      contentMessages(withText('Tell how many. Tell how much. Use the written method. An essay.')),
    ).toEqual([]);
  });

  it('allows a token the overrides allowlist for that skill', () => {
    expect(
      contentMessages(withText('Say the number.'), tinySources, { 'k-count': ['say'] }),
    ).toEqual([]);
  });

  it('limits titles to 6 words, counting a spaced number as one', () => {
    expect(titleWords('Read and build numbers to 10 000')).toBe(6);
    expect(contentMessages(withText('Count.', 'Count to 50 by 1s and 2s'))).toEqual([
      'k-count: title "Count to 50 by 1s and 2s" has more than 6 words',
    ]);
  });

  it('flags skills that cite only overall expectations', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', ['k-count'], ['B1']);
    expect(contentMessages(skills)).toEqual([
      'g1-read-to-50: cites only overall expectations (B1)',
    ]);
  });

  it('flags a grade with more skills than specific expectations', () => {
    const skills = [...validGraph(), skill('k-extra', [], ['A6.1'])];
    expect(contentMessages(skills)).toEqual([
      'Grade K has 3 skills, more than its 2 specific expectations',
    ]);
  });

  describe('multiplication needs addition below it', () => {
    const sources: GradeSource[] = [
      tinySources[0],
      {
        ...tinySources[1],
        expectations: [
          {
            code: 'B2.1',
            kind: 'specific',
            topic: 'Math Facts',
            statement: 'recall addition facts and related subtraction facts',
            details: '',
          },
          {
            code: 'B2.5',
            kind: 'specific',
            topic: 'Multiplication and Division',
            statement: 'solve equal-group problems',
            details: '',
          },
        ],
      },
    ];

    it('passes when an add/subtract skill is an ancestor', () => {
      const skills = [
        skill('k-count', [], ['A6.1']),
        skill('g1-add-facts', ['k-count'], ['B2.1']),
        skill('g1-equal-groups', ['g1-add-facts'], ['B2.5']),
      ];
      expect(contentMessages(skills, sources)).toEqual([]);
    });

    it('fails when none is', () => {
      const skills = [
        skill('k-count', [], ['A6.1']),
        skill('g1-add-facts', ['k-count'], ['B2.1']),
        skill('g1-equal-groups', ['k-count'], ['B2.5']),
      ];
      expect(contentMessages(skills, sources)).toEqual([
        'g1-equal-groups: multiplication or division with no addition or subtraction skill below it',
      ]);
    });
  });

  it('is part of checkGraph', () => {
    expect(checkGraph(withText('Draw it.'), tinySources).map((p) => p.message)).toHaveLength(1);
  });
});

describe('findWarnings', () => {
  const grade2: GradeSource = {
    grade: '2',
    subject: 'math',
    framework: 'ontario-math-2020',
    strands: ['B'],
    file: 'grade-2.md',
    expectations: [
      {
        code: 'B1.1',
        kind: 'specific',
        topic: 'Whole Numbers',
        statement: 'read to 200',
        details: '',
      },
      { code: 'B2.1', kind: 'specific', topic: 'Math Facts', statement: 'add to 20', details: '' },
    ],
  };
  const sources = [...tinySources, grade2];

  it('passes skills that reach the grade before in the same topic', () => {
    const skills = [...validGraph(), skill('g2-add-to-20', ['g1-add-to-10'], ['B2.1'])];
    expect(findWarnings(skills, sources)).toEqual([]);
  });

  it('warns when a skill skips its topic in the grade before', () => {
    const skills = [...validGraph(), skill('g2-add-to-20', ['g1-read-to-50'], ['B2.1'])];
    expect(findWarnings(skills, sources).map((w) => w.message)).toEqual([
      'g2-add-to-20: reaches no Grade 1 skill in the same topic',
    ]);
  });
});

describe('checkGraph on a subject that starts at Grade 1', () => {
  const sources: GradeSource[] = [1, 2].map((n) => ({
    grade: String(n) as Skill['grade'],
    subject: 'science',
    framework: 'ontario-science-2022',
    strands: ['B'],
    file: `grade-${n}.md`,
    expectations: [{ code: 'B1.1', kind: 'specific', topic: '', statement: 'plants', details: '' }],
  }));
  const sci = (id: string, prerequisiteIds: string[] = []): Skill => ({
    ...skill(id, prerequisiteIds, ['B1.1']),
    subject: 'science',
    framework: 'ontario-science-2022',
    grade: id[1] as Skill['grade'],
  });

  it('roots at Grade 1 and wants the subject tag', () => {
    const skills = [sci('g1-sci-plants'), sci('g2-sci-plant-parts', ['g1-sci-plants'])];
    expect(checkGraph(skills, sources).map((p) => p.message)).toEqual([]);
    expect(findWarnings(skills, sources)).toEqual([]);
  });

  it('reports a Grade 2 orphan and a missing tag', () => {
    const found = checkGraph([sci('g1-sci-plants'), sci('g2-plant-parts')], sources).map(
      (p) => p.message,
    );
    expect(found).toContain('g2-plant-parts: id must start with g2-sci-');
    expect(found).toContain(
      'g2-plant-parts: orphan, only Grade 1 skills may have no prerequisites',
    );
  });
});
