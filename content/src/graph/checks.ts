import {
  CONTENT_SCHEMA_VERSION,
  ContentBundleSchema,
  findPrerequisiteCycle,
  type Skill,
  type SkillGrade,
} from '@bright-trail/shared';
import { gradeRank, idPrefix, type GradeSource } from './sources';

export interface Problem {
  /** Grade the problem belongs to, so the build can send it back to that grade's generator. */
  grade: SkillGrade | null;
  message: string;
}

/**
 * Runs every deterministic check on a skill graph against the sources it came from.
 * An empty list means the graph is valid.
 */
export function checkGraph(skills: readonly Skill[], sources: readonly GradeSource[]): Problem[] {
  const problems: Problem[] = [];
  const byId = new Map(skills.map((s) => [s.id, s]));
  const gradeOf = (id: string) => byId.get(id)?.grade ?? null;

  // The shared bundle schema covers field shapes, duplicate ids, unknown prerequisites, and cycles.
  const bundle = ContentBundleSchema.safeParse({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    version: 'skill-graph',
    generatedAt: '2026-01-01T00:00:00Z',
    skills,
    nuggets: [],
    items: [],
  });
  if (!bundle.success) {
    for (const issue of bundle.error.issues) {
      const [, index] = issue.path;
      const skill = typeof index === 'number' ? skills[index] : undefined;
      const where = skill ? `${skill.id}: ` : '';
      problems.push({
        grade: skill?.grade ?? null,
        message: `Schema: ${where}${issue.path.slice(2).join('.') || '(skill)'} ${issue.message}`,
      });
    }
  }

  const cycle = findPrerequisiteCycle(skills);
  if (cycle) {
    problems.push({ grade: gradeOf(cycle[0]), message: `Cycle: ${cycle.join(' -> ')}` });
  }

  const sourceByGrade = new Map(sources.map((s) => [s.grade, s]));
  for (const skill of skills) {
    const at = (message: string) => problems.push({ grade: skill.grade, message });
    if (!skill.id.startsWith(idPrefix(skill.grade))) {
      at(`${skill.id}: id must start with ${idPrefix(skill.grade)}`);
    }
    const source = sourceByGrade.get(skill.grade);
    const codes = new Set(source?.expectations.map((e) => e.code));
    for (const code of skill.expectationCodes) {
      if (!codes.has(code)) at(`${skill.id}: expectation ${code} is not in Grade ${skill.grade}`);
    }
    for (const id of skill.prerequisiteIds) {
      const grade = gradeOf(id);
      if (grade && gradeRank(grade) > gradeRank(skill.grade)) {
        at(`${skill.id}: prerequisite ${id} is in a higher grade (${grade})`);
      }
    }
    if (skill.grade !== 'K' && skill.prerequisiteIds.length === 0) {
      at(`${skill.id}: orphan, only Kindergarten skills may have no prerequisites`);
    }
  }

  const reachable = reachableFromRoots(skills);
  for (const skill of skills) {
    if (!reachable.has(skill.id)) {
      problems.push({
        grade: skill.grade,
        message: `${skill.id}: not reachable from a Kindergarten root`,
      });
    }
  }

  for (const source of sources) {
    const used = new Set(
      skills.filter((s) => s.grade === source.grade).flatMap((s) => s.expectationCodes),
    );
    for (const e of source.expectations) {
      if (e.kind === 'specific' && !used.has(e.code)) {
        problems.push({
          grade: source.grade,
          message: `Expectation ${e.code} (Grade ${source.grade}) has no skill`,
        });
      }
    }
  }
  return problems;
}

/** Kindergarten skills with no prerequisites: where every trail starts. */
export function roots(skills: readonly Skill[]): Skill[] {
  return skills.filter((s) => s.grade === 'K' && s.prerequisiteIds.length === 0);
}

/** Ids reachable by walking from the roots to the skills that depend on them. */
export function reachableFromRoots(skills: readonly Skill[]): Set<string> {
  const dependents = new Map<string, string[]>();
  for (const skill of skills) {
    for (const id of skill.prerequisiteIds) {
      dependents.set(id, [...(dependents.get(id) ?? []), skill.id]);
    }
  }
  const seen = new Set<string>();
  const queue = roots(skills).map((s) => s.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(dependents.get(id) ?? []));
  }
  return seen;
}

/** Every skill that `id` needs, directly or through other prerequisites. */
function ancestors(id: string, byId: ReadonlyMap<string, Skill>, memo: Map<string, Set<string>>) {
  const known = memo.get(id);
  if (known) return known;
  const result = new Set<string>();
  memo.set(id, result); // Guards against cycles; checkGraph reports those separately.
  for (const prerequisite of byId.get(id)?.prerequisiteIds ?? []) {
    if (!byId.has(prerequisite)) continue;
    result.add(prerequisite);
    for (const a of ancestors(prerequisite, byId, memo)) result.add(a);
  }
  return result;
}

export interface RemovedEdge {
  skillId: string;
  prerequisiteId: string;
  /** The listed prerequisite that already implies the removed one. */
  via: string;
}

/**
 * Drops prerequisites that another listed prerequisite already implies, so each skill lists
 * direct prerequisites only. Walk-back probes these lists, so a transitive edge would skip a level.
 */
export function removeTransitivePrerequisites(skills: readonly Skill[]): {
  skills: Skill[];
  removed: RemovedEdge[];
} {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const memo = new Map<string, Set<string>>();
  const removed: RemovedEdge[] = [];
  const result = skills.map((skill) => {
    const kept = skill.prerequisiteIds.filter((candidate) => {
      const via = skill.prerequisiteIds.find(
        (other) => other !== candidate && ancestors(other, byId, memo).has(candidate),
      );
      if (via) removed.push({ skillId: skill.id, prerequisiteId: candidate, via });
      return !via;
    });
    return kept.length === skill.prerequisiteIds.length
      ? skill
      : { ...skill, prerequisiteIds: kept };
  });
  return { skills: result, removed };
}

/** Longest prerequisite chain, root first. Ties go to the chain that sorts first by id. */
export function longestChain(skills: readonly Skill[]): string[] {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const memo = new Map<string, string[]>();
  const chainTo = (id: string, visiting: Set<string>): string[] => {
    const known = memo.get(id);
    if (known) return known;
    visiting.add(id);
    let best: string[] = [];
    for (const p of [...(byId.get(id)?.prerequisiteIds ?? [])].sort()) {
      if (!byId.has(p) || visiting.has(p)) continue;
      const chain = chainTo(p, visiting);
      if (chain.length > best.length) best = chain;
    }
    visiting.delete(id);
    const chain = [...best, id];
    memo.set(id, chain);
    return chain;
  };
  let longest: string[] = [];
  for (const id of [...byId.keys()].sort()) {
    const chain = chainTo(id, new Set());
    if (chain.length > longest.length) longest = chain;
  }
  return longest;
}

/** Skills below Grade 6 that no other skill builds on. Valid, but worth a look. */
export function deadEnds(skills: readonly Skill[]): Skill[] {
  const used = new Set(skills.flatMap((s) => s.prerequisiteIds));
  return skills.filter((s) => s.grade !== '6' && !used.has(s.id));
}
