import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  CAPTURES: R2Bucket;
  /** Bearer secret for `/admin/*`. It also keys signed capture links. */
  FEEDBACK_ADMIN_TOKEN: string;
}

export const json = (status: number, body: object, headers?: HeadersInit) =>
  Response.json(body, { status, headers });

/** Runs the handler for the request's method, or answers 405 with the methods the path allows. */
export function byMethod(
  request: Request,
  handlers: Record<string, () => Promise<Response>>,
): Promise<Response> {
  const handler = handlers[request.method];
  if (handler) return handler();
  const allowed = Object.keys(handlers);
  return Promise.resolve(
    json(405, { error: `Use ${allowed.join(' or ')}.` }, { Allow: allowed.join(', ') }),
  );
}
