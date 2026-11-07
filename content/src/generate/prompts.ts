import {
  describeVisual as describeShape,
  type Item,
  type Skill,
  type StoryNugget,
  type Visual,
} from '@bright-trail/shared';
import { z } from 'zod';
import { GENERATOR_MODEL, REVIEWER_MODEL } from '../graph/prompts';
import type { LlmRequest, ToolSpec } from '../graph/llm';
import { gradeRank, type Expectation } from '../graph/sources';
import {
  BasicContentSchema,
  ContentReviewSchema,
  FractionContentSchema,
  type GeneratedContent,
} from './schema';
import type { CheckLevel } from './solver';
import { readingLimits } from './text-checks';
import { CHOICE_MAX_CHARS, ITEMS_PER_SKILL, spokenChoice } from './validate';

export { GENERATOR_MODEL, REVIEWER_MODEL };

/** Skills whose items are graded by range, e.g. "closer to 5 or closer to 10?". */
export const ESTIMATION_SKILLS = new Set([
  'k-estimate-and-count',
  'g1-estimate-50',
  'g2-estimate-200',
]);

function toolSpec(name: string, description: string, schema: z.ZodType): ToolSpec {
  const inputSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete inputSchema.$schema;
  return { name, description, inputSchema };
}

/**
 * Skills about parts of one whole, which draw the parts with fraction pictures. Other skills keep
 * the basic pictures, so their prompts, and cached responses, stay as they were.
 */
export const FRACTION_PICTURE_SKILLS = new Set([
  'g1-fair-share-drawings',
  'g1-half-equals-two-fourths',
  'g1-compare-unit-fractions',
  'g1-equal-groups',
  'g2-fair-share-fractions',
  'g2-third-equals-two-sixths',
  'g2-equal-groups-multiply',
  'g3-fair-share-20',
  'g3-equivalent-fair-shares',
  'g3-fraction-repeated-addition',
  'g4-represent-fractions',
  'g4-compare-fair-shares',
  'g4-count-unit-fractions',
  'g5-add-sub-like-fractions',
]);

const SUBMIT_DESCRIPTION = `Submit one skill's story cards and its ${ITEMS_PER_SKILL} practice items. Call it exactly once.`;

export const SUBMIT_CONTENT = toolSpec('submit_content', SUBMIT_DESCRIPTION, BasicContentSchema);
export const SUBMIT_FRACTION_CONTENT = toolSpec(
  'submit_content',
  SUBMIT_DESCRIPTION,
  FractionContentSchema,
);

export const SUBMIT_CONTENT_REVIEW = toolSpec(
  'submit_content_review',
  'Submit the problems found in one skill. Call it exactly once. An empty list means it is fine.',
  ContentReviewSchema,
);

const APP_CONTEXT = `BrightTrail is an audio-first math app for Ontario kids from Kindergarten to Grade 6. Device text-to-speech reads every story card, question, and answer choice aloud, so a child who can't read yet must be able to play from sound alone. A child answers only by tapping a choice, typing a number on a keypad, or dragging a frog along a number line. There are no images: pictures are drawn from data as one emoji, a row of up to 20 copies of one emoji, or a ten-frame.`;

const GENERATOR_SYSTEM = `${APP_CONTEXT}

You write the content for one skill: a short narrated story that teaches it, then ${ITEMS_PER_SKILL} practice items.

Story, 5 to 8 cards:
- One small story with a named character and a concrete situation, building up to the idea step by step. The last card invites the child to practise.
- narration is what the device says. text is optional short screen text such as "3 + 2 = 5" (null for none). visual is optional.
- If a card says "here are 6 apples", its visual shows 6 apples.

Pictures (visual), the only kinds that exist:
- {"kind":"emoji","emoji":"🐸","count":null,"filled":null}: one emoji.
- {"kind":"objects","emoji":"🍎","count":6,"filled":null}: 1 to 20 copies of one emoji.
- {"kind":"ten-frame","emoji":null,"count":null,"filled":7}: a ten-frame with 0 to 10 dots.
There are no fraction pictures, shapes, arrays, charts, or number-line pictures. Never refer to a picture that can't be drawn this way. Use null for no picture.

Items, exactly ${ITEMS_PER_SKILL}:
- 5 at difficulty 1 (easy), 5 at difficulty 2 (on grade level), 5 at difficulty 3 (hardest, still this skill). Stay inside this skill and grade.
- Use all three types, at least 3 of each: tap, keypad, number-line. Every item asks something different.
- narration: the question as heard. It must make sense with eyes closed. Never "look at the choices" or "which of these".
- prompt: short screen text, e.g. "7 + 5 = ?" or "How many fish?".
- why: one or two kind sentences, read after a miss, showing how to get the right answer.
- tap: 2 to 4 choices with ids a, b, c, d. A choice is {"kind":"number","value":7}, {"kind":"text","text":"closer to 10"} (at most ${CHOICE_MAX_CHARS} characters), or {"kind":"visual","visual":{...},"narration":"three apples"}. Exactly one choice is right, given in answerChoiceId. Vary where the right one sits. The narration must name every choice, written exactly as the choice shows it, e.g. "Is it closer to 5 or closer to 10?" or "Which is greater, 3/4 or 2/3?". The app shuffles choices, so never say "the first one".
- keypad: answer is a number 0 or more with at most 6 characters, like 42, 0.75, or 1200. No fractions, no negatives. visual is optional.
- number-line: min, max, step, and target. 2 to 40 steps, the target on a step. Labels show as whole numbers or decimals. No visual (use null).
- Unused fields are null. Non-tap items have choices [] and answerChoiceId "".

Writing numbers. The app turns these into words before speaking, so write them exactly like this:
- Digits as the screen shows them: 7, 24 336 (a space between thousands, never a comma), 0.25, 3/4, 1 3/4, $2.50, 75¢, 25%, -6.
- Operators with spaces: 3 + 4 = 7, 9 - 4, 6 × 5, 12 ÷ 3.
- Never: ordinals in digits (write "third"), colons or commas inside numbers, ranges like 1-10 (write "1 to 10"), brackets or parentheses in spoken text (say "first add 3 and 4, then multiply by 2"), symbols like < > ≈ ^ * or a lone /, emoji in any narration, why, or choice text, or " - " as a dash in a sentence (it is read as "minus").

Never use these words in anything the child hears or sees: say, out loud, draw, write, tell how, explain, show how. The child can't speak, draw, or write answers.

check: how code re-computes the answer. Write expressions with numbers, + - * / % ^, brackets, comparisons (< <= > >= == !=), and, or, not, and the functions roundTo(x, unit) (halves round up), floor, ceil, abs, min, max, isEven, isOdd, isPrime. The word count means how many objects the item's picture shows. Use only numbers the child sees or hears.
- rule "equals": expr is the exact answer. Keypad: expr equals answer. Number line: expr equals target. Tap: exactly one choice is worth expr. Choices that are not plain numbers (text like "closer to 10", a word, a picture) get their value in check.choices, e.g. [{"id":"a","expr":"10"}].
- rule "nearest": a range question, such as estimating or "closer to". expr is the true amount, each choice is a benchmark, and the right choice is the closest one. Keep the true amount clearly closer to one benchmark, never near halfway.
- rule "greatest" or "least": the right choice is the biggest or smallest. Give values for choices that are not plain numbers.
- rule "true": yes or no, even or odd, true or false, prime or composite. Each choice gets a statement in check.choices that is true only for the right choice, e.g. even: "isEven(14)", odd: "isOdd(14)", yes: "3/4 > 2/3", no: "not (3/4 > 2/3)".
- rule "none": only when no rule fits, with a note saying why. A second reviewer then checks it by hand, so use it rarely.
- choices is [] when no choice needs a value. note is "" unless the rule is "none".

Give your whole answer as the structured output.`;

const BASIC_PICTURES =
  'There are no images: pictures are drawn from data as one emoji, a row of up to 20 copies of one emoji, or a ten-frame.';

const BASIC_PICTURE_LIST = `- {"kind":"emoji","emoji":"🐸","count":null,"filled":null}: one emoji.
- {"kind":"objects","emoji":"🍎","count":6,"filled":null}: 1 to 20 copies of one emoji.
- {"kind":"ten-frame","emoji":null,"count":null,"filled":7}: a ten-frame with 0 to 10 dots.
There are no fraction pictures, shapes, arrays, charts, or number-line pictures.`;

const NONE = '"shape":null,"parts":null,"shaded":null,"wholes":null,"label":null';

const FRACTION_PICTURE_LIST = `- {"kind":"emoji","emoji":"🐸","count":null,"filled":null,${NONE}}: one emoji.
- {"kind":"objects","emoji":"🍎","count":6,"filled":null,${NONE}}: 1 to 20 copies of one whole thing.
- {"kind":"ten-frame","emoji":null,"count":null,"filled":7,${NONE}}: a ten-frame with 0 to 10 dots.
- {"kind":"fraction","emoji":null,"count":null,"filled":null,"shape":"circle","parts":4,"shaded":3,"wholes":null,"label":null}: one whole cut into 2 to 12 equal parts with some shaded, here 3/4 of a circle. shape is "circle" (a pizza or pie), "rectangle" (a pan or chocolate bar, cut into a grid), or "bar" (a fraction strip). For more than one whole, wholes is 2 to 4 and shading fills the first whole before the next: 7/4 is wholes 2, parts 4, shaded 7. label is short screen text under the picture, such as "3/4", or null. Leave it null when the question asks what the picture shows.
There are no arrays, charts, number-line pictures, or shapes with unequal parts.`;

const BASIC_CHECK_WORDS = "The word count means how many objects the item's picture shows.";
const FRACTION_CHECK_WORDS = `${BASIC_CHECK_WORDS} With a fraction picture, parts is the parts in one whole and shaded is the shaded parts, so shaded / parts is the fraction it shows. When the answer is read off the picture, write it with these words, e.g. "shaded / parts" or "parts - shaded", so code checks the picture against the answer. A picture choice is worth the fraction it shows, and its narration names that amount in digits, like "3/4 of the circle".`;

/** The same prompt with the fraction picture kind added. Parts a prompt lacks stay as they are. */
export function withFractionPictures(system: string): string {
  return system
    .replace(
      BASIC_PICTURES,
      BASIC_PICTURES.replace('or a ten-frame.', 'a ten-frame, or a shape cut into equal parts.'),
    )
    .replace(BASIC_PICTURE_LIST, FRACTION_PICTURE_LIST)
    .replace(BASIC_CHECK_WORDS, FRACTION_CHECK_WORDS);
}

const TONE: Record<Skill['grade'], string> = {
  K: 'The child is 4 or 5 and cannot read. Use very short sentences of 3 to 8 words, everyday words, and a warm, playful voice. Every story card has a picture. Keep numbers to 10 unless the skill needs up to 20.',
  '1': 'The child is 6 and just starting to read. Use short sentences and everyday words. Most story cards have a picture. Keep numbers inside the skill, mostly to 20 or 50.',
  '2': 'The child is 7. Use short, clear sentences and a friendly voice. Pictures help, but cards can also show number sentences.',
  '3': 'The child is 8. Friendly but not cute. Use everyday situations like games, snacks, and sports.',
  '4': 'The child is 9. Friendly but not cute. Use everyday situations like sports, money, and building things.',
  '5': 'The child is 10 and reads well. Do not talk down: no baby talk, no "yay", no cutesy mascots. Use real situations like sports stats, recipes, money, science, and games, and the correct math words such as numerator, denominator, and equivalent.',
  '6': 'The child is 11 and reads well. Do not talk down: no baby talk, no "yay", no cutesy mascots. Use real situations like sports stats, temperatures, recipes, budgets, and games, and the correct math words such as integer, ratio, and equivalent.',
};

const ESTIMATION_NOTE = `This is an estimation skill, so grade by range, not by one exact count. Most items are tap items with rule "nearest": the child sees or hears an amount and picks the closer benchmark, e.g. "Is it closer to 5 or closer to 10?", with text choices "closer to 5" and "closer to 10" valued 5 and 10 in check.choices. A picture shows at most 20 objects. For bigger amounts, describe them by groups the child can picture, e.g. "4 full bags of 10 marbles and 2 more", and keep the true amount in expr. Keypad and number-line items can ask the exact count to check the estimate.`;

const FRACTION_PICTURE_NOTE = `This skill is about parts of a whole, so draw the parts with fraction pictures. Use one whenever a card or item talks about one whole cut into equal parts, such as a pizza in slices, a pan of brownies, or a strip of paper. Never show slices, halves, or pieces as copies of an emoji: 4 × 🍕 is four whole pizzas. Use objects only for whole things, such as 8 × 🍪 shared between friends, and show a leftover that gets cut as a fraction picture. The picture must match the words: if Mia eats 3 of 4 equal slices, it is a circle with parts 4 and shaded 3. Kindergarten and Grade 1 stories still need a picture on at least 6 of every 10 cards.`;

const FRACTION_NOTE = `This skill is about parts of a whole, and no picture can show one thing cut into pieces. An objects picture shows whole copies: 4 × 🍕 is four pizzas, not one pizza in 4 slices. So picture the pieces as separate things, e.g. "4 slices" shown as 4 × 🍕 only when the narration calls each one a slice, or share whole objects like 8 × 🍪 between friends. Never say a picture shows one whole cut up. Kindergarten and Grade 1 stories still need a picture on at least 6 of every 10 cards.`;

/** Fraction skills in the early grades, where pictures of parts are easiest to get wrong. */
export function isEarlyFractionSkill(skill: Skill): boolean {
  return (
    gradeRank(skill.grade) <= gradeRank('4') &&
    /fraction|half|halves|third|fourth|share/i.test(`${skill.title} ${skill.description}`)
  );
}

function gradeName(grade: Skill['grade']): string {
  return grade === 'K' ? 'Kindergarten' : `Grade ${grade}`;
}

const MAX_DETAILS = 1500;

function formatExpectation(e: Expectation): string {
  const details =
    e.details.length > MAX_DETAILS ? `${e.details.slice(0, MAX_DETAILS)}…` : e.details;
  return `${e.code}: ${e.statement}${details ? `\n\n${details}` : ''}`;
}

export interface SkillContext {
  skill: Skill;
  /** The curriculum text for the skill's expectation codes. */
  expectations: readonly Expectation[];
  prerequisites: readonly Skill[];
}

export function generateRequest({ skill, expectations, prerequisites }: SkillContext): LlmRequest {
  const limits = readingLimits(skill.grade);
  const fractions = FRACTION_PICTURE_SKILLS.has(skill.id);
  const fractionNote = fractions
    ? `\n${FRACTION_PICTURE_NOTE}\n`
    : isEarlyFractionSkill(skill)
      ? `\n${FRACTION_NOTE}\n`
      : '';
  const needs = prerequisites.length
    ? prerequisites.map((p) => `- ${p.title}: ${p.description}`).join('\n')
    : 'None. This is a starting skill.';
  return {
    model: GENERATOR_MODEL,
    system: fractions ? withFractionPictures(GENERATOR_SYSTEM) : GENERATOR_SYSTEM,
    tool: fractions ? SUBMIT_FRACTION_CONTENT : SUBMIT_CONTENT,
    maxTokens: 32000,
    prompt: `Skill ${skill.id}, ${gradeName(skill.grade)}: ${skill.title}
${skill.description}

Curriculum expectations:

${expectations.map(formatExpectation).join('\n\n')}

The child already knows:
${needs}

Voice: ${TONE[skill.grade]} Sentences have at most ${limits.sentenceWords} words. A story card's narration has at most ${limits.cardWords} words, a question at most ${limits.questionWords}, a why at most ${limits.whyWords}. Keep long words (3+ syllables) under ${Math.round(limits.longWordShare * 100)}% of all words; number words don't count.
${ESTIMATION_SKILLS.has(skill.id) ? `\n${ESTIMATION_NOTE}\n` : ''}${fractionNote}
Write the story and the ${ITEMS_PER_SKILL} items for ${skill.id}.`,
  };
}

export function repairRequest(
  context: SkillContext,
  previous: GeneratedContent,
  problems: readonly string[],
): LlmRequest {
  const { prompt, ...rest } = generateRequest(context);
  return {
    ...rest,
    prompt: `${prompt}

A previous answer failed these checks. Items count from 1 in the order given, and story cards too.

${problems.map((p) => `- ${p}`).join('\n')}

The previous answer:

${JSON.stringify(previous)}

Fix every problem and submit the complete corrected story and all ${ITEMS_PER_SKILL} items. Keep what had no problem as it is.`,
  };
}

const REVIEWER_SYSTEM = `${APP_CONTEXT}

You review one skill's story and practice items before children see them. No teacher checks them after you.

Report a problem as a blocker when:
- the marked answer is wrong, or more than one choice is right, or the right answer is missing;
- a fact or explanation is false or would teach a misconception;
- the question can't be understood by ear alone, or the narration and the picture disagree;
- the content is clearly outside the skill or far off the grade level.
Report it as a note for anything smaller: tone, wording, a too-easy or too-hard item, a story that could be clearer.

Items marked VERIFY need extra care: code could not tie their answer to the question by itself. Work each one out and confirm the marked answer, and that each choice means what its value says.

Use the item id as target, or "story" for the story cards. An empty list is a fine answer when nothing is wrong. Give your whole answer as the structured output.`;

function describeVisual(v: Visual | undefined): string {
  if (!v) return 'none';
  if (v.kind === 'emoji') return v.emoji;
  if (v.kind === 'objects') return `${v.count} × ${v.emoji}`;
  if (v.kind === 'fraction')
    return `${describeShape(v)}${v.label ? `, labelled "${v.label}"` : ''}`;
  return `ten-frame with ${v.filled} dots`;
}

function describeItem(item: Item, level: CheckLevel): string {
  const lines = [
    `### ${item.id} (${item.type}, difficulty ${item.difficulty})${level === 'solved' ? '' : ' VERIFY'}`,
    `Narration: ${item.narration}`,
    `Screen: ${item.prompt}`,
  ];
  if (item.type === 'tap') {
    lines.push(`Picture: ${describeVisual(item.visual)}`);
    for (const c of item.choices) {
      const pic = c.kind === 'visual' ? ` (picture: ${describeVisual(c.visual)})` : '';
      lines.push(
        `Choice ${c.id}: ${spokenChoice(c)}${pic}${c.id === item.answerChoiceId ? '  <- marked right' : ''}`,
      );
    }
  } else if (item.type === 'keypad') {
    lines.push(`Picture: ${describeVisual(item.visual)}`, `Answer: ${item.answer}`);
  } else {
    lines.push(`Line: ${item.min} to ${item.max}, step ${item.step}. Answer: ${item.target}`);
  }
  lines.push(`Why: ${item.why}`);
  return lines.join('\n');
}

export function reviewRequest(
  skill: Skill,
  nugget: StoryNugget,
  items: readonly Item[],
  levels: ReadonlyMap<string, CheckLevel>,
): LlmRequest {
  const cards = nugget.cards
    .map(
      (c, i) =>
        `${i + 1}. ${c.narration}${c.text ? ` [screen: ${c.text}]` : ''} [picture: ${describeVisual(c.visual)}]`,
    )
    .join('\n');
  return {
    model: REVIEWER_MODEL,
    system: FRACTION_PICTURE_SKILLS.has(skill.id)
      ? withFractionPictures(REVIEWER_SYSTEM)
      : REVIEWER_SYSTEM,
    tool: SUBMIT_CONTENT_REVIEW,
    maxTokens: 16000,
    prompt: `Skill ${skill.id}, ${gradeName(skill.grade)}: ${skill.title}
${skill.description}

## Story

${cards}

## Items

${items.map((item) => describeItem(item, levels.get(item.id) ?? 'unchecked')).join('\n\n')}

Review the content for ${skill.id}.`,
  };
}
