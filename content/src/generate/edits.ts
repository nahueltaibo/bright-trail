import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { itemIds } from './convert';
import type { GeneratedContent } from './schema';

const ITEM_FIELDS = [
  'difficulty',
  'narration',
  'prompt',
  'why',
  'visual',
  'choices',
  'answerChoiceId',
  'answer',
  'min',
  'max',
  'step',
  'target',
  'check',
] as const;
const CARD_FIELDS = ['narration', 'text', 'visual'] as const;

/**
 * A hand fix to generated content, applied after review. `was` holds the replaced values, so an
 * edit fails loudly instead of landing on different content once the skill regenerates.
 */
export const ContentEditSchema = z.strictObject({
  skillId: z.string(),
  /** An item id like `g1-count-50-tap-3`, or `story` with `card`. */
  target: z.string(),
  /** Story card number, from 1. */
  card: z.number().int().min(1).optional(),
  set: z.record(z.string(), z.unknown()),
  was: z.record(z.string(), z.unknown()),
  reason: z.string().min(1),
});
export type ContentEdit = z.infer<typeof ContentEditSchema>;

export const ContentEditsSchema = z.strictObject({ edits: z.array(ContentEditSchema) });

export async function loadEdits(file: string): Promise<ContentEdit[]> {
  return ContentEditsSchema.parse(JSON.parse(await readFile(file, 'utf8'))).edits;
}

/** Applies one skill's edits to a copy of its content. Problems mean an edit didn't apply. */
export function applyEdits(
  skillId: string,
  content: GeneratedContent,
  edits: readonly ContentEdit[],
): { content: GeneratedContent; problems: string[] } {
  const edited = structuredClone(content);
  const ids = itemIds(skillId, edited);
  const problems: string[] = [];
  for (const edit of edits) {
    const where = edit.target === 'story' ? `story card ${edit.card}` : edit.target;
    const record: Record<string, unknown> | undefined =
      edit.target === 'story'
        ? edited.cards[(edit.card ?? 0) - 1]
        : edited.items[ids.indexOf(edit.target)];
    const allowed: readonly string[] = edit.target === 'story' ? CARD_FIELDS : ITEM_FIELDS;
    if (!record) {
      problems.push(`edit for ${where}: no such ${edit.target === 'story' ? 'card' : 'item'}`);
      continue;
    }
    const keys = Object.keys(edit.set);
    const bad = keys.filter((k) => !allowed.includes(k));
    if (bad.length > 0) {
      problems.push(`edit for ${where}: can't set ${bad.join(', ')}`);
      continue;
    }
    if (!isDeepStrictEqual(Object.keys(edit.was).sort(), [...keys].sort())) {
      problems.push(`edit for ${where}: was must hold the old value of every field it sets`);
      continue;
    }
    const stale = keys.filter((k) => !isDeepStrictEqual(record[k], edit.was[k]));
    if (stale.length > 0) {
      problems.push(
        `edit for ${where}: ${stale.join(', ')} changed since the edit was written, so it is stale`,
      );
      continue;
    }
    Object.assign(record, edit.set);
  }
  return { content: edited, problems };
}
