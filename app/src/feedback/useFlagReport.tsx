import type { AttemptPhase } from '@bright-trail/shared';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import type { View } from 'react-native';

import type { FlagTarget } from '../learning';
import type { Repository } from '../storage/repository';
import { captureForReport } from './captureReport';
import { captureFiles } from './files';
import { queueReport, type FlagDraft } from './queue';
import type { ReportTarget } from './report';
import { ReportSheet } from './ReportSheet';
import { syncFeedback } from './sync';

type Pending = { draft: FlagDraft; flag: FlagTarget; resolve: (sent: boolean) => void };

export type FlagReportOptions = {
  repo: Repository;
  childId: string;
  /** What the flag points at on screen now, or null when nothing reportable shows. */
  describe: (flag: FlagTarget) => { target: ReportTarget; phase: AttemptPhase } | null;
  /** Writes the local flags row. */
  saveFlag: (flag: FlagTarget) => Promise<void>;
};

/**
 * The flag flow: capture the view under `captureRef`, then ask for a comment. Send saves the
 * flag, queues the report, and syncs. Put `sheet` outside the captured view.
 */
export function useFlagReport({ repo, childId, describe, saveFlag }: FlagReportOptions) {
  const captureRef = useRef<ComponentRef<typeof View>>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  // Set from the tap until the sheet closes, so a second tap during the capture does nothing.
  const busy = useRef(false);

  const onFlag = useCallback(
    async (flag: FlagTarget): Promise<boolean> => {
      const about = describe(flag);
      if (busy.current || !about) return false;
      busy.current = true;
      const capturePath = await captureForReport(captureRef);
      return new Promise<boolean>((resolve) =>
        setPending({ draft: { ...about, childId, capturePath }, flag, resolve }),
      );
    },
    [describe, childId],
  );

  const finish = (p: Pending, sent: boolean) => {
    setPending(null);
    busy.current = false;
    p.resolve(sent);
  };

  const close = () => {
    if (!pending) return;
    if (pending.draft.capturePath) captureFiles.remove(pending.draft.capturePath);
    finish(pending, false);
  };

  const send = (comment: string) => {
    if (!pending) return;
    const p = pending;
    finish(p, true);
    void (async () => {
      try {
        await saveFlag(p.flag);
        await queueReport(repo, p.draft, comment);
      } catch (e) {
        console.warn('Could not queue the report', e);
        if (p.draft.capturePath) captureFiles.remove(p.draft.capturePath);
        return;
      }
      await syncFeedback(repo);
    })();
  };

  const sheet = pending ? <ReportSheet onSend={send} onClose={close} /> : null;
  return { captureRef, onFlag, sheet };
}
