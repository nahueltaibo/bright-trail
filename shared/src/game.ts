import { z } from 'zod';
import { BlocksSceneSchema, blocksProblems } from './blocks';
import { CompareSceneSchema, compareProblems } from './compare';
import type { Item } from './item';
import { JoinSceneSchema, joinProblems } from './join';
import { SceneSchema, sceneProblems } from './scene';
import { SliceSceneSchema, sliceProblems } from './slices';

/** Every minigame an item can play, by its `kind`: the scene it needs and how to check it. */
export const GAMES = {
  share: { schema: SceneSchema, problems: sceneProblems },
  slices: { schema: SliceSceneSchema, problems: sliceProblems },
  join: { schema: JoinSceneSchema, problems: joinProblems },
  compare: { schema: CompareSceneSchema, problems: compareProblems },
  blocks: { schema: BlocksSceneSchema, problems: blocksProblems },
} as const;

export const GameSchema = z.discriminatedUnion('kind', [
  GAMES.share.schema,
  GAMES.slices.schema,
  GAMES.join.schema,
  GAMES.compare.schema,
  GAMES.blocks.schema,
]);
export type Game = z.infer<typeof GameSchema>;
export type GameKind = Game['kind'];
export type GameOf<K extends GameKind> = Extract<Game, { kind: K }>;

/** What's wrong with a game for its item, from the game's own check. Empty when it fits. */
export function gameProblems(item: Item, game: Game): string[] {
  const problems = GAMES[game.kind].problems as (item: Item, game: Game) => string[];
  return problems(item, game);
}
