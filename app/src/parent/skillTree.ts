import {
  SKILL_GRADES,
  isReviewDue,
  type Attempt,
  type MasteryState,
  type MasteryStatus,
  type PlacementState,
  type Skill,
  type SkillGrade,
} from '@bright-trail/shared';
import type { IconName } from '../design/Icon';

/** How parents see each state. Icon, word, and border style each carry it, not colour alone. */
export const STATE_STYLES: Record<
  MasteryStatus,
  {
    label: string;
    meaning: string;
    icon: IconName;
    border: 'dashed' | 'dotted' | 'solid' | 'thick';
  }
> = {
  unknown: { label: 'Unknown', meaning: 'Not asked yet.', icon: 'question', border: 'dashed' },
  assumed: {
    label: 'Assumed',
    meaning: 'Taken as known from grade, not asked.',
    icon: 'half',
    border: 'dotted',
  },
  gap: {
    label: 'Gap',
    meaning: 'Missed in placement or a check. Taught next.',
    icon: 'gap',
    border: 'solid',
  },
  learning: {
    label: 'Learning',
    meaning: 'Story seen, check not passed yet.',
    icon: 'sprout',
    border: 'solid',
  },
  mastered: {
    label: 'Mastered',
    meaning: 'Passed a check: 4 of 5 right.',
    icon: 'star',
    border: 'thick',
  },
  'review-due': {
    label: 'Review due',
    meaning: 'Mastered and due for a 3-question review.',
    icon: 'refresh',
    border: 'solid',
  },
};

/** Legend order, as the design lists the states. */
export const LEGEND_ORDER: readonly MasteryStatus[] = [
  'unknown',
  'assumed',
  'gap',
  'learning',
  'mastered',
  'review-due',
];

/** The state to show. A mastered skill whose review date has come shows as review due. */
export function displayState(mastery: MasteryState | undefined, today: string): MasteryStatus {
  if (!mastery) return 'unknown';
  return isReviewDue(mastery, today) ? 'review-due' : mastery.status;
}

export type SkillRow = { skill: Skill; state: MasteryStatus; mastery?: MasteryState };
export type GradeGroup = { grade: SkillGrade; rows: SkillRow[] };

/** Skills in bundle order, grouped by grade from K up. Empty grades are left out. */
export function groupSkillsByGrade(
  skills: readonly Skill[],
  mastery: readonly MasteryState[],
  today: string,
): GradeGroup[] {
  const bySkill = new Map(mastery.map((m) => [m.skillId, m]));
  return SKILL_GRADES.map((grade) => ({
    grade,
    rows: skills
      .filter((s) => s.grade === grade)
      .map((skill) => {
        const m = bySkill.get(skill.id);
        return { skill, state: displayState(m, today), mastery: m };
      }),
  })).filter((g) => g.rows.length > 0);
}

export type PlacementResultRow = {
  skill: Skill;
  /** What placement concluded: shown it, or found a gap. */
  passed: boolean;
  /** Placement items answered and answered right for this skill. */
  answered: number;
  correct: number;
};

/**
 * The skills placement asked about, in grade order, so a parent can spot-check them. Tallies
 * count only this placement's items, so attempts from before a progress reset are left out.
 */
export function placementResults(
  skills: readonly Skill[],
  placement: Pick<PlacementState, 'results' | 'usedItemIds'>,
  attempts: readonly Attempt[],
): PlacementResultRow[] {
  const used = new Set(placement.usedItemIds);
  // Placement shows each item once, so the latest answer to it is this placement's.
  const latest = new Map<string, Attempt>();
  for (const a of attempts)
    if (a.phase === 'placement' && used.has(a.itemId)) latest.set(a.itemId, a);
  const tally = new Map<string, { answered: number; correct: number }>();
  for (const a of latest.values()) {
    const t = tally.get(a.skillId) ?? { answered: 0, correct: 0 };
    t.answered++;
    if (a.correct) t.correct++;
    tally.set(a.skillId, t);
  }
  const passed = new Map(placement.results.map((r) => [r.skillId, r.passed]));
  return SKILL_GRADES.flatMap((grade) =>
    skills
      .filter((skill) => skill.grade === grade && passed.has(skill.id))
      .map((skill) => ({
        skill,
        passed: passed.get(skill.id)!,
        answered: tally.get(skill.id)?.answered ?? 0,
        correct: tally.get(skill.id)?.correct ?? 0,
      })),
  );
}

/** Node size and spacing for the skill graph, in layout pixels. */
export const GRAPH = { nodeWidth: 184, nodeHeight: 60, layerGap: 56, rowGap: 16, top: 32 } as const;

export type GraphNode = SkillRow & { x: number; y: number };
export type SkillGraphLayout = {
  nodes: GraphNode[];
  /** Prerequisite id, then the id of the skill it unlocks. */
  edges: [string, string][];
  /** Where each grade's first layer starts. */
  columns: { grade: SkillGrade; x: number }[];
  width: number;
  height: number;
};

/**
 * Lays skills out left to right: one band per grade, split into layers so a prerequisite in the
 * same grade sits left of what it unlocks. Each layer is ordered by where its prerequisites sit,
 * to keep arrows short and crossings few.
 */
export function layoutSkillGraph(groups: readonly GradeGroup[]): SkillGraphLayout {
  const rows = new Map(groups.flatMap((g) => g.rows.map((r) => [r.skill.id, r] as const)));
  const depth = new Map<string, number>();
  const depthOf = (row: SkillRow, seen: Set<string>): number => {
    const known = depth.get(row.skill.id);
    if (known !== undefined) return known;
    seen.add(row.skill.id);
    let d = 0;
    for (const id of row.skill.prerequisiteIds) {
      const pre = rows.get(id);
      if (pre && pre.skill.grade === row.skill.grade && !seen.has(id))
        d = Math.max(d, depthOf(pre, seen) + 1);
    }
    depth.set(row.skill.id, d);
    return d;
  };

  const layers: SkillRow[][] = [];
  const columns: SkillGraphLayout['columns'] = [];
  for (const group of groups) {
    const inGrade: SkillRow[][] = [];
    for (const row of group.rows) (inGrade[depthOf(row, new Set())] ??= []).push(row);
    columns.push({ grade: group.grade, x: layers.length * (GRAPH.nodeWidth + GRAPH.layerGap) });
    layers.push(...inGrade.filter(Boolean));
  }

  const slot = new Map<string, number>();
  const ordered = layers.map((layer) => {
    const centre = (row: SkillRow) => {
      const at = row.skill.prerequisiteIds.flatMap((id) => slot.get(id) ?? []);
      return at.length ? at.reduce((a, b) => a + b, 0) / at.length : Infinity;
    };
    // Stable sort keeps bundle order for skills with no placed prerequisites.
    const sorted = [...layer].sort((a, b) => centre(a) - centre(b));
    sorted.forEach((row, i) => slot.set(row.skill.id, i - (sorted.length - 1) / 2));
    return sorted;
  });

  const tallest = Math.max(0, ...ordered.map((l) => l.length));
  const pitch = GRAPH.nodeHeight + GRAPH.rowGap;
  const nodes = ordered.flatMap((layer, li) =>
    layer.map((row, i) => ({
      ...row,
      x: li * (GRAPH.nodeWidth + GRAPH.layerGap),
      y: GRAPH.top + ((tallest - layer.length) / 2 + i) * pitch,
    })),
  );
  const edges = nodes.flatMap(({ skill }) =>
    skill.prerequisiteIds
      .filter((id) => rows.has(id))
      .map((id): [string, string] => [id, skill.id]),
  );
  return {
    nodes,
    edges,
    columns,
    width: Math.max(0, ordered.length * (GRAPH.nodeWidth + GRAPH.layerGap) - GRAPH.layerGap),
    height: GRAPH.top + Math.max(0, tallest * pitch - GRAPH.rowGap),
  };
}
