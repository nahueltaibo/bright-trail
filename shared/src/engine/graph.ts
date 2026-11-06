import type { SchoolGrade } from '../grade';
import type { Skill, SkillGrade } from '../skill';

/** The parts of a skill the engine reads. */
export type GraphSkill = Pick<Skill, 'id' | 'grade' | 'prerequisiteIds'>;

export interface SkillGraph {
  /** In bundle order, which breaks ties between skills of the same grade. */
  readonly skills: readonly GraphSkill[];
  readonly byId: ReadonlyMap<string, GraphSkill>;
}

/** Indexes skills by id. Throws on an unknown prerequisite, which a validated bundle never has. */
export function createSkillGraph(skills: readonly GraphSkill[]): SkillGraph {
  const byId = new Map(skills.map((s) => [s.id, s]));
  for (const skill of skills) {
    for (const id of skill.prerequisiteIds) {
      if (!byId.has(id)) throw new Error(`Unknown prerequisite ${id} on ${skill.id}`);
    }
  }
  return { skills, byId };
}

/** Orders grades: Kindergarten (K, JK, SK) is 0, Grade n is n. */
export function gradeRank(grade: SkillGrade | SchoolGrade): number {
  return grade === 'K' || grade === 'JK' || grade === 'SK' ? 0 : Number(grade);
}
