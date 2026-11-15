import {
  SCHOOL_GRADES,
  answerPlacement,
  createPlacementContent,
  createSkillGraph,
  finishPlacement,
  gradeRank,
  manifestPath,
  nextPlacementItem,
  startPlacement,
  type ChildProfile,
} from '@bright-trail/shared';
import { openRepository, type Repository } from '../storage/repository';
import { openNodeSqliteDatabase } from '../storage/testing/nodeSqliteDatabase';
import { childHasPacks, loadContent, packStatus, syncPacks } from './content';
import { loadCore } from './core';
import { DISK_URL, diskBundle, diskManifest, diskSource, readPackFile } from './testing/diskPacks';

const now = () => new Date('2026-11-11T12:00:00Z');
const maya: ChildProfile = {
  id: 'maya',
  firstName: 'Maya',
  birthdate: '2019-03-14',
  gradeOverride: '1',
  avatar: 'fox',
  readingMode: false,
  dyslexicFont: false,
  subjects: ['math'],
};

async function freshRepo(): Promise<Repository> {
  return openRepository(openNodeSqliteDatabase(':memory:'));
}

describe('the generated packs', () => {
  it('give every skill a story and enough items for placement and a check', () => {
    const bundle = diskBundle();
    const nuggets = new Set(bundle.nuggets.map((n) => n.skillId));
    for (const skill of bundle.skills) {
      expect(nuggets.has(skill.id)).toBe(true);
      expect(bundle.items.filter((i) => i.skillId === skill.id).length).toBeGreaterThanOrEqual(5);
    }
  });

  // The content covers only some grades, so a child in any other grade must start nearby.
  it.each(SCHOOL_GRADES)('run placement to the end for a %s child', (grade) => {
    const bundle = diskBundle();
    const content = createPlacementContent(createSkillGraph(bundle.skills), bundle.items);
    const bundled = new Set(bundle.skills.map((s) => gradeRank(s.grade)));
    const nearest = Math.min(gradeRank(grade), content.topRank);

    for (const correct of [true, false]) {
      let state = startPlacement('kid', content, grade);
      expect(bundled.has(state.grade!)).toBe(true);
      if (bundled.has(nearest)) expect(state.grade).toBe(nearest);
      for (let n = 0; state.phase !== 'done'; n++) {
        expect(n).toBeLessThan(40);
        const item = nextPlacementItem(state, content)!;
        state = answerPlacement(state, content, { itemId: item.id, correct });
      }
      const { learner } = finishPlacement(state, content, '2026-11-07T12:00:00Z');
      expect(Object.keys(learner.skills)).toHaveLength(bundle.skills.length);
    }
  });
});

describe('loadContent', () => {
  it('has the shipped skills and no stories or items before a download', async () => {
    const repo = await freshRepo();
    const bundle = await loadContent(repo);
    expect(bundle.skills).toEqual(loadCore().skills);
    expect(bundle.items).toEqual([]);
    expect(bundle.version).toBe(`core-${loadCore().hash.slice(0, 8)}`);
  });

  it('joins the downloaded packs, and caches until they change', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    await syncPacks(repo, { source: diskSource(), now });

    const bundle = await loadContent(repo);
    expect(bundle.version).toBe(diskManifest().version);
    const grades = new Set(
      bundle.items.map((i) => bundle.skills.find((s) => s.id === i.skillId)!.grade),
    );
    expect([...grades].sort()).toEqual(['1', '2', 'K']);
    expect(await loadContent(repo)).toBe(bundle);

    await syncPacks(repo, { source: diskSource(), extra: 'all', now });
    const all = await loadContent(repo);
    expect(all).not.toBe(bundle);
    expect(all.items).toHaveLength(diskBundle().items.length);
  });

  it('leaves out packs downloaded for another core', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    await syncPacks(repo, { source: diskSource(), now });
    const pack = (await repo.packs.forCore(loadCore().hash)).find((p) => p.id === 'math-1')!;
    const [installed] = (await repo.packs.list()).filter((p) => p.id === 'math-1');
    await repo.packs.save({ ...installed, coreHash: 'f'.repeat(64), body: JSON.stringify(pack) });

    const bundle = await loadContent(repo);
    const grade1 = new Set(pack.items.map((i) => i.id));
    expect(bundle.items.some((i) => grade1.has(i.id))).toBe(false);
    expect(bundle.items.length).toBeGreaterThan(0);
    expect(await childHasPacks(repo, 'maya', now)).toBe(false);
  });
});

describe('syncPacks', () => {
  it('downloads each child’s grade and one either side, after the manifest', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    const requests: string[] = [];
    expect(await childHasPacks(repo, 'maya', now)).toBe(false);

    await syncPacks(repo, { source: diskSource(requests), now });

    expect(requests[0]).toBe(manifestPath(loadCore().hash));
    expect(requests.slice(1).map((f) => f.split('.')[0])).toEqual(['math-k', 'math-1', 'math-2']);
    expect((await repo.packs.list()).map((p) => p.id)).toEqual(['math-1', 'math-2', 'math-k']);
    expect(packStatus.get()).toEqual({ state: 'ready' });
    expect(await childHasPacks(repo, 'maya', now)).toBe(true);
  });

  it('downloads nothing again once the packs are in, and the manifest every 5 minutes', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    await syncPacks(repo, { source: diskSource(), now });
    const requests: string[] = [];
    await syncPacks(repo, { source: diskSource(requests), now });
    expect(requests).toEqual([]);
    const later = () => new Date('2026-11-11T12:05:00Z');
    await syncPacks(repo, { source: diskSource(requests), now: later });
    expect(requests).toEqual([manifestPath(loadCore().hash)]);
  });

  it('deletes packs no child needs', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    await syncPacks(repo, { source: diskSource(), now });
    await repo.children.save({ ...maya, gradeOverride: '4' });
    await syncPacks(repo, { source: diskSource(), now });
    expect((await repo.packs.list()).map((p) => p.id)).toEqual(['math-3', 'math-4', 'math-5']);
  });

  it('rejects a pack whose sha256 doesn’t match, and keeps none of it', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    const source = diskSource();
    const fetchText = source.fetchText;
    source.fetchText = async (url) => {
      const text = await fetchText(url);
      return url.includes('math-k.') ? text.replace('"K"', '"K" ') : text;
    };

    await syncPacks(repo, { source, now });

    expect(packStatus.get()).toEqual({
      state: 'failed',
      offline: false,
      message: 'Pack math-k failed its checksum.',
    });
    expect(await repo.packs.list()).toEqual([]);
  });

  it('reports offline when the manifest can’t be reached', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    const source = diskSource();
    source.fetchText = () => Promise.reject(new TypeError('Network request failed'));

    await syncPacks(repo, { source, now });

    expect(packStatus.get()).toMatchObject({ state: 'failed', offline: true });
  });

  it('runs once more when called during a sync', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    const first = syncPacks(repo, { source: diskSource(), now });
    await repo.children.save({ ...maya, id: 'leo', gradeOverride: '4' });
    const second = syncPacks(repo, { source: diskSource(), now });
    await Promise.all([first, second]);
    expect((await repo.packs.list()).map((p) => p.id)).toEqual([
      'math-1',
      'math-2',
      'math-3',
      'math-4',
      'math-5',
      'math-k',
    ]);
  });

  it('keeps every queued call’s extra packs', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    const first = syncPacks(repo, { source: diskSource(), now });
    const all = syncPacks(repo, { source: diskSource(), extra: 'all', now });
    const plain = syncPacks(repo, { source: diskSource(), now });
    await Promise.all([first, all, plain]);
    expect((await repo.packs.list()).map((p) => p.id).sort()).toEqual(
      diskManifest()
        .packs.map((p) => p.id)
        .sort(),
    );
  });

  it('joins queued lists of extra packs', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    const first = syncPacks(repo, { source: diskSource(), now });
    const four = syncPacks(repo, { source: diskSource(), extra: ['math-4'], now });
    const five = syncPacks(repo, { source: diskSource(), extra: ['math-5'], now });
    await Promise.all([first, four, five]);
    expect((await repo.packs.list()).map((p) => p.id)).toEqual([
      'math-1',
      'math-2',
      'math-4',
      'math-5',
      'math-k',
    ]);
  });
});

// Main publishes packs before the OTA update that reads them, so this build meets newer games.
describe('packs published after this build', () => {
  /** Serves the disk packs with math-k rewritten by `edit`, under a manifest that names it. */
  async function newerSource(edit: (items: Record<string, unknown>[]) => void) {
    const source = diskSource();
    const manifest = diskManifest();
    const entry = manifest.packs.find((p) => p.id === 'math-k')!;
    const pack = JSON.parse(readPackFile(entry.file));
    edit(pack.items);
    const body = JSON.stringify(pack);
    const sha256 = await source.sha256(body);
    const file = `math-k.${sha256.slice(0, 16)}.json`;
    const served = new Map([
      [file, body],
      [
        manifestPath(manifest.coreHash),
        JSON.stringify({
          ...manifest,
          packs: manifest.packs.map((p) => (p === entry ? { ...p, file, sha256 } : p)),
        }),
      ],
    ]);
    const fetchText = source.fetchText;
    source.fetchText = async (url) =>
      served.get(url.slice(DISK_URL.length + 1)) ?? (await fetchText(url));
    return source;
  }

  it('plays an item with an unknown game kind, or an unknown scene, as its own screen', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    let kGames = 0;
    const stripped: string[] = [];
    const source = await newerSource((items) => {
      const plain = items.find((i) => !i.game)!;
      const known = items.find((i) => i.game)!;
      plain.game = { kind: 'wall', rows: [1, 2] };
      known.game = { kind: (known.game as { kind: string }).kind, future: true };
      kGames = items.filter((i) => i.game).length;
      stripped.push(plain.id as string, known.id as string);
    });

    await syncPacks(repo, { source, now });

    expect(packStatus.get()).toEqual({ state: 'ready' });
    expect(await childHasPacks(repo, 'maya', now)).toBe(true);
    const bundle = await loadContent(repo);
    for (const id of stripped) {
      const item = bundle.items.find((i) => i.id === id);
      expect(item).toBeDefined();
      expect(item!.game).toBeUndefined();
    }
    const kSkills = new Set(bundle.skills.filter((s) => s.grade === 'K').map((s) => s.id));
    const kItems = bundle.items.filter((i) => kSkills.has(i.skillId));
    expect(kItems.filter((i) => i.game)).toHaveLength(kGames - 2);
  });

  it('leaves out an item it can’t read even without its game, and keeps the rest', async () => {
    const repo = await freshRepo();
    await repo.children.save(maya);
    let dropped = '';
    const source = await newerSource((items) => {
      items[0].type = 'drag-to-order';
      dropped = items[0].id as string;
    });

    await syncPacks(repo, { source, now });

    expect(packStatus.get()).toEqual({ state: 'ready' });
    const bundle = await loadContent(repo);
    expect(bundle.items.some((i) => i.id === dropped)).toBe(false);
    expect(bundle.items.length).toBeGreaterThan(0);
  });
});
