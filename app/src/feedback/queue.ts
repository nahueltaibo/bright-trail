import type { AttemptPhase } from '@bright-trail/shared';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import * as Updates from 'expo-updates';
import { PixelRatio, Platform } from 'react-native';

import { loadContent } from '../content';
import { loadCore } from '../content/core';
import type { Repository } from '../storage/repository';
import type { CaptureFiles } from './captureTypes';
import { deviceInfo } from './device';
import { captureFiles } from './files';
import { buildReport, type ReportInput, type ReportTarget } from './report';

/** A flag waiting on the sheet: what was flagged, and its capture if one fit. */
export type FlagDraft = {
  target: ReportTarget;
  phase: AttemptPhase;
  childId: string;
  capturePath: string | null;
};

/** The build, device, and screen a report came from. */
export function reportContext(): Pick<ReportInput, 'app' | 'device' | 'screen'> {
  const device = deviceInfo();
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  return {
    app: {
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      runtimeVersion: Updates.runtimeVersion || null,
      updateId: Updates.isEmbeddedLaunch ? null : (Updates.updateId ?? null),
    },
    device: { platform, osVersion: device.osVersion, model: device.model },
    screen: { ...device.screen, fontScale: PixelRatio.getFontScale() },
  };
}

export type QueueDeps = {
  files: Pick<CaptureFiles, 'keep' | 'remove'>;
  id: () => string;
  now: () => Date;
  context: typeof reportContext;
};

const defaultDeps: QueueDeps = {
  files: captureFiles,
  id: randomUUID,
  now: () => new Date(),
  context: reportContext,
};

/** Builds the report for a sent flag and queues it with its capture for `syncFeedback`. */
export async function queueReport(
  repo: Repository,
  draft: FlagDraft,
  comment: string,
  deps: QueueDeps = defaultDeps,
): Promise<void> {
  const [bundle, child] = await Promise.all([loadContent(repo), repo.children.get(draft.childId)]);
  if (!child) throw new Error(`No child ${draft.childId}`);
  const id = deps.id();
  const capturePath = draft.capturePath
    ? await deps.files.keep(draft.capturePath, `${id}${extension(draft.capturePath)}`)
    : null;
  try {
    const report = buildReport({
      id,
      createdAt: deps.now().toISOString(),
      target: draft.target,
      phase: draft.phase,
      bundle,
      coreHash: loadCore().hash,
      ...deps.context(),
      child,
      comment,
      hasCapture: capturePath !== null,
    });
    await repo.reports.enqueue(report, capturePath);
  } catch (e) {
    if (capturePath) deps.files.remove(capturePath);
    throw e;
  }
}

const extension = (uri: string) => /\.[a-z]+$/i.exec(uri)?.[0] ?? '';
