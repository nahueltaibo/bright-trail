/** The last thing the feedback flow did on this device, for the parent area. Not persisted. */
export type FeedbackEvent = { at: Date; text: string };

let last: FeedbackEvent | null = null;

export function noteFeedback(text: string, at: Date = new Date()): void {
  last = { at, text };
}

export function lastFeedbackEvent(): FeedbackEvent | null {
  return last;
}

/** How a Worker answer reads to a grown-up. Null means no answer came in time. */
export function describeUpload(status: number | null): string {
  if (status === null) return 'No answer from the server (offline or timed out). Will retry.';
  if (status >= 200 && status < 300) return 'Report sent.';
  if (status === 408 || status === 429 || status >= 500)
    return `The server answered ${status}. Will retry.`;
  return `The server refused the report (${status}).`;
}
