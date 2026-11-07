import {
  deriveGrade,
  type Attempt,
  type ChildProfile,
  type MasteryState,
  type SchoolGrade,
  type WalkBack,
} from '@bright-trail/shared';
import type { StoredContentFlag } from '../storage/flag';
import type { Repository } from '../storage/repository';

export const EXPORT_FORMAT = 'bright-trail-export';
export const EXPORT_VERSION = 1;

export type ExportedChild = ChildProfile & {
  derivedGrade: SchoolGrade;
  walkBack: WalkBack | null;
};

/** Everything on the device, for scoring the POC pass bars after the test. */
export type ExportPayload = {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  bundleVersion: string;
  children: ExportedChild[];
  mastery: MasteryState[];
  attempts: Attempt[];
  flags: StoredContentFlag[];
};

export async function buildExport(
  repo: Repository,
  { now, today, bundleVersion }: { now: string; today: string; bundleVersion: string },
): Promise<ExportPayload> {
  const children: ExportedChild[] = [];
  const mastery: MasteryState[] = [];
  for (const child of await repo.children.list()) {
    children.push({
      ...child,
      derivedGrade: deriveGrade(child.birthdate, today),
      walkBack: await repo.walkBack.get(child.id),
    });
    mastery.push(...(await repo.mastery.listForChild(child.id)));
  }
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now,
    bundleVersion,
    children,
    mastery,
    attempts: await repo.attempts.listAll(),
    flags: await repo.flags.list(),
  };
}

/** e.g. `bright-trail-export-2026-11-06T14-30-00.json`. Colons break file names on some targets. */
export function exportFileName(now: string): string {
  return `bright-trail-export-${now.slice(0, 19).replace(/:/g, '-')}.json`;
}
