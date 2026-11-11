import { z } from 'zod';
import { IsoDateTimeSchema, NonEmptyTextSchema } from './common';
import { ItemSchema } from './item';
import { StoryNuggetSchema } from './nugget';
import { SkillSchema, type Skill } from './skill';

/** Bumped on breaking schema changes, so the app can reject a bundle it can't play. */
export const CONTENT_SCHEMA_VERSION = 2;

/**
 * Returns one prerequisite cycle as a path of skill ids that starts and ends on the same id,
 * or `null` if the graph is acyclic. Unknown prerequisite ids are ignored.
 */
export function findPrerequisiteCycle(
  skills: readonly Pick<Skill, 'id' | 'prerequisiteIds'>[],
): string[] | null {
  const prerequisites = new Map(skills.map((s) => [s.id, s.prerequisiteIds]));
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];

  const visit = (id: string): string[] | null => {
    if (state.get(id) === 'done') return null;
    if (state.get(id) === 'visiting') return [...path.slice(path.indexOf(id)), id];
    state.set(id, 'visiting');
    path.push(id);
    for (const next of prerequisites.get(id) ?? []) {
      if (!prerequisites.has(next)) continue;
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(id, 'done');
    return null;
  };

  for (const { id } of skills) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

function addDuplicateIssues(
  ctx: z.RefinementCtx,
  collection: string,
  entries: readonly { id: string }[],
) {
  const seen = new Set<string>();
  entries.forEach(({ id }, i) => {
    if (seen.has(id)) {
      ctx.addIssue({ code: 'custom', path: [collection, i, 'id'], message: `Duplicate id ${id}` });
    }
    seen.add(id);
  });
}

export const ContentBundleSchema = z
  .object({
    schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
    /** Content release label, e.g. `2026.11.06-1`. Changes on every rebuild. */
    version: NonEmptyTextSchema,
    generatedAt: IsoDateTimeSchema,
    skills: z.array(SkillSchema),
    nuggets: z.array(StoryNuggetSchema),
    items: z.array(ItemSchema),
  })
  .superRefine((bundle, ctx) => {
    addDuplicateIssues(ctx, 'skills', bundle.skills);
    addDuplicateIssues(ctx, 'nuggets', bundle.nuggets);
    addDuplicateIssues(ctx, 'items', bundle.items);

    const skillIds = new Set(bundle.skills.map((s) => s.id));
    bundle.skills.forEach((skill, i) => {
      skill.prerequisiteIds.forEach((id, j) => {
        if (!skillIds.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['skills', i, 'prerequisiteIds', j],
            message: `Unknown prerequisite ${id}`,
          });
        }
      });
    });
    for (const collection of ['nuggets', 'items'] as const) {
      bundle[collection].forEach((entry, i) => {
        if (!skillIds.has(entry.skillId)) {
          ctx.addIssue({
            code: 'custom',
            path: [collection, i, 'skillId'],
            message: `Unknown skill ${entry.skillId}`,
          });
        }
      });
    }

    const cycle = findPrerequisiteCycle(bundle.skills);
    if (cycle) {
      ctx.addIssue({
        code: 'custom',
        path: ['skills'],
        message: `Prerequisite cycle: ${cycle.join(' -> ')}`,
      });
    }
  });
export type ContentBundle = z.infer<typeof ContentBundleSchema>;

/** Parses untrusted JSON into a bundle. Throws a `ZodError` listing every problem. */
export function parseContentBundle(data: unknown): ContentBundle {
  return ContentBundleSchema.parse(data);
}
