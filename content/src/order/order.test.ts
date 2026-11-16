import type { ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptOrders, applyOrders, gapAsk, orderCandidates, type TaggedOrder } from './order';

const tap = (
  id: string,
  prompt: string,
  narration: string,
  choices: string[],
  answer = 0,
): Item => ({
  id,
  skillId: 's',
  difficulty: 1,
  why: 'w',
  prompt,
  narration,
  type: 'tap',
  choices: choices.map((text, i) => ({ id: 'abcd'[i]!, kind: 'text' as const, text })),
  answerChoiceId: 'abcd'[answer]!,
});

// Real science items from the Grade 1 bundle.
const after = tap(
  'g1-sci-design-steps-tap-6',
  'What comes after build?',
  'Mia has built her boat. What step comes next: plan, test, or buy a toy?',
  ['plan', 'buy a toy', 'test'],
  2,
);
const last = tap(
  'g1-sci-design-steps-tap-9',
  'What comes last?',
  'Mia plans, builds, and tests. What step comes last: plan, build, or make it better?',
  ['make it better', 'plan', 'build'],
);
const roots = tap(
  'g1-sci-plant-animal-features-tap-7',
  'What holds a plant in place?',
  'Which plant part holds the plant in the soil: leaves, roots, or petals?',
  ['leaves', 'petals', 'roots'],
  2,
);

const card = (text: string, emoji: string | null = null) => ({ text, emoji });
const tagged = (itemId: string, over: Partial<TaggedOrder> = {}): TaggedOrder => ({
  itemId,
  fits: true,
  cards: [card('build', '🔨'), card('test', ''), card('make it better')],
  missing: 1,
  cycle: false,
  otherChoiceFits: false,
  skipsSteps: false,
  note: '',
  ...over,
});

describe('orderCandidates', () => {
  it('keeps text tap items about a sequence, and skips pictures and other games', () => {
    const picture = { ...after, id: 'picture', visual: { kind: 'emoji', emoji: '⛵' } } as Item;
    const taken = { ...after, id: 'taken', game: { kind: 'label' } } as unknown as Item;
    expect(orderCandidates([after, last, roots, picture, taken]).map((i) => i.id)).toEqual([
      after.id,
      last.id,
    ]);
  });

  it('hears then, second, and third, and skips true or false items', () => {
    const then = tap('then', 'Egg, then what?', 'Egg, then what?', ['chick', 'hen']);
    const second = tap('second', 'What is the second step?', 'Which step?', ['soap', 'dry']);
    const yesNo = tap('yes-no', 'Spring comes after winter.', 'True or false?', ['true', 'false']);
    expect(orderCandidates([then, second, yesNo]).map((i) => i.id)).toEqual(['then', 'second']);
  });
});

describe('gapAsk', () => {
  it('reads the prompt first, then the narration', () => {
    expect(gapAsk(after)).toEqual({ at: 'after', card: 'build' });
    expect(gapAsk(last)).toEqual({ at: 'last' });
    expect(gapAsk(tap('f', 'Which step?', 'What does Mia do first?', ['plan']))).toEqual({
      at: 'first',
    });
    expect(gapAsk(tap('b', 'What comes before the frog?', 'n', ['egg']))).toEqual({
      at: 'before',
      card: 'frog',
    });
    expect(gapAsk(tap('n', 'What comes next?', 'Then what?', ['egg']))).toBeUndefined();
  });
});

describe('acceptOrders gap', () => {
  const seasons = ['winter', 'spring', 'summer', 'fall'].map((t) => card(t));
  const row = (prompt: string, answer: string, missing: number, cycle = false) => {
    const item = tap('i', prompt, 'n', [answer, 'night']);
    return acceptOrders([item], { scenes: [tagged('i', { cards: seasons, missing, cycle })] })
      .rejected.i;
  };

  it('puts the gap first for "first"', () => {
    expect(row('Which season comes first?', 'winter', 0)).toBeUndefined();
    expect(row('Which season comes first?', 'spring', 1)).toBe('the item asks for the first card');
  });

  it('puts the gap last for "last", unless the row is a cycle', () => {
    expect(row('Which comes last?', 'fall', 3)).toBeUndefined();
    expect(row('Which comes last?', 'summer', 2)).toBe('the item asks for the last card');
    expect(row('Which comes last?', 'summer', 2, true)).toBeUndefined();
  });

  it('puts the gap right after the card "after" names, wrapping in a cycle', () => {
    expect(row('What comes after spring?', 'summer', 2)).toBeUndefined();
    expect(row('What comes after the summer season?', 'fall', 3)).toBeUndefined();
    expect(row('What comes after winter?', 'summer', 2)).toBe(
      'the card before the gap is not winter',
    );
    expect(row('What comes after fall?', 'winter', 0)).toBe('the card before the gap is not fall');
    expect(row('What comes after fall?', 'winter', 0, true)).toBeUndefined();
  });

  it('puts the gap right before the card "before" names', () => {
    expect(row('What comes before summer?', 'spring', 1)).toBeUndefined();
    expect(row('What comes before fall?', 'spring', 1)).toBe('the card after the gap is not fall');
  });
});

describe('acceptOrders', () => {
  it('keeps a row that leaves out the other choices, and drops empty emojis', () => {
    const { scenes, rejected } = acceptOrders([after], { scenes: [tagged(after.id)] });
    expect(rejected).toEqual({});
    expect(scenes[after.id]).toEqual({
      kind: 'order',
      cards: [{ text: 'build', emoji: '🔨' }, { text: 'test' }, { text: 'make it better' }],
      missing: 1,
    });
  });

  it('keeps cycle only when set', () => {
    const { scenes } = acceptOrders([after], { scenes: [tagged(after.id, { cycle: true })] });
    expect(scenes[after.id]?.cycle).toBe(true);
  });

  it('rejects misfits, shown choices, wrong answers, short rows, open gaps, and skipped steps', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ ...after, id }));
    const { scenes, rejected } = acceptOrders(items, {
      scenes: [
        tagged('a', { fits: false, note: 'plan is a choice' }),
        tagged('b', { cards: [card('plan'), card('build'), card('test')], missing: 2 }),
        tagged('c', { missing: 2 }),
        tagged('d', { cards: [card('build'), card('test')] }),
        tagged('e', { otherChoiceFits: true }),
        tagged('f', { skipsSteps: true }),
      ],
    });
    expect(scenes).toEqual({});
    expect(rejected.a).toBe('does not fit: plan is a choice');
    expect(rejected.b).toBe('the choice plan is already in the row');
    expect(rejected.c).toMatch(/^the missing card is make it better but the item answers test/);
    expect(rejected.d).toMatch(/3/);
    expect(rejected.e).toBe('another choice also fits the gap');
    expect(rejected.f).toBe('the row skips steps or swaps the events the item tells');
  });

  it('rejects cards that mix articles or start with a capital the item never writes', () => {
    const feast = tap(
      'g2-soc-chronology-tap-13',
      'What comes after summer camp?',
      'A family has a spring picnic, a summer camp, and a fall harvest feast. Which comes right after the summer camp: the spring picnic or the fall harvest feast?',
      ['the spring picnic', 'the fall harvest feast'],
      1,
    );
    const row = (...texts: string[]) =>
      tagged(feast.id, { cards: texts.map((t) => card(t)), missing: 1 });
    const mixed = acceptOrders([feast], {
      scenes: [row('Summer camp', 'the fall harvest feast', 'winter party')],
    });
    expect(mixed.rejected[feast.id]).toBe(
      'only some cards start with an article; the card Summer camp starts with a capital the item never writes',
    );
    const even = acceptOrders([feast], {
      scenes: [row('the summer camp', 'the fall harvest feast', 'the winter party')],
    });
    expect(even.rejected).toEqual({});
  });

  it('keeps a capital the item writes, like Grade 1', () => {
    const grade = tap(
      'g1-soc-events-in-order-tap-6',
      'What came after Kindergarten?',
      'Sam went to daycare, then Kindergarten, then Grade 1. Which came after Kindergarten: daycare, or Grade 1?',
      ['daycare', 'Grade 1'],
      1,
    );
    const { rejected } = acceptOrders([grade], {
      scenes: [
        tagged(grade.id, { cards: [card('Kindergarten'), card('Grade 1'), card('Grade 2')] }),
      ],
    });
    expect(rejected).toEqual({});
  });
});

describe('applyOrders', () => {
  it('sets the scene on its item and drops one that no longer fits', () => {
    const { scenes } = acceptOrders([after], { scenes: [tagged(after.id)] });
    const bundle = { items: [after, last] } as unknown as ContentBundle;
    const applied = applyOrders(bundle, scenes);
    expect(applied.bundle.items[0]!.game).toEqual(scenes[after.id]);
    const changed = { ...after, answerChoiceId: 'a' } as Item;
    const stale = applyOrders({ items: [changed] } as unknown as ContentBundle, scenes);
    expect(stale.bundle.items[0]!.game).toBeUndefined();
    expect(stale.dropped).toEqual([
      `${after.id}: the missing card is test but the item answers plan`,
    ]);
  });
});
