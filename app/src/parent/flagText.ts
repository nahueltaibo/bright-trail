import type { ContentBundle } from '@bright-trail/shared';
import type { ContentFlag } from '../storage/flag';

export type FlagDescription = {
  /** e.g. "Item" or "Story card 3". */
  kind: string;
  /** What the child saw or heard. Null when the content isn't in the current bundle. */
  text: string | null;
  skillTitle: string | null;
};

/** Looks up the flagged item or card in the bundle so a parent can read what was flagged. */
export function describeFlag(flag: ContentFlag, bundle: ContentBundle): FlagDescription {
  const skillTitle = (skillId: string) =>
    bundle.skills.find((s) => s.id === skillId)?.title ?? null;

  if (flag.contentKind === 'item') {
    const item = bundle.items.find((i) => i.id === flag.contentId);
    return {
      kind: 'Item',
      text: item ? item.prompt : null,
      skillTitle: item ? skillTitle(item.skillId) : null,
    };
  }
  const nugget = bundle.nuggets.find((n) => n.id === flag.contentId);
  const card = flag.cardIndex === null ? undefined : nugget?.cards[flag.cardIndex];
  return {
    kind: `Story card ${(flag.cardIndex ?? 0) + 1}`,
    text: card ? (card.text ? `${card.text} — ${card.narration}` : card.narration) : null,
    skillTitle: nugget ? skillTitle(nugget.skillId) : null,
  };
}
