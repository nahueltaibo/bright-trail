import { createHash } from 'node:crypto';
import {
  CONTENT_SCHEMA_VERSION,
  ContentCoreSchema,
  ContentManifestSchema,
  ContentPackSchema,
  manifestPath,
  packId,
  SKILL_GRADES,
  SUBJECTS,
  type ContentBundle,
  type ContentCore,
  type ContentManifest,
  type Skill,
} from '@bright-trail/shared';

/** Every file the split writes, keyed by its path under the packs folder. */
export type PackFiles = Map<string, string>;

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/**
 * Splits a bundle into core, one pack per subject and grade with content, and a manifest named
 * by the schema version and the core's hash. Output is minified and deterministic, so hashes match the served bytes.
 */
export function splitBundle(bundle: ContentBundle): {
  core: ContentCore;
  manifest: ContentManifest;
  files: PackFiles;
} {
  const files: PackFiles = new Map();
  const core = ContentCoreSchema.parse({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    hash: sha256(JSON.stringify(bundle.skills)),
    skills: bundle.skills,
  });
  files.set('core.json', JSON.stringify(core));

  const skillById = new Map<string, Skill>(bundle.skills.map((s) => [s.id, s]));
  const keyOf = (skillId: string) => {
    const skill = skillById.get(skillId)!;
    return packId(skill.subject, skill.grade);
  };

  const packs: ContentManifest['packs'] = [];
  for (const subject of SUBJECTS) {
    for (const grade of SKILL_GRADES) {
      const id = packId(subject, grade);
      const nuggets = bundle.nuggets.filter((n) => keyOf(n.skillId) === id);
      const items = bundle.items.filter((i) => keyOf(i.skillId) === id);
      if (nuggets.length === 0 && items.length === 0) continue;
      const pack = ContentPackSchema.parse({
        schemaVersion: CONTENT_SCHEMA_VERSION,
        id,
        subject,
        grade,
        nuggets,
        items,
      });
      const text = JSON.stringify(pack);
      const hash = sha256(text);
      const file = `${id}.${hash.slice(0, 16)}.json`;
      files.set(file, text);
      packs.push({ id, subject, grade, file, sha256: hash, bytes: Buffer.byteLength(text) });
    }
  }

  const manifest = ContentManifestSchema.parse({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    coreHash: core.hash,
    version: bundle.version,
    generatedAt: bundle.generatedAt,
    packs,
  });
  files.set(manifestPath(core.hash), JSON.stringify(manifest));
  return { core, manifest, files };
}
