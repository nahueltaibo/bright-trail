import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assembleBundle,
  ContentPackSchema,
  parseContentBundle,
  type ContentBundle,
} from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { describe, expect, it } from 'vitest';
import { splitBundle } from './split';
import { packsDir, readPackFiles } from './write-packs';

const sampleBundle = parseContentBundle(sample);
const byId = <T extends { id: string }>(list: readonly T[]) =>
  [...list].sort((a, b) => a.id.localeCompare(b.id));

function packsOf(files: Map<string, string>) {
  return [...files]
    .filter(([name]) => name !== 'core.json' && !name.startsWith('manifests/'))
    .map(([, text]) => ContentPackSchema.parse(JSON.parse(text)));
}

describe('splitBundle', () => {
  it('puts each story and item in the pack of its skill subject and grade', () => {
    const { manifest, files } = splitBundle(sampleBundle);
    expect(manifest.packs.map((p) => p.id)).toEqual(['math-k', 'math-1']);
    const grades = new Map(sampleBundle.skills.map((s) => [s.id, s.grade]));
    for (const pack of packsOf(files)) {
      for (const entry of [...pack.nuggets, ...pack.items]) {
        expect(grades.get(entry.skillId)).toBe(pack.grade);
      }
    }
  });

  it('leaves grades with no content out of the manifest', () => {
    const { manifest } = splitBundle(sampleBundle);
    expect(manifest.packs.some((p) => p.grade === '2')).toBe(false);
  });

  it('assembles back into the same bundle', () => {
    const { core, manifest, files } = splitBundle(sampleBundle);
    const bundle = assembleBundle(core, manifest, packsOf(files));
    expect(bundle.skills).toEqual(sampleBundle.skills);
    expect(byId(bundle.nuggets)).toEqual(byId(sampleBundle.nuggets));
    expect(byId(bundle.items)).toEqual(byId(sampleBundle.items));
    expect(bundle.version).toBe(sampleBundle.version);
  });

  it('leaves subjects parents cannot pick out of core and the packs', () => {
    const skill = sampleBundle.skills.find((s) => s.grade === '1')!;
    const sci = {
      ...skill,
      id: 'g1-sci-living-things',
      subject: 'science' as const,
      framework: 'ontario-science-2022' as const,
      prerequisiteIds: [],
    };
    const item = { ...sampleBundle.items[0], id: 'g1-sci-living-things-tap-1', skillId: sci.id };
    const { core, manifest } = splitBundle({
      ...sampleBundle,
      skills: [...sampleBundle.skills, sci],
      items: [...sampleBundle.items, item],
    });
    expect(core).toEqual(splitBundle(sampleBundle).core);
    expect(manifest.packs.map((p) => p.id)).toEqual(['math-k', 'math-1']);
  });

  it('leaves parent opt-in skills out until the app can turn them on', () => {
    const skill = sampleBundle.skills.find((s) => s.grade === '1')!;
    const optIn = {
      ...skill,
      id: 'g1-body-parts',
      prerequisiteIds: [],
      parentOptIn: 'human-development' as const,
    };
    const { core } = splitBundle({ ...sampleBundle, skills: [...sampleBundle.skills, optIn] });
    expect(core).toEqual(splitBundle(sampleBundle).core);
  });

  it('records each pack file hash and size', () => {
    const { manifest, files } = splitBundle(sampleBundle);
    for (const entry of manifest.packs) {
      const text = files.get(entry.file)!;
      expect(createHash('sha256').update(text).digest('hex')).toBe(entry.sha256);
      expect(Buffer.byteLength(text)).toBe(entry.bytes);
      expect(entry.file).toBe(`${entry.id}.${entry.sha256.slice(0, 16)}.json`);
    }
  });

  it('keeps the core hash when only items change, so fixes skip an app update', () => {
    const fixed: ContentBundle = {
      ...sampleBundle,
      version: 'fixed',
      items: sampleBundle.items.slice(1),
    };
    const before = splitBundle(sampleBundle);
    const after = splitBundle(fixed);
    expect(after.core.hash).toBe(before.core.hash);
    expect(after.manifest.packs).not.toEqual(before.manifest.packs);
  });

  it('changes the core hash when the graph changes', () => {
    const regraphed: ContentBundle = {
      ...sampleBundle,
      skills: sampleBundle.skills.map((s) => ({ ...s, title: `${s.title}!` })),
    };
    expect(splitBundle(regraphed).core.hash).not.toBe(splitBundle(sampleBundle).core.hash);
  });
});

describe('content/out/packs', () => {
  it('matches bundle.json, or run npm run content:packs', async () => {
    const bundle = parseContentBundle(
      JSON.parse(readFileSync(join(packsDir, '..', 'bundle.json'), 'utf8')),
    );
    const expected = splitBundle(bundle).files;
    const actual = await readPackFiles();
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [name, text] of expected) expect(actual.get(name), name).toBe(text);
  });
});
