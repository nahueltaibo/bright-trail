import type { GameKind, GameOf, Item } from '@bright-trail/shared';
import { useMemo, type ReactElement } from 'react';
import { ArraysGame } from './arrays/ArraysGame';
import { ARRAYS_DEMO_ITEMS } from './arrays/demo';
import { CompareGame } from './compare/CompareGame';
import { COMPARE_DEMO_ITEMS } from './compare/demo';
import { sceneLabels } from './compare/layout';
import { SLICE_DEMO_ITEMS } from './food/demo';
import { sliceUnit } from './food/layout';
import { SliceGame } from './food/SliceGame';
import { JOIN_DEMO_ITEMS } from './join/demo';
import { JoinGame } from './join/JoinGame';
import { DEMO_ITEMS } from './minigames/demo';
import { problemFromScene } from './minigames/share';
import { ShareGame } from './minigames/ShareGame';
import { useGameProps } from './minigames/useGameProps';
import type { ItemViewProps } from './types';

export type GameViewProps<K extends GameKind = GameKind> = ItemViewProps & {
  game: GameOf<K>;
  shuffleSeed?: string;
};

export type GameEntry<K extends GameKind> = {
  /** Names the game on the dev pages. */
  title: string;
  /** Plays an item whose `game.kind` is this one. */
  View: (props: GameViewProps<K>) => ReactElement;
  /** One item per kind of question, for `/dev/games/<kind>`. */
  demo: readonly Item[];
};

function ShareView({ game, ...props }: GameViewProps<'share'>) {
  const { item } = props;
  const problem = useMemo(() => problemFromScene(game, item.id), [game, item.id]);
  return <ShareGame {...useGameProps(props)} problem={problem} />;
}

function SlicesView({ game: scene, ...props }: GameViewProps<'slices'>) {
  const game = useGameProps(props);
  const unit = sliceUnit(scene, typeof game.answer === 'number' ? game.answer : 0);
  return <SliceGame {...game} scene={scene} unit={unit} seed={props.item.id} />;
}

function JoinView({ game, ...props }: GameViewProps<'join'>) {
  return <JoinGame {...useGameProps(props)} scene={game} />;
}

function CompareView({ game, ...props }: GameViewProps<'compare'>) {
  const frame = useGameProps(props);
  const input = useMemo(() => sceneLabels(frame.input, game), [frame.input, game]);
  return <CompareGame {...frame} input={input} scene={game} />;
}

function ArraysView({ game, ...props }: GameViewProps<'arrays'>) {
  return <ArraysGame {...useGameProps(props)} scene={game} />;
}

/** Every minigame the app plays, by `kind`. A new kind in `GAMES` fails the type check here. */
export const GAME_VIEWS: { [K in GameKind]: GameEntry<K> } = {
  share: { title: 'Sharing', View: ShareView, demo: DEMO_ITEMS },
  slices: { title: 'Slices', View: SlicesView, demo: SLICE_DEMO_ITEMS },
  join: { title: 'Join and leave', View: JoinView, demo: JOIN_DEMO_ITEMS },
  compare: { title: 'Compare and order', View: CompareView, demo: COMPARE_DEMO_ITEMS },
  arrays: { title: 'Arrays', View: ArraysView, demo: ARRAYS_DEMO_ITEMS },
};

export const GAME_KINDS = Object.keys(GAME_VIEWS) as GameKind[];

export function isGameKind(kind: unknown): kind is GameKind {
  return (GAME_KINDS as unknown[]).includes(kind);
}

/** Plays an item as its game. */
export function GameView(props: GameViewProps) {
  // Each entry's View takes its own kind's game, which `game.kind` picks out.
  const { View } = GAME_VIEWS[props.game.kind] as GameEntry<GameKind>;
  return <View {...props} />;
}
