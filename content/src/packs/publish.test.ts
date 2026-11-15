import { manifestPath, parseContentBundle } from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { describe, expect, it } from 'vitest';
import { planUploads, publish, readR2Config, type Upload } from './publish';
import { splitBundle } from './split';

const { manifest, files } = splitBundle(parseContentBundle(sample));
const manifestKey = manifestPath(manifest.coreHash);

describe('planUploads', () => {
  it('uploads every pack before the manifest', () => {
    const keys = planUploads(files).map((u) => u.key);
    expect(keys.at(-1)).toBe(manifestKey);
    expect(keys.slice(0, -1).sort()).toEqual(manifest.packs.map((p) => p.file).sort());
  });

  it('leaves core out, since it ships inside the app', () => {
    expect(planUploads(files).some((u) => u.key === 'core.json')).toBe(false);
  });

  it('caches hashed packs forever and manifests briefly', () => {
    for (const u of planUploads(files)) {
      expect(u.cacheControl).toContain(u.key === manifestKey ? 'max-age=60' : 'immutable');
    }
  });
});

describe('publish', () => {
  it('stops at a failed pack, so the manifest never names a missing file', async () => {
    const sent: string[] = [];
    const uploads = planUploads(files);
    const put = async (u: Upload) => {
      if (u.key === uploads[0].key) throw new Error('network down');
      sent.push(u.key);
    };
    await expect(publish(uploads, put)).rejects.toThrow('network down');
    expect(sent).not.toContain(manifestKey);
  });
});

describe('readR2Config', () => {
  const full = {
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'packs',
  };

  it('reads all four settings', () => {
    expect(readR2Config(full)).toEqual({
      accountId: 'acct',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'packs',
    });
  });

  it('returns null when none are set, including empty secrets in CI', () => {
    expect(readR2Config({})).toBeNull();
    expect(readR2Config({ R2_BUCKET: '', R2_ACCOUNT_ID: ' ' })).toBeNull();
  });

  it('names the missing ones when only some are set', () => {
    expect(() => readR2Config({ ...full, R2_BUCKET: '' })).toThrow('R2_BUCKET');
  });
});
