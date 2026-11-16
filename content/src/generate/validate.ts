import {
  ItemSchema,
  StoryNuggetSchema,
  toSpeech,
  type Item,
  type Skill,
  type StoryNugget,
  type Visual,
} from '@bright-trail/shared';
import type { z } from 'zod';
import { convertContent } from './convert';
import { numbersMentioned } from './numbers';
import { Rational } from './rational';
import type { GeneratedContent } from './schema';
import { solveItem, type CheckLevel } from './solver';
import {
  longWordShare,
  readingLimits,
  readingProblems,
  riskyProblems,
  speechProblems,
  type TextRole,
} from './text-checks';

export const ITEMS_PER_SKILL = 15;
/** Placement starts at difficulty 2 and steps one level up or down, so every level needs depth. */
export const MIN_PER_DIFFICULTY = 4;
export const MIN_PER_TYPE = 2;
/** Keypad entry holds 6 characters and has no minus key. */
export const KEYPAD_MAX_LENGTH = 6;
export const NUMBER_LINE_STEPS = { min: 2, max: 40 } as const;
/** Choice tiles fit a few big words. */
export const CHOICE_MAX_CHARS = 24;
/** Kindergarten and Grade 1 stories lean on pictures. */
export const PICTURE_SHARE = 0.6;

export interface SkillValidation {
  nugget: StoryNugget | null;
  items: Item[];
  /** Every problem, worded for the generator. Empty means the skill passes the code checks. */
  problems: string[];
  levels: Map<string, CheckLevel>;
}

function issues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

function visualProblems(visual: Visual | undefined): string[] {
  if (!visual || visual.kind === 'ten-frame' || visual.kind === 'fraction') return [];
  const ok =
    /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(visual.emoji) &&
    !/[\p{L}\s]/u.test(visual.emoji);
  return ok ? [] : [`"${visual.emoji}" is not an emoji`];
}

/** A fraction picture choice can't be seen by a non-reader, so its label must say the amount. */
function fractionNarrationProblems(visual: Visual, narration: string): string[] {
  if (visual.kind !== 'fraction') return [];
  const said = numbersMentioned(narration);
  const has = (value: Rational) => said.some((v) => v.eq(value));
  const shaded = Rational.of(visual.picked);
  const amount = shaded.div(Rational.of(visual.parts));
  if (has(amount) || (has(shaded) && has(Rational.of(visual.parts)))) return [];
  return [
    `narration "${narration}" must name the picture's amount, like "${visual.picked}/${visual.parts}" or "${visual.picked} of ${visual.parts} parts"`,
  ];
}

const normalize = (s: string) =>
  toSpeech(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** What the app says for a choice: its label, spoken. */
export function spokenChoice(choice: Extract<Item, { type: 'tap' }>['choices'][number]): string {
  if (choice.kind === 'number') return String(Number(choice.value.toFixed(6)));
  return choice.kind === 'text' ? choice.text : choice.narration;
}

function namesChoice(narration: string, label: string): boolean {
  const said = ` ${normalize(narration)} `;
  return said.includes(` ${normalize(label)} `);
}

function withoutLabels(narration: string, labels: readonly string[]): string {
  let text = narration;
  // Longest first, so "1 and a half" goes before "1".
  for (const label of [...labels].sort((a, b) => b.length - a.length)) {
    if (!label) continue;
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(?<![\\w.])${escaped}(?!\\w)`, 'gi'), ' ');
  }
  return text.replace(/ +([,?.!])/g, '$1');
}

/** Runs every code check on one skill's generated content. */
export function validateSkill(skill: Skill, content: GeneratedContent): SkillValidation {
  const problems: string[] = [];
  const levels = new Map<string, CheckLevel>();
  const converted = convertContent(skill.id, content);
  const texts: string[] = [];

  // `readAs` is the text the reading level applies to, when it differs from what is spoken.
  const checkText = (
    where: string,
    text: string | undefined,
    role: TextRole,
    spoken: boolean,
    readAs = text,
  ) => {
    if (!text) return;
    texts.push(text);
    const found = [
      ...readingProblems(readAs!, role, skill.grade),
      ...riskyProblems(text),
      ...(spoken ? speechProblems(text) : []),
    ];
    for (const p of found) problems.push(`${where}: ${p}`);
  };

  const nuggetResult = StoryNuggetSchema.safeParse(converted.nugget);
  const nugget = nuggetResult.success ? nuggetResult.data : null;
  if (!nuggetResult.success) {
    for (const issue of issues(nuggetResult.error)) problems.push(`story: ${issue}`);
  } else {
    nugget!.cards.forEach((card, i) => {
      const where = `story card ${i + 1}`;
      checkText(`${where} narration`, card.narration, 'card', true);
      checkText(`${where} text`, card.text, 'prompt', false);
      for (const p of visualProblems(card.visual)) problems.push(`${where}: ${p}`);
    });
    if (skill.grade === 'K' || skill.grade === '1') {
      const pictured = nugget!.cards.filter((c) => c.visual).length;
      if (pictured < Math.ceil(nugget!.cards.length * PICTURE_SHARE)) {
        problems.push(
          `story: only ${pictured} of ${nugget!.cards.length} cards have a picture, Grade ${skill.grade} needs ${Math.round(PICTURE_SHARE * 100)}%`,
        );
      }
    }
  }

  if (converted.items.length !== ITEMS_PER_SKILL) {
    problems.push(`there are ${converted.items.length} items, need exactly ${ITEMS_PER_SKILL}`);
  }

  const items: Item[] = [];
  converted.items.forEach((raw, i) => {
    const where = `item ${i + 1} (${String(raw.type)})`;
    const parsed = ItemSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of issues(parsed.error)) problems.push(`${where}: ${issue}`);
      return;
    }
    const item = parsed.data;
    items.push(item);

    const solved = solveItem(item, converted.checks.get(item.id)!);
    levels.set(item.id, solved.level);
    for (const p of solved.problems) problems.push(`${where}: ${p}`);

    // Tap narration must list every choice, so the choice labels don't count toward its length.
    const labels = item.type === 'tap' ? item.choices.map(spokenChoice) : [];
    checkText(
      `${where} narration`,
      item.narration,
      'question',
      true,
      withoutLabels(item.narration, labels),
    );
    checkText(`${where} prompt`, item.prompt, 'prompt', false);
    checkText(`${where} why`, item.why, 'why', true);

    if (item.type === 'tap') {
      for (const p of visualProblems(item.visual)) problems.push(`${where}: ${p}`);
      for (const choice of item.choices) {
        const label = spokenChoice(choice);
        if (choice.kind === 'text') {
          checkText(`${where} choice ${choice.id}`, choice.text, 'choice', true);
          if (choice.text.length > CHOICE_MAX_CHARS) {
            problems.push(`${where}: choice ${choice.id} is over ${CHOICE_MAX_CHARS} characters`);
          }
        }
        if (choice.kind === 'visual') {
          checkText(`${where} choice ${choice.id}`, choice.narration, 'choice', true);
          for (const p of [
            ...visualProblems(choice.visual),
            ...fractionNarrationProblems(choice.visual, choice.narration),
          ])
            problems.push(`${where} choice ${choice.id}: ${p}`);
        }
        if (!namesChoice(item.narration, label)) {
          problems.push(
            `${where}: narration must name choice ${choice.id} ("${label}") so a non-reader hears it`,
          );
        }
      }
    }
    if (item.type === 'keypad') {
      for (const p of visualProblems(item.visual)) problems.push(`${where}: ${p}`);
      const typed = String(Number(item.answer.toFixed(6)));
      if (item.answer < 0)
        problems.push(`${where}: the keypad has no minus key, answer must be 0 or more`);
      if (typed.length > KEYPAD_MAX_LENGTH) {
        problems.push(
          `${where}: answer ${typed} is longer than ${KEYPAD_MAX_LENGTH} keypad characters`,
        );
      }
    }
    if (item.type === 'number-line') {
      const steps = Math.round((item.max - item.min) / item.step);
      if (steps < NUMBER_LINE_STEPS.min || steps > NUMBER_LINE_STEPS.max) {
        problems.push(
          `${where}: the line has ${steps} steps, keep it to ${NUMBER_LINE_STEPS.min}-${NUMBER_LINE_STEPS.max} so a finger can hit one`,
        );
      }
    }
  });

  const byDifficulty = [1, 2, 3].map((d) => items.filter((i) => i.difficulty === d).length);
  byDifficulty.forEach((n, i) => {
    if (n < MIN_PER_DIFFICULTY) {
      problems.push(`only ${n} items at difficulty ${i + 1}, need at least ${MIN_PER_DIFFICULTY}`);
    }
  });
  if (skill.subject === 'math') {
    for (const type of ['tap', 'keypad', 'number-line'] as const) {
      const n = items.filter((i) => i.type === type).length;
      if (n < MIN_PER_TYPE) problems.push(`only ${n} ${type} items, need at least ${MIN_PER_TYPE}`);
    }
  } else {
    // Fact skills have no numbers to type or place, and the sort, order, and label games tap.
    items.forEach((item, i) => {
      if (item.type !== 'tap') problems.push(`item ${i + 1} is ${item.type}, use only tap items`);
    });
  }

  const seen = new Map<string, number>();
  items.forEach((item, i) => {
    // Same question heard, or the same thing on screen with the same answer.
    const shown = JSON.stringify({ ...item, id: '', narration: '', why: '' });
    for (const key of [`n:${normalize(item.narration)}`, `s:${shown}`]) {
      const first = seen.get(key);
      if (first !== undefined) {
        problems.push(`item ${i + 1} repeats item ${first + 1}`);
        break;
      }
      seen.set(key, i);
    }
  });

  const { share, examples } = longWordShare(texts);
  const limit = readingLimits(skill.grade).longWordShare;
  if (share > limit) {
    problems.push(
      `${Math.round(share * 100)}% of words are long (3+ syllables), Grade ${skill.grade} max is ${Math.round(limit * 100)}%: ${examples.join(', ')}`,
    );
  }

  return { nugget, items, problems, levels };
}
