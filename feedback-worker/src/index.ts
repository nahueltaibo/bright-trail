import { handleAdmin } from './admin';
import { handleSignedCapture } from './captures';
import { byMethod, json, type Env } from './env';
import { handleReport } from './intake';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/v1/reports') {
      return byMethod(request, { POST: () => handleReport(request, env) });
    }
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return handleAdmin(request, env, pathname);
    }
    const capture = /^\/captures\/([^/]+)$/.exec(pathname);
    if (capture) {
      return byMethod(request, { GET: () => handleSignedCapture(request, env, capture[1]) });
    }
    return json(404, { error: 'Not found.' });
  },
};
