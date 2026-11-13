import type { Skill, Subject } from '@bright-trail/shared';
import { z } from 'zod';
import type { Problem } from './checks';
import type { LlmRequest, ToolSpec } from './llm';
import { idPrefix, type Expectation, type GradeSource } from './sources';

export const GENERATOR_MODEL = 'claude-sonnet-5-5';
export const REVIEWER_MODEL = 'claude-haiku-5-5';

export const GeneratedSkillsSchema = z.strictObject({
  skills: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      expectationCodes: z.array(z.string()),
      prerequisiteIds: z.array(z.string()),
    }),
  ),
});
export type GeneratedSkills = z.infer<typeof GeneratedSkillsSchema>;

export const ReviewSchema = z.strictObject({
  corrections: z.array(
    z.strictObject({
      skillId: z.string(),
      /** False keeps the current list, so `prerequisiteIds` is ignored. */
      changePrerequisites: z.boolean(),
      prerequisiteIds: z.array(z.string()),
      /** Empty keeps the current text. */
      title: z.string(),
      description: z.string(),
      reason: z.string(),
    }),
  ),
  notes: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;
export type Correction = Review['corrections'][number];

function toolSpec(name: string, description: string, schema: z.ZodType): ToolSpec {
  const inputSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete inputSchema.$schema;
  return { name, description, inputSchema };
}

export const SUBMIT_SKILLS = toolSpec(
  'submit_skills',
  "Submit the complete list of skills for this grade. Call it exactly once with the whole grade's skills.",
  GeneratedSkillsSchema,
);

export const SUBMIT_REVIEW = toolSpec(
  'submit_review',
  'Submit corrections to the proposed skills. Call it exactly once. An empty list means no changes.',
  ReviewSchema,
);

const GRAPH_CONTEXT = `BrightTrail is a math learning app for Ontario kids from Kindergarten to Grade 6. Its skill graph is a tech tree: a skill unlocks only after its prerequisites are mastered. Kids who start in a higher grade get earlier skills marked as assumed. When a kid fails a skill twice, the app probes that skill's prerequisites, one level at a time, to find the real gap. So every prerequisite must be real and direct: list X only if a kid can't learn the skill without X, and no other listed prerequisite already depends on X.`;

const GENERATOR_SYSTEM = `${GRAPH_CONTEXT}

You turn official curriculum expectations into skills, one grade at a time.

Rules:
- Each skill is one ability a kid can show by answering short questions on a tablet: tap an answer, type a number, or drag on a number line.
- Keep an expectation as one skill when it's one ability. Split it only when it bundles abilities a kid could master separately, such as reading numbers and skip counting. Don't split a skill into small steps, such as reading and writing the same numbers, or adding and subtracting the same facts.
- Every specific expectation must be covered by at least one skill. A skill may list several codes from this grade when it genuinely combines them. Use the codes exactly as written.
- The whole graph from Kindergarten to Grade 6 should hold 80 to 110 skills, about one per specific expectation. Stay within the skill budget the prompt gives for the grade.
- Ids are kebab-case, start with the grade prefix you're given, and stay short, e.g. "g2-add-within-100".
- Titles have at most 6 words. Descriptions are one or two short sentences, spoken to the kid, that a 6-year-old understands when read aloud.
- Prerequisites come from this grade's skills or from earlier grades' skills. Never point to a later grade.
- Kindergarten foundations such as counting have no prerequisites. Every skill from Grade 1 up has at least one, and usually builds on the same idea from the grade before.
- Give your whole answer as the structured output, with every skill for this grade.`;

const REVIEWER_SYSTEM = `${GRAPH_CONTEXT}

You review one grade of a proposed skill graph and return corrections.

Check each skill:
- Each prerequisite is truly needed. Remove ones a kid could do without.
- Each prerequisite is direct. Remove one that another listed prerequisite already depends on.
- No needed prerequisite is missing, especially the same idea from the grade before.
- Prerequisites never point to a later grade or to the skill itself.
- The title and description match the expectation and suit a kid hearing them read aloud.

Return a correction only where something is wrong. An empty list is a fine answer. With changePrerequisites true, give the full new prerequisite list, using only ids that appear in the prompt. Leave title or description empty to keep it. Don't add, remove, or rename skills. Give your whole answer as the structured output.`;

const SUBJECT_NAMES: Record<Subject, string> = {
  math: 'math',
  language: 'language',
  science: 'science and technology',
  'social-studies': 'social studies',
  french: 'French',
  health: 'health',
  arts: 'the arts',
};

const ID_EXAMPLES: Partial<Record<Subject, string>> = {
  science: 'g2-sci-animal-needs',
  'social-studies': 'g2-soc-community-helpers',
  health: 'g2-hlth-food-groups',
};

/**
 * Math keeps its original prompts, so its cached calls stay valid. Other subjects start at Grade
 * 1 and check facts and ideas by tapping, sorting, ordering, and labelling.
 */
function systemPrompts(subject: Subject): { generator: string; reviewer: string } {
  if (subject === 'math') return { generator: GENERATOR_SYSTEM, reviewer: REVIEWER_SYSTEM };
  const name = SUBJECT_NAMES[subject];
  const context = GRAPH_CONTEXT.replace(
    'BrightTrail is a math learning app for Ontario kids from Kindergarten to Grade 6.',
    `BrightTrail is a learning app for Ontario kids from Kindergarten to Grade 6. This graph covers ${name}, from Grade 1 to Grade 6.`,
  );
  const generator = `${context}

You turn official ${name} curriculum expectations into skills, one grade at a time.

Rules:
- Each skill is one body of knowledge a kid can show by answering short questions on a tablet: pick the right fact, sort things into groups, put steps or events in order, or label the parts of a picture. Hands-on investigations, discussions, and projects can't be checked this way, so build the skill around the facts and ideas the expectation teaches.
- Some expectations teach a process instead of facts: investigating, designing, coding, or researching. Make each one a quiz on the process, using the grade's topics: put the steps in order, pick a question you could investigate, pick the fair test, pick what a few lines of code do, sort sources, or read a simple chart or map.
- Expectations marked "parent opt-in" only reach kids whose parent turns them on. Never mix one with other expectations in a skill, and never make a skill without the mark depend on one.
- Keep an expectation as one skill when it's one idea. Split it only when it bundles ideas a kid could master separately. Don't split a skill into small steps.
- Every specific expectation must be covered by at least one skill. A skill may list several codes from this grade when it genuinely combines them, but only codes from one strand (the code's first letter). Use the codes exactly as written.
- Aim for about one skill per specific expectation. Stay within the skill budget the prompt gives for the grade.
- Ids are kebab-case, start with the prefix you're given, and stay short, e.g. "${ID_EXAMPLES[subject] ?? 'g2-topic'}".
- Titles have at most 6 words. Descriptions are one or two short sentences, spoken to the kid, that a 6-year-old understands when read aloud. Never ask the kid to say, draw, write, or explain anything.
- Prerequisites come from this grade's skills or from earlier grades' skills. Never point to a later grade.
- Grade 1 skills may have no prerequisites. Every skill from Grade 2 up has at least one, usually the same topic from the grade before, or the closest earlier skill it builds on.
- Give your whole answer as the structured output, with every skill for this grade.`;
  return { generator, reviewer: REVIEWER_SYSTEM.replace(GRAPH_CONTEXT, context) };
}

function gradeName(source: GradeSource): string {
  return source.grade === 'K' ? 'Kindergarten' : `Grade ${source.grade}`;
}

function formatExpectation(e: Expectation): string {
  if (e.kind === 'overall') return `### ${e.code} (overall)\n\n${e.statement}`;
  const topic = e.topic ? ` ${e.topic}` : '';
  const optIn = e.parentOptIn ? ' (parent opt-in)' : '';
  return `### ${e.code}${topic}${optIn}\n\n${e.statement}\n\n${e.details}`.trim();
}

function formatSkill(
  s: Pick<Skill, 'id' | 'grade' | 'expectationCodes' | 'title' | 'description' | 'prerequisiteIds'>,
): string {
  const needs = s.prerequisiteIds.length > 0 ? s.prerequisiteIds.join(', ') : 'none';
  return `- ${s.id} [${s.expectationCodes.join(', ')}] ${s.title}: ${s.description} (needs: ${needs})`;
}

function earlierSection(earlier: readonly Skill[]): string {
  if (earlier.length === 0) return 'There are no earlier grades. This is the first grade.';
  return `Skills from earlier grades, which are valid prerequisites:\n\n${earlier.map(formatSkill).join('\n')}`;
}

// Cached LLM calls key on this wording, "strand B, C" included, so keep it.
function expectationsSection(source: GradeSource): string {
  return `${gradeName(source)} expectations (strand ${source.strands.join(', ')}):\n\n${source.expectations
    .map(formatExpectation)
    .join('\n\n')}`;
}

/** Keeps the graph near one skill per expectation, so K-6 lands at 80 to 110 skills. */
export function skillBudget(source: GradeSource): number {
  return source.expectations.filter((e) => e.kind === 'specific').length;
}

export function generateRequest(source: GradeSource, earlier: readonly Skill[]): LlmRequest {
  return {
    model: GENERATOR_MODEL,
    system: systemPrompts(source.subject).generator,
    tool: SUBMIT_SKILLS,
    maxTokens: 32000,
    prompt: `${earlierSection(earlier)}

${expectationsSection(source)}

Write the skills for ${gradeName(source)}. Every id starts with "${idPrefix(source.grade, source.subject)}". Budget: ${skillBudget(source)} skills at most.`,
  };
}

export function reviewRequest(
  source: GradeSource,
  earlier: readonly Skill[],
  proposed: readonly Skill[],
): LlmRequest {
  return {
    model: REVIEWER_MODEL,
    system: systemPrompts(source.subject).reviewer,
    tool: SUBMIT_REVIEW,
    maxTokens: 16000,
    prompt: `${earlierSection(earlier)}

${expectationsSection(source)}

Proposed ${gradeName(source)} skills:

${proposed.map(formatSkill).join('\n')}

Review the proposed ${gradeName(source)} skills.`,
  };
}

export function repairRequest(
  source: GradeSource,
  earlier: readonly Skill[],
  current: readonly Skill[],
  problems: readonly Problem[],
): LlmRequest {
  const { prompt, ...rest } = generateRequest(source, earlier);
  return {
    ...rest,
    prompt: `${prompt}

A previous answer failed these checks:

${problems.map((p) => `- ${p.message}`).join('\n')}

The previous answer:

${current.map(formatSkill).join('\n')}

Fix every problem and submit the complete corrected list for ${gradeName(source)}. Keep skills that had no problem as they are.`,
  };
}
