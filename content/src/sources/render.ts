import { SUBJECT_FRAMEWORKS } from '@bright-trail/shared';
import {
  API,
  FSL_PROGRAMS,
  KINDERGARTEN,
  KINDERGARTEN_MATH,
  KINDERGARTEN_SPLIT,
  type Curriculum,
} from './curricula';
import { htmlToMarkdown } from './html';

export interface ApiElement {
  type: string;
  value: unknown;
}
export interface ApiItem {
  system: { codename: string; type: string; name: string };
  elements: Record<string, ApiElement>;
}
export interface ApiResponse {
  item: ApiItem;
  modular_content: Record<string, ApiItem>;
}

export interface CoursePlan {
  grade: string;
  /** FSL program, such as `core`. Other subjects have one program. */
  program?: string;
  /** Course name, such as "Science and Technology". */
  name: string;
  strands: string;
  /** Path under the subject's folder. */
  file: string;
}

/** Elaborations kept, by the English half of their `pedagogical_supports` name. The rest are teaching aids. */
const KEPT: Record<string, string> = {
  Examples: 'Examples',
  'Key Concepts': 'Key concepts',
  'Knowledge and skills': 'Knowledge and skills',
};

export const strandsUrl = (codename: string) => `${API}${codename}?language=en-CA&depth=6`;

function text(item: ApiItem, key: string): string {
  const v = item.elements[key]?.value;
  return typeof v === 'string' ? v : '';
}
function refs(item: ApiItem, key: string): string[] {
  const v = item.elements[key]?.value;
  return Array.isArray(v) ? (v as string[]) : [];
}
function terms(item: ApiItem, key: string): { name: string; codename: string }[] {
  const v = item.elements[key]?.value;
  return Array.isArray(v) ? (v as { name: string; codename: string }[]) : [];
}

function lookup(res: ApiResponse, codename: string): ApiItem {
  const item = res.modular_content[codename];
  if (!item) throw new Error(`${res.item.system.codename}: ${codename} missing; fetch deeper`);
  return item;
}

/** Year the framework name carries, e.g. 2022 for `ontario-science-2022`. */
export function frameworkYear(subject: Curriculum['subject']): string {
  return SUBJECT_FRAMEWORKS[subject].slice(-4);
}

/**
 * Finds the Grade 1–6 courses of a curriculum item fetched with depth 2.
 * Throws when the Ministry's year moved past the framework's, since that needs a new framework.
 */
export function planCourses(res: ApiResponse, curriculum: Curriculum): CoursePlan[] {
  const year = text(res.item, 'monarchs_printer_year');
  if (year !== frameworkYear(curriculum.subject)) {
    throw new Error(
      `${curriculum.subject} is now the ${year} curriculum, not ${frameworkYear(curriculum.subject)}. Add a framework for it.`,
    );
  }
  const plans: CoursePlan[] = [];
  for (const code of refs(res.item, 'specific_courses')) {
    const course = lookup(res, code);
    const grade = /^n([1-6])$/.exec(terms(course, 'site___grade')[0]?.codename ?? '')?.[1];
    if (!grade) continue;
    const strands = refs(course, 'sections').find(
      (s) => text(lookup(res, s), 'url_slug') === 'strands',
    );
    if (!strands) throw new Error(`${code} has no strands section`);
    let program: string | undefined;
    if (curriculum.subject === 'french') {
      const tag = terms(course, 'site___language_program')[0]?.codename ?? '';
      if (!(tag in FSL_PROGRAMS)) throw new Error(`${code} has unknown FSL program "${tag}"`);
      program = FSL_PROGRAMS[tag];
      if (!program) continue;
    }
    const file = `${program ? `${program}-` : ''}grade-${grade}.md`;
    if (plans.some((p) => p.file === file)) throw new Error(`Two courses map to ${file}`);
    plans.push({ grade, program, name: text(course, 'name').trim(), strands, file });
  }
  return plans.sort((a, b) => a.file.localeCompare(b.file, 'en', { numeric: true }));
}

function renderObject(res: ApiResponse, codename: string): string {
  const item = lookup(res, codename);
  const resolve = (c: string) => renderObject(res, c);
  const body = htmlToMarkdown(text(item, 'content'), resolve);
  const title = text(item, 'title').trim();
  return title ? `**${title}**\n\n${body}` : body;
}

/** Elaborations in page order. Language nests some in "Additional information" collections. */
function elaborations(res: ApiResponse, codes: string[]): ApiItem[] {
  return codes.flatMap((c) => {
    const item = lookup(res, c);
    if (item.system.type === 'elaborations') return [item];
    if (item.system.type === 'ui___content_collection')
      return elaborations(res, refs(item, 'sections'));
    return [];
  });
}

export interface GradeMeta {
  curriculum: Curriculum;
  plan: CoursePlan;
  retrieved: string;
}

const PROGRAM_NAMES: Record<string, string> = {
  core: 'Core French',
  extended: 'Extended French',
  immersion: 'French Immersion',
};

/** Writes one grade's strands, fetched with depth 6, in the layout `content/sources/README.md` describes. */
export function renderGrade(res: ApiResponse, meta: GradeMeta): string {
  const { curriculum, plan } = meta;
  const year = frameworkYear(curriculum.subject);
  const name = plan.program
    ? `French as a Second Language: ${PROGRAM_NAMES[plan.program]}`
    : plan.name;
  const out: string[] = [
    `# Grade ${plan.grade} ${name}`,
    '',
    `- **Source:** *${curriculum.title}, ${year}*, Grade ${plan.grade}${plan.program ? `, ${PROGRAM_NAMES[plan.program]}` : ''}`,
    '- **Publisher:** Ontario Ministry of Education, Curriculum and Resources site',
    `- **Version:** ${year} (current at retrieval)`,
    `- **Captured via:** the site's public content API, item \`${plan.strands}\` (${strandsUrl(plan.strands)})`,
    `- **Retrieved:** ${meta.retrieved}`,
    `- **Content kept:** each strand's overview, overall and specific expectations, and each specific expectation's Examples, Key concepts, and Knowledge and skills. Teacher prompts, instructional tips, sample questions, and student talk are omitted. Images appear as their official alt text.`,
  ];

  return finish([...out, ...renderStrands(res, () => true)]);
}

function finish(lines: string[]): string {
  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

/** Writes the strands `res.item` lists, keeping the overall expectations `keep` accepts. Strands left empty are dropped. */
function renderStrands(res: ApiResponse, keep: (code: string) => boolean): string[] {
  const md = (html: string) => htmlToMarkdown(html, (c) => renderObject(res, c));
  const out: string[] = [];
  for (const code of refs(res.item, 'sections')) {
    const strand = lookup(res, code);
    if (strand.system.type !== 'l3___strand') continue;
    const letter = text(strand, 'title_index').trim();
    if (!/^[A-Z]$/.test(letter)) throw new Error(`${code}: strand letter "${letter}"`);
    const overalls = refs(strand, 'overall_expectations')
      .map((oc) => lookup(res, oc))
      .filter((o) => o.system.type === 'l4___overall_expectation')
      .filter((o) => keep(text(o, 'title_index').trim()));
    if (overalls.length === 0) continue;
    out.push('', `## Strand ${letter}: ${text(strand, 'title').trim()}`);

    for (const c of refs(strand, 'why_is_this_learning_important')) {
      out.push('', '### Why is this learning important?', '', md(text(lookup(res, c), 'content')));
    }
    for (const c of refs(strand, 'description')) {
      const item = lookup(res, c);
      out.push(
        '',
        `### ${text(item, 'title').trim() || 'Overview'}`,
        '',
        md(text(item, 'content')),
      );
    }

    for (const overall of overalls) {
      const oc = overall.system.codename;
      const ocode = text(overall, 'title_index').trim();
      if (!ocode.startsWith(letter)) throw new Error(`${oc}: ${ocode} is not in strand ${letter}`);
      out.push('', `### ${ocode}. ${text(overall, 'title').trim()}`.trimEnd(), '');
      out.push(`**${ocode}.** ${md(text(overall, 'content'))}`);

      for (const sc of refs(overall, 'specific_expectations')) {
        const specific = lookup(res, sc);
        // Lists also hold callouts that link to other pages.
        if (specific.system.type !== 'l5___specific_expectation') continue;
        const scode = text(specific, 'title_index').trim();
        if (!scode.startsWith(`${ocode}.`))
          throw new Error(`${sc}: ${scode} is not under ${ocode}`);
        out.push('', `#### ${scode} ${text(specific, 'title').trim()}`.trimEnd(), '');
        out.push(`**${scode}** ${md(text(specific, 'content'))}`);

        const attached = [
          ...refs(specific, 'elaborations'),
          ...refs(specific, 'non_curriculum_elaborations'),
        ];
        for (const elaboration of elaborations(res, attached)) {
          const label = terms(elaboration, 'pedagogical_supports')[0]?.name.split(' | ')[0];
          if (!label || !KEPT[label]) continue;
          out.push('', `**${KEPT[label]}**`, '', md(text(elaboration, 'elaboration')));
        }
      }
    }
  }
  return out;
}

/** Strands section of the Kindergarten course, fetched with depth 2. Throws when the Ministry's year moved on. */
export function kindergartenStrands(res: ApiResponse): string {
  const year = text(res.item, 'year_issued').trim();
  const expected = KINDERGARTEN.framework.slice(-4);
  if (year !== expected) {
    throw new Error(
      `Kindergarten is now the ${year} curriculum, not ${expected}. Add a framework for it.`,
    );
  }
  const strands = refs(res.item, 'sections').find(
    (s) => text(lookup(res, s), 'url_slug') === 'strands',
  );
  if (!strands) throw new Error(`${res.item.system.codename} has no strands section`);
  return strands;
}

/** Overall expectation codes in the strands collection, in page order. */
export function overallCodes(res: ApiResponse): string[] {
  return refs(res.item, 'sections')
    .map((s) => lookup(res, s))
    .filter((s) => s.system.type === 'l3___strand')
    .flatMap((s) => refs(s, 'overall_expectations').map((o) => lookup(res, o)))
    .filter((o) => o.system.type === 'l4___overall_expectation')
    .map((o) => text(o, 'title_index').trim());
}

/** Throws unless every overall expectation is filed under exactly one subject or kept with math. */
export function checkKindergartenSplit(codes: readonly string[]): void {
  const filed = [...Object.values(KINDERGARTEN_SPLIT).flat(), ...KINDERGARTEN_MATH];
  const twice = filed.filter((c, i) => filed.indexOf(c) !== i);
  if (twice.length) throw new Error(`Kindergarten codes filed twice: ${twice.join(', ')}`);
  const unfiled = codes.filter((c) => !filed.includes(c));
  if (unfiled.length) {
    throw new Error(
      `Kindergarten has new overall expectations ${unfiled.join(', ')}. File them in KINDERGARTEN_SPLIT.`,
    );
  }
  const gone = filed.filter((c) => !codes.includes(c));
  if (gone.length) throw new Error(`Kindergarten no longer has ${gone.join(', ')}`);
}

export interface KindergartenMeta {
  subject: Curriculum['subject'];
  strands: string;
  retrieved: string;
}

/** Writes one subject's share of the Kindergarten strands, fetched with depth 6. */
export function renderKindergarten(res: ApiResponse, meta: KindergartenMeta): string {
  const codes = KINDERGARTEN_SPLIT[meta.subject];
  if (!codes?.length) throw new Error(`Kindergarten files nothing under ${meta.subject}`);
  const range = codes.length > 1 ? `${codes[0]}–${codes[codes.length - 1]}` : codes[0];
  const out = [
    `# Kindergarten: ${KINDERGARTEN_NAMES[meta.subject]}`,
    '',
    `- **Source:** *${KINDERGARTEN.title}*, overall expectations ${range}`,
    '- **Publisher:** Ontario Ministry of Education, Curriculum and Resources site',
    '- **Version:** 2026 (in effect from the 2026–27 school year)',
    `- **Captured via:** the site's public content API, item \`${meta.strands}\` (${strandsUrl(meta.strands)})`,
    `- **Retrieved:** ${meta.retrieved}`,
    `- **Content kept:** overall expectations ${range}, their strand's overview, each specific expectation, and its Examples and Knowledge and skills. Images appear as their official alt text.`,
  ];
  return finish([...out, ...renderStrands(res, (code) => codes.includes(code))]);
}

const KINDERGARTEN_NAMES: Record<Curriculum['subject'], string> = {
  language: 'Language Expectations',
  science: 'Science and Technology Expectations',
  'social-studies': 'Social Studies Expectations',
  french: 'French Expectations',
  health: 'Health and Physical Education Expectations',
  arts: 'Arts Expectations',
};
