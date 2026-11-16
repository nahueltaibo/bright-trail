import {
  REPORT_COMMENT_MAX,
  ReportSchema,
  type AttemptPhase,
  type ChildProfile,
  type ContentBundle,
  type Item,
  type Report,
  type StoryNugget,
} from '@bright-trail/shared';

/** What the tester flagged: the item on screen, or one card of a story. */
export type ReportTarget =
  { kind: 'item'; item: Item } | { kind: 'card'; nugget: StoryNugget; cardIndex: number };

export type ReportInput = {
  /** A fresh UUID, so a retried upload doesn't add a second report. */
  id: string;
  createdAt: string;
  target: ReportTarget;
  phase: AttemptPhase;
  bundle: Pick<ContentBundle, 'version' | 'schemaVersion'>;
  coreHash: string;
  app: Report['app'];
  device: Report['device'];
  screen: Report['screen'];
  /** Only the reading settings are copied, so a whole profile can be passed safely. */
  child: Pick<ChildProfile, 'readingMode' | 'dyslexicFont'>;
  comment?: string | null;
  hasCapture: boolean;
};

/** Builds and checks a report. Throws if the result doesn't pass `ReportSchema`. */
export function buildReport(input: ReportInput): Report {
  const { target } = input;
  if (target.kind === 'card' && !target.nugget.cards[target.cardIndex]) {
    throw new Error(`${target.nugget.id} has no card ${target.cardIndex}`);
  }
  const comment = input.comment?.trim().slice(0, REPORT_COMMENT_MAX) || null;
  return ReportSchema.parse({
    id: input.id,
    createdAt: input.createdAt,
    comment,
    target:
      target.kind === 'item'
        ? { contentKind: 'item', contentId: target.item.id, cardIndex: null }
        : { contentKind: 'card', contentId: target.nugget.id, cardIndex: target.cardIndex },
    item: target.kind === 'item' ? target.item : null,
    skillId: target.kind === 'item' ? target.item.skillId : target.nugget.skillId,
    phase: input.phase,
    content: {
      bundleVersion: input.bundle.version,
      coreHash: input.coreHash,
      contentSchemaVersion: input.bundle.schemaVersion,
    },
    app: input.app,
    device: input.device,
    screen: input.screen,
    settings: { readingMode: input.child.readingMode, dyslexicFont: input.child.dyslexicFont },
    hasCapture: input.hasCapture,
  });
}
