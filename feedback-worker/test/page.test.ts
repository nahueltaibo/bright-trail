import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PAGE_HEADERS } from '../src/page';
import { startWorker, type TestWorker } from './helpers';

let worker: TestWorker;

beforeAll(async () => {
  worker = await startWorker();
}, 60_000);

afterAll(async () => {
  await worker?.dispose();
});

function expectPageHeaders(res: Response, type: string) {
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe(`${type}; charset=utf-8`);
  for (const [name, value] of Object.entries(PAGE_HEADERS)) {
    expect(res.headers.get(name)).toBe(value);
  }
}

describe('admin page', () => {
  it('serves the page without a token, with strict headers', async () => {
    const res = await worker.call('/admin');
    expectPageHeaders(res, 'text/html');
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe');
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const html = await res.text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(html).toContain('<script type="module" src="/admin.js"></script>');
    expect(html).not.toMatch(/<script>|<style|\sstyle=|\son\w+=/);
  });

  it('serves its script and stylesheet without a token, with the same headers', async () => {
    const js = await worker.call('/admin.js');
    expectPageHeaders(js, 'text/javascript');
    expect(await js.text()).toContain('sessionStorage');

    const css = await worker.call('/admin.css');
    expectPageHeaders(css, 'text/css');
  });

  it('serves no other file from public/', async () => {
    expect((await worker.call('/admin.html')).status).toBe(404);
  });

  it('answers HEAD with the headers, and 405 to a POST', async () => {
    const head = await worker.call('/admin', { method: 'HEAD' });
    expectPageHeaders(head, 'text/html');
    expect(await head.text()).toBe('');
    expect((await worker.call('/admin', { method: 'POST' })).status).toBe(405);
  });

  it('still answers 401 on the API without a token', async () => {
    for (const path of ['/admin/', '/admin/reports', '/admin/reports/x', '/admin/captures/x']) {
      expect((await worker.call(path)).status).toBe(401);
    }
  });
});
