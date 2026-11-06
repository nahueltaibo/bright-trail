import { describe, expect, it } from 'vitest';
import sample from '../fixtures/sample-bundle.json';
import {
  ContentBundleSchema,
  findPrerequisiteCycle,
  parseContentBundle,
  type ContentBundle,
} from './bundle';
import type { NumberLineItem, TapItem } from './item';

function clone(): ContentBundle {
  return parseContentBundle(structuredClone(sample));
}

function messages(data: unknown): string[] {
  const result = ContentBundleSchema.safeParse(data);
  expect(result.success).toBe(false);
  return result.error!.issues.map((issue) => issue.message);
}

describe('sample bundle', () => {
  it('passes validation', () => {
    const bundle = parseContentBundle(sample);
    expect(bundle.skills).toHaveLength(3);
    expect(new Set(bundle.items.map((item) => item.type))).toEqual(
      new Set(['tap', 'keypad', 'number-line']),
    );
  });
});

describe('ContentBundleSchema', () => {
  it('rejects a prerequisite cycle', () => {
    const bundle = clone();
    bundle.skills[0].prerequisiteIds = ['g1-add-within-10'];
    expect(messages(bundle)).toContain(
      'Prerequisite cycle: k-count-to-20 -> g1-add-within-10 -> g1-numbers-to-50 -> k-count-to-20',
    );
  });

  it('rejects a dangling prerequisite', () => {
    const bundle = clone();
    bundle.skills[1].prerequisiteIds = ['k-missing'];
    expect(messages(bundle)).toEqual(['Unknown prerequisite k-missing']);
  });

  it('rejects nuggets and items for unknown skills', () => {
    const bundle = clone();
    bundle.nuggets[0].skillId = 'nope';
    bundle.items[0].skillId = 'nope';
    expect(messages(bundle)).toEqual(['Unknown skill nope', 'Unknown skill nope']);
  });

  it('rejects duplicate ids', () => {
    const bundle = clone();
    bundle.items[1].id = bundle.items[0].id;
    expect(messages(bundle)).toEqual([`Duplicate id ${bundle.items[0].id}`]);
  });

  it('rejects a tap item whose answer is not a choice', () => {
    const bundle = clone();
    (bundle.items[0] as TapItem).answerChoiceId = 'z';
    expect(messages(bundle)).toEqual(['No choice has id z']);
  });

  it('rejects a number-line target off the step', () => {
    const bundle = clone();
    (bundle.items[5] as NumberLineItem).target = 33;
    expect(messages(bundle)).toEqual(['target is not on a step']);
  });

  it('rejects a story outside 5 to 8 cards', () => {
    const bundle = clone();
    bundle.nuggets[0].cards = bundle.nuggets[0].cards.slice(0, 4);
    expect(messages(bundle)).toHaveLength(1);
  });

  it('rejects an unknown schema version', () => {
    expect(messages({ ...clone(), schemaVersion: 2 })).toHaveLength(1);
  });
});

describe('findPrerequisiteCycle', () => {
  it('returns null for a DAG with shared prerequisites', () => {
    expect(
      findPrerequisiteCycle([
        { id: 'a', prerequisiteIds: [] },
        { id: 'b', prerequisiteIds: ['a'] },
        { id: 'c', prerequisiteIds: ['a', 'b'] },
      ]),
    ).toBeNull();
  });

  it('finds a self-loop', () => {
    expect(findPrerequisiteCycle([{ id: 'a', prerequisiteIds: ['a'] }])).toEqual(['a', 'a']);
  });
});
