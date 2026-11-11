import {
  assembleBundle,
  localClock,
  type ContentBundle,
  type ContentManifest,
} from '@bright-trail/shared';
import type { Repository } from '../storage/repository';
import { loadCore } from './core';
import {
  fetchManifest,
  hasPacks,
  installPacks,
  PackError,
  packsForChild,
  removePacks,
  storedManifest,
  type PackSource,
} from './packs';

const bundles = new WeakMap<Repository, { key: string; bundle: Promise<ContentBundle> }>();

/**
 * The shipped core joined with every pack downloaded for it. Skills without a pack have no
 * stories or items, so the session passes them over. Cached until the downloaded packs change.
 */
export async function loadContent(repo: Repository): Promise<ContentBundle> {
  const core = loadCore();
  const [manifest, installed] = await Promise.all([storedManifest(repo, core), repo.packs.list()]);
  const current = installed.filter((p) => p.coreHash === core.hash);
  const key = [manifest?.version, ...current.map((p) => p.sha256)].join(' ');
  const hit = bundles.get(repo);
  if (hit?.key === key) return hit.bundle;

  // Before the first download there's no manifest, so the core names the content instead.
  const label = manifest ?? {
    version: `core-${core.hash.slice(0, 8)}`,
    generatedAt: '2026-01-01T00:00:00Z',
  };
  const bundle = repo.packs.forCore(core.hash).then((packs) => assembleBundle(core, label, packs));
  bundles.set(repo, { key, bundle });
  bundle.catch(() => bundles.get(repo)?.bundle === bundle && bundles.delete(repo));
  return bundle;
}

/** Where downloads stand, for the parent area and the kid zone's "getting ready" screen. */
export type PackStatus =
  | { state: 'idle' }
  | { state: 'downloading'; done: number; total: number }
  | { state: 'ready' }
  | { state: 'failed'; offline: boolean; message: string };

let status: PackStatus = { state: 'idle' };
const listeners = new Set<() => void>();

function setStatus(next: PackStatus) {
  status = next;
  for (const listener of listeners) listener();
}

export const packStatus = {
  get: (): PackStatus => status,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** `fetch` and expo-crypto, against the build's `EXPO_PUBLIC_CONTENT_URL`. */
export function defaultSource(): PackSource {
  return {
    baseUrl: process.env.EXPO_PUBLIC_CONTENT_URL,
    async fetchText(url) {
      const response = await fetch(url);
      if (!response.ok) throw new PackError(`${url} answered ${response.status}.`);
      return response.text();
    },
    async sha256(text) {
      // Loaded here so tests that pass their own source never touch the native module.
      const Crypto = await import('expo-crypto');
      return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
    },
  };
}

type SyncOptions = {
  source?: PackSource;
  /** Packs to keep and download on top of what the children need, such as every pack for `/dev`. */
  extra?: 'all' | readonly string[];
  now?: () => Date;
};

/** How long a downloaded manifest counts as current. The host caches it for as long. */
const MANIFEST_TTL_MS = 5 * 60 * 1000;
const manifests = new WeakMap<Repository, { at: number; manifest: ContentManifest }>();

let running: Promise<void> | null = null;
let again: SyncOptions | null = null;

/**
 * Brings the downloaded packs in line with what every child needs now, and deletes the rest.
 * Calls during a sync run once more after it, so a fast series of answers costs one extra pass.
 * Never rejects. Failures land in `packStatus`.
 */
export function syncPacks(repo: Repository, options: SyncOptions = {}): Promise<void> {
  if (running) {
    again = again ? mergeOptions(again, options) : options;
    return running;
  }
  running = (async () => {
    try {
      await syncOnce(repo, options);
    } finally {
      running = null;
    }
    const next = again;
    again = null;
    if (next) await syncPacks(repo, next);
  })();
  return running;
}

/** Folds queued calls into one pass that keeps every pack any of them asked for. */
function mergeOptions(a: SyncOptions, b: SyncOptions): SyncOptions {
  const extra =
    a.extra === 'all' || b.extra === 'all'
      ? 'all'
      : a.extra || b.extra
        ? [...new Set([...(a.extra ?? []), ...(b.extra ?? [])])]
        : undefined;
  return { source: b.source ?? a.source, now: b.now ?? a.now, extra };
}

async function syncOnce(repo: Repository, options: SyncOptions) {
  const source = options.source ?? defaultSource();
  const now = options.now ?? (() => new Date());
  const core = loadCore();
  // A retry after a failure shows as "getting ready" until it settles.
  if (status.state === 'failed') setStatus({ state: 'idle' });
  try {
    const memo = manifests.get(repo);
    let manifest = memo && now().getTime() - memo.at < MANIFEST_TTL_MS ? memo.manifest : null;
    if (!manifest) {
      manifest = await fetchManifest(repo, core, source);
      manifests.set(repo, { at: now().getTime(), manifest });
    }
    const today = localClock(now()).today;
    const wanted = new Set<string>();
    for (const child of await repo.children.list()) {
      for (const id of await packsForChild(repo, core, manifest, child, today)) wanted.add(id);
    }
    const extra = options.extra === 'all' ? manifest.packs.map((p) => p.id) : options.extra;
    for (const id of extra ?? []) wanted.add(id);

    const ids = [...wanted];
    await installPacks(
      repo,
      core,
      manifest,
      ids,
      source,
      (done, total) => {
        if (total > 0) setStatus({ state: 'downloading', done, total });
      },
      now,
    );
    await removePacks(repo, wanted);
    setStatus({ state: 'ready' });
  } catch (e) {
    const error = e instanceof PackError ? e : null;
    setStatus({
      state: 'failed',
      offline: error?.offline ?? false,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * True when a child has the packs for their own grade and one either side. Packs for the grades
 * ahead download in the background and don't hold play up. False before the first manifest.
 */
export async function childHasPacks(
  repo: Repository,
  childId: string,
  now: () => Date = () => new Date(),
): Promise<boolean> {
  const core = loadCore();
  const [manifest, child] = await Promise.all([
    storedManifest(repo, core),
    repo.children.get(childId),
  ]);
  if (!manifest || !child) return false;
  const ids = await packsForChild(repo, core, manifest, child, localClock(now()).today, false);
  return hasPacks(repo, core, ids);
}
