import {
  CONTENT_SCHEMA_VERSION,
  ContentBundleSchema,
  type ContentBundle,
  type Item,
  type Skill,
  type StoryNugget,
} from '@bright-trail/shared';
import type { LlmClient, LlmRequest } from '../graph/llm';
import { generateRequest, repairRequest, reviewRequest, type SkillContext } from './prompts';
import {
  ContentReviewSchema,
  GeneratedContentSchema,
  type GeneratedContent,
  type ReviewProblem,
} from './schema';
import type { CheckLevel } from './solver';
import { validateSkill } from './validate';

export const MAX_RETRIES = 2;

/** The Claude Code login ran out of usage. Finished skills are cached, so a rerun resumes. */
export class UsageLimitError extends Error {}

const USAGE_LIMIT =
  /usage limit|hit your (session |weekly |daily )?limit|rate.?limit|limit reached|quota|\b429\b/i;

export function isUsageLimit(error: unknown): boolean {
  return (
    error instanceof UsageLimitError || (error instanceof Error && USAGE_LIMIT.test(error.message))
  );
}

export interface Attempt {
  /** Problems that sent this attempt back, from code checks or the reviewer. Empty when it passed. */
  problems: string[];
  reviewed: boolean;
}

export interface SkillOutcome {
  skill: Skill;
  status: 'passed' | 'failed';
  nugget: StoryNugget | null;
  items: Item[];
  levels: Map<string, CheckLevel>;
  attempts: Attempt[];
  /** Reviewer notes on the final content, plus blockers that code had already disproved. */
  reviewNotes: ReviewProblem[];
  reviewSummary: string;
  /** LLM requests behind this skill, cached or live. */
  calls: number;
}

class BadOutput extends Error {
  constructor(
    message: string,
    readonly output: unknown,
  ) {
    super(message);
  }
}

async function call(llm: LlmClient, request: LlmRequest): Promise<unknown> {
  try {
    return await llm.call(request);
  } catch (error) {
    if (isUsageLimit(error)) throw new UsageLimitError((error as Error).message, { cause: error });
    // Failures aren't cached, so one more try often gets through a transient CLI error.
    try {
      return await llm.call(request);
    } catch (again) {
      if (isUsageLimit(again))
        throw new UsageLimitError((again as Error).message, { cause: again });
      throw again;
    }
  }
}

/**
 * Reviewer blockers become regenerate reasons, except a "wrong answer" claim on an item whose
 * answer code already recomputed: code wins, and the claim goes to the report.
 */
export function splitReview(
  problems: readonly ReviewProblem[],
  levels: ReadonlyMap<string, CheckLevel>,
): { blockers: ReviewProblem[]; notes: ReviewProblem[] } {
  const blockers: ReviewProblem[] = [];
  const notes: ReviewProblem[] = [];
  for (const p of problems) {
    const overruled = p.category === 'wrong-answer' && levels.get(p.target) === 'solved';
    if (p.severity === 'blocker' && !overruled) blockers.push(p);
    else notes.push(overruled ? { ...p, note: `Code disagrees, answer recomputed. ${p.note}` } : p);
  }
  return { blockers, notes };
}

/** Generates, checks, and reviews one skill, regenerating with the reasons up to `maxRetries` times. */
export async function generateSkill(
  context: SkillContext,
  llm: LlmClient,
  {
    maxRetries = MAX_RETRIES,
    log = () => {},
  }: { maxRetries?: number; log?: (m: string) => void } = {},
): Promise<SkillOutcome> {
  const { skill } = context;
  const attempts: Attempt[] = [];
  let calls = 0;
  let request = generateRequest(context);
  let last: SkillOutcome | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) log(`${skill.id}: retry ${attempt}`);
    calls++;
    let output: GeneratedContent;
    let problems: string[];
    let raw: unknown;
    try {
      raw = await call(llm, request);
      const parsed = GeneratedContentSchema.safeParse(raw);
      if (!parsed.success)
        throw new BadOutput(`output does not match the schema: ${parsed.error.message}`, raw);
      output = parsed.data;
    } catch (error) {
      if (error instanceof UsageLimitError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ problems: [message.slice(0, 500)], reviewed: false });
      // Without usable output there is nothing to repair, so the next attempt starts over with the reason.
      request = repairRequest(
        context,
        (error instanceof BadOutput ? error.output : null) as GeneratedContent,
        [message.slice(0, 500)],
      );
      continue;
    }

    const validation = validateSkill(skill, output);
    problems = validation.problems;
    let reviewNotes: ReviewProblem[] = [];
    let reviewSummary = '';
    let reviewed = false;
    if (problems.length === 0) {
      calls++;
      reviewed = true;
      const review = ContentReviewSchema.parse(
        await call(
          llm,
          reviewRequest(skill, validation.nugget!, validation.items, validation.levels),
        ),
      );
      const split = splitReview(review.problems, validation.levels);
      reviewNotes = split.notes;
      reviewSummary = review.notes;
      const numberOf = new Map(validation.items.map((item, i) => [item.id, i + 1]));
      problems = split.blockers.map((b) => {
        const where = numberOf.has(b.target) ? `item ${numberOf.get(b.target)}` : 'story';
        return `${where}: reviewer found ${b.category}: ${b.note}`;
      });
    }
    attempts.push({ problems, reviewed });
    last = {
      skill,
      status: problems.length === 0 ? 'passed' : 'failed',
      nugget: validation.nugget,
      items: validation.items,
      levels: validation.levels,
      attempts,
      reviewNotes,
      reviewSummary,
      calls,
    };
    if (problems.length === 0) return last;
    log(`${skill.id}: ${problems.length} problems`);
    request = repairRequest(context, output, problems);
  }
  return {
    ...(last ?? {
      skill,
      nugget: null,
      items: [],
      levels: new Map(),
      reviewNotes: [],
      reviewSummary: '',
    }),
    status: 'failed',
    attempts,
    calls,
  };
}

export interface ContentRun {
  outcomes: SkillOutcome[];
  /** Skills not finished because the run stopped. */
  pending: Skill[];
  /** Why the run stopped early, or null when every skill ran. */
  stoppedBy: string | null;
}

/** Runs skills a few at a time. On a usage limit it stops taking new skills and keeps what's done. */
export async function generateAll(
  contexts: readonly SkillContext[],
  llm: LlmClient,
  { concurrency = 3, log = () => {} }: { concurrency?: number; log?: (m: string) => void } = {},
): Promise<ContentRun> {
  const outcomes = new Map<string, SkillOutcome>();
  let next = 0;
  let stoppedBy: string | null = null;

  const worker = async () => {
    while (stoppedBy === null && next < contexts.length) {
      const context = contexts[next++];
      try {
        const outcome = await generateSkill(context, llm, { log });
        outcomes.set(context.skill.id, outcome);
        log(`${context.skill.id}: ${outcome.status} after ${outcome.attempts.length} attempts`);
      } catch (error) {
        if (error instanceof UsageLimitError) {
          stoppedBy ??= error.message;
          continue;
        }
        // One broken skill shouldn't stop the other hundred.
        const message = error instanceof Error ? error.message : String(error);
        log(`${context.skill.id}: failed with ${message}`);
        outcomes.set(context.skill.id, {
          skill: context.skill,
          status: 'failed',
          nugget: null,
          items: [],
          levels: new Map(),
          attempts: [{ problems: [message.slice(0, 500)], reviewed: false }],
          reviewNotes: [],
          reviewSummary: '',
          calls: 0,
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  return {
    outcomes: contexts.flatMap((c) => outcomes.get(c.skill.id) ?? []),
    pending: contexts.filter((c) => !outcomes.has(c.skill.id)).map((c) => c.skill),
    stoppedBy,
  };
}

/** Every skill stays in the graph. Only skills that passed bring a nugget and items. */
export function buildBundle(
  skills: readonly Skill[],
  outcomes: readonly SkillOutcome[],
  now: Date,
): ContentBundle {
  const passed = outcomes.filter((o) => o.status === 'passed');
  const order = new Map(skills.map((s, i) => [s.id, i]));
  passed.sort((a, b) => order.get(a.skill.id)! - order.get(b.skill.id)!);
  const date = now.toISOString().slice(0, 10).replace(/-/g, '.');
  return ContentBundleSchema.parse({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    version: `${date}-${passed.length}`,
    generatedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    skills,
    nuggets: passed.map((o) => o.nugget!),
    items: passed.flatMap((o) => o.items),
  });
}
