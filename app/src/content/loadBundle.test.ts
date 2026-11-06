import { loadBundle } from './loadBundle';

describe('loadBundle', () => {
  it('loads and validates the sample bundle once', async () => {
    const bundle = await loadBundle();
    expect(bundle.version).toBe('sample-1');
    expect(bundle.skills.map((s) => s.id)).toContain('g1-add-within-10');
    expect(await loadBundle()).toBe(bundle);
  });
});
