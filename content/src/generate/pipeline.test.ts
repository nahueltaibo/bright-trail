import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseContentBundle } from '@bright-trail/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { withDiskCache, type LlmClient, type LlmRequest } from '../graph/llm';
import { factContent, g1Context, g1SciSkill, g1Skill, goodContent } from './fixtures';
import {
  buildBundle,
  generateAll,
  generateSkill,
  isUsageLimit,
  splitReview,
  type SkillOutcome,
} from './pipeline';
import {
  GENERATOR_MODEL,
  generateRequest,
  REVIEWER_MODEL,
  reviewRequest,
  type SkillContext,
} from './prompts';
import { renderContentReport, renderPilotReport } from './report';
import type { ContentReview, GeneratedContent } from './schema';
import type { ContentEdit } from './edits';

const clean: ContentReview = { problems: [], notes: 'Looks right.' };

/** Answers by tool, one queued answer per call; the last one repeats. Never touches the CLI. */
class FakeLlm implements LlmClient {
  requests: LlmRequest[] = [];
  constructor(
    private readonly content: (GeneratedContent | unknown)[],
    private readonly reviews: ContentReview[] = [clean],
    private readonly fail?: (request: LlmRequest) => Error | null,
  ) {}

  async call(request: LlmRequest): Promise<unknown> {
    const error = this.fail?.(request);
    if (error) throw error;
    this.requests.push(request);
    const queue = request.tool.name === 'submit_content' ? this.content : this.reviews;
    return queue.length > 1 ? queue.shift() : queue[0];
  }
}

const withWrongAnswer = (): GeneratedContent => {
  const content = goodContent();
  content.items[2].answer = 4;
  return content;
};

const context = (id: string): SkillContext => ({ ...g1Context, skill: { ...g1Skill, id } });

describe('generateSkill', () => {
  it('passes good content after one generate and one review call', async () => {
    const llm = new FakeLlm([goodContent()]);
    const outcome = await generateSkill(g1Context, llm);
    expect(outcome.status).toBe('passed');
    expect(outcome.items).toHaveLength(15);
    expect(outcome.calls).toBe(2);
    expect(llm.requests.map((r) => [r.model, r.tool.name])).toEqual([
      [GENERATOR_MODEL, 'submit_content'],
      [REVIEWER_MODEL, 'submit_content_review'],
    ]);
    expect(llm.requests[0].prompt).toContain('g1-add-within-10');
    expect(llm.requests[0].prompt).toContain('just starting to read');
    expect(llm.requests[1].prompt).toContain('g1-add-within-10-keypad-1');
    expect(outcome.reviewSummary).toBe('Looks right.');
  });

  it('regenerates with the code check reasons and the previous answer', async () => {
    const llm = new FakeLlm([withWrongAnswer(), goodContent()]);
    const outcome = await generateSkill(g1Context, llm);
    expect(outcome.status).toBe('passed');
    expect(outcome.attempts.map((a) => a.problems)).toEqual([
      ['item 3 (keypad): answer is 4 but 1 + 2 = 3'],
      [],
    ]);
    const repair = llm.requests[1];
    expect(repair.tool.name).toBe('submit_content');
    expect(repair.prompt).toContain('- item 3 (keypad): answer is 4 but 1 + 2 = 3');
    expect(repair.prompt).toContain('"answer":4');
    // The failed attempt never reached the reviewer.
    expect(llm.requests.filter((r) => r.model === REVIEWER_MODEL)).toHaveLength(1);
  });

  it('fails after 2 retries and keeps the last problems', async () => {
    const llm = new FakeLlm([withWrongAnswer()]);
    const outcome = await generateSkill(g1Context, llm);
    expect(outcome.status).toBe('failed');
    expect(outcome.attempts).toHaveLength(3);
    expect(outcome.calls).toBe(3);
    expect(llm.requests.every((r) => r.model === GENERATOR_MODEL)).toBe(true);
  });

  it('regenerates on a reviewer blocker', async () => {
    const blocker: ContentReview = {
      problems: [
        {
          target: 'g1-add-within-10-tap-1',
          severity: 'blocker',
          category: 'ambiguous',
          note: 'Two readings.',
        },
      ],
      notes: '',
    };
    const llm = new FakeLlm([goodContent()], [blocker, clean]);
    const outcome = await generateSkill(g1Context, llm);
    expect(outcome.status).toBe('passed');
    expect(outcome.attempts[0].problems).toEqual([
      'item 1: reviewer found ambiguous: Two readings.',
    ]);
    expect(llm.requests[2].prompt).toContain('item 1: reviewer found ambiguous');
  });

  it('keeps a wrong-answer claim on a code-solved item as a note', async () => {
    const claim: ContentReview = {
      problems: [
        {
          target: 'g1-add-within-10-keypad-1',
          severity: 'blocker',
          category: 'wrong-answer',
          note: 'Should be 4.',
        },
        { target: 'story', severity: 'note', category: 'age', note: 'A bit plain.' },
      ],
      notes: 'Mostly fine.',
    };
    const outcome = await generateSkill(g1Context, new FakeLlm([goodContent()], [claim]));
    expect(outcome.status).toBe('passed');
    expect(outcome.reviewNotes.map((n) => n.note)).toEqual([
      'Code disagrees, answer recomputed. Should be 4.',
      'A bit plain.',
    ]);
  });

  it('retries output that breaks the schema', async () => {
    const llm = new FakeLlm([{ cards: 'nope' }, goodContent()]);
    const outcome = await generateSkill(g1Context, llm);
    expect(outcome.status).toBe('passed');
    expect(outcome.attempts[0].problems[0]).toMatch(/does not match the schema/);
  });

  it('retries a transient CLI error once without spending an attempt', async () => {
    let failures = 1;
    const llm = new FakeLlm([goodContent()], [clean], () =>
      failures-- > 0 ? new Error('exit 1: socket hang up') : null,
    );
    const outcome = await generateSkill(g1Context, llm);
    expect(outcome.status).toBe('passed');
    expect(outcome.attempts).toHaveLength(1);
  });
});

describe('splitReview', () => {
  it('treats blockers as reasons unless code solved the answer', () => {
    const levels = new Map([
      ['a', 'solved' as const],
      ['b', 'linked' as const],
    ]);
    const { blockers, notes } = splitReview(
      [
        { target: 'a', severity: 'blocker', category: 'wrong-answer', note: 'x' },
        { target: 'a', severity: 'blocker', category: 'age', note: 'y' },
        { target: 'b', severity: 'blocker', category: 'wrong-answer', note: 'z' },
        { target: 'b', severity: 'note', category: 'other', note: 'w' },
      ],
      levels,
    );
    expect(blockers.map((b) => b.note)).toEqual(['y', 'z']);
    expect(notes.map((n) => n.note)).toEqual(['Code disagrees, answer recomputed. x', 'w']);
  });
});

describe('generateAll', () => {
  it('stops at a usage limit and keeps finished skills', async () => {
    const llm = new FakeLlm([goodContent()], [clean], (request) =>
      request.prompt.includes('Skill g1-second')
        ? new Error('Claude AI usage limit reached|1762480000')
        : null,
    );
    const contexts = ['g1-first', 'g1-second', 'g1-third'].map(context);
    const run = await generateAll(contexts, llm, { concurrency: 1 });
    expect(run.outcomes.map((o) => o.skill.id)).toEqual(['g1-first']);
    expect(run.pending.map((s) => s.id)).toEqual(['g1-second', 'g1-third']);
    expect(run.stoppedBy).toMatch(/usage limit/);
  });

  it('records a skill whose review breaks and carries on', async () => {
    const llm = new FakeLlm([goodContent()], [{ nope: true } as unknown as ContentReview]);
    const run = await generateAll([context('g1-first')], llm);
    expect(run.outcomes[0].status).toBe('failed');
    expect(run.stoppedBy).toBeNull();
  });

  describe('with a disk cache', () => {
    let dir: string | undefined;
    afterEach(async () => {
      if (dir) await rm(dir, { recursive: true, force: true });
    });

    it('costs 0 calls on a rerun', async () => {
      dir = await mkdtemp(join(tmpdir(), 'content-cache-'));
      const contexts = ['g1-first', 'g1-second'].map(context);
      const first = new FakeLlm([withWrongAnswer(), goodContent()]);
      await generateAll(contexts, withDiskCache(first, dir), { concurrency: 1 });
      expect(first.requests.length).toBeGreaterThan(0);

      const second = new FakeLlm([goodContent()]);
      const rerun = await generateAll(contexts, withDiskCache(second, dir));
      expect(second.requests).toHaveLength(0);
      expect(rerun.outcomes.map((o) => o.status)).toEqual(['passed', 'passed']);
    });
  });
});

describe('isUsageLimit', () => {
  it('recognises CLI limit messages', () => {
    for (const message of [
      'Claude AI usage limit reached|1762480000',
      "You've hit your session limit · resets 3pm",
      'API Error: 429 rate_limit_error',
    ]) {
      expect(isUsageLimit(new Error(message)), message).toBe(true);
    }
    expect(isUsageLimit(new Error('hit max_tokens'))).toBe(false);
  });
});

describe('bundle and reports', () => {
  async function outcomes(): Promise<SkillOutcome[]> {
    const passed = await generateSkill(g1Context, new FakeLlm([goodContent()]));
    const failed = await generateSkill(context('g1-other'), new FakeLlm([withWrongAnswer()]));
    return [passed, failed];
  }

  it('builds a valid bundle with only passed skills', async () => {
    const skills = [g1Skill, { ...g1Skill, id: 'g1-other' }];
    const bundle = buildBundle(skills, await outcomes(), new Date('2026-11-06T12:00:00.123Z'));
    expect(parseContentBundle(bundle)).toEqual(bundle);
    expect(bundle.version).toBe('2026.11.06-1');
    expect(bundle.generatedAt).toBe('2026-11-06T12:00:00Z');
    expect(bundle.skills).toHaveLength(2);
    expect(bundle.nuggets.map((n) => n.skillId)).toEqual(['g1-add-within-10']);
    expect(bundle.items).toHaveLength(15);
  });

  it('reports counts, failures, retries, and calls', async () => {
    const all = await outcomes();
    const skills = all.map((o) => o.skill);
    const report = renderContentReport(
      skills,
      { outcomes: all, pending: [], stoppedBy: null },
      2 * 1024 * 1024,
    );
    expect(report).toContain('**1 of 2 skills passed**');
    expect(report).toContain('The bundle is 2.00 MB.');
    expect(report).toContain('- **g1-other**: item 3 (keypad): answer is 4 but 1 + 2 = 3');
    expect(report).toContain('**15** items solved by code');
    expect(report).toContain('5 requests behind this content');
  });

  it('says where a stopped run resumes', async () => {
    const all = await outcomes();
    const report = renderContentReport(
      [g1Skill],
      {
        outcomes: all.slice(0, 1),
        pending: [{ ...g1Skill, id: 'g1-next' }],
        stoppedBy: 'usage limit reached',
      },
      null,
    );
    expect(report).toContain('**The run stopped early:** usage limit reached');
    expect(report).toContain('`g1-next`');
  });

  it('shows the full story and one item per type in the pilot report', async () => {
    const all = await outcomes();
    const report = renderPilotReport({ outcomes: all, pending: [], stoppedBy: null });
    expect(report).toContain('| 1 | Leo has 3 apples. |  | 3 × 🍎 |');
    expect(report).toContain('**g1-add-within-10-tap-3** · tap · difficulty 2');
    expect(report).toContain('**g1-add-within-10-keypad-3** · keypad · difficulty 2');
    expect(report).toContain('**g1-add-within-10-number-line-2** · number-line · difficulty 2');
    expect(report).toContain('**Failed** after 2 retries');
  });
});

describe('generateRequest', () => {
  it('adds range-grading instructions only for estimation skills', () => {
    const estimate = generateRequest({ ...g1Context, skill: { ...g1Skill, id: 'g1-estimate-50' } });
    expect(estimate.prompt).toContain('grade by range');
    expect(generateRequest(g1Context).prompt).not.toContain('grade by range');
  });

  it('warns early fraction skills that pictures show whole copies', () => {
    const half = { ...g1Skill, id: 'g1-halves', title: 'Halves and fourths' };
    expect(generateRequest({ ...g1Context, skill: half }).prompt).toContain(
      '4 × 🍕 is four pizzas',
    );
    const g5 = { ...half, id: 'g5-halves', grade: '5' as const };
    expect(generateRequest({ ...g1Context, skill: g5 }).prompt).not.toContain('four pizzas');
    expect(generateRequest(g1Context).prompt).not.toContain('four pizzas');
  });

  it('asks Grade 5 and 6 not to talk down', () => {
    const g5 = generateRequest({ ...g1Context, skill: { ...g1Skill, id: 'g5-x', grade: '5' } });
    expect(g5.prompt).toContain('Do not talk down');
    expect(g5.prompt).toContain('at most 22 words');
  });

  it('offers fraction pictures only to fraction picture skills', () => {
    const fraction = generateRequest({
      ...g1Context,
      skill: { ...g1Skill, id: 'g1-half-equals-two-fourths' },
    });
    const basic = generateRequest(g1Context);
    for (const added of [
      'or a shape cut into equal parts.',
      '"kind":"fraction"',
      'shaded / parts is the fraction it shows',
    ]) {
      expect(fraction.system).toContain(added);
      expect(basic.system).not.toContain(added);
    }
    expect(fraction.system).not.toContain('There are no fraction pictures');
    expect(fraction.prompt).toContain('draw the parts with fraction pictures');
    expect(fraction.prompt).not.toContain('no picture can show one thing cut into pieces');
    expect(JSON.stringify(fraction.tool.inputSchema)).toContain('"shaded"');
    expect(JSON.stringify(basic.tool.inputSchema)).not.toContain('"shaded"');
  });
});

describe('fact skills', () => {
  const context: SkillContext = {
    skill: g1SciSkill,
    expectations: [
      { code: 'B2.1', kind: 'specific', topic: '', statement: 'living things', details: '' },
    ],
    prerequisites: [],
  };

  it('ask for tap-only items with the fact prompt and tone', () => {
    const request = generateRequest(context);
    expect(request.system).toContain('all tap items');
    expect(request.system).not.toContain('number-line:');
    expect(request.system).not.toContain('math app');
    expect(request.prompt).not.toContain('Keep numbers inside the skill');
    // A title with "share" is no fraction skill outside math.
    const sharing = { ...g1SciSkill, title: 'Sharing traditions' };
    expect(generateRequest({ ...context, skill: sharing }).prompt).not.toContain('pizza');
  });

  it('pass after review with every item left to the reviewer', async () => {
    const llm = new FakeLlm([factContent()]);
    const outcome = await generateSkill(context, llm);
    expect(outcome.status).toBe('passed');
    expect(llm.requests[1].prompt).toContain('VERIFY');
    expect(llm.requests[1].system).toContain('Every item here is marked VERIFY');
  });

  it('keep the math prompts for math skills', () => {
    expect(generateRequest(g1Context).system).toContain('audio-first math app');
    expect(
      reviewRequest(g1Skill, { id: 's', skillId: g1Skill.id, cards: [] }, [], new Map()).system,
    ).not.toContain('Every item here is marked VERIFY');
  });
});

describe('generateSkill hand edits', () => {
  const edit = (set: Record<string, unknown>, was: Record<string, unknown>): ContentEdit => ({
    skillId: g1Skill.id,
    target: 'g1-add-within-10-keypad-1',
    set,
    was,
    reason: 'Clearer by ear.',
  });

  it('applies an edit after review and checks it again', async () => {
    const llm = new FakeLlm([goodContent()]);
    const narration = 'Mia has 1 shell. She finds 2 more. How many shells now?';
    const outcome = await generateSkill(g1Context, llm, {
      edits: [edit({ narration }, { narration: goodContent().items[2].narration })],
    });
    expect(outcome.status).toBe('passed');
    expect(outcome.calls).toBe(2);
    expect(outcome.items.find((i) => i.id === 'g1-add-within-10-keypad-1')?.narration).toBe(
      narration,
    );
    expect(outcome.edits).toHaveLength(1);
  });

  it('fails a stale edit or one that breaks a check', async () => {
    const stale = await generateSkill(g1Context, new FakeLlm([goodContent()]), {
      edits: [edit({ narration: 'New.' }, { narration: 'Something else.' })],
    });
    expect(stale.status).toBe('failed');
    expect(stale.attempts.at(-1)?.problems[0]).toMatch(/stale/);

    const broken = await generateSkill(g1Context, new FakeLlm([goodContent()]), {
      edits: [edit({ answer: 9 }, { answer: 3 })],
    });
    expect(broken.status).toBe('failed');
    expect(broken.attempts.at(-1)?.problems[0]).toBe(
      'after hand edits: item 3 (keypad): answer is 9 but 1 + 2 = 3',
    );
  });
});
