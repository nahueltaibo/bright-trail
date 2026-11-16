import { json, type Env } from './env';

/** The admin page's public paths, and the asset and type each serves. */
const PAGE_FILES: Record<string, { asset: string; type: string }> = {
  '/admin': { asset: '/admin.html', type: 'text/html; charset=utf-8' },
  '/admin.js': { asset: '/admin.js', type: 'text/javascript; charset=utf-8' },
  '/admin.css': { asset: '/admin.css', type: 'text/css; charset=utf-8' },
};

export const PAGE_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' blob:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export const isPagePath = (pathname: string) => Object.hasOwn(PAGE_FILES, pathname);

/** Serves the admin page or one of its files. They hold no data, so they need no token. */
export async function servePage(request: Request, env: Env, pathname: string) {
  const file = PAGE_FILES[pathname];
  const asset = await env.ASSETS.fetch(new URL(file.asset, request.url).toString());
  if (!asset.ok) return json(404, { error: 'Not found.' });
  return new Response(request.method === 'HEAD' ? null : await asset.text(), {
    headers: { ...PAGE_HEADERS, 'Content-Type': file.type },
  });
}
