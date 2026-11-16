import { describe, expect, it } from 'vitest';
import { removeTransitivePrerequisites } from './checks';
import { skill, validGraph } from './fixtures';
import {
  applyOverrides,
  edgeKey,
  OverridesFileSchema,
  overridesFor,
  type Override,
} from './overrides';

const reason = 'test';

describe('applyOverrides', () => {
  it('adds, removes, and replaces prerequisites in place', () => {
    const overrides: Override[] = [
      { op: 'addPrerequisite', skillId: 'g1-read-to-50', prerequisiteId: 'k-add-to-5', reason },
      { op: 'removePrerequisite', skillId: 'g1-add-to-10', prerequisiteId: 'k-add-to-5', reason },
      {
        op: 'replacePrerequisite',
        skillId: 'k-add-to-5',
        from: 'k-count',
        to: 'k-other',
        reason,
      },
    ];
    const skills = [...validGraph(), skill('k-other', [], ['A6.1'])];
    const { skills: fixed, stale } = applyOverrides(skills, overrides);
    expect(stale).toEqual([]);
    const byId = new Map(fixed.map((s) => [s.id, s.prerequisiteIds]));
    expect(byId.get('g1-read-to-50')).toEqual(['k-count', 'k-add-to-5']);
    expect(byId.get('g1-add-to-10')).toEqual(['g1-read-to-50']);
    expect(byId.get('k-add-to-5')).toEqual(['k-other']);
  });

  it('replaces titles and descriptions without touching the input', () => {
    const skills = validGraph();
    const { skills: fixed } = applyOverrides(skills, [
      { op: 'setTitle', skillId: 'k-count', title: 'Count up', reason },
      { op: 'setDescription', skillId: 'k-count', description: 'What comes next?', reason },
    ]);
    expect(fixed[0]).toMatchObject({ title: 'Count up', description: 'What comes next?' });
    expect(skills[0].title).toBe('k-count');
  });

  it('reports overrides that no longer match the graph', () => {
    const { stale } = applyOverrides(validGraph(), [
      { op: 'addPrerequisite', skillId: 'g1-add-to-10', prerequisiteId: 'k-add-to-5', reason },
      { op: 'removePrerequisite', skillId: 'k-count', prerequisiteId: 'k-add-to-5', reason },
      { op: 'setTitle', skillId: 'k-gone', title: 'Gone', reason },
      { op: 'addPrerequisite', skillId: 'k-count', prerequisiteId: 'k-gone', reason },
      { op: 'protectPrerequisite', skillId: 'k-count', prerequisiteId: 'k-add-to-5', reason },
    ]);
    expect(stale).toEqual([
      'Override addPrerequisite on g1-add-to-10: already lists k-add-to-5',
      "Override removePrerequisite on k-count: doesn't list k-add-to-5",
      'Override setTitle on k-gone: no such skill',
      'Override addPrerequisite on k-count: no such skill k-gone',
      "Override protectPrerequisite on k-count: doesn't list k-add-to-5",
    ]);
  });

  it('collects protected edges and allowed tokens', () => {
    const { protectedEdges, allowedTokens } = applyOverrides(validGraph(), [
      { op: 'protectPrerequisite', skillId: 'g1-add-to-10', prerequisiteId: 'k-add-to-5', reason },
      { op: 'allowToken', skillId: 'k-count', token: 'say', reason },
    ]);
    expect([...protectedEdges]).toEqual([edgeKey('g1-add-to-10', 'k-add-to-5')]);
    expect(allowedTokens.get('k-count')).toEqual(new Set(['say']));
  });

  it('is deterministic', () => {
    const overrides: Override[] = [
      { op: 'addPrerequisite', skillId: 'g1-read-to-50', prerequisiteId: 'k-add-to-5', reason },
    ];
    expect(applyOverrides(validGraph(), overrides)).toEqual(
      applyOverrides(validGraph(), overrides),
    );
  });
});

describe('protected edges', () => {
  it('survive transitive pruning', () => {
    const skills = validGraph();
    skills[3] = skill('g1-add-to-10', ['k-count', 'k-add-to-5'], ['B2.1']);
    const { skills: reduced, removed } = removeTransitivePrerequisites(
      skills,
      new Set([edgeKey('g1-add-to-10', 'k-count')]),
    );
    expect(reduced[3].prerequisiteIds).toEqual(['k-count', 'k-add-to-5']);
    expect(removed).toEqual([]);
  });
});

describe('OverridesFileSchema', () => {
  it('requires a reason on every entry', () => {
    const entry = { op: 'setTitle', skillId: 'k-count', title: 'Count' };
    expect(OverridesFileSchema.safeParse({ overrides: [entry] }).success).toBe(false);
    expect(
      OverridesFileSchema.safeParse({ overrides: [{ ...entry, reason: 'Shorter' }] }).success,
    ).toBe(true);
  });

  it('rejects unknown ops and fields', () => {
    const bad = [
      { op: 'renameSkill', skillId: 'k-count', reason },
      { op: 'setTitle', skillId: 'k-count', title: 'Count', reason, extra: 1 },
    ];
    for (const entry of bad) {
      expect(OverridesFileSchema.safeParse({ overrides: [entry] }).success).toBe(false);
    }
  });
});

describe('overridesFor', () => {
  const math: Override = { op: 'setTitle', skillId: 'g3-add-within-100', title: 'Add', reason };
  const science: Override = {
    op: 'addPrerequisite',
    skillId: 'g4-sci-machine-forces',
    prerequisiteId: 'g3-sci-force-effects',
    reason,
  };

  it('keeps the overrides whose skill id names the subject', () => {
    expect(overridesFor([math, science], 'math')).toEqual([math]);
    expect(overridesFor([math, science], 'science')).toEqual([science]);
    expect(overridesFor([math, science], 'health')).toEqual([]);
  });
});
