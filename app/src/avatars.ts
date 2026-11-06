/** The fixed avatar set. `ChildProfile.avatar` stores the key. */
export const AVATARS = [
  { key: 'fox', emoji: '🦊', label: 'Fox' },
  { key: 'owl', emoji: '🦉', label: 'Owl' },
  { key: 'penguin', emoji: '🐧', label: 'Penguin' },
  { key: 'frog', emoji: '🐸', label: 'Frog' },
  { key: 'lion', emoji: '🦁', label: 'Lion' },
  { key: 'unicorn', emoji: '🦄', label: 'Unicorn' },
  { key: 'octopus', emoji: '🐙', label: 'Octopus' },
  { key: 'dinosaur', emoji: '🦖', label: 'Dinosaur' },
] as const;

export type Avatar = (typeof AVATARS)[number];
export type AvatarKey = Avatar['key'];

const FALLBACK: Avatar = AVATARS[0];

/** Unknown keys fall back to the first avatar, so a bad row never blanks the picker. */
export function getAvatar(key: string): Avatar {
  return AVATARS.find((a) => a.key === key) ?? FALLBACK;
}
