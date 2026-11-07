import type { Kid, Thing } from './share';

/** Girls and boys with a mix of skin tones and names from many backgrounds. */
export const KIDS = {
  maya: { name: 'Maya', emoji: '👧🏽' },
  kofi: { name: 'Kofi', emoji: '👦🏿' },
  aiko: { name: 'Aiko', emoji: '👧🏻' },
  mateo: { name: 'Mateo', emoji: '👦🏽' },
  priya: { name: 'Priya', emoji: '👧🏾' },
  liam: { name: 'Liam', emoji: '👦🏼' },
  amara: { name: 'Amara', emoji: '👧🏿' },
  wei: { name: 'Wei', emoji: '👦🏻' },
  sofia: { name: 'Sofia', emoji: '👧🏼' },
  omar: { name: 'Omar', emoji: '👦🏾' },
} satisfies Record<string, Kid>;

export const THINGS = {
  cookie: { emoji: '🍪', one: 'cookie', many: 'cookies', cuttable: true },
  apple: { emoji: '🍎', one: 'apple', many: 'apples', cuttable: true },
  strawberry: { emoji: '🍓', one: 'strawberry', many: 'strawberries', cuttable: true },
  pie: { emoji: '🥧', one: 'pie', many: 'pies', cuttable: true },
  sandwich: { emoji: '🥪', one: 'sandwich', many: 'sandwiches', cuttable: true },
  ball: { emoji: '⚽', one: 'ball', many: 'balls' },
  teddy: { emoji: '🧸', one: 'teddy bear', many: 'teddy bears' },
  car: { emoji: '🚗', one: 'toy car', many: 'toy cars' },
} satisfies Record<string, Thing>;
