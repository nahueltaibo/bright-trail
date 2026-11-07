import { readFile } from 'node:fs/promises';
import type { Skill } from '@bright-trail/shared';
import { z } from 'zod';

export const BundleScopeSchema = z.strictObject({
  /** Skills the testers should learn. Their prerequisites join the bundle automatically. */
  targets: z.array(z.string()).min(1),
  /** Retries beyond the usual 2 for closure skills that must have content. */
  extraRetries: z.record(z.string(), z.number().int().min(0).max(3)).default({}),
});
export type BundleScope = z.output<typeof BundleScopeSchema>;

export async function loadScope(file: string): Promise<BundleScope> {
  return BundleScopeSchema.parse(JSON.parse(await readFile(file, 'utf8')));
}

/**
 * The targets and every skill they depend on, in graph order. Walk-back and placement probe
 * prerequisites, so each one needs content, and the result is a self-contained subgraph.
 */
export function prerequisiteClosure(skills: readonly Skill[], targets: readonly string[]): Skill[] {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const unknown = targets.filter((id) => !byId.has(id));
  if (unknown.length > 0) throw new Error(`Unknown target skills: ${unknown.join(', ')}`);
  const keep = new Set<string>();
  const stack = [...targets];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (keep.has(id)) continue;
    keep.add(id);
    stack.push(...byId.get(id)!.prerequisiteIds);
  }
  return skills.filter((s) => keep.has(s.id));
}
