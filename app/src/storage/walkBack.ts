import { IdSchema } from '@bright-trail/shared';
import { z } from 'zod';

// Mirrors `LearnerState.walkBack` from the learner engine (A1). Kept local until the engine
// lands on main; swap for its schema then.
/** A child's walk-back in progress: prerequisites still to probe and skills waiting to reteach. */
export const WalkBackSchema = z.object({
  probes: z.array(IdSchema),
  targets: z.array(IdSchema),
});
export type WalkBack = z.infer<typeof WalkBackSchema>;
