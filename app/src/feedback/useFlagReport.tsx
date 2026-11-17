import type { AttemptPhase } from '@bright-trail/shared';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import type { View } from 'react-native';

import type { FlagTarget } from '../learning';
import type { Repository } from '../storage/repository';
import { captureForReport } from './captureReport';
import { captureFiles } from './files';
import { queueReport, type FlagDraft } from './queue';
import type { ReportTarget } from './report';
import { ReportSheet } from './ReportSheet';
import { noteFeedback } from './status';
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
  // Refs, so the unmount cleanup sees the latest flag.
  const open = useRef<Pending | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const p = open.current;
      if (p) drop(p);
      open.current = null;
      busy.current = false;
    };
  }, []);

  const onFlag = useCallback(
    async (flag: FlagTarget): Promise<boolean> => {
      const about = describe(flag);
      if (busy.current || !about) return false;
      busy.current = true;
      let capturePath: string | null = null;
      try {
        capturePath = await captureForReport(captureRef);
      } catch (e) {
        console.warn('Could not capture the item', e);
      }
      if (!mounted.current) {
        if (capturePath) removeQuietly(capturePath);
        busy.current = false;
        return false;
      }
      return new Promise<boolean>((resolve) => {
        const p = { draft: { ...about, childId, capturePath }, flag, resolve };
        open.current = p;
        setPending(p);
      });
    },
    [describe, childId],
  );

  const finish = (p: Pending, sent: boolean) => {
    open.current = null;
    busy.current = false;
    setPending(null);
    p.resolve(sent);
  };

  const close = () => {
    if (!pending) return;
    if (pending.draft.capturePath) removeQuietly(pending.draft.capturePath);
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
        noteFeedback(`Could not queue the report: ${e instanceof Error ? e.message : String(e)}`);
        if (p.draft.capturePath) removeQuietly(p.draft.capturePath);
        return;
      }
      await syncFeedback(repo);
    })();
  };

  const sheet = pending ? <ReportSheet onSend={send} onClose={close} /> : null;
  return { captureRef, onFlag, sheet };
}

/** Deletes a dropped flag's capture and tells the flag button it wasn't sent. */
function drop(p: Pending) {
  if (p.draft.capturePath) removeQuietly(p.draft.capturePath);
  p.resolve(false);
}

function removeQuietly(uri: string) {
  try {
    captureFiles.remove(uri);
  } catch (e) {
    console.warn('Could not delete the capture', e);
  }
}
