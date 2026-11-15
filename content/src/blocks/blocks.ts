import {
  BLOCKS_ASKS,
  BlocksSceneSchema,
  PLACES,
  blocksProblems,
  itemAnswer,
  type BlocksScene,
  type ContentBundle,
  type Item,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { GENERATOR_MODEL } from '../graph/prompts';
import type { LlmRequest } from '../graph/llm';

// Flat with nullable fields, like the content schema: structured output follows it more reliably.
const TaggedBlocksSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  ask: z.enum(BLOCKS_ASKS),
  hundreds: z.number().int(),
  tens: z.number().int(),
  ones: z.number().int(),
  place: z.enum(PLACES).nullable(),
  note: z.string(),
});
export const BlocksTagOutputSchema = z.strictObject({ scenes: z.array(TaggedBlocksSchema) });
export type TaggedBlocks = z.infer<typeof TaggedBlocksSchema>;

export const PLACE_WORDS =
  /\b(ones?|tens?|hundreds?|digits?|place|worth|blocks?|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b|\b[1-9]0{1,2}\s*(\+|and)\s*(\d|\?)/i;

/**
 * Items that might build a number from blocks: a whole-number answer, no picture, place words.
 * A number line counts only when its prompt names the places, since "Go to 27" practises the line.
 */
export function blocksCandidates(items: readonly Item[]): Item[] {
  return items.filter((i) => {
    if ((i.game && i.game.kind !== 'blocks') || ('visual' in i && i.visual)) return false;
    const answer = itemAnswer(i);
    if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0) return false;
    if (i.type === 'tap' && !i.choices.every((c) => c.kind === 'number')) return false;
    return PLACE_WORDS.test(i.type === 'number-line' ? i.prompt : `${i.prompt} ${i.narration}`);
  });
}

const SYSTEM = `You map math practice items for kids to a base-ten blocks scene. The app lays out flats (hundreds), rods (tens), and cubes (ones) on a mat before the child answers. After the answer it plays the blocks out: ten cubes trade for a rod and ten rods for a flat, flats break into rods, and the blocks get counted. The app works out the answer from the scene and checks it against the item's answer.

The mat holds hundreds (0 to 9 flats), tens (0 to 20 rods), and ones (0 to 20 cubes). Lay them out the way the item describes the number. "9 tens and 15 ones" is 0, 9, 15. "14 boxes of 10" is 0, 14, 0. "10 and 10 and 10 and 5" is 0, 3, 5. A number the item gives only as a whole, like "Type forty-eight" or "In 583", uses its digits: 4, 8 or 5, 8, 3.

Asks:
- total: the item wants the number the blocks make. "3 tens and 5 ones is what number?", "Which number is twelve?", "What is 100 + 7?", "20 and 7 make what?". place is null.
- count: the item wants how many blocks of one place are on the mat. "How many tens are in 42?" (4 of the tens), "What digit is in the tens place of 639?", "15 is 10 and what?" (ones of 1 ten 5 ones), "164 is 1 hundred, 5 tens, and how many ones?" (ones of 1, 5, 14).
- worth: the item wants what one digit is worth. "In 583, what is the 8 worth?" is 5, 8, 3 with place tens. Needs 9 or fewer of each block.
- make: the item wants how many of a place the whole number makes, breaking bigger blocks. "How many tens make 150?" is 1, 5, 0 with place tens, answer 15. "How many tens make one hundred?" is 1, 0, 0.

Rules:
- place: the place a count, worth, or make ask is about. null for total.
- The blocks must make the number the item is about, and the ask must come to the item's answer.
- Set fits to false when the item doesn't ask about one number's place value: true or false, which of two descriptions, comparing two numbers, which number has a digit in some place, "how many times as much", counting by a step, or adding and subtracting that isn't joining hundreds, tens, and ones. Also when the number is 1000 or more. Fill the other fields with any valid value then.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

function describe(item: Item) {
  return {
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    narration: item.narration,
    ...(item.type === 'tap' && {
      choices: item.choices.map((c) => (c.kind === 'number' ? c.value : '')),
    }),
    answer: itemAnswer(item),
  };
}

export function blocksTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  const inputSchema = z.toJSONSchema(BlocksTagOutputSchema) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    model: GENERATOR_MODEL,
    system: SYSTEM,
    prompt: `Skill ${skillId}. Map each item to a scene, or set fits to false.\n\n${JSON.stringify(items.map(describe), null, 1)}`,
    tool: {
      name: 'submit_scenes',
      description: 'Submit one scene entry per item. Call it exactly once.',
      inputSchema,
    },
    maxTokens: 8000,
  };
}

export type BlocksTagResult = {
  scenes: Record<string, BlocksScene>;
  rejected: Record<string, string>;
};

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptBlocks(items: readonly Item[], output: unknown): BlocksTagResult {
  const parsed = BlocksTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: BlocksTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const candidate = BlocksSceneSchema.safeParse({
      kind: 'blocks',
      ask: t.ask,
      hundreds: t.hundreds,
      tens: t.tens,
      ones: t.ones,
      ...(t.ask !== 'total' && t.place !== null && { place: t.place }),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = blocksProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/** Adds stored blocks scenes to the bundle's items, dropping and reporting any that no longer fit. */
export function applyBlocks(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, BlocksScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'blocks', scenes, blocksProblems);
}
