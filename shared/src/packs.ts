import { z } from 'zod';
import { CONTENT_SCHEMA_VERSION, ContentBundleSchema, type ContentBundle } from './bundle';
import { IdSchema, IsoDateTimeSchema, NonEmptyTextSchema } from './common';
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
