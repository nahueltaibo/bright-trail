import { ReportSchema, type Report } from '@bright-trail/shared';
import type { D1Database } from '@cloudflare/workers-types';
import { json, type Env } from './env';

export const LIMITS = {
  reportsPerIpPerHour: 30,
  reportBytes: 32 * 1024,
  captureBytes: 400 * 1024,
  reportsPerDay: 5000,
  captureBytesPerDay: 500 * 1024 * 1024,
};

const HOUR_MS = 60 * 60 * 1000;
// Room for the multipart boundaries and part headers around the two parts.
const BODY_BYTES = LIMITS.reportBytes + LIMITS.captureBytes + 16 * 1024;

const CAPTURE_TYPES = [
  { ext: 'png', type: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'jpg', type: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
];

/** POST /v1/reports: a multipart body with a `report` JSON part and an optional `capture` image. */
export async function handleReport(request: Request, env: Env): Promise<Response> {
  if (await overRateLimit(env.DB, request.headers.get('CF-Connecting-IP') ?? 'unknown')) {
    return json(429, { error: 'Too many reports from this address. Try again later.' });
  }

  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return json(415, { error: 'Send multipart/form-data.' });
  }
  const body = await readCapped(request, BODY_BYTES);
  if (!body) return json(413, { error: 'The request is too large.' });

  let form: FormData;
  try {
    form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData();
  } catch {
    return json(400, { error: 'The multipart body could not be read.' });
  }

  const reportPart = form.get('report');
  if (reportPart === null) return json(400, { error: 'The report part is missing.' });
  const reportText = typeof reportPart === 'string' ? reportPart : await reportPart.text();
  if (new TextEncoder().encode(reportText).byteLength > LIMITS.reportBytes) {
    return json(413, { error: 'The report is too large.' });
  }

  const capturePart = form.get('capture');
  if (typeof capturePart === 'string') return json(400, { error: 'The capture must be a file.' });
  let capture: { bytes: Uint8Array; ext: string; type: string } | null = null;
  if (capturePart) {
    if (capturePart.size > LIMITS.captureBytes) {
      return json(413, { error: 'The capture is too large.' });
    }
    const bytes = new Uint8Array(await capturePart.arrayBuffer());
    const kind = CAPTURE_TYPES.find((t) => t.magic.every((b, i) => bytes[i] === b));
    if (!kind) return json(415, { error: 'The capture must be a PNG or JPEG.' });
    capture = { bytes, ext: kind.ext, type: kind.type };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(reportText);
  } catch {
    return json(400, { error: 'The report is not valid JSON.' });
  }
  const parsed = ReportSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return json(400, { error: 'The report does not match the schema.', issues });
  }
  const report = parsed.data;
  if (report.hasCapture !== (capture !== null)) {
    return json(400, { error: 'hasCapture must match whether a capture part is sent.' });
  }

  return store(env, report, capture);
}

async function store(
  env: Env,
  report: Report,
  capture: { bytes: Uint8Array; ext: string; type: string } | null,
): Promise<Response> {
  const exists = await env.DB.prepare('SELECT 1 FROM reports WHERE id = ?').bind(report.id).first();
  if (exists) return json(200, { id: report.id, duplicate: true });

  const day = new Date().toISOString().slice(0, 10);
  const captureBytes = capture?.bytes.byteLength ?? 0;
  const usage = await env.DB.prepare(
    'SELECT reports, capture_bytes AS bytes FROM daily_usage WHERE day = ?',
  )
    .bind(day)
    .first<{ reports: number; bytes: number }>();
  if (
    usage &&
    (usage.reports >= LIMITS.reportsPerDay ||
      usage.bytes + captureBytes > LIMITS.captureBytesPerDay)
  ) {
    // The app keeps its queue on a 5xx and tries again later.
    return json(503, { error: 'The daily report limit is reached. Try again tomorrow.' });
  }

  const captureKey = capture ? `captures/${report.id}.${capture.ext}` : null;
  if (capture && captureKey) {
    await env.CAPTURES.put(captureKey, capture.bytes, {
      httpMetadata: { contentType: capture.type },
    });
  }

  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO reports
       (id, created_at, received_at, content_kind, content_id, skill_id, capture_key, capture_bytes, report)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      report.id,
      report.createdAt,
      new Date().toISOString(),
      report.target.contentKind,
      report.target.contentId,
      report.skillId,
      captureKey,
      captureBytes,
      JSON.stringify(report),
    )
    .run();
  // A concurrent retry of the same id got there first.
  if (inserted.meta.changes === 0) return json(200, { id: report.id, duplicate: true });

  await env.DB.prepare(
    `INSERT INTO daily_usage (day, reports, capture_bytes) VALUES (?, 1, ?)
     ON CONFLICT (day) DO UPDATE SET reports = reports + 1, capture_bytes = capture_bytes + excluded.capture_bytes`,
  )
    .bind(day, captureBytes)
    .run();

  return json(201, { id: report.id });
}

/** Counts this request against its IP, and says whether the IP is past the hourly limit. */
// The rate-limiting binding only counts over 10 or 60 seconds, so the hourly window lives in D1.
async function overRateLimit(db: D1Database, ip: string): Promise<boolean> {
  const now = Date.now();
  // Hashed so D1 holds no raw IPs. Rows last an hour.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const ipHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const [, , count] = await db.batch<{ n: number }>([
    db.prepare('DELETE FROM intake_hits WHERE at <= ?').bind(now - HOUR_MS),
    db.prepare('INSERT INTO intake_hits (ip_hash, at) VALUES (?, ?)').bind(ipHash, now),
    db.prepare('SELECT COUNT(*) AS n FROM intake_hits WHERE ip_hash = ?').bind(ipHash),
  ]);
  return (count.results[0]?.n ?? 0) > LIMITS.reportsPerIpPerHour;
}

/** Reads the body, or returns null once it passes `max` bytes, whatever Content-Length claims. */
async function readCapped(request: Request, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > max) return null;
  if (!request.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = request.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
