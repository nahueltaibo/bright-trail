import type { Report } from '@bright-trail/shared';
import { z } from 'zod';

/** `rejected` means the Worker refused it for good, so it isn't sent again. */
export const QueuedReportStatusSchema = z.enum(['pending', 'rejected']);
export type QueuedReportStatus = z.infer<typeof QueuedReportStatusSchema>;

/** A report waiting in the device queue. Sent reports leave the queue. */
export type QueuedReport = {
  report: Report;
  /** The capture file to upload with it. Null when `report.hasCapture` is false. */
  capturePath: string | null;
  status: QueuedReportStatus;
  createdAt: string;
  /** The last upload try, sent or not. Null until the first. */
  attemptedAt: string | null;
};
