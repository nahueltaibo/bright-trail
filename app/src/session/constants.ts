/** A session ends at the first item boundary after 10 minutes. */
export const SESSION_CAP_MS = 10 * 60 * 1000;

/**
 * Placement items per session, about 7 minutes. Placement runs up to 28 items, so it splits over
 * two sessions and a young child doesn't tire.
 */
export const PLACEMENT_ITEMS_PER_SESSION = 14;

/**
 * Lessons on one skill per session. Two failed checks start walk-back, and when no prerequisite
 * is left to probe the engine picks the same skill again. The cap stops that loop.
 */
export const LESSONS_PER_SKILL_PER_SESSION = 2;

export type SessionLimits = {
  capMs: number;
  placementItemsPerSession: number;
  lessonsPerSkill: number;
};

export const DEFAULT_LIMITS: SessionLimits = {
  capMs: SESSION_CAP_MS,
  placementItemsPerSession: PLACEMENT_ITEMS_PER_SESSION,
  lessonsPerSkill: LESSONS_PER_SKILL_PER_SESSION,
};
