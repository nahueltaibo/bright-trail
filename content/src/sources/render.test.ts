import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRICULA, KINDERGARTEN_MATH, KINDERGARTEN_SPLIT } from './curricula';
import {
  checkKindergartenSplit,
  kindergartenStrands,
  overallCodes,
  planCourses,
  renderGrade,
  renderKindergarten,
  type ApiItem,
  type ApiResponse,
} from './render';

const science = CURRICULA.find((c) => c.subject === 'science')!;
const french = CURRICULA.find((c) => c.subject === 'french')!;

function item(codename: string, type: string, elements: Record<string, unknown>): ApiItem {
  return {
    system: { codename, type, name: codename },
    elements: Object.fromEntries(
      Object.entries(elements).map(([k, value]) => [
        k,
        { type: Array.isArray(value) ? 'modular_content' : 'text', value },
      ]),
    ),
  };
}

function response(root: ApiItem, others: ApiItem[]): ApiResponse {
  return {
    item: root,
    modular_content: Object.fromEntries(others.map((i) => [i.system.codename, i])),
  };
}

const course = (codename: string, grade: string, sections: string[], program?: string) =>
  item(codename, 'l2___course', {
    name: 'Science and Technology',
    site___grade: [{ name: grade, codename: `n${grade}` }],
    site___language_program: program ? [{ name: program, codename: program }] : [],
    sections,
  });
const strandsSection = (codename: string) =>
  item(codename, 'ui___content_collection', { url_slug: 'strands' });
const parents = (codename: string) => item(codename, 'ui___generic_content', { url_slug: '' });

describe('planCourses', () => {
  const top = (year: string, courses: ApiItem[], sections: ApiItem[]) =>
    response(
      item('cur', 'l1___curriculum', {
        monarchs_printer_year: year,
        specific_courses: courses.map((c) => c.system.codename),
      }),
      [...courses, ...sections],
    );

  it('maps Grade 1–6 courses to their strands, skipping Grades 7 and 8', () => {
    const plans = planCourses(
      top(
        '2022',
        [
          course('g3', '3', ['info', 'g3-strands']),
          course('g1', '1', ['g1-strands']),
          course('g7', '7', ['g7-strands']),
        ],
        [strandsSection('g3-strands'), strandsSection('g1-strands'), parents('info')],
      ),
      science,
    );
    expect(plans).toEqual([
      {
        grade: '1',
        program: undefined,
        name: 'Science and Technology',
        strands: 'g1-strands',
        file: 'grade-1.md',
      },
      {
        grade: '3',
        program: undefined,
        name: 'Science and Technology',
        strands: 'g3-strands',
        file: 'grade-3.md',
      },
    ]);
  });

  it('keeps only the immersion FSL program, with its prefix', () => {
    const plans = planCourses(
      top(
        '2013',
        [
          course('c4', '4', ['c4-s'], 'core_french'),
          course('i1', '1', ['i1-s'], 'french_immersion'),
        ],
        [strandsSection('c4-s'), strandsSection('i1-s')],
      ),
      french,
    );
    expect(plans.map((p) => p.file)).toEqual(['immersion-grade-1.md']);
  });

  it('stops when the Ministry publishes a newer curriculum', () => {
    expect(() => planCourses(top('2027', [], []), science)).toThrow(
      'science is now the 2027 curriculum, not 2022. Add a framework for it.',
    );
  });
});

describe('renderGrade', () => {
  const strands = response(
    item('g3-strands', 'ui___content_collection', { sections: ['strand-b', 'callout'] }),
    [
      item('callout', 'ui___generic_content', {}),
      item('strand-b', 'l3___strand', {
        title_index: 'B',
        title: 'Life Systems',
        why_is_this_learning_important: ['why'],
        description: [],
        overall_expectations: ['b1'],
      }),
      item('why', 'ui___generic_content', { content: '<p>Plants matter.</p>' }),
      item('b1', 'l4___overall_expectation', {
        title_index: ' B1',
        title: 'Relating Science',
        content: '<p>assess ways plants help</p>',
        specific_expectations: ['b1-1', 'link'],
      }),
      item('link', 'ui___generic_content', { content: '<p>See the continuum</p>' }),
      item('b1-1', 'l5___specific_expectation', {
        title_index: 'B1.1',
        title: 'Plants',
        content: '<p>describe how <em>plants</em> grow</p>',
        elaborations: ['examples', 'prompts'],
        non_curriculum_elaborations: ['more'],
      }),
      item('examples', 'elaborations', {
        pedagogical_supports: [{ name: 'Examples | Exemples', codename: 'examples' }],
        elaboration: '<ul><li>roots</li></ul>',
      }),
      item('prompts', 'elaborations', {
        pedagogical_supports: [{ name: 'Teacher Prompts | x', codename: 'tp' }],
        elaboration: '<p>Ask a question</p>',
      }),
      item('more', 'ui___content_collection', { sections: ['skills'] }),
      item('skills', 'elaborations', {
        pedagogical_supports: [{ name: 'Knowledge and skills | Connaissances', codename: 'ks' }],
        elaboration: '<p>Naming parts</p>',
      }),
    ],
  );

  it('writes strands, expectations, and kept elaborations', () => {
    const md = renderGrade(strands, {
      curriculum: science,
      plan: {
        grade: '3',
        name: 'Science and Technology',
        strands: 'g3-strands',
        file: 'grade-3.md',
      },
      retrieved: '2026-11-12',
    });
    expect(md.split('\n').slice(0, 2)).toEqual(['# Grade 3 Science and Technology', '']);
    expect(md).toContain('- **Retrieved:** 2026-11-12');
    expect(md.slice(md.indexOf('## Strand B'))).toBe(
      [
        '## Strand B: Life Systems',
        '',
        '### Why is this learning important?',
        '',
        'Plants matter.',
        '',
        '### B1. Relating Science',
        '',
        '**B1.** assess ways plants help',
        '',
        '#### B1.1 Plants',
        '',
        '**B1.1** describe how *plants* grow',
        '',
        '**Examples**',
        '',
        '- roots',
        '',
        '**Knowledge and skills**',
        '',
        'Naming parts',
        '',
      ].join('\n'),
    );
  });
});

describe('kindergartenStrands', () => {
  const course = (year: string) =>
    response(
      item('kindergarten', 'l2___course', { year_issued: year, sections: ['glance', 'ks'] }),
      [parents('glance'), strandsSection('ks')],
    );

  it('finds the strands section', () => {
    expect(kindergartenStrands(course('2026'))).toBe('ks');
  });

  it('stops when the Ministry publishes a newer curriculum', () => {
    expect(() => kindergartenStrands(course('2030'))).toThrow(
      'Kindergarten is now the 2030 curriculum, not 2026. Add a framework for it.',
    );
  });
});

describe('checkKindergartenSplit', () => {
  const filed = [...Object.values(KINDERGARTEN_SPLIT).flat(), ...KINDERGARTEN_MATH];

  it('accepts the codes the split files', () => {
    expect(() => checkKindergartenSplit(filed)).not.toThrow();
  });

  it('stops on a code no subject files', () => {
    expect(() => checkKindergartenSplit([...filed, 'D26'])).toThrow(
      'Kindergarten has new overall expectations D26. File them in KINDERGARTEN_SPLIT.',
    );
  });

  it('stops on a filed code the curriculum dropped', () => {
    expect(() => checkKindergartenSplit(filed.filter((c) => c !== 'B12'))).toThrow(
      'Kindergarten no longer has B12',
    );
  });
});

describe('renderKindergarten', () => {
  const overall = (codename: string, code: string, specifics: string[]) =>
    item(codename, 'l4___overall_expectation', {
      title_index: code,
      title: `Title ${code}`,
      content: `<p>do ${code}</p>`,
      specific_expectations: specifics,
    });
  const specific = (codename: string, code: string) =>
    item(codename, 'l5___specific_expectation', {
      title_index: code,
      title: '',
      content: `<p>do ${code}</p>`,
      elaborations: [],
    });
  const strand = (codename: string, letter: string, overalls: string[]) =>
    item(codename, 'l3___strand', {
      title_index: letter,
      title: `Strand ${letter} title`,
      why_is_this_learning_important: [],
      description: [],
      overall_expectations: overalls,
    });
  const strands = response(item('ks', 'ui___content_collection', { sections: ['c', 'd'] }), [
    strand('c', 'C', ['c14']),
    overall('c14', 'C14', ['c14-1']),
    specific('c14-1', 'C14.1'),
    strand('d', 'D', ['d23', 'd24', 'd25']),
    overall('d23', 'D23', ['d23-1']),
    specific('d23-1', 'D23.1'),
    overall('d24', 'D24', ['d24-1']),
    specific('d24-1', 'D24.1'),
    overall('d25', 'D25', []),
  ]);

  it("keeps only the subject's overall expectations and their strand", () => {
    const md = renderKindergarten(strands, {
      subject: 'arts',
      strands: 'ks',
      retrieved: '2026-11-12',
    });
    expect(md.split('\n')[0]).toBe('# Kindergarten: Arts Expectations');
    expect(md).toContain('*Kindergarten Curriculum (2026)*, overall expectations D24–D25');
    expect(md.slice(md.indexOf('## Strand'))).toBe(
      [
        '## Strand D: Strand D title',
        '',
        '### D24. Title D24',
        '',
        '**D24.** do D24',
        '',
        '#### D24.1',
        '',
        '**D24.1** do D24.1',
        '',
        '### D25. Title D25',
        '',
        '**D25.** do D25',
        '',
      ].join('\n'),
    );
  });

  it('lists overall codes in page order', () => {
    expect(overallCodes(strands)).toEqual(['C14', 'D23', 'D24', 'D25']);
  });
});

describe('fetched Kindergarten files', () => {
  const sources = join(import.meta.dirname, '../../sources');

  it.each(Object.entries(KINDERGARTEN_SPLIT))(
    '%s holds exactly its codes',
    async (subject, codes) => {
      const md = await readFile(join(sources, subject, 'kindergarten.md'), 'utf8');
      const found = [...md.matchAll(/^### ([A-Z]\d+)\. /gm)].map((m) => m[1]);
      expect(found).toEqual(codes);
    },
  );
});
