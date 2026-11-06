import { describe, expect, it } from 'vitest';
import {
  checkGraph,
  deadEnds,
  longestChain,
  reachableFromRoots,
  removeTransitivePrerequisites,
} from './checks';
import { skill, tinySources, validGraph } from './fixtures';

const messages = (skills = validGraph()) => checkGraph(skills, tinySources).map((p) => p.message);

describe('checkGraph', () => {
  it('passes a valid graph', () => {
    expect(messages()).toEqual([]);
  });

  it('reports schema problems from the shared schema', () => {
    const skills = validGraph();
    skills[1] = { ...skills[1], id: 'K-Bad' };
    expect(messages(skills)).toContain(
      'Schema: K-Bad: id Use a kebab-case id, e.g. "g1-add-within-10"',
    );
  });

  it('reports unknown prerequisites', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', ['k-missing'], ['B1.1']);
    expect(messages(skills)).toContain(
      'Schema: g1-read-to-50: prerequisiteIds.0 Unknown prerequisite k-missing',
    );
  });

  it('reports a cycle and the skills it cuts off', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', ['g1-add-to-10'], ['B1.1']);
    skills[3] = skill('g1-add-to-10', ['g1-read-to-50'], ['B2.1']);
    const found = messages(skills);
    expect(found).toContain('Cycle: g1-read-to-50 -> g1-add-to-10 -> g1-read-to-50');
    expect(found).toContain('g1-read-to-50: not reachable from a Kindergarten root');
    expect(found).toContain('g1-add-to-10: not reachable from a Kindergarten root');
  });

  it('reports orphans above Kindergarten', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', [], ['B1.1']);
    expect(messages(skills)).toContain(
      'g1-read-to-50: orphan, only Kindergarten skills may have no prerequisites',
    );
  });

  it('reports a prerequisite in a higher grade', () => {
    const skills = validGraph();
    skills[1] = skill('k-add-to-5', ['k-count', 'g1-read-to-50'], ['A6.2']);
    expect(messages(skills)).toContain(
      'k-add-to-5: prerequisite g1-read-to-50 is in a higher grade (1)',
    );
  });

  it('reports expectation codes missing from that grade', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', ['k-count'], ['B1.1', 'B1.9']);
    expect(messages(skills)).toContain('g1-read-to-50: expectation B1.9 is not in Grade 1');
  });

  it('reports specific expectations no skill covers', () => {
    const skills = validGraph().filter((s) => s.id !== 'g1-add-to-10');
    expect(messages(skills)).toEqual(['Expectation B2.1 (Grade 1) has no skill']);
  });

  it('reports ids without their grade prefix', () => {
    const skills = validGraph();
    skills[2] = { ...skills[2], id: 'g2-read-to-50' };
    skills[3] = { ...skills[3], prerequisiteIds: ['k-add-to-5', 'g2-read-to-50'] };
    expect(messages(skills)).toEqual(['g2-read-to-50: id must start with g1-']);
  });

  it('tags each problem with its grade', () => {
    const skills = validGraph();
    skills[2] = skill('g1-read-to-50', [], ['B1.1']);
    expect(new Set(checkGraph(skills, tinySources).map((p) => p.grade))).toEqual(new Set(['1']));
  });
});

describe('graph helpers', () => {
  it('finds everything reachable from Kindergarten roots', () => {
    expect([...reachableFromRoots(validGraph())].sort()).toEqual(
      ['g1-add-to-10', 'g1-read-to-50', 'k-add-to-5', 'k-count'].sort(),
    );
  });

  it('removes prerequisites another prerequisite already implies', () => {
    const skills = validGraph();
    skills[3] = skill('g1-add-to-10', ['k-count', 'k-add-to-5', 'g1-read-to-50'], ['B2.1']);
    const { skills: reduced, removed } = removeTransitivePrerequisites(skills);
    expect(reduced[3].prerequisiteIds).toEqual(['k-add-to-5', 'g1-read-to-50']);
    expect(removed).toEqual([
      { skillId: 'g1-add-to-10', prerequisiteId: 'k-count', via: 'k-add-to-5' },
    ]);
    expect(reduced[0]).toBe(skills[0]);
  });

  it('finds the longest chain, root first', () => {
    expect(longestChain(validGraph())).toEqual(['k-count', 'g1-read-to-50', 'g1-add-to-10']);
  });

  it('lists dead ends below Grade 6', () => {
    const skills = [...validGraph(), skill('k-coins', [], ['A6.1'])];
    expect(deadEnds(skills).map((s) => s.id)).toEqual(['g1-add-to-10', 'k-coins']);
  });
});
