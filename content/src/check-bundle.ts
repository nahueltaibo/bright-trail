import { ContentBundleSchema } from '@bright-trail/shared';

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
  return {
    ok: true,
    summary: `Bundle ${version}: ${skills.length} skills, ${nuggets.length} nuggets, ${items.length} items`,
  };
}
