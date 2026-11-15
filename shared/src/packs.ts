import { z } from 'zod';
import { CONTENT_SCHEMA_VERSION, ContentBundleSchema, type ContentBundle } from './bundle';
import { IdSchema, IsoDateTimeSchema, NonEmptyTextSchema } from './common';
import { gradeRank } from './engine/graph';
import type { SchoolGrade } from './grade';
import { ItemSchema } from './item';
import { StoryNuggetSchema } from './nugget';
import {
  SkillGradeSchema,
  SkillSchema,
  SubjectSchema,
  type SkillGrade,
  type Subject,
} from './skill';

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

/** One pack holds the stories and items of one subject in one grade, e.g. `math-k` or `math-3`. */
export function packId(subject: Subject, grade: SkillGrade): string {
  return `${subject}-${grade.toLowerCase()}`;
}

/**
 * The skill graph, shipped inside the app. `hash` covers the skills only, so a content fix that
 * leaves the graph alone keeps the hash and reaches devices without an app update.
 */
export const ContentCoreSchema = z.object({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
  hash: Sha256Schema,
  skills: z.array(SkillSchema),
});
export type ContentCore = z.infer<typeof ContentCoreSchema>;

export const ContentPackSchema = z
  .object({
    schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
    id: IdSchema,
    subject: SubjectSchema,
    grade: SkillGradeSchema,
    nuggets: z.array(StoryNuggetSchema),
    items: z.array(ItemSchema),
  })
  .refine((pack) => pack.id === packId(pack.subject, pack.grade), {
    path: ['id'],
    message: 'Pack id must match its subject and grade',
  });
export type ContentPack = z.infer<typeof ContentPackSchema>;

/**
 * Reads a downloaded pack. Packs can be newer than this build, so an item's `game` it can't read
 * is dropped and the item plays its own screen. An item it still can't read is left out.
 */
export function readContentPack(data: unknown): ContentPack {
  const items = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return ContentPackSchema.parse(data);
  const readable = items.flatMap((item: unknown) => {
    if (ItemSchema.safeParse(item).success) return [item];
    if (typeof item !== 'object' || item === null) return [];
    const rest: Record<string, unknown> = { ...item };
    delete rest.game;
    return ItemSchema.safeParse(rest).success ? [rest] : [];
  });
  return ContentPackSchema.parse({ ...(data as object), items: readable });
}

/**
 * Where a core's manifest lives for one schema version. A build only fetches its own version, so
 * a breaking bump leaves older builds on the last manifest they can read.
 */
export function manifestPath(coreHash: string, schemaVersion = CONTENT_SCHEMA_VERSION): string {
  return `manifests/v${schemaVersion}/${coreHash}.json`;
}

export const PackEntrySchema = z.object({
  id: IdSchema,
  subject: SubjectSchema,
  grade: SkillGradeSchema,
  /** File name next to the manifest's folder. It carries the hash, so it never changes in place. */
  file: z.string().regex(/^[a-z0-9-]+\.[0-9a-f]{16}\.json$/),
  sha256: Sha256Schema,
  bytes: z.number().int().positive(),
});
export type PackEntry = z.infer<typeof PackEntrySchema>;

/**
 * Packs that go with one core. A subject and grade missing here has no content, which is not the
 * same as a pack the device hasn't downloaded yet.
 */
export const ContentManifestSchema = z.object({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
  coreHash: Sha256Schema,
  /** Content release label, e.g. `2026.11.06-53`. */
  version: NonEmptyTextSchema,
  generatedAt: IsoDateTimeSchema,
  packs: z.array(PackEntrySchema),
});
export type ContentManifest = z.infer<typeof ContentManifestSchema>;

/** Joins core and packs into one bundle and checks it. Throws if a pack names a skill core lacks. */
export function assembleBundle(
  core: ContentCore,
  manifest: Pick<ContentManifest, 'version' | 'generatedAt'>,
  packs: readonly ContentPack[],
): ContentBundle {
  return ContentBundleSchema.parse({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    version: manifest.version,
    generatedAt: manifest.generatedAt,
    skills: core.skills,
    nuggets: packs.flatMap((p) => p.nuggets),
    items: packs.flatMap((p) => p.items),
  });
}

/** How many grades either side of the child's grade to keep, so near gaps and stretch skills play. */
const GRADE_REACH = 1;

/**
 * Ids of the packs a child needs: each chosen subject at the child's grade and one either side,
 * plus `extraGrades` such as the grade placement is about to probe. Only packs the manifest has.
 */
export function packsFor(
  child: { subjects: readonly Subject[]; grade: SkillGrade | SchoolGrade },
  available: readonly Pick<PackEntry, 'id' | 'subject' | 'grade'>[],
  extraGrades: readonly SkillGrade[] = [],
): string[] {
  const rank = gradeRank(child.grade);
  const extra = new Set(extraGrades.map(gradeRank));
  return available
    .filter((p) => child.subjects.includes(p.subject))
    .filter(
      (p) => Math.abs(gradeRank(p.grade) - rank) <= GRADE_REACH || extra.has(gradeRank(p.grade)),
    )
    .map((p) => p.id);
}
