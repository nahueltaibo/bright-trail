import { readFile } from 'node:fs/promises';
import { IdSchema, type Skill } from '@bright-trail/shared';
import { z } from 'zod';

const reason = z.string().trim().min(1);
const edge = { skillId: IdSchema, prerequisiteId: IdSchema, reason };

export const OverrideSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('addPrerequisite'), ...edge }),
  z.strictObject({ op: z.literal('removePrerequisite'), ...edge }),
  z.strictObject({
    op: z.literal('replacePrerequisite'),
    skillId: IdSchema,
    from: IdSchema,
    to: IdSchema,
    reason,
  }),
  /** Keeps an edge that transitive pruning would otherwise drop. */
  z.strictObject({ op: z.literal('protectPrerequisite'), ...edge }),
  z.strictObject({
    op: z.literal('setTitle'),
    skillId: IdSchema,
    title: z.string().min(1),
    reason,
  }),
  z.strictObject({
    op: z.literal('setDescription'),
    skillId: IdSchema,
    description: z.string().min(1),
    reason,
  }),
  /** Lets one skill's kid-facing text keep a risky token on purpose. */
  z.strictObject({ op: z.literal('allowToken'), skillId: IdSchema, token: z.string(), reason }),
]);
export type Override = z.infer<typeof OverrideSchema>;

export const OverridesFileSchema = z.strictObject({ overrides: z.array(OverrideSchema) });

export async function loadOverrides(file: string): Promise<Override[]> {
  const parsed = OverridesFileSchema.safeParse(JSON.parse(await readFile(file, 'utf8')));
  if (!parsed.success) throw new Error(`${file}: ${z.prettifyError(parsed.error)}`);
  return parsed.data.overrides;
}

export interface OverrideResult {
  skills: Skill[];
  /** Edges pruning must keep, as `skillId>prerequisiteId`. */
  protectedEdges: Set<string>;
  /** Tokens each skill may keep, keyed by skill id. */
  allowedTokens: Map<string, Set<string>>;
  /** Overrides that no longer match the graph. A stale override fails the build. */
  stale: string[];
}

export const edgeKey = (skillId: string, prerequisiteId: string) => `${skillId}>${prerequisiteId}`;

/**
 * Applies overrides in file order. Each one must still match the generated graph, so a
 * regenerated graph can't silently drop or double a fix.
 */
export function applyOverrides(skills: readonly Skill[], overrides: readonly Override[]) {
  const byId = new Map(
    skills.map((s) => [s.id, { ...s, prerequisiteIds: [...s.prerequisiteIds] }]),
  );
  const protectedEdges = new Set<string>();
  const allowedTokens = new Map<string, Set<string>>();
  const stale: string[] = [];

  for (const o of overrides) {
    const skill = byId.get(o.skillId);
    const fail = (why: string) => stale.push(`Override ${o.op} on ${o.skillId}: ${why}`);
    if (!skill) {
      fail('no such skill');
      continue;
    }
    const has = (id: string) => skill.prerequisiteIds.includes(id);
    const known = (id: string) => byId.has(id) || (fail(`no such skill ${id}`), false);
    switch (o.op) {
      case 'addPrerequisite':
        if (!known(o.prerequisiteId)) break;
        if (has(o.prerequisiteId)) fail(`already lists ${o.prerequisiteId}`);
        else skill.prerequisiteIds.push(o.prerequisiteId);
        break;
      case 'removePrerequisite':
        if (!has(o.prerequisiteId)) fail(`doesn't list ${o.prerequisiteId}`);
        else skill.prerequisiteIds = skill.prerequisiteIds.filter((id) => id !== o.prerequisiteId);
        break;
      case 'replacePrerequisite':
        if (!known(o.to)) break;
        if (!has(o.from)) fail(`doesn't list ${o.from}`);
        else if (has(o.to)) fail(`already lists ${o.to}`);
        else skill.prerequisiteIds = skill.prerequisiteIds.map((id) => (id === o.from ? o.to : id));
        break;
      case 'protectPrerequisite':
        protectedEdges.add(edgeKey(o.skillId, o.prerequisiteId));
        break;
      case 'setTitle':
        if (skill.title === o.title) fail('title is already this');
        skill.title = o.title;
        break;
      case 'setDescription':
        if (skill.description === o.description) fail('description is already this');
        skill.description = o.description;
        break;
      case 'allowToken':
        allowedTokens.set(o.skillId, (allowedTokens.get(o.skillId) ?? new Set()).add(o.token));
        break;
    }
  }

  // Checked after every override, since a later entry may add the edge being protected.
  for (const key of protectedEdges) {
    const [skillId, prerequisiteId] = key.split('>');
    if (!byId.get(skillId)?.prerequisiteIds.includes(prerequisiteId)) {
      stale.push(`Override protectPrerequisite on ${skillId}: doesn't list ${prerequisiteId}`);
    }
  }
  const result: OverrideResult = {
    skills: skills.map((s) => byId.get(s.id)!),
    protectedEdges,
    allowedTokens,
    stale,
  };
  return result;
}
