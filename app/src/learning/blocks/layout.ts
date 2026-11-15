import { PLACE_VALUE, PLACES, type BlocksScene, type Place } from '@bright-trail/shared';

export const STAGE_W = 360;
export const STAGE_H = 290;
const AREA_TOP = 64;
const AREA_H = 196;
const MARGIN = 10;
const ZONE_GAP = 14;
/** Room for a zone's header, even when it holds no blocks. */
const ZONE_MIN_W = 66;
const MAX_UNIT = 16;
const MIN_UNIT = 3;
const CUBE_MIN = 11;
/** Flats per row, rods per row, and cubes per row. */
const PER_ROW: Record<Place, number> = { hundreds: 3, tens: 10, ones: 5 };

export type Mat = Pick<BlocksScene, Place>;
export type Rect = { x: number; y: number; w: number; h: number };

/** One step of the play-out, with the mat it leaves. */
export type Step =
  | { kind: 'trade'; place: 'ones' | 'tens'; mat: Mat }
  | { kind: 'break'; place: 'hundreds' | 'tens'; mat: Mat }
  | { kind: 'count'; place: Place; by: number; from: number; mat: Mat }
  | { kind: 'join'; mat: Mat }
  | { kind: 'take'; taken: Mat; mat: Mat };

const up = { ones: 'tens', tens: 'hundreds' } as const;
const down = { hundreds: 'tens', tens: 'ones' } as const;
const above = (p: Place, q: Place) => PLACE_VALUE[q] > PLACE_VALUE[p];
const NONE: Mat = { hundreds: 0, tens: 0, ones: 0 };

/** The blocks on the mat before the answer. An add ask lays out both numbers. */
export function startMat(s: BlocksScene): Mat {
  const extra = s.ask === 'add' ? (s.second ?? NONE) : NONE;
  return {
    hundreds: s.hundreds + extra.hundreds,
    tens: s.tens + extra.tens,
    ones: s.ones + extra.ones,
  };
}

/**
 * What the play-out does: trade ten of a kind up, break bigger blocks down, then count. A sum
 * first joins the second number's blocks, or breaks what it must and takes them away.
 */
export function blocksPlan(s: BlocksScene): Step[] {
  let mat: Mat = { hundreds: s.hundreds, tens: s.tens, ones: s.ones };
  const steps: Step[] = [];
  const trade = (place: 'ones' | 'tens') => {
    while (mat[place] >= 10) {
      mat = { ...mat, [place]: mat[place] - 10, [up[place]]: mat[up[place]] + 1 };
      steps.push({ kind: 'trade', place, mat });
    }
  };
  const breakDown = (place: 'hundreds' | 'tens') => {
    while (mat[place] > 0) {
      mat = { ...mat, [place]: mat[place] - 1, [down[place]]: mat[down[place]] + 10 };
      steps.push({ kind: 'break', place, mat });
    }
  };
  const breakOne = (place: 'hundreds' | 'tens') => {
    mat = { ...mat, [place]: mat[place] - 1, [down[place]]: mat[down[place]] + 10 };
    steps.push({ kind: 'break', place, mat });
  };
  const count = (place: Place, by: number, from: number) => {
    if (mat[place] > 0) steps.push({ kind: 'count', place, by, from, mat });
  };
  const total = () => {
    trade('ones');
    trade('tens');
    count('hundreds', 100, 0);
    count('tens', 10, mat.hundreds * 100);
    count('ones', 1, mat.hundreds * 100 + mat.tens * 10);
  };

  if (s.ask === 'total') {
    total();
  } else if (s.ask === 'add') {
    mat = startMat(s);
    steps.push({ kind: 'join', mat });
    total();
  } else if (s.ask === 'take') {
    const taken = s.second ?? NONE;
    if (mat.ones < taken.ones) {
      if (mat.tens === 0) breakOne('hundreds');
      breakOne('tens');
    }
    if (mat.tens < taken.tens) breakOne('hundreds');
    mat = {
      hundreds: mat.hundreds - taken.hundreds,
      tens: mat.tens - taken.tens,
      ones: mat.ones - taken.ones,
    };
    steps.push({ kind: 'take', taken, mat });
    total();
  } else if (s.ask === 'make') {
    const p = s.place!;
    if (above('ones', p)) trade('ones');
    if (above('tens', p)) trade('tens');
    if (above(p, 'hundreds')) breakDown('hundreds');
    if (above(p, 'tens')) breakDown('tens');
    count(p, 1, 0);
  } else {
    count(s.place!, s.ask === 'worth' ? PLACE_VALUE[s.place!] : 1, 0);
  }
  return steps;
}

/** The places that hold a block at some point, plus every place below the highest. */
export function shownPlaces(s: BlocksScene, plan: readonly Step[]): Place[] {
  const mats = [startMat(s), ...plan.map((p) => p.mat)];
  const top = PLACES.findIndex((p) => mats.some((m) => m[p] > 0));
  return PLACES.slice(Math.max(0, top));
}

function size(place: Place, n: number, u: number): { w: number; h: number } {
  if (n === 0) return { w: 0, h: 0 };
  const per = Math.min(n, PER_ROW[place]);
  const rows = Math.ceil(n / PER_ROW[place]);
  switch (place) {
    case 'hundreds':
      return { w: per * 10 * u + (per - 1) * gap(place, u), h: rows * 10 * u + (rows - 1) * u };
    case 'tens':
      return { w: per * u + (per - 1) * gap(place, u), h: rows * 10 * u + (rows - 1) * u };
    case 'ones': {
      const c = cubeSize(u);
      return { w: per * c + (per - 1) * gap(place, u), h: rows * c + (rows - 1) * gap(place, u) };
    }
  }
}

function gap(place: Place, u: number): number {
  return place === 'hundreds'
    ? Math.max(3, u * 0.6)
    : place === 'tens'
      ? u * 0.5
      : cubeSize(u) * 0.4;
}

/** Loose cubes stay big enough to count on a phone, so they aren't drawn to scale on a big mat. */
export function cubeSize(u: number): number {
  return Math.max(u, CUBE_MIN);
}

/** How wide each place's zone is: the widest it gets on any of the mats. */
function zoneWidths(mats: readonly Mat[], places: readonly Place[], u: number): number[] {
  return places.map((p) => Math.max(ZONE_MIN_W, ...mats.map((m) => size(p, m[p], u).w)));
}

/**
 * The biggest block unit that fits every mat the play-out passes through, and zone widths that
 * hold still across them, so headers and counters don't jump.
 */
export function frameFor(mats: readonly Mat[], places: readonly Place[]): MatFrame {
  for (let u = MAX_UNIT; u > MIN_UNIT; u -= 0.25) {
    const widths = zoneWidths(mats, places, u);
    const w = widths.reduce((a, b) => a + b, 0) + ZONE_GAP * (places.length - 1) + 2 * MARGIN;
    const tall = mats.some((m) => places.some((p) => size(p, m[p], u).h > AREA_H));
    if (w <= STAGE_W && !tall) return { unit: u, places, widths };
  }
  return { unit: MIN_UNIT, places, widths: zoneWidths(mats, places, MIN_UNIT) };
}

export type MatFrame = { unit: number; places: readonly Place[]; widths: number[] };

export type MatLayout = {
  /** Where each place's header and counter sit, by its center. */
  zones: { place: Place; x: number }[];
  /** Each place's blocks in order. */
  slots: Record<Place, Rect[]>;
};

/** Where every block of `m` stands on the 360 × 290 stage, zones left to right. */
export function layoutMat(m: Mat, { unit: u, places, widths }: MatFrame): MatLayout {
  const total = widths.reduce((a, b) => a + b, 0) + ZONE_GAP * (places.length - 1);
  let left = (STAGE_W - total) / 2;
  const zones: MatLayout['zones'] = [];
  const slots: MatLayout['slots'] = { hundreds: [], tens: [], ones: [] };
  places.forEach((place, z) => {
    const w = widths[z];
    const box = size(place, m[place], u);
    const x0 = left + (w - box.w) / 2;
    const y0 = AREA_TOP + (AREA_H - box.h) / 2;
    const g = gap(place, u);
    const [bw, bh] =
      place === 'hundreds'
        ? [10 * u, 10 * u]
        : place === 'tens'
          ? [u, 10 * u]
          : [cubeSize(u), cubeSize(u)];
    const rowGap = place === 'ones' ? g : u;
    for (let i = 0; i < m[place]; i++) {
      const col = i % PER_ROW[place];
      const row = Math.floor(i / PER_ROW[place]);
      slots[place].push({ x: x0 + col * (bw + g), y: y0 + row * (bh + rowGap), w: bw, h: bh });
    }
    zones.push({ place, x: left + w / 2 });
    left += w + ZONE_GAP;
  });
  return { zones, slots };
}

/** The ten strips a rod or flat is made of: cubes down a rod, rods across a flat. */
export function tenParts(r: Rect, place: 'hundreds' | 'tens'): Rect[] {
  return Array.from({ length: 10 }, (_, i) =>
    place === 'hundreds'
      ? { x: r.x + (i * r.w) / 10, y: r.y, w: r.w / 10, h: r.h }
      : { x: r.x, y: r.y + (i * r.h) / 10, w: r.w, h: r.h / 10 },
  );
}

/** The scene's play-out and the frame that holds every mat along it. */
export function sceneFrame(s: BlocksScene): { plan: Step[]; frame: MatFrame } {
  const plan = blocksPlan(s);
  const places = shownPlaces(s, plan);
  return { plan, frame: frameFor([s, startMat(s), ...plan.map((p) => p.mat)], places) };
}
