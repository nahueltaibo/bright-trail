import {
  ContentManifestSchema,
  createSkillGraph,
  gradeRank,
  isUnlocked,
  packsFor,
  SKILL_GRADES,
  statusOf,
  type ChildProfile,
  type ContentCore,
  type ContentManifest,
  type LearnerState,
  type SkillGrade,
} from '@bright-trail/shared';
import { effectiveGrade } from '../parent/children';
import type { Repository, StoredPlacement } from '../storage/repository';

/** Where packs come from. The app passes `fetch` and expo-crypto; tests read files from disk. */
export type PackSource = {
  /** Serves `manifests/<coreHash>.json` and the pack files. Undefined when the build has none. */
  baseUrl: string | undefined;
  fetchText: (url: string) => Promise<string>;
  sha256: (text: string) => Promise<string>;
};

/** A download that failed. `offline` means the request never got an answer. */
export class PackError extends Error {
  constructor(
    message: string,
    readonly offline = false,
  ) {
    super(message);
  }
}

const MANIFEST_KEY = 'content-manifest';

async function download(source: PackSource, path: string): Promise<string> {
  if (!source.baseUrl) throw new PackError('This build has no content address.');
  const url = `${source.baseUrl.replace(/\/+$/, '')}/${path}`;
  try {
    return await source.fetchText(url);
  } catch (e) {
    if (e instanceof PackError) throw e;
    throw new PackError(`Couldn't reach ${url}`, true);
  }
}

/** The manifest last downloaded for this core, or null before the first download. */
export async function storedManifest(
  repo: Repository,
  core: ContentCore,
): Promise<ContentManifest | null> {
  const text = await repo.settings.get(MANIFEST_KEY);
  if (!text) return null;
  const parsed = ContentManifestSchema.safeParse(JSON.parse(text));
  return parsed.success && parsed.data.coreHash === core.hash ? parsed.data : null;
}

/** Downloads this core's manifest and keeps it for offline starts. */
export async function fetchManifest(
  repo: Repository,
  core: ContentCore,
  source: PackSource,
): Promise<ContentManifest> {
  const text = await download(source, `manifests/${core.hash}.json`);
  const parsed = ContentManifestSchema.safeParse(JSON.parse(text));
  if (!parsed.success || parsed.data.coreHash !== core.hash) {
    throw new PackError(`The manifest for core ${core.hash.slice(0, 8)} is not valid.`);
  }
  await repo.settings.set(MANIFEST_KEY, text);
  return parsed.data;
}

/** Grades past the child's own that play soon: placement's current grade and trace, or the trail's frontier. */
export function aheadGrades(
  core: ContentCore,
  placement: StoredPlacement | null,
  learner: LearnerState | null,
): SkillGrade[] {
  const byId = new Map(core.skills.map((s) => [s.id, s]));
  const grades = new Set<SkillGrade>();
  if (placement && !placement.finishedAt) {
    const { grade, queue } = placement.state;
    if (grade !== null) grades.add(SKILL_GRADES[Math.min(grade, SKILL_GRADES.length - 1)]);
    for (const id of queue) {
      const skill = byId.get(id);
      if (skill) grades.add(skill.grade);
    }
  } else if (learner) {
    const graph = createSkillGraph(core.skills);
    for (const skill of core.skills) {
      const status = statusOf(learner, skill.id);
      if (status !== 'mastered' && status !== 'assumed' && isUnlocked(learner, graph, skill.id)) {
        grades.add(skill.grade);
      }
    }
  }
  return [...grades].sort((a, b) => gradeRank(a) - gradeRank(b));
}

/** Ids of the packs a child needs: their grade (placed or by age) ±1, and the grades ahead. */
export async function packsForChild(
  repo: Repository,
  core: ContentCore,
  manifest: ContentManifest,
  child: ChildProfile,
  today: string,
  ahead = true,
): Promise<string[]> {
  const placement = await repo.placement.get(child.id);
  let learner: LearnerState | null = null;
  if (placement?.finishedAt) {
    const rows = await repo.mastery.listForChild(child.id);
    learner = {
      childId: child.id,
      skills: Object.fromEntries(rows.map((m) => [m.skillId, m])),
      walkBack: { probes: [], targets: [] },
    };
  }
  const top = SKILL_GRADES[SKILL_GRADES.length - 1];
  const grade = placement?.finishedAt
    ? (placement.placedGrade ?? top)
    : effectiveGrade(child, today);
  return packsFor(
    { subjects: child.subjects, grade },
    manifest.packs,
    ahead ? aheadGrades(core, placement, learner) : [],
  );
}

/**
 * Downloads each listed pack the device lacks or holds in another version, checks its sha256,
 * and saves it. Stops at the first failure. Packs saved before it stay.
 */
export async function installPacks(
  repo: Repository,
  core: ContentCore,
  manifest: ContentManifest,
  ids: readonly string[],
  source: PackSource,
  onProgress?: (done: number, total: number) => void,
  now: () => Date = () => new Date(),
): Promise<void> {
  const installed = new Map((await repo.packs.list()).map((p) => [p.id, p]));
  const todo = manifest.packs.filter((entry) => {
    if (!ids.includes(entry.id)) return false;
    const have = installed.get(entry.id);
    return !have || have.sha256 !== entry.sha256 || have.coreHash !== core.hash;
  });
  onProgress?.(0, todo.length);
  for (const [n, entry] of todo.entries()) {
    const body = await download(source, entry.file);
    if ((await source.sha256(body)) !== entry.sha256) {
      throw new PackError(`Pack ${entry.id} failed its checksum.`);
    }
    await repo.packs.save({
      id: entry.id,
      coreHash: core.hash,
      sha256: entry.sha256,
      body,
      installedAt: now()
        .toISOString()
        .replace(/\.\d{3}Z$/, 'Z'),
    });
    onProgress?.(n + 1, todo.length);
  }
}

/** Deletes downloaded packs outside `keep`. */
export async function removePacks(repo: Repository, keep: ReadonlySet<string>): Promise<void> {
  for (const pack of await repo.packs.list()) {
    if (!keep.has(pack.id)) await repo.packs.remove(pack.id);
  }
}

/** True when every listed pack is downloaded for this core, in any version. */
export async function hasPacks(
  repo: Repository,
  core: ContentCore,
  ids: readonly string[],
): Promise<boolean> {
  const installed = await repo.packs.list();
  return ids.every((id) => installed.some((p) => p.id === id && p.coreHash === core.hash));
}
