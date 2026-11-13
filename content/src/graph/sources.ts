import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SUBJECT_FRAMEWORKS,
  type Framework,
  type ParentOptIn,
  type SkillGrade,
  type Subject,
} from '@bright-trail/shared';

export interface Expectation {
  /** Official code, e.g. `B2.3`. Codes repeat across grades, so pair them with a grade. */
  code: string;
  kind: 'overall' | 'specific';
  /** Heading topic such as "Whole Numbers". Empty when the source has none. */
  topic: string;
  statement: string;
  /** Examples and Key concepts as written in the source. */
  details: string;
  /** Set on expectations a parent must turn on. Their skills carry it. */
  parentOptIn?: ParentOptIn;
}

export interface GradeSource {
  grade: SkillGrade;
  subject: Subject;
  framework: Framework;
  /** Strand letters in the order the file lists them, e.g. `['B']` or `['B', 'C']`. */
  strands: string[];
  file: string;
  expectations: Expectation[];
}

export const GRADE_ORDER: readonly SkillGrade[] = ['K', '1', '2', '3', '4', '5', '6'];

export function gradeRank(grade: SkillGrade): number {
  return GRADE_ORDER.indexOf(grade);
}

/** What the graph reads from one subject's folder in `content/sources/`. */
export interface SubjectSpec {
  subject: Subject;
  /** Id tag after the grade, e.g. `sci` in `g3-sci-plant-needs`. Math has none. */
  tag: string;
  /** Strands a tablet item can check. Undefined keeps every strand in the file. */
  strands?: readonly string[];
  /** Reads `kindergarten.md` too. Without it, the subject's graph starts at Grade 1. */
  kindergarten?: boolean;
  /** Specific expectations under a matching topic heading need a parent's opt-in. */
  optInTopic?: { topic: RegExp; optIn: ParentOptIn };
}

export const MATH: SubjectSpec = { subject: 'math', tag: '', kindergarten: true };

/** Subjects the skill graph covers. Health keeps only Strand D, Healthy Living. */
export const GRAPH_SUBJECTS: readonly SubjectSpec[] = [
  MATH,
  { subject: 'science', tag: 'sci', strands: ['A', 'B', 'C', 'D', 'E'] },
  { subject: 'social-studies', tag: 'soc', strands: ['A', 'B'] },
  {
    subject: 'health',
    tag: 'hlth',
    strands: ['D'],
    optInTopic: { topic: /human development and sexual health/i, optIn: 'human-development' },
  },
];

function specOf(subject: Subject): SubjectSpec {
  return GRAPH_SUBJECTS.find((s) => s.subject === subject) ?? { subject, tag: subject };
}

/** The subject an id's tag names, e.g. science for `g3-sci-plant-needs`. Untagged ids are math. */
export function subjectOfId(id: string): Subject {
  const tag = /^(?:k|g\d)-([a-z]+)-/.exec(id)?.[1];
  return GRAPH_SUBJECTS.find((s) => s.tag && s.tag === tag)?.subject ?? 'math';
}

/** Id prefix every skill of a grade and subject carries, e.g. `k-`, `g3-`, or `g3-sci-`. */
export function idPrefix(grade: SkillGrade, subject: Subject = 'math'): string {
  const { tag } = specOf(subject);
  return `${grade === 'K' ? 'k' : `g${grade}`}-${tag ? `${tag}-` : ''}`;
}

function gradeOfFile(file: string): SkillGrade | null {
  if (file === 'kindergarten.md') return 'K';
  const match = /^grade-([1-6])\.md$/.exec(file);
  return match ? (match[1] as SkillGrade) : null;
}

const OVERALL = /^\*\*([A-Z]\d+)\.\*\*\s+(.+)$/;
const SPECIFIC_HEADING = /^#### ([A-Z]\d+\.\d+)\b\s*(.*)$/;
const STATEMENT = /^\*\*([A-Z]\d+\.\d+)\*\*\s+(.+)$/;

/** Parses one curriculum file in the layout `content/sources/math/README.md` describes. */
export function parseSource(file: string, markdown: string, spec: SubjectSpec): GradeSource {
  const grade = gradeOfFile(file);
  if (!grade) throw new Error(`Unexpected source file ${file}`);
  const expectations: Expectation[] = [];
  let current: (Expectation & { lines: string[] }) | null = null;

  const flush = () => {
    if (!current) return;
    const { lines, ...rest } = current;
    if (!rest.statement) throw new Error(`${file}: ${rest.code} has no statement line`);
    expectations.push({ ...rest, details: lines.join('\n').trim() });
    current = null;
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = SPECIFIC_HEADING.exec(line);
    if (heading) {
      flush();
      current = {
        code: heading[1],
        kind: 'specific',
        topic: heading[2].trim(),
        statement: '',
        details: '',
        lines: [],
      };
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      flush();
      continue;
    }
    const overall = OVERALL.exec(line);
    if (overall && !current) {
      expectations.push({
        code: overall[1],
        kind: 'overall',
        topic: '',
        statement: overall[2].trim(),
        details: '',
      });
      continue;
    }
    if (!current) continue;
    const statement = STATEMENT.exec(line);
    if (statement && statement[1] === current.code && !current.statement) {
      current.statement = statement[2].trim();
    } else {
      current.lines.push(line);
    }
  }
  flush();

  const kept = expectations
    .filter((e) => !spec.strands || spec.strands.includes(e.code[0]))
    .map((e) =>
      e.kind === 'specific' && spec.optInTopic?.topic.test(e.topic)
        ? { ...e, parentOptIn: spec.optInTopic.optIn }
        : e,
    );
  const specific = kept.filter((e) => e.kind === 'specific');
  if (specific.length === 0) throw new Error(`${file}: no specific expectations found`);
  return {
    grade,
    subject: spec.subject,
    framework: grade === 'K' ? 'ontario-kindergarten-2026' : SUBJECT_FRAMEWORKS[spec.subject],
    strands: [...new Set(kept.map((e) => e.code[0]))],
    file,
    expectations: kept,
  };
}

/**
 * Reads every grade file in `<root>/<subject>/`, ordered K to 6. Ignores other files such as the
 * README.
 */
export async function loadSources(root: string, subject: Subject): Promise<GradeSource[]> {
  const spec = specOf(subject);
  const dir = join(root, subject);
  const files = (
    await readdir(dir).catch(() => {
      throw new Error(`No curriculum sources for ${subject}: ${dir} is missing`);
    })
  ).filter((f) => {
    const grade = gradeOfFile(f);
    return grade !== null && (grade !== 'K' || spec.kindergarten);
  });
  const sources = await Promise.all(
    files.map(async (f) => parseSource(f, await readFile(join(dir, f), 'utf8'), spec)),
  );
  return sources.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade));
}

/** Reads the sources of the given subjects, each ordered K to 6. Defaults to `GRAPH_SUBJECTS`. */
export async function loadAllSources(
  root: string,
  subjects: readonly Subject[] = GRAPH_SUBJECTS.map((s) => s.subject),
): Promise<Map<Subject, GradeSource[]>> {
  const entries = await Promise.all(
    subjects.map(async (subject) => [subject, await loadSources(root, subject)] as const),
  );
  return new Map(entries);
}

/** The source a skill's expectation codes come from. */
export function sourceOf(
  sources: readonly GradeSource[],
  skill: { subject: Subject; grade: SkillGrade },
): GradeSource | undefined {
  return sources.find((s) => s.subject === skill.subject && s.grade === skill.grade);
}

/** The lowest grade a subject's sources cover: K for math, Grade 1 for the rest. */
export function firstGrade(sources: readonly GradeSource[], subject: Subject): SkillGrade {
  const ranks = sources.filter((s) => s.subject === subject).map((s) => gradeRank(s.grade));
  return GRADE_ORDER[ranks.length > 0 ? Math.min(...ranks) : 0];
}

export function gradeName(grade: SkillGrade): string {
  return grade === 'K' ? 'Kindergarten' : `Grade ${grade}`;
}
