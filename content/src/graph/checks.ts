import {
  CONTENT_SCHEMA_VERSION,
  ContentBundleSchema,
  findPrerequisiteCycle,
  type Skill,
  type SkillGrade,
} from '@bright-trail/shared';
import { edgeKey } from './overrides';
import { gradeRank, idPrefix, type Expectation, type GradeSource } from './sources';

export interface Problem {
  /** Grade the problem belongs to, so the build can send it back to that grade's generator. */
  grade: SkillGrade | null;
  message: string;
}

export interface CheckOptions {
  /** Risky tokens each skill may keep on purpose, keyed by skill id. */
  allowedTokens?: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Runs every deterministic check on a skill graph against the sources it came from.
 * An empty list means the graph is valid.
 */
export function checkGraph(
  skills: readonly Skill[],
  sources: readonly GradeSource[],
  options: CheckOptions = {},
): Problem[] {
  return [...checkStructure(skills, sources), ...checkContent(skills, sources, options)];
}

/** Shape, links, and coverage: the checks a generator repair can fix. */
export function checkStructure(
  skills: readonly Skill[],
  sources: readonly GradeSource[],
): Problem[] {
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

/** Phrases that ask for a spoken, drawn, or written answer, which no POC item type can take. */
export const RISKY_TOKENS = [
  'out loud',
  'say',
  'draw',
  'write',
  'tell how',
  'explain',
  'show how',
] as const;

export const MAX_TITLE_WORDS = 6;

/** Words in a title. A spaced number such as `10 000` counts as one word. */
export function titleWords(title: string): number {
  return title
    .replace(/(\d) (?=\d{3}\b)/g, '$1')
    .split(/\s+/)
    .filter(Boolean).length;
}

export function riskyTokensIn(text: string): string[] {
  // "Tell how many" asks for a number, which a keypad can take.
  return RISKY_TOKENS.filter((token) =>
    new RegExp(`\\b${token}(s|ing|ings)?\\b(?! (many|much)\\b)`, 'i').test(text),
  );
}

// Codes are renumbered per grade (B2.5 is multiplication in Grade 2, addition in Grade 3), so the
// source's topic heading and statement classify an expectation instead.
const isMultDiv = (e: Expectation) => /multiplication and division/i.test(e.topic);
const isAddSub = (e: Expectation) =>
  !isMultDiv(e) && /\badd(ition|ing)?\b/i.test(e.statement) && /\bsubtract/i.test(e.statement);

function expectationsOf(skill: Skill, sources: readonly GradeSource[]): Expectation[] {
  const source = sources.find((s) => s.grade === skill.grade);
  const codes = new Set(skill.expectationCodes);
  return source?.expectations.filter((e) => codes.has(e.code)) ?? [];
}

/** Kid-facing text, expectation codes, and walk-back coverage. Overrides fix these. */
export function checkContent(
  skills: readonly Skill[],
  sources: readonly GradeSource[],
  { allowedTokens = new Map() }: CheckOptions = {},
): Problem[] {
  const problems: Problem[] = [];
  const byId = new Map(skills.map((s) => [s.id, s]));
  const memo = new Map<string, Set<string>>();

  for (const skill of skills) {
    const at = (message: string) => problems.push({ grade: skill.grade, message });
    const allowed = allowedTokens.get(skill.id);
    for (const [field, text] of [
      ['title', skill.title],
      ['description', skill.description],
    ] as const) {
      for (const token of riskyTokensIn(text).filter((t) => !allowed?.has(t))) {
        at(
          `${skill.id}: ${field} says "${token}", which no tap, keypad, or number-line item can check`,
        );
      }
    }
    if (titleWords(skill.title) > MAX_TITLE_WORDS) {
      at(`${skill.id}: title "${skill.title}" has more than ${MAX_TITLE_WORDS} words`);
    }
    if (
      skill.expectationCodes.length > 0 &&
      skill.expectationCodes.every((c) => !c.includes('.'))
    ) {
      at(`${skill.id}: cites only overall expectations (${skill.expectationCodes.join(', ')})`);
    }
    if (expectationsOf(skill, sources).some(isMultDiv)) {
      const addSub = [...ancestors(skill.id, byId, memo)].some((id) => {
        const ancestor = byId.get(id);
        return ancestor ? expectationsOf(ancestor, sources).some(isAddSub) : false;
      });
      if (!addSub) {
        at(
          `${skill.id}: multiplication or division with no addition or subtraction skill below it`,
        );
      }
    }
  }

  for (const source of sources) {
    const count = skills.filter((s) => s.grade === source.grade).length;
    const budget = source.expectations.filter((e) => e.kind === 'specific').length;
    if (count > budget) {
      problems.push({
        grade: source.grade,
        message: `Grade ${source.grade} has ${count} skills, more than its ${budget} specific expectations`,
      });
    }
  }
  return problems;
}

// Topic headings change name across grades, so related ones share a family.
function topicFamilies(topic: string): string[] {
  if (/rational/i.test(topic)) return ['whole', 'fraction'];
  if (/fraction|decimal|percent/i.test(topic)) return ['fraction'];
  if (/whole/i.test(topic)) return ['whole'];
  return topic ? [topic.toLowerCase()] : [];
}

/**
 * Grade 1+ skills that reach no skill of the grade before in the same topic. Not a failure: some
 * ideas are new in a grade. Topics missing from the grade before, and Kindergarten's untitled
 * topics, match any skill of that grade.
 */
export function findWarnings(skills: readonly Skill[], sources: readonly GradeSource[]): Problem[] {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const memo = new Map<string, Set<string>>();
  const families = (s: Skill) =>
    new Set(expectationsOf(s, sources).flatMap((e) => topicFamilies(e.topic)));
  const warnings: Problem[] = [];
  for (const skill of skills) {
    const rank = gradeRank(skill.grade);
    if (rank === 0) continue;
    const previous = skills.filter((s) => gradeRank(s.grade) === rank - 1);
    const mine = families(skill);
    const sameTopic = previous.filter((p) => [...families(p)].some((f) => mine.has(f)));
    const targets = new Set((sameTopic.length > 0 ? sameTopic : previous).map((s) => s.id));
    if (![...ancestors(skill.id, byId, memo)].some((id) => targets.has(id))) {
      const topic = sameTopic.length > 0 ? ` in the same topic` : '';
      warnings.push({
        grade: skill.grade,
        message: `${skill.id}: reaches no Grade ${previous[0]?.grade ?? '?'} skill${topic}`,
      });
    }
  }
  return warnings;
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
 * A spurious edge upstream can make a real one look transitive, so `protectedEdges` (keys from
 * `edgeKey`) are kept.
 */
export function removeTransitivePrerequisites(
  skills: readonly Skill[],
  protectedEdges: ReadonlySet<string> = new Set(),
): {
  skills: Skill[];
  removed: RemovedEdge[];
} {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const memo = new Map<string, Set<string>>();
  const removed: RemovedEdge[] = [];
  const result = skills.map((skill) => {
    const kept = skill.prerequisiteIds.filter((candidate) => {
      if (protectedEdges.has(edgeKey(skill.id, candidate))) return true;
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
