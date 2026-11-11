import type { Skill } from '@bright-trail/shared';
import type { z } from 'zod';
import {
  checkGraph,
  checkStructure,
  findWarnings,
  removeTransitivePrerequisites,
  type Problem,
  type RemovedEdge,
} from './checks';
import type { LlmClient, LlmRequest } from './llm';
import { applyOverrides, type Override } from './overrides';
import {
  GeneratedSkillsSchema,
  generateRequest,
  repairRequest,
  reviewRequest,
  ReviewSchema,
  type Correction,
  type GeneratedSkills,
  type Review,
} from './prompts';
import { gradeRank, type GradeSource } from './sources';

export interface GradeLog {
  grade: Skill['grade'];
  proposed: number;
  applied: Correction[];
  rejected: { correction: Correction; why: string }[];
  reviewerNotes: string;
  /** Generator reruns needed to clear this grade's check problems. */
  repairs: number;
}

export interface GraphBuild {
  skills: Skill[];
  /** Problems left after every repair. Empty means the graph is valid. */
  problems: Problem[];
  /** Worth a look, but they don't fail the build. */
  warnings: Problem[];
  removedTransitive: RemovedEdge[];
  overrides: readonly Override[];
  grades: GradeLog[];
}

export interface BuildOptions {
  maxRepairs?: number;
  /** Hand fixes applied after generation, before pruning and checks. */
  overrides?: readonly Override[];
  log?: (message: string) => void;
}

async function ask<T>(llm: LlmClient, request: LlmRequest, schema: z.ZodType<T>): Promise<T> {
  const output = await llm.call(request);
  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    throw new Error(`${request.model} returned bad ${request.tool.name} input: ${parsed.error}`);
  }
  return parsed.data;
}

function toSkills(generated: GeneratedSkills, source: GradeSource): Skill[] {
  return generated.skills.map((s) => ({
    id: s.id.trim(),
    subject: source.subject,
    framework: source.framework,
    grade: source.grade,
    strand: source.strand,
    expectationCodes: [...new Set(s.expectationCodes.map((c) => c.trim()))],
    title: s.title.trim(),
    description: s.description.trim(),
    prerequisiteIds: [...new Set(s.prerequisiteIds.map((id) => id.trim()))],
  }));
}

/** Applies reviewer corrections that refer to known skills. Returns the rest as rejected. */
export function applyCorrections(
  proposed: readonly Skill[],
  earlier: readonly Skill[],
  review: Review,
): { skills: Skill[]; applied: Correction[]; rejected: GradeLog['rejected'] } {
  const known = new Set([...earlier, ...proposed].map((s) => s.id));
  const byId = new Map(proposed.map((s) => [s.id, { ...s }]));
  const applied: Correction[] = [];
  const rejected: GradeLog['rejected'] = [];
  for (const correction of review.corrections) {
    const skill = byId.get(correction.skillId);
    if (!skill) {
      rejected.push({ correction, why: `${correction.skillId} is not a skill of this grade` });
      continue;
    }
    if (correction.changePrerequisites) {
      const ids = [...new Set(correction.prerequisiteIds)];
      const unknown = ids.filter((id) => !known.has(id) || id === skill.id);
      if (unknown.length > 0) {
        rejected.push({ correction, why: `unknown or self prerequisites: ${unknown.join(', ')}` });
        continue;
      }
      skill.prerequisiteIds = ids;
    }
    if (correction.title.trim()) skill.title = correction.title.trim();
    if (correction.description.trim()) skill.description = correction.description.trim();
    applied.push(correction);
  }
  return { skills: proposed.map((s) => byId.get(s.id)!), applied, rejected };
}

/**
 * Builds the skill graph grade by grade, K first, so each grade can link to the reviewed skills
 * before it. Per grade: the generator proposes skills, the reviewer corrects them, and check
 * failures go back to the generator up to `maxRepairs` times.
 */
export async function buildGraph(
  sources: readonly GradeSource[],
  llm: LlmClient,
  { maxRepairs = 2, overrides = [], log = () => {} }: BuildOptions = {},
): Promise<GraphBuild> {
  const ordered = [...sources].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade));
  const built: Skill[] = [];
  const grades: GradeLog[] = [];

  for (const [index, source] of ordered.entries()) {
    const earlier = [...built];
    log(`Grade ${source.grade}: generating`);
    const generated = await ask(llm, generateRequest(source, earlier), GeneratedSkillsSchema);
    const proposed = toSkills(generated, source);

    log(`Grade ${source.grade}: reviewing ${proposed.length} skills`);
    const review = await ask(llm, reviewRequest(source, earlier, proposed), ReviewSchema);
    const corrected = applyCorrections(proposed, earlier, review);
    const { applied, rejected } = corrected;
    // Repairs start from the corrected list, so the reviewer's changes carry through.
    let skills = corrected.skills;

    let repairs = 0;
    const sourcesSoFar = ordered.slice(0, index + 1);
    for (;;) {
      // Content checks wait for the overrides, so they never trigger a repair call.
      const problems = checkStructure([...earlier, ...skills], sourcesSoFar).filter(
        (p) => p.grade === source.grade,
      );
      if (problems.length === 0 || repairs >= maxRepairs) break;
      repairs++;
      log(`Grade ${source.grade}: repairing ${problems.length} problems (attempt ${repairs})`);
      const fixed = await ask(
        llm,
        repairRequest(source, earlier, skills, problems),
        GeneratedSkillsSchema,
      );
      skills = toSkills(fixed, source);
    }

    built.push(...skills);
    grades.push({
      grade: source.grade,
      proposed: proposed.length,
      applied,
      rejected,
      reviewerNotes: review.notes,
      repairs,
    });
  }

  const fixed = applyOverrides(built, overrides);
  const { skills, removed } = removeTransitivePrerequisites(fixed.skills, fixed.protectedEdges);
  const stale = fixed.stale.map((message): Problem => ({ grade: null, message }));
  return {
    skills,
    problems: [...stale, ...checkGraph(skills, ordered, fixed)],
    warnings: findWarnings(skills, ordered),
    removedTransitive: removed,
    overrides,
    grades,
  };
}
