import type { BlocksScene, ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import {
  acceptBlocks,
  applyBlocks,
  blocksCandidates,
  PLACE_WORDS,
  type TaggedBlocks,
} from './blocks';

const base = { skillId: 's', difficulty: 1, prompt: 'p', why: 'w' } as const;
const keypad = (id: string, narration: string, answer: number): Item => ({
  ...base,
  id,
  narration,
  type: 'keypad',
  answer,
});

const tagged = (itemId: string, over: Partial<TaggedBlocks> = {}): TaggedBlocks => ({
  itemId,
  fits: true,
  ask: 'total',
  hundreds: 0,
  tens: 3,
  ones: 5,
  place: null,
  note: '',
  ...over,
});

const build = keypad('build', 'Mia has 3 tens and 5 ones. What number is that?', 35);

describe('blocksCandidates', () => {
  it('keeps whole-number answers that talk about places, and skips text and pictures', () => {
    const thirty = keypad('thirty', 'Type the number thirty.', 30);
    const sum = keypad('sum', 'What is 100 + 7?', 107);
    const fact = keypad('fact', 'What is 7 times 8?', 56);
    const words: Item = {
      ...base,
      id: 'words',
      narration: '12 tens and 5 ones is 152. True or false?',
      type: 'tap',
      choices: [
        { id: 'a', kind: 'text', text: 'true' },
        { id: 'b', kind: 'text', text: 'false' },
      ],
      answerChoiceId: 'b',
    };
    const picture = {
      ...keypad('picture', 'Each star is 100. How many tens?', 6),
      visual: { kind: 'objects', emoji: '⭐', count: 6 },
    } as Item;
    expect(blocksCandidates([build, thirty, sum, fact, words, picture]).map((i) => i.id)).toEqual([
      'build',
      'thirty',
      'sum',
    ]);
  });

  it('takes a number line only when its prompt names the places', () => {
    const line = (id: string, prompt: string, target: number): Item => ({
      ...base,
      id,
      prompt,
      narration: `Move the frog to ${prompt}. That is ninety-seven.`,
      type: 'number-line',
      min: 0,
      max: 200,
      step: 1,
      target,
    });
    const items = [
      line('places', '4 tens and 7 ones', 47),
      line('many', '17 tens 5 ones', 175),
      line('parts', '20 and 9 make?', 29),
      line('find', 'Find 97', 97),
    ];
    expect(blocksCandidates(items).map((i) => i.id)).toEqual(['places', 'many', 'parts']);
  });
});

describe('PLACE_WORDS', () => {
  it('matches a missing part after a ten or a hundred', () => {
    expect(PLACE_WORDS.test('15 = 10 + ?')).toBe(true);
    expect(PLACE_WORDS.test('124 = 100 + ?')).toBe(true);
    expect(PLACE_WORDS.test('10 and 6 make?')).toBe(true);
    expect(PLACE_WORDS.test('7 + ? = 12')).toBe(false);
    expect(PLACE_WORDS.test('17 and 3 more')).toBe(false);
  });
});

describe('acceptBlocks', () => {
  it('keeps a matching scene and drops the place of a total', () => {
    const { scenes, rejected } = acceptBlocks([build], {
      scenes: [tagged('build', { place: 'ones' })],
    });
    expect(rejected).toEqual({});
    expect(scenes.build).toEqual({ kind: 'blocks', ask: 'total', hundreds: 0, tens: 3, ones: 5 });
  });

  it('rejects misfits, bad mats, and wrong answers with a reason', () => {
    const items = ['a', 'b', 'c'].map((id) => ({ ...build, id }));
    const { scenes, rejected } = acceptBlocks(items, {
      scenes: [
        tagged('a', { fits: false, note: 'true or false' }),
        tagged('b', { tens: 30 }),
        tagged('c', { ones: 3 }),
      ],
    });
    expect(scenes).toEqual({});
    expect(rejected.a).toBe('does not fit: true or false');
    expect(rejected.b).toMatch(/<=20/);
    expect(rejected.c).toBe('the blocks come to 33 but the item answers 35');
  });
});

describe('applyBlocks', () => {
  it('sets matching scenes and drops stale ones', () => {
    const bundle = { items: [build, { ...build, id: 'stale', answer: 53 }] } as ContentBundle;
    const scene: BlocksScene = { kind: 'blocks', ask: 'total', hundreds: 0, tens: 3, ones: 5 };
    const { bundle: out, dropped } = applyBlocks(bundle, { build: scene, stale: scene });
    expect(out.items[0].game).toEqual(scene);
    expect(out.items[1].game).toBeUndefined();
    expect(dropped).toEqual(['stale: the blocks come to 35 but the item answers 53']);
  });
});
