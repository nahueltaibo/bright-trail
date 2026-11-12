import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tinySources } from './fixtures';
import { withDiskCache, type LlmClient, type LlmRequest } from './llm';
import type { Override } from './overrides';
import { buildGraph, mergeBuilds } from './pipeline';
import { GENERATOR_MODEL, REVIEWER_MODEL, type GeneratedSkills, type Review } from './prompts';
import { renderReport } from './report';

type Generated = GeneratedSkills['skills'][number];
const gen = (id: string, codes: string[], prerequisiteIds: string[] = []): Generated => ({
  id,
  title: id,
  description: `Practise ${id}.`,
  expectationCodes: codes,
  prerequisiteIds,
});
const noChanges: Review = { corrections: [], notes: '' };

/** Answers by grade and tool, and records every request. */
class FakeLlm implements LlmClient {
  requests: LlmRequest[] = [];
  constructor(
    private readonly answers: {
      generate: Record<string, GeneratedSkills[]>;
      review?: Record<string, Review>;
    },
  ) {}

  async call(request: LlmRequest): Promise<unknown> {
    this.requests.push(request);
    const grade = /Write the skills for (Kindergarten|Grade (\d))/.exec(request.prompt);
    const reviewGrade = /Review the proposed (Kindergarten|Grade (\d))/.exec(request.prompt);
    const key = (m: RegExpExecArray) => m[2] ?? 'K';
    if (request.tool.name === 'submit_review') {
      return this.answers.review?.[key(reviewGrade!)] ?? noChanges;
    }
    const queue = this.answers.generate[key(grade!)];
    // Each generate or repair call for a grade takes the next answer; the last one repeats.
    return queue.length > 1 ? queue.shift() : queue[0];
  }
}

const kSkills: GeneratedSkills = {
  skills: [gen('k-count', ['A6.1']), gen('k-add-to-5', ['A6.2'], ['k-count'])],
};
const g1Skills: GeneratedSkills = {
  skills: [
    gen('g1-read-to-50', ['B1.1'], ['k-count']),
    gen('g1-add-to-10', ['B2.1'], ['k-count', 'k-add-to-5', 'g1-read-to-50']),
  ],
};

describe('buildGraph', () => {
  it('builds grade by grade with the right models and earlier skills in context', async () => {
    const llm = new FakeLlm({ generate: { K: [kSkills], '1': [g1Skills] } });
    const build = await buildGraph(tinySources, llm);

    expect(build.problems).toEqual([]);
    expect(llm.requests.map((r) => [r.model, r.tool.name])).toEqual([
      [GENERATOR_MODEL, 'submit_skills'],
      [REVIEWER_MODEL, 'submit_review'],
      [GENERATOR_MODEL, 'submit_skills'],
      [REVIEWER_MODEL, 'submit_review'],
    ]);
    expect(llm.requests[0].prompt).toContain('There are no earlier grades');
    expect(llm.requests[2].prompt).toContain('- k-add-to-5 [A6.2]');
    expect(build.skills.find((s) => s.id === 'g1-read-to-50')).toMatchObject({
      subject: 'math',
      framework: 'ontario-math-2020',
      grade: '1',
      strand: 'B',
    });
  });

  it('gives each skill the strand of its codes', async () => {
    const [k, g1] = tinySources;
    const twoStrands = {
      ...g1,
      strands: ['B', 'C'],
      expectations: [
        ...g1.expectations,
        { code: 'C1.1', kind: 'specific' as const, topic: '', statement: 'patterns', details: '' },
      ],
    };
    const g1Patterns = gen('g1-patterns', ['C1.1'], ['k-count']);
    const llm = new FakeLlm({
      generate: { K: [kSkills], '1': [{ skills: [...g1Skills.skills, g1Patterns] }] },
    });
    const build = await buildGraph([k, twoStrands], llm);

    expect(build.problems).toEqual([]);
    expect(llm.requests[2].prompt).toContain('Grade 1 expectations (strand B, C)');
    expect(build.skills.find((s) => s.id === 'g1-read-to-50')?.strand).toBe('B');
    expect(build.skills.find((s) => s.id === 'g1-patterns')?.strand).toBe('C');
  });

  it('sends a skill citing two strands back for repair', async () => {
    const [k, g1] = tinySources;
    const twoStrands = {
      ...g1,
      strands: ['B', 'C'],
      expectations: [
        ...g1.expectations,
        { code: 'C1.1', kind: 'specific' as const, topic: '', statement: 'patterns', details: '' },
      ],
    };
    const mixed = gen('g1-patterns', ['B2.1', 'C1.1'], ['k-count']);
    const fixed = gen('g1-patterns', ['C1.1'], ['k-count']);
    const llm = new FakeLlm({
      generate: {
        K: [kSkills],
        '1': [{ skills: [...g1Skills.skills, mixed] }, { skills: [...g1Skills.skills, fixed] }],
      },
    });
    const build = await buildGraph([k, twoStrands], llm);

    expect(build.problems).toEqual([]);
    expect(build.grades.find((g) => g.grade === '1')?.repairs).toBe(1);
  });

  it('drops transitive prerequisites', async () => {
    const llm = new FakeLlm({ generate: { K: [kSkills], '1': [g1Skills] } });
    const build = await buildGraph(tinySources, llm);
    expect(build.skills.find((s) => s.id === 'g1-add-to-10')?.prerequisiteIds).toEqual([
      'k-add-to-5',
      'g1-read-to-50',
    ]);
    expect(build.removedTransitive).toEqual([
      { skillId: 'g1-add-to-10', prerequisiteId: 'k-count', via: 'k-add-to-5' },
    ]);
  });

  it('applies reviewer corrections and rejects ones about unknown skills', async () => {
    const review: Review = {
      notes: 'One fix.',
      corrections: [
        {
          skillId: 'g1-read-to-50',
          changePrerequisites: true,
          prerequisiteIds: ['k-add-to-5'],
          title: 'Read numbers to 50',
          description: '',
          reason: 'Reading builds on adding.',
        },
        {
          skillId: 'g1-unknown',
          changePrerequisites: false,
          prerequisiteIds: [],
          title: 'x',
          description: '',
          reason: 'Typo.',
        },
        {
          skillId: 'g1-add-to-10',
          changePrerequisites: true,
          prerequisiteIds: ['g2-later'],
          title: '',
          description: '',
          reason: 'Bad id.',
        },
      ],
    };
    const llm = new FakeLlm({
      generate: { K: [kSkills], '1': [g1Skills] },
      review: { '1': review },
    });
    const build = await buildGraph(tinySources, llm);

    expect(build.skills.find((s) => s.id === 'g1-read-to-50')).toMatchObject({
      title: 'Read numbers to 50',
      description: 'Practise g1-read-to-50.',
      prerequisiteIds: ['k-add-to-5'],
    });
    const log = build.grades.find((g) => g.grade === '1')!;
    expect(log.applied.map((c) => c.skillId)).toEqual(['g1-read-to-50']);
    expect(log.rejected.map((r) => r.why)).toEqual([
      'g1-unknown is not a skill of this grade',
      'unknown or self prerequisites: g2-later',
    ]);
  });

  it('sends check problems back to the generator until they clear', async () => {
    const orphaned: GeneratedSkills = {
      skills: [gen('g1-read-to-50', ['B1.1']), gen('g1-add-to-10', ['B2.1'], ['g1-read-to-50'])],
    };
    const llm = new FakeLlm({ generate: { K: [kSkills], '1': [orphaned, g1Skills] } });
    const build = await buildGraph(tinySources, llm);

    expect(build.problems).toEqual([]);
    expect(build.grades.map((g) => g.repairs)).toEqual([0, 1]);
    const repair = llm.requests[4];
    expect(repair.model).toBe(GENERATOR_MODEL);
    expect(repair.prompt).toContain(
      '- g1-read-to-50: orphan, only Kindergarten skills may have no prerequisites',
    );
  });

  it('stops after the repair limit and returns the remaining problems', async () => {
    const missing: GeneratedSkills = { skills: [gen('g1-read-to-50', ['B1.1'], ['k-count'])] };
    const llm = new FakeLlm({ generate: { K: [kSkills], '1': [missing] } });
    const build = await buildGraph(tinySources, llm, { maxRepairs: 1 });

    expect(build.grades[1].repairs).toBe(1);
    expect(build.problems.map((p) => p.message)).toEqual([
      'Expectation B2.1 (Grade 1) has no skill',
    ]);
    expect(renderReport(build)).toContain("**1 problem left, so `skills.json` wasn't written.**");
  });

  it('applies overrides before pruning and checks, without repair calls', async () => {
    const risky: GeneratedSkills = {
      skills: [
        { ...gen('k-count', ['A6.1']), description: 'Count out loud.' },
        gen('k-add-to-5', ['A6.2'], ['k-count']),
      ],
    };
    const llm = new FakeLlm({ generate: { K: [risky], '1': [g1Skills] } });
    const overrides: Override[] = [
      {
        op: 'setDescription',
        skillId: 'k-count',
        description: 'What comes next?',
        reason: 'r',
      },
      {
        op: 'protectPrerequisite',
        skillId: 'g1-add-to-10',
        prerequisiteId: 'k-count',
        reason: 'r',
      },
    ];
    const build = await buildGraph(tinySources, llm, { overrides });

    expect(build.problems).toEqual([]);
    expect(llm.requests).toHaveLength(4);
    expect(build.removedTransitive).toEqual([]);
    expect(build.skills.find((s) => s.id === 'g1-add-to-10')?.prerequisiteIds).toContain('k-count');
    expect(renderReport(build)).toContain('## Overrides Applied');
  });

  it('fails the build on content problems the overrides leave', async () => {
    const risky: GeneratedSkills = {
      skills: [
        { ...gen('k-count', ['A6.1']), description: 'Count out loud.' },
        gen('k-add-to-5', ['A6.2'], ['k-count']),
      ],
    };
    const llm = new FakeLlm({ generate: { K: [risky], '1': [g1Skills] } });
    const build = await buildGraph(tinySources, llm);
    expect(llm.requests).toHaveLength(4);
    expect(build.problems.map((p) => p.message)).toEqual([
      'k-count: description says "out loud", which no tap, keypad, or number-line item can check',
    ]);
  });

  it('rejects malformed model output', async () => {
    const llm: LlmClient = { call: async () => ({ skills: [{ id: 'k-count' }] }) };
    await expect(buildGraph(tinySources, llm)).rejects.toThrow(/bad submit_skills input/);
  });
});

describe('mergeBuilds', () => {
  it('joins builds and flags a skill id two subjects share', async () => {
    const build = await buildGraph(
      tinySources,
      new FakeLlm({ generate: { K: [kSkills], '1': [g1Skills] } }),
    );
    expect(mergeBuilds([build])).toEqual(build);

    const merged = mergeBuilds([build, build]);
    expect(merged.skills).toHaveLength(build.skills.length * 2);
    expect(merged.grades).toHaveLength(4);
    expect(merged.problems.map((p) => p.message)).toEqual(
      build.skills.map((s) => `${s.id} is in two subjects`),
    );
  });
});

describe('renderReport', () => {
  it('summarizes counts, roots, and the longest chain', async () => {
    const llm = new FakeLlm({ generate: { K: [kSkills], '1': [g1Skills] } });
    const report = renderReport(await buildGraph(tinySources, llm));
    expect(report).toContain('**All checks pass.** 4 skills');
    expect(report).toContain('| K | 2 | 0 | 0 | 0 |');
    expect(report).toContain('**Roots:** `k-count`');
    expect(report).toContain(
      '**Longest chain (3 skills):** `k-count` → `g1-read-to-50` → `g1-add-to-10`',
    );
  });
});

describe('withDiskCache', () => {
  let dir: string;
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('calls the model once per distinct request', async () => {
    dir = await mkdtemp(join(tmpdir(), 'bt-cache-'));
    let calls = 0;
    const inner: LlmClient = { call: async () => ({ answer: ++calls }) };
    const cached = withDiskCache(inner, dir);
    const request: LlmRequest = {
      model: 'm',
      system: 's',
      prompt: 'p',
      tool: { name: 't', description: 'd', inputSchema: {} },
      maxTokens: 10,
    };

    expect(await cached.call(request)).toEqual({ answer: 1 });
    expect(await cached.call(request)).toEqual({ answer: 1 });
    expect(await cached.call({ ...request, prompt: 'other' })).toEqual({ answer: 2 });
    expect(await readdir(dir)).toHaveLength(2);
  });
});
