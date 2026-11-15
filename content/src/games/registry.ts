import type {
  ArrayScene,
  BlocksScene,
  CompareScene,
  GridScene,
  Hops,
  Item,
  JoinScene,
  LabelScene,
  LineupScene,
  NumberLineItem,
  OrderScene,
  Scene,
  SliceScene,
  SortScene,
  StonesScene,
  WallScene,
} from '@bright-trail/shared';
import { acceptArrays, applyArrays, arrayCandidates, arrayTagRequest } from '../arrays/arrays';
import { acceptBlocks, applyBlocks, blocksCandidates, blocksTagRequest } from '../blocks/blocks';
import {
  acceptCompares,
  applyCompares,
  compareCandidates,
  compareTagRequest,
} from '../compare/compare';
import { acceptGrids, applyGrids, gridCandidates, gridTagRequest } from '../grid/grid';
import { acceptHops, applyHops, hopsCandidates, hopsTagRequest } from '../hops/hops';
import { acceptJoins, applyJoins, joinCandidates, joinTagRequest } from '../join/join';
import { acceptLabels, applyLabels, labelCandidates, labelTagRequest } from '../label/label';
import { acceptLineups, applyLineups, lineupCandidates, lineupTagRequest } from '../lineup/lineup';
import { acceptOrders, applyOrders, orderCandidates, orderTagRequest } from '../order/order';
import { acceptScenes, applyScenes, candidateItems, tagRequest } from '../scenes/scenes';
import { acceptSlices, applySlices, sliceCandidates, sliceTagRequest } from '../slices/slices';
import { acceptSorts, applySorts, sortCandidates, sortTagRequest } from '../sort/sort';
import { acceptStones, applyStones, stonesCandidates, stonesTagRequest } from '../stones/stones';
import { acceptWalls, applyWalls, wallCandidates, wallTagRequest } from '../wall/wall';
import type { Tagger } from './tagger';

const MATH = ['math'] as const;
const CARD_SUBJECTS = ['science', 'social-studies', 'health'] as const;

const share: Tagger<Item, Scene> = {
  file: 'scenes.json',
  outcome: 'play as sharing scenes',
  label: 'Scene',
  minPerSkill: 3,
  subjects: MATH,
  candidates: candidateItems,
  request: tagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptScenes(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyScenes,
};

const slices: Tagger<Item, SliceScene> = {
  file: 'slices.json',
  outcome: 'play as slice scenes',
  label: 'Slices',
  minPerSkill: 3,
  subjects: MATH,
  candidates: sliceCandidates,
  request: sliceTagRequest,
  accept: (items, output) => {
    const { slices, rejected } = acceptSlices(items, output);
    return { tagged: slices, rejected };
  },
  apply: applySlices,
};

const join: Tagger<Item, JoinScene> = {
  file: 'join.json',
  outcome: 'play as join scenes',
  label: 'Join',
  minPerSkill: 3,
  subjects: MATH,
  candidates: joinCandidates,
  request: joinTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptJoins(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyJoins,
};

const compare: Tagger<Item, CompareScene> = {
  file: 'compare.json',
  outcome: 'play as compare scenes',
  label: 'Compare',
  minPerSkill: 3,
  subjects: MATH,
  candidates: compareCandidates,
  request: compareTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptCompares(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyCompares,
};

const arrays: Tagger<Item, ArrayScene> = {
  file: 'arrays.json',
  outcome: 'play as array scenes',
  label: 'Arrays',
  minPerSkill: 3,
  subjects: MATH,
  candidates: arrayCandidates,
  request: arrayTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptArrays(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyArrays,
};

const grid: Tagger<Item, GridScene> = {
  file: 'grid.json',
  outcome: 'play as grid scenes',
  label: 'Grid',
  minPerSkill: 3,
  subjects: MATH,
  candidates: gridCandidates,
  request: gridTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptGrids(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyGrids,
};

const blocks: Tagger<Item, BlocksScene> = {
  file: 'blocks.json',
  outcome: 'play as base-ten blocks',
  label: 'Blocks',
  // A skill's lone sum past 20, like 16 + 9, is still worth a call.
  minPerSkill: 1,
  subjects: MATH,
  candidates: blocksCandidates,
  request: blocksTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptBlocks(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyBlocks,
};

const stones: Tagger<Item, StonesScene> = {
  file: 'stones.json',
  outcome: 'play as stepping stones',
  label: 'Stones',
  // A skill's only counting run is still worth a call, like g4's one run of thirds.
  minPerSkill: 1,
  subjects: MATH,
  candidates: stonesCandidates,
  request: stonesTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptStones(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyStones,
};

const lineup: Tagger<Item, LineupScene> = {
  file: 'lineup.json',
  outcome: 'play as line-ups',
  label: 'Lineup',
  // Place-in-line items are few, often one or two in a skill.
  minPerSkill: 1,
  subjects: MATH,
  candidates: lineupCandidates,
  request: lineupTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptLineups(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyLineups,
};

const wall: Tagger<Item, WallScene> = {
  file: 'wall.json',
  outcome: 'play on a fraction wall',
  label: 'Wall',
  minPerSkill: 3,
  subjects: MATH,
  candidates: wallCandidates,
  request: wallTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptWalls(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyWalls,
};

const label: Tagger<Item, LabelScene> = {
  file: 'label.json',
  outcome: 'play as labelled pictures',
  label: 'Label',
  // A skill names only a few parts of any one picture.
  minPerSkill: 1,
  subjects: CARD_SUBJECTS,
  candidates: labelCandidates,
  request: labelTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptLabels(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyLabels,
};

const order: Tagger<Item, OrderScene> = {
  file: 'order.json',
  outcome: 'play as rows in order',
  label: 'Order',
  minPerSkill: 1,
  subjects: CARD_SUBJECTS,
  candidates: orderCandidates,
  request: orderTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptOrders(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyOrders,
};

const sort: Tagger<Item, SortScene> = {
  file: 'sort.json',
  outcome: 'play as sorts into bins',
  label: 'Sort',
  minPerSkill: 1,
  subjects: CARD_SUBJECTS,
  candidates: sortCandidates,
  request: sortTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptSorts(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applySorts,
};

const hops: Tagger<NumberLineItem, Hops> = {
  file: 'hops.json',
  outcome: 'hop a planned path',
  label: 'Hops',
  minPerSkill: 1,
  subjects: MATH,
  candidates: hopsCandidates,
  request: hopsTagRequest,
  accept: (items, output) => {
    const { paths, rejected } = acceptHops(items, output);
    return { tagged: paths, rejected };
  },
  apply: applyHops,
};

/**
 * Every content tagger by the `--kind` that runs it, in the order the bundle applies them.
 * Hops come last because they skip number-line items that already play a minigame.
 */
export const TAGGERS = {
  share,
  slices,
  join,
  compare,
  arrays,
  grid,
  blocks,
  stones,
  lineup,
  wall,
  label,
  order,
  sort,
  hops,
};
export type TaggerKind = keyof typeof TAGGERS;

export function isTaggerKind(kind: string): kind is TaggerKind {
  return Object.hasOwn(TAGGERS, kind);
}
