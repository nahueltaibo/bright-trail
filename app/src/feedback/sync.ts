import type { Repository } from '../storage/repository';
import type { QueuedReport } from '../storage/report';
import type { CaptureFiles } from './captureTypes';
import { captureFiles } from './files';

/** What a sync needs from the outside world. Tests pass their own. */
export type FeedbackDeps = {
  /** The feedback Worker, without `/v1/reports`. Undefined when the build has none. */
  baseUrl: string | undefined;
  fetch: (url: string, init: { method: 'POST'; body: FormData }) => Promise<{ status: number }>;
  /** The multipart value for a capture file, or null when the file is gone. */
  capturePart: (uri: string) => Promise<unknown>;
  files: Pick<CaptureFiles, 'remove'>;
  now?: () => Date;
};

/** React Native's FormData uploads a file from its URI, without reading it into JS. */
async function nativeCapturePart(uri: string): Promise<unknown> {
  if (captureFiles.size(uri) === null) return null;
  const jpeg = /\.jpe?g$/i.test(uri);
  return {
    uri,
    name: jpeg ? 'capture.jpg' : 'capture.png',
    type: jpeg ? 'image/jpeg' : 'image/png',
  };
}

export function defaultFeedbackDeps(): FeedbackDeps {
  return {
    baseUrl: process.env.EXPO_PUBLIC_FEEDBACK_URL,
    fetch: (url, init) => fetch(url, init),
    capturePart: nativeCapturePart,
    files: captureFiles,
  };
}

type Outcome = 'sent' | 'rejected' | 'retry';

let running: Promise<void> | null = null;
let again = false;

/**
 * Uploads queued reports, oldest first. Calls during a run get one more pass after it, so a
 * report sent mid-run still goes. Stops at the first report the Worker can't take yet.
 * Never rejects. Without a Worker URL, reports stay queued.
 */
export function syncFeedback(
  repo: Repository,
  deps: FeedbackDeps = defaultFeedbackDeps(),
): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce(repo, deps);
      } while (again);
    } catch (e) {
      console.warn('Feedback sync failed', e);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(repo: Repository, deps: FeedbackDeps) {
  if (!deps.baseUrl) return;
  const url = `${deps.baseUrl.replace(/\/+$/, '')}/v1/reports`;
  for (const queued of await repo.reports.listPending()) {
    const outcome = await upload(url, queued, deps);
    const at = (deps.now ?? (() => new Date()))().toISOString();
    if (outcome === 'retry') {
      await repo.reports.recordAttempt(queued.report.id, at);
      return;
    }
    if (outcome === 'sent') await repo.reports.markSent(queued.report.id);
    else await repo.reports.markRejected(queued.report.id, at);
    // A rejected report never goes again, so its capture has no further use either.
    if (queued.capturePath) deps.files.remove(queued.capturePath);
  }
}

async function upload(url: string, queued: QueuedReport, deps: FeedbackDeps): Promise<Outcome> {
  const capture = queued.capturePath ? await deps.capturePart(queued.capturePath) : null;
  // A capture lost since the flag still lets the report go, as one without a picture.
  const report = capture ? queued.report : { ...queued.report, hasCapture: false };
  const body = new FormData();
  body.append('report', JSON.stringify(report));
  if (capture) body.append('capture', capture as Blob);

  let status: number;
  try {
    ({ status } = await deps.fetch(url, { method: 'POST', body }));
  } catch {
    return 'retry';
  }
  if (status >= 200 && status < 300) return 'sent';
  if (status === 429 || status >= 500) return 'retry';
  return 'rejected';
}
