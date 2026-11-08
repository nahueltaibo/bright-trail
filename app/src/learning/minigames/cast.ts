import type { Person } from '@bright-trail/shared';

export type Kid = { name: string; emoji: string };

const TONES = ['🏻', '🏼', '🏽', '🏾', '🏿'];
const BASE = { girl: '👧', boy: '👦', kid: '🧒' } as const;

// FNV-1a: enough to spread names and item ids over a few choices.
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A named kid's picture: the story's look, and a skin tone that stays the same for the name. */
export function kidFor(person: Person): Kid {
  return { name: person.name, emoji: BASE[person.look] + TONES[hash(person.name) % TONES.length] };
}

/** Girls and boys with names from many backgrounds, for kids the story leaves unnamed. */
export const POOL: Person[] = [
  { name: 'Maya', look: 'girl' },
  { name: 'Kofi', look: 'boy' },
  { name: 'Aiko', look: 'girl' },
  { name: 'Mateo', look: 'boy' },
  { name: 'Priya', look: 'girl' },
  { name: 'Liam', look: 'boy' },
  { name: 'Amara', look: 'girl' },
  { name: 'Wei', look: 'boy' },
  { name: 'Sofia', look: 'girl' },
  { name: 'Omar', look: 'boy' },
  { name: 'Hana', look: 'girl' },
  { name: 'Kai', look: 'boy' },
  { name: 'Nia', look: 'girl' },
  { name: 'Leo', look: 'boy' },
];

/**
 * Hands out pool kids in an order fixed by `seed`, skipping names already in the story. The same
 * item always gets the same cast.
 */
export function castFrom(seed: string, taken: readonly string[]) {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  const order = [...POOL].sort((a, b) => hash(`${seed}:${a.name}`) - hash(`${seed}:${b.name}`));
  return (): Kid => {
    const next = order.find((p) => !used.has(p.name.toLowerCase()))!;
    used.add(next.name.toLowerCase());
    return kidFor(next);
  };
}
