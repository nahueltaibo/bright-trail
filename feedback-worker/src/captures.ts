import { json, type Env } from './env';

export const LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

const hmacKey = (raw: BufferSource) =>
  crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

// Derived from the admin token, so links need no second secret and rotating the token revokes them.
async function linkKey(token: string) {
  const raw = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(encoder.encode(token)),
    encoder.encode('capture-link-v1'),
  );
  return hmacKey(raw);
}

const signedText = (id: string, exp: number | string) => encoder.encode(`${id}.${exp}`);

/** A link to the report's capture that works without the token until `expiresAt`, 7 days on. */
export async function signCaptureLink(origin: string, id: string, token: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + LINK_TTL_SECONDS;
  const sig = await crypto.subtle.sign('HMAC', await linkKey(token), signedText(id, exp));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return {
    url: `${origin}/captures/${encodeURIComponent(id)}?exp=${exp}&sig=${hex}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/** Whether `exp` and `sig` sign this id, and `exp` is in the future but no more than 7 days out. */
export async function verifyCaptureLink(
  id: string,
  exp: string | null,
  sig: string | null,
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token || !exp || !sig || !/^\d{1,12}$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) {
    return false;
  }
  const seconds = Number(exp);
  if (seconds * 1000 <= now || seconds * 1000 > now + LINK_TTL_SECONDS * 1000) return false;
  const bytes = new Uint8Array(sig.match(/../g)!.map((pair) => parseInt(pair, 16)));
  // verify compares in constant time.
  return crypto.subtle.verify('HMAC', await linkKey(token), bytes, signedText(id, exp));
}

/** GET /captures/:id?exp=&sig=: the capture for anyone holding a signed link. */
export async function handleSignedCapture(request: Request, env: Env, id: string) {
  const { searchParams } = new URL(request.url);
  const valid = await verifyCaptureLink(
    id,
    searchParams.get('exp'),
    searchParams.get('sig'),
    env.FEEDBACK_ADMIN_TOKEN,
  );
  if (!valid) return json(403, { error: 'The link is invalid or has expired.' });
  return streamCapture(env, id);
}

/** GET /admin/captures/:id: the capture, or with `?link=1` a signed link to it. */
export async function handleAdminCapture(request: Request, env: Env, id: string) {
  const url = new URL(request.url);
  if (url.searchParams.get('link') !== '1') return streamCapture(env, id);
  const row = await env.DB.prepare('SELECT capture_key FROM reports WHERE id = ?')
    .bind(id)
    .first<{ capture_key: string | null }>();
  if (!row?.capture_key) return json(404, { error: 'The report has no capture.' });
  return json(200, await signCaptureLink(url.origin, id, env.FEEDBACK_ADMIN_TOKEN));
}

async function streamCapture(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT capture_key FROM reports WHERE id = ?')
    .bind(id)
    .first<{ capture_key: string | null }>();
  const object = row?.capture_key ? await env.CAPTURES.get(row.capture_key) : null;
  if (!object) return json(404, { error: 'The report has no capture.' });
  // Tests compile this file with DOM types, whose ReadableStream differs from workers-types'.
  return new Response(object.body as unknown as BodyInit, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      // Screenshots from testers' devices: no shared caches.
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
