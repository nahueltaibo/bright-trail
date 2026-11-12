import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Framework, SkillGrade, Subject } from '@bright-trail/shared';

export interface Expectation {
  /** Official code, e.g. `B2.3`. Codes repeat across grades, so pair them with a grade. */
  code: string;
  kind: 'overall' | 'specific';
  /** Heading topic such as "Whole Numbers". Empty when the source has none. */
  topic: string;
  statement: string;
  /** Examples and Key concepts as written in the source. */
  details: string;
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

/** Id prefix every skill of a grade carries, e.g. `k-` or `g3-`. */
export function idPrefix(grade: SkillGrade): string {
  return grade === 'K' ? 'k-' : `g${grade}-`;
}

/** Framework of each subject's Grade 1-6 files. Kindergarten files always use the 2026 program. */
const GRADE_FRAMEWORKS: Record<Subject, Framework> = { math: 'ontario-math-2020' };

function gradeOfFile(file: string): SkillGrade | null {
  if (file === 'kindergarten.md') return 'K';
  const match = /^grade-([1-6])\.md$/.exec(file);
  return match ? (match[1] as SkillGrade) : null;
}

const OVERALL = /^\*\*([A-Z]\d+)\.\*\*\s+(.+)$/;
const SPECIFIC_HEADING = /^#### ([A-Z]\d+\.\d+)\b\s*(.*)$/;
const STATEMENT = /^\*\*([A-Z]\d+\.\d+)\*\*\s+(.+)$/;

/** Parses one curriculum file in the layout `content/sources/README.md` describes. */
export function parseSource(file: string, markdown: string, subject: Subject): GradeSource {
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

  const specific = expectations.filter((e) => e.kind === 'specific');
  if (specific.length === 0) throw new Error(`${file}: no specific expectations found`);
  return {
    grade,
    subject,
    framework: grade === 'K' ? 'ontario-kindergarten-2026' : GRADE_FRAMEWORKS[subject],
    strands: [...new Set(expectations.map((e) => e.code[0]))],
    file,
    expectations,
  };
}

/** Reads every grade file of one subject in `dir`, ordered K to 6. Ignores other files such as the README. */
export async function loadSources(dir: string, subject: Subject): Promise<GradeSource[]> {
  const files = (await readdir(dir)).filter((f) => gradeOfFile(f));
  const sources = await Promise.all(
    files.map(async (f) => parseSource(f, await readFile(join(dir, f), 'utf8'), subject)),
  );
  return sources.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade));
}
