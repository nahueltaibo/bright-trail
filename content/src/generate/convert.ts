import type { GenCheck, GenChoice, GeneratedContent, GenItem, GenVisual } from './schema';

function visualOf(v: GenVisual | null): Record<string, unknown> | undefined {
  if (!v) return undefined;
  if (v.kind === 'emoji') return { kind: 'emoji', emoji: v.emoji };
  if (v.kind === 'objects') return { kind: 'objects', emoji: v.emoji, count: v.count };
  if (v.kind === 'fraction') {
    return {
      kind: 'fraction',
      shape: v.shape,
      parts: v.parts,
      // The generator says "shaded". The app calls those parts picked.
      picked: v.shaded,
      ...(v.wholes && v.wholes > 1 ? { wholes: v.wholes } : {}),
      ...(v.label?.trim() ? { label: v.label.trim() } : {}),
    };
  }
  return { kind: 'ten-frame', filled: v.filled };
}

function choiceOf(c: GenChoice): Record<string, unknown> {
  if (c.kind === 'number') return { id: c.id, kind: 'number', value: c.value };
  if (c.kind === 'text') return { id: c.id, kind: 'text', text: c.text };
  return { id: c.id, kind: 'visual', visual: visualOf(c.visual), narration: c.narration };
}

const clean = (s: string | null | undefined) => (s ?? '').trim();

function itemOf(item: GenItem, id: string, skillId: string): Record<string, unknown> {
  const base = {
    id,
    skillId,
    type: item.type,
    difficulty: item.difficulty,
    narration: clean(item.narration),
    prompt: clean(item.prompt),
    why: clean(item.why),
  };
  if (item.type === 'tap') {
    return {
      ...base,
      ...(item.visual ? { visual: visualOf(item.visual) } : {}),
      choices: item.choices.map(choiceOf),
      answerChoiceId: item.answerChoiceId,
    };
  }
  if (item.type === 'keypad') {
    return {
      ...base,
      ...(item.visual ? { visual: visualOf(item.visual) } : {}),
      answer: item.answer,
    };
  }
  return { ...base, min: item.min, max: item.max, step: item.step, target: item.target };
}

export interface Converted {
  /** Bundle-shaped but unvalidated: schema checks run on these. */
  nugget: Record<string, unknown>;
  items: Record<string, unknown>[];
  /** Answer checks by item id. They stay out of the bundle. */
  checks: Map<string, GenCheck>;
}

/** Item ids number each type separately, e.g. `g1-count-50-tap-3`, so they match the sample bundle. */
export function itemIds(skillId: string, content: GeneratedContent): string[] {
  const perType = new Map<string, number>();
  return content.items.map((item) => {
    const n = (perType.get(item.type) ?? 0) + 1;
    perType.set(item.type, n);
    return `${skillId}-${item.type}-${n}`;
  });
}

export function convertContent(skillId: string, content: GeneratedContent): Converted {
  const ids = itemIds(skillId, content);
  const checks = new Map<string, GenCheck>();
  const items = content.items.map((item, i) => {
    checks.set(ids[i], item.check);
    return itemOf(item, ids[i], skillId);
  });
  const nugget = {
    id: `${skillId}-story`,
    skillId,
    cards: content.cards.map((card) => ({
      narration: clean(card.narration),
      ...(clean(card.text) ? { text: clean(card.text) } : {}),
      ...(card.visual ? { visual: visualOf(card.visual) } : {}),
    })),
  };
  return { nugget, items, checks };
}
