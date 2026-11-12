import { toSpeech } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import {
  emoji,
  factContent,
  g1SciSkill,
  g1Skill,
  goodContent,
  keypad,
  line,
  num,
  objects,
  tap,
  text,
} from './fixtures';
import type { GeneratedContent } from './schema';
import { validateSkill } from './validate';

function mutate(change: (c: GeneratedContent) => void): GeneratedContent {
  const content = goodContent();
  change(content);
  return content;
}

const problemsOf = (content: GeneratedContent, skill = g1Skill) =>
  validateSkill(skill, content).problems;

describe('validateSkill', () => {
  it('passes good content with every answer solved by code', () => {
    const result = validateSkill(g1Skill, goodContent());
    expect(result.problems).toEqual([]);
    expect(result.items).toHaveLength(15);
    expect(result.nugget?.id).toBe('g1-add-within-10-story');
    expect(result.items.map((i) => i.id).slice(0, 3)).toEqual([
      'g1-add-within-10-tap-1',
      'g1-add-within-10-tap-2',
      'g1-add-within-10-keypad-1',
    ]);
    expect(new Set(result.levels.values())).toEqual(new Set(['solved']));
  });

  it('writes narration toSpeech turns fully into words', () => {
    const { nugget, items } = validateSkill(g1Skill, goodContent());
    for (const text of [
      ...nugget!.cards.map((c) => c.narration),
      ...items.flatMap((i) => [i.narration, i.why]),
    ]) {
      expect(toSpeech(text)).not.toMatch(/[\d+=×÷]/);
    }
  });

  it('reports schema errors in the story and items', () => {
    const fewCards = mutate((c) => (c.cards = c.cards.slice(0, 4)));
    expect(problemsOf(fewCards).join()).toMatch(/story: cards/);
    const badVisual = mutate((c) => (c.items[3].visual = objects('🍎', 25)));
    expect(problemsOf(badVisual).join()).toMatch(/item 4 \(keypad\): visual.count/);
    const badAnswerId = mutate((c) => (c.items[0].answerChoiceId = 'z'));
    expect(problemsOf(badAnswerId).join()).toMatch(/No choice has id z/);
  });

  it('needs exactly 15 items, spread across difficulty and type', () => {
    expect(problemsOf(mutate((c) => c.items.pop())).join()).toMatch(/14 items, need exactly 15/);
    const allEasy = mutate((c) => c.items.forEach((i) => (i.difficulty = 1)));
    expect(problemsOf(allEasy)).toEqual(
      expect.arrayContaining([
        'only 0 items at difficulty 2, need at least 4',
        'only 0 items at difficulty 3, need at least 4',
      ]),
    );
    const noLines = mutate((c) => {
      c.items = c.items.map((i, n) => (i.type === 'number-line' ? keypad(i.difficulty, n, 1) : i));
    });
    expect(problemsOf(noLines).join()).toMatch(/only 0 number-line items/);
  });

  it('catches wrong answers', () => {
    const wrong = mutate((c) => (c.items[2].answer = 4));
    expect(problemsOf(wrong)).toEqual(['item 3 (keypad): answer is 4 but 1 + 2 = 3']);
  });

  it('catches duplicates', () => {
    const dup = mutate((c) => (c.items[1] = tap(1, 1, 1, [3, 4])));
    expect(problemsOf(dup)).toContain('item 2 repeats item 1');
  });

  it('needs tap narration to name every choice', () => {
    const silent = mutate((c) => (c.items[0].narration = 'What is 1 + 1?'));
    expect(problemsOf(silent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/item 1 \(tap\): narration must name choice a \("3"\)/),
      ]),
    );
    const words = mutate((c) => {
      c.items[0] = {
        ...tap(1, 1, 1, [3, 4]),
        narration: 'Is 1 + 1 even or odd?',
        choices: [text('a', 'even'), text('b', 'odd')],
        answerChoiceId: 'a',
        check: {
          rule: 'true',
          expr: '',
          choices: [
            { id: 'a', expr: 'isEven(1 + 1)' },
            { id: 'b', expr: 'isOdd(1 + 1)' },
          ],
          note: '',
        },
      };
    });
    const result = validateSkill(g1Skill, words);
    expect(result.problems).toEqual([]);
    expect(result.levels.get('g1-add-within-10-tap-1')).toBe('linked');
  });

  it('flags narration toSpeech reads badly and risky words', () => {
    const symbols = mutate((c) => (c.items[2].narration = 'What is (1 + 2)?'));
    expect(problemsOf(symbols).join()).toMatch(
      /item 3 \(keypad\) narration: toSpeech can't say "\("/,
    );
    const risky = mutate((c) => (c.cards[1].narration = 'Say how many apples.'));
    expect(problemsOf(risky).join()).toMatch(/story card 2 narration: uses "say"/);
    const emojiChoice = mutate((c) => (c.items[0].choices[0] = text('a', '🍎')));
    expect(problemsOf(emojiChoice).join()).toMatch(/choice a: no emoji/);
  });

  it('applies the grade reading level', () => {
    const wordy = mutate(
      (c) =>
        (c.cards[0].narration =
          'Leo has three bright red apples sitting in a basket on the kitchen table today.'),
    );
    expect(problemsOf(wordy).join()).toMatch(
      /story card 1 narration: sentence has 15 words, Grade 1 max is 12/,
    );
    const fancy = mutate((c) => {
      c.cards.forEach((card) => (card.narration = 'Equivalent combinations accumulate.'));
      c.items.forEach((item) => (item.why = 'Equivalent combinations accumulate continually.'));
    });
    expect(problemsOf(fancy).join()).toMatch(/of words are long/);
  });

  it('needs pictures on most Grade 1 story cards', () => {
    const bare = mutate((c) => c.cards.forEach((card) => (card.visual = null)));
    expect(problemsOf(bare).join()).toMatch(/only 0 of 5 cards have a picture/);
    expect(problemsOf(bare, { ...g1Skill, id: 'g5-x', grade: '5' })).toEqual([]);
  });

  it('rejects text pretending to be an emoji', () => {
    const fake = mutate((c) => (c.cards[0].visual = emoji('apple')));
    expect(problemsOf(fake).join()).toMatch(/"apple" is not an emoji/);
  });

  it('checks keypad and number-line playability', () => {
    const negative = mutate((c) => {
      c.items[2] = {
        ...keypad(1, 1, 2),
        narration: 'What is 1 - 2?',
        answer: -1,
        check: { rule: 'equals', expr: '1 - 2', choices: [], note: '' },
      };
    });
    expect(problemsOf(negative).join()).toMatch(/no minus key/);
    const long = mutate((c) => {
      c.items[2] = {
        ...keypad(1, 1, 2),
        narration: 'What is 1234567 + 1?',
        answer: 1234568,
        check: { rule: 'equals', expr: '1234567 + 1', choices: [], note: '' },
      };
    });
    expect(problemsOf(long).join()).toMatch(/longer than 6 keypad characters/);
    const fine = mutate((c) => (c.items[4] = { ...line(1, 1, 3), max: 100, step: 1 }));
    expect(problemsOf(fine).join()).toMatch(/100 steps/);
  });

  it('rejects choice text too long for a tile', () => {
    const wide = mutate((c) => {
      c.items[0].choices[0] = text('a', 'three and some more apples');
      c.items[0].narration = 'What is 1 + 1? Is it three and some more apples, 2, or 4?';
      c.items[0].check = {
        rule: 'equals',
        expr: '1 + 1',
        choices: [{ id: 'a', expr: '3' }],
        note: '',
      };
    });
    expect(problemsOf(wide).join()).toMatch(/choice a is over 24 characters/);
  });

  it('keeps number choices in narration as the screen shows them', () => {
    const content = mutate((c) => {
      c.items[0].choices = [num('a', 0.5), num('b', 2), num('c', 4)];
      c.items[0].narration = 'What is 1 + 1? Is it 0.5, 2, or 4?';
    });
    expect(problemsOf(content)).toEqual([]);
  });

  it('does not count the listed choices toward a tap sentence length', () => {
    const listed = mutate((c) => {
      c.items[0].choices = [text('a', '1 and a half'), text('b', '2'), text('c', '1 and a fourth')];
      c.items[0].narration = 'What is 1 + 1, 1 and a half, 2, or 1 and a fourth?';
      c.items[0].check = {
        rule: 'equals',
        expr: '1 + 1',
        choices: [
          { id: 'a', expr: '3/2' },
          { id: 'c', expr: '5/4' },
        ],
        note: '',
      };
    });
    expect(problemsOf(listed)).toEqual([]);
  });

  it('needs a fraction picture choice to say the amount it shows', () => {
    const picture = (narration: string) =>
      mutate((c) => {
        c.items[0].narration = `Which is more, ${narration} or 1/4 of the circle?`;
        c.items[0].choices = [
          {
            id: 'a',
            kind: 'visual',
            value: null,
            text: null,
            visual: {
              kind: 'fraction',
              emoji: null,
              count: null,
              filled: null,
              shape: 'circle',
              parts: 4,
              shaded: 3,
              wholes: null,
              label: null,
            },
            narration,
          },
          { ...text('b', '1/4 of the circle'), kind: 'text' },
        ];
        c.items[0].answerChoiceId = 'a';
        c.items[0].check = {
          rule: 'greatest',
          expr: '',
          choices: [{ id: 'b', expr: '1/4' }],
          note: '',
        };
      });
    expect(problemsOf(picture('3/4 of the circle'))).toEqual([]);
    expect(problemsOf(picture('3 of 4 parts'))).toEqual([]);
    expect(problemsOf(picture('most of the circle'))).toContain(
      'item 1 (tap) choice a: narration "most of the circle" must name the picture\'s amount, like "3/4" or "3 of 4 parts"',
    );
  });
});

describe('validateSkill on a fact skill', () => {
  it('passes tap-only items the reviewer verifies', () => {
    const result = validateSkill(g1SciSkill, factContent());
    expect(result.problems).toEqual([]);
    expect(new Set(result.levels.values())).toEqual(new Set(['unchecked']));
  });

  it('asks for tap items only', () => {
    const content = factContent();
    content.items[0] = keypad(1, 1, 2);
    expect(validateSkill(g1SciSkill, content).problems).toContain(
      'item 1 is keypad, use only tap items',
    );
  });
});
