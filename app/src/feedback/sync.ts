import type { Report } from '@bright-trail/shared';

import type { Repository } from '../storage/repository';
import type { QueuedReport } from '../storage/report';
import type { CaptureFiles } from './captureTypes';
import { captureFiles } from './files';
import { describeUpload, noteFeedback } from './status';

/** What a sync needs from the outside world. Tests pass their own. */
export type FeedbackDeps = {
  /** The feedback Worker, without `/v1/reports`. Undefined when the build has none. */
  baseUrl: string | undefined;
  fetch: (
    url: string,
    init: { method: 'POST'; body: FormData; signal: AbortSignal },
  ) => Promise<{ status: number }>;
  /** How long an upload may take before it counts as offline. */
  timeoutMs?: number;
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

const TIMEOUT_MS = 30_000;

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
      noteFeedback(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(repo: Repository, deps: FeedbackDeps) {
  if (!deps.baseUrl) {
    noteFeedback('This build has no feedback URL, so reports stay on the device.');
    return;
  }
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
  let answer = await post(url, queued.report, capture, deps);
  // The capture can be what the Worker or the device's upload refuses, and the report is worth
  // more without it than lost.
  if (capture && (typeof answer === 'string' || answer === 413 || answer === 415)) {
    const first = answer;
    answer = await post(url, queued.report, null, deps);
    if (typeof first === 'string' && typeof answer === 'number' && answer >= 200 && answer < 300) {
      noteFeedback(`Report sent without its picture. With it: ${first}`);
      return 'sent';
    }
  }
  if (typeof answer === 'string') {
    noteFeedback(`Upload failed: ${answer}. Will retry.`);
    return 'retry';
  }
  noteFeedback(describeUpload(answer));
  if (answer === 408 || answer === 429 || answer >= 500) return 'retry';
  if (answer >= 200 && answer < 300) return 'sent';
  return 'rejected';
}

/** The Worker's status, or why no answer came, such as a timeout or a failed request. */
async function post(
  url: string,
  report: Report,
  capture: unknown,
  deps: FeedbackDeps,
): Promise<number | string> {
  const body = new FormData();
  // Without a capture, lost since the flag or refused, the report says it has none.
  body.append('report', JSON.stringify(capture ? report : { ...report, hasCapture: false }));
  if (capture) body.append('capture', capture as Blob);

  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The race also covers a fetch that ignores the signal, so a stalled upload can't hold the run.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new Error('The upload timed out'));
    }, deps.timeoutMs ?? TIMEOUT_MS);
  });
  try {
    const response = await Promise.race([
      deps.fetch(url, { method: 'POST', body, signal: abort.signal }),
      timeout,
    ]);
    return response.status;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(timer);
  }
}
