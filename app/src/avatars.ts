import { color } from './design/tokens';

/** The fixed avatar set. `ChildProfile.avatar` stores the key. Each animal keeps its disc tint. */
export const AVATARS = [
  { key: 'fox', emoji: '🦊', label: 'Fox', tint: color.avPeach },
  { key: 'owl', emoji: '🦉', label: 'Owl', tint: color.avSky },
  { key: 'penguin', emoji: '🐧', label: 'Penguin', tint: color.avSky },
  { key: 'frog', emoji: '🐸', label: 'Frog', tint: color.avMint },
  { key: 'lion', emoji: '🦁', label: 'Lion', tint: color.avPeach },
  { key: 'unicorn', emoji: '🦄', label: 'Unicorn', tint: color.avLilac },
  { key: 'octopus', emoji: '🐙', label: 'Octopus', tint: color.avLilac },
  { key: 'dinosaur', emoji: '🦕', label: 'Dinosaur', tint: color.avMint },
  { key: 'panda', emoji: '🐼', label: 'Panda', tint: color.avMint },
  { key: 'cheetah', emoji: '🐆', label: 'Cheetah', tint: color.avPeach },
] as const;

export type Avatar = (typeof AVATARS)[number];
export type AvatarKey = Avatar['key'];

const FALLBACK: Avatar = AVATARS[0];

/** Unknown keys fall back to the first avatar, so a bad row never blanks the picker. */
export function getAvatar(key: string): Avatar {
  return AVATARS.find((a) => a.key === key) ?? FALLBACK;
}
