import { handleReport, type Env } from './intake';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/v1/reports') {
      if (request.method !== 'POST') {
        return Response.json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
      }
      return handleReport(request, env);
    }
    return Response.json({ error: 'Not found.' }, { status: 404 });
  },
};
