import { ContentBundleSchema, gameProblems, hopsProblems } from '@bright-trail/shared';

export type BundleCheck = { ok: true; summary: string } | { ok: false; problems: string[] };

export function checkBundle(data: unknown): BundleCheck {
  const result = ContentBundleSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      problems: result.error.issues.map(
        (issue) => `${issue.path.join('.') || '(bundle)'}: ${issue.message}`,
      ),
    };
  }
  const { version, skills, nuggets, items } = result.data;
  const sceneIssues = items.flatMap((item) => [
    ...(item.game
      ? gameProblems(item, item.game).map((p) => `${item.id} ${item.game?.kind}: ${p}`)
      : []),
    ...(item.type === 'number-line' && item.hops
      ? hopsProblems(item, item.hops).map((p) => `${item.id} hops: ${p}`)
      : []),
  ]);
  if (sceneIssues.length > 0) return { ok: false, problems: sceneIssues };
  return {
    ok: true,
    summary: `Bundle ${version}: ${skills.length} skills, ${nuggets.length} nuggets, ${items.length} items`,
  };
}
