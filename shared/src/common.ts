import { z } from 'zod';

// Kebab-case slugs keep ids stable across LLM reruns and safe as SQLite keys and file names.
export const IdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use a kebab-case id, e.g. "g1-add-within-10"');

/** Calendar date as `YYYY-MM-DD`, with no time zone. */
export const IsoDateSchema = z.iso.date();

/** Instant as an ISO 8601 date-time with an offset, e.g. `2026-11-06T14:30:00Z`. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const NonEmptyTextSchema = z.string().trim().min(1);
