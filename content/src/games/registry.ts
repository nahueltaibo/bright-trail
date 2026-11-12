import type {
  CompareScene,
  Hops,
  Item,
  JoinScene,
  NumberLineItem,
  Scene,
  SliceScene,
} from '@bright-trail/shared';
import {
  acceptCompares,
  applyCompares,
  compareCandidates,
  compareTagRequest,
} from '../compare/compare';
import { acceptHops, applyHops, hopsCandidates, hopsTagRequest } from '../hops/hops';
import { acceptJoins, applyJoins, joinCandidates, joinTagRequest } from '../join/join';
import { acceptScenes, applyScenes, candidateItems, tagRequest } from '../scenes/scenes';
import { acceptSlices, applySlices, sliceCandidates, sliceTagRequest } from '../slices/slices';
import type { Tagger } from './tagger';

const share: Tagger<Item, Scene> = {
  file: 'scenes.json',
  outcome: 'play as sharing scenes',
  label: 'Scene',
  minPerSkill: 3,
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
  candidates: compareCandidates,
  request: compareTagRequest,
  accept: (items, output) => {
    const { scenes, rejected } = acceptCompares(items, output);
    return { tagged: scenes, rejected };
  },
  apply: applyCompares,
};

const hops: Tagger<NumberLineItem, Hops> = {
  file: 'hops.json',
  outcome: 'hop a planned path',
  label: 'Hops',
  minPerSkill: 1,
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
export const TAGGERS = { share, slices, join, compare, hops };
export type TaggerKind = keyof typeof TAGGERS;

export function isTaggerKind(kind: string): kind is TaggerKind {
  return Object.hasOwn(TAGGERS, kind);
}
