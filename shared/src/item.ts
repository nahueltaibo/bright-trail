import { z } from 'zod';
import { IdSchema, NonEmptyTextSchema } from './common';
import { JoinSceneSchema } from './join';
import { SceneSchema } from './scene';
import { SliceSceneSchema } from './slices';
import { VisualSchema } from './visual';

export const DifficultySchema = z.number().int().min(1).max(3);

const ItemBaseSchema = z.object({
  id: IdSchema,
  skillId: IdSchema,
  /** 1 easy, 2 medium, 3 hard. */
  difficulty: DifficultySchema,
  /** The question as spoken. Tap items should name the choices too. */
  narration: NonEmptyTextSchema,
  prompt: NonEmptyTextSchema,
  /** Shown, and read aloud, after a miss. */
  why: NonEmptyTextSchema,
  /** When set, the item plays as the sharing minigame. Its answer must match the item's. */
  scene: SceneSchema.optional(),
  /** When set, the item plays as the slices minigame. Its answer must be one the scene shows. */
  slices: SliceSceneSchema.optional(),
  /** When set, the item plays as the join-and-leave minigame. Its answer must match the item's. */
  join: JoinSceneSchema.optional(),
});

export const ChoiceSchema = z.discriminatedUnion('kind', [
  z.object({ id: IdSchema, kind: z.literal('text'), text: NonEmptyTextSchema }),
  z.object({ id: IdSchema, kind: z.literal('number'), value: z.number() }),
  // A picture can't read itself, so it carries its own spoken label.
  z.object({
    id: IdSchema,
    kind: z.literal('visual'),
    visual: VisualSchema,
    narration: NonEmptyTextSchema,
  }),
]);
export type Choice = z.infer<typeof ChoiceSchema>;

export const TapItemSchema = ItemBaseSchema.extend({
  type: z.literal('tap'),
  visual: VisualSchema.optional(),
  choices: z.array(ChoiceSchema).min(2).max(4),
  answerChoiceId: IdSchema,
}).superRefine((item, ctx) => {
  const ids = item.choices.map((c) => c.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choice ids repeat' });
  }
  if (!ids.includes(item.answerChoiceId)) {
    ctx.addIssue({
      code: 'custom',
      path: ['answerChoiceId'],
      message: `No choice has id ${item.answerChoiceId}`,
    });
  }
});
export type TapItem = z.infer<typeof TapItemSchema>;

export const KeypadItemSchema = ItemBaseSchema.extend({
  type: z.literal('keypad'),
  visual: VisualSchema.optional(),
  answer: z.number(),
});
export type KeypadItem = z.infer<typeof KeypadItemSchema>;

// Steps can be decimals (0.1), so compare with a tolerance instead of `%`.
function isOnStep(value: number, min: number, step: number): boolean {
  const steps = (value - min) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

export const NumberLineItemSchema = ItemBaseSchema.extend({
  type: z.literal('number-line'),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  target: z.number(),
}).superRefine((item, ctx) => {
  if (item.max <= item.min) {
    ctx.addIssue({ code: 'custom', path: ['max'], message: 'max must be above min' });
    return;
  }
  if (!isOnStep(item.max, item.min, item.step)) {
    ctx.addIssue({ code: 'custom', path: ['step'], message: 'step must divide max - min' });
  }
  if (item.target < item.min || item.target > item.max) {
    ctx.addIssue({ code: 'custom', path: ['target'], message: 'target is outside min..max' });
  } else if (!isOnStep(item.target, item.min, item.step)) {
    ctx.addIssue({ code: 'custom', path: ['target'], message: 'target is not on a step' });
  }
});
export type NumberLineItem = z.infer<typeof NumberLineItemSchema>;

export const ItemSchema = z.discriminatedUnion('type', [
  TapItemSchema,
  KeypadItemSchema,
  NumberLineItemSchema,
]);
export type Item = z.infer<typeof ItemSchema>;
export type ItemType = Item['type'];
