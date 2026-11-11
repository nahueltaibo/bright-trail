import { describe, expect, it } from 'vitest';
import sample from '../fixtures/sample-bundle.json';
import { CONTENT_SCHEMA_VERSION, parseContentBundle } from './bundle';
import { assembleBundle, ContentPackSchema, packId, type ContentCore } from './packs';

const bundle = parseContentBundle(sample);
const core: ContentCore = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  hash: '0'.repeat(64),
  skills: bundle.skills,
};
const manifest = { version: bundle.version, generatedAt: bundle.generatedAt };
const pack = (grade: '1' | 'k') => ({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: `math-${grade}`,
  subject: 'math',
  grade: grade === 'k' ? 'K' : grade,
  nuggets: bundle.nuggets.filter((n) => n.skillId.startsWith(grade === 'k' ? 'k-' : 'g1-')),
  items: bundle.items.filter((i) => i.skillId.startsWith(grade === 'k' ? 'k-' : 'g1-')),
});

describe('packId', () => {
  it('names a pack by subject and lower-case grade', () => {
    expect(packId('math', 'K')).toBe('math-k');
    expect(packId('math', '3')).toBe('math-3');
  });
});

describe('ContentPackSchema', () => {
  it('rejects an id that does not match the subject and grade', () => {
    expect(ContentPackSchema.safeParse({ ...pack('1'), id: 'math-2' }).success).toBe(false);
  });
});

describe('assembleBundle', () => {
  it('plays only the packs it is given', () => {
    const assembled = assembleBundle(core, manifest, [ContentPackSchema.parse(pack('1'))]);
    expect(assembled.skills).toHaveLength(bundle.skills.length);
    expect(assembled.items.every((i) => i.skillId.startsWith('g1-'))).toBe(true);
  });

  it('throws when a pack names a skill core lacks', () => {
    const smallCore = { ...core, skills: bundle.skills.filter((s) => s.grade === 'K') };
    expect(() => assembleBundle(smallCore, manifest, [ContentPackSchema.parse(pack('1'))])).toThrow(
      /Unknown skill/,
    );
  });
});
