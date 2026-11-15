import {
  AttemptSchema,
  ChildProfileSchema,
  IsoDateTimeSchema,
  MasteryStateSchema,
  PlacementStateSchema,
  readContentPack,
  SkillGradeSchema,
  WalkBackSchema,
  type Attempt,
  type ChildProfile,
  type ContentPack,
  type MasteryState,
  type PlacementState,
  type SkillGrade,
  type WalkBack,
} from '@bright-trail/shared';
import type { SqlDatabase } from './db';
import { ContentFlagSchema, type ContentFlag, type StoredContentFlag } from './flag';
import { migrate } from './migrations';

type ChildRow = {
  id: string;
  first_name: string;
  birthdate: string;
  grade_override: string | null;
  avatar: string;
  reading_mode: number;
  dyslexic_font: number;
  subjects: string;
};

type MasteryRow = {
  child_id: string;
  skill_id: string;
  status: string;
  check_answered: number;
  check_correct: number;
  failed_checks: number;
  reviews_passed: number;
  next_review_on: string | null;
  updated_at: string;
};

type AttemptRow = {
  child_id: string;
  skill_id: string;
  item_id: string;
  answer: string;
  correct: number;
  time_to_answer_ms: number;
  narration_replays: number;
  session_id: string;
  phase: string;
  timestamp: string;
};

type FlagRow = {
  id: number;
  child_id: string | null;
  content_kind: string;
  content_id: string;
  card_index: number | null;
  bundle_version: string;
  created_at: string;
  resolved_at: string | null;
};

type PlacementRow = {
  state: string;
  placed_grade: string | null;
  finished_at: string | null;
};

/** A downloaded pack, without its body. */
export type InstalledPack = { id: string; coreHash: string; sha256: string; installedAt: string };

/** A child's placement: in progress while `finishedAt` is null. */
export type StoredPlacement = {
  state: PlacementState;
  /** Where teaching starts. Null while in progress, or when placed above every grade. */
  placedGrade: SkillGrade | null;
  finishedAt: string | null;
};

const toPlacement = (r: PlacementRow): StoredPlacement => ({
  state: PlacementStateSchema.parse(JSON.parse(r.state)),
  placedGrade: r.placed_grade === null ? null : SkillGradeSchema.parse(r.placed_grade),
  finishedAt: r.finished_at === null ? null : IsoDateTimeSchema.parse(r.finished_at),
});

const toChild = (r: ChildRow): ChildProfile =>
  ChildProfileSchema.parse({
    id: r.id,
    firstName: r.first_name,
    birthdate: r.birthdate,
    gradeOverride: r.grade_override ?? undefined,
    avatar: r.avatar,
    readingMode: r.reading_mode === 1,
    dyslexicFont: r.dyslexic_font === 1,
    subjects: JSON.parse(r.subjects),
  });

const toMastery = (r: MasteryRow): MasteryState =>
  MasteryStateSchema.parse({
    childId: r.child_id,
    skillId: r.skill_id,
    status: r.status,
    checkAnswered: r.check_answered,
    checkCorrect: r.check_correct,
    failedChecks: r.failed_checks,
    reviewsPassed: r.reviews_passed,
    nextReviewOn: r.next_review_on,
    updatedAt: r.updated_at,
  });

const toAttempt = (r: AttemptRow): Attempt =>
  AttemptSchema.parse({
    childId: r.child_id,
    skillId: r.skill_id,
    itemId: r.item_id,
    // JSON keeps the string-or-number type of the answer.
    answer: JSON.parse(r.answer),
    correct: r.correct === 1,
    timeToAnswerMs: r.time_to_answer_ms,
    narrationReplays: r.narration_replays,
    sessionId: r.session_id,
    phase: r.phase,
    timestamp: r.timestamp,
  });

const toFlag = (r: FlagRow): StoredContentFlag => ({
  id: r.id,
  ...ContentFlagSchema.parse({
    childId: r.child_id,
    contentKind: r.content_kind,
    contentId: r.content_id,
    cardIndex: r.card_index,
    bundleVersion: r.bundle_version,
    createdAt: r.created_at,
  }),
  resolvedAt: r.resolved_at === null ? null : IsoDateTimeSchema.parse(r.resolved_at),
});

const ATTEMPT_COLUMNS = `child_id, skill_id, item_id, answer, correct, time_to_answer_ms,
  narration_replays, session_id, phase, timestamp`;

/**
 * Typed access to the on-device tables. Every write is validated against the shared schemas
 * before it reaches SQLite, and every read is validated again on the way out.
 */
export function createRepository(db: SqlDatabase) {
  const children = {
    /** In the order they were added, so the picker stays stable. */
    async list(): Promise<ChildProfile[]> {
      const rows = await db.getAllAsync<ChildRow>('SELECT * FROM children ORDER BY rowid', []);
      return rows.map(toChild);
    },
    async get(id: string): Promise<ChildProfile | null> {
      const row = await db.getFirstAsync<ChildRow>('SELECT * FROM children WHERE id = ?', [id]);
      return row ? toChild(row) : null;
    },
    /** Inserts or replaces the profile with the same id. */
    async save(profile: ChildProfile): Promise<void> {
      const c = ChildProfileSchema.parse(profile);
      await db.runAsync(
        `INSERT INTO children (id, first_name, birthdate, grade_override, avatar, reading_mode,
           dyslexic_font, subjects)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           first_name = excluded.first_name, birthdate = excluded.birthdate,
           grade_override = excluded.grade_override, avatar = excluded.avatar,
           reading_mode = excluded.reading_mode, dyslexic_font = excluded.dyslexic_font,
           subjects = excluded.subjects`,
        [
          c.id,
          c.firstName,
          c.birthdate,
          c.gradeOverride ?? null,
          c.avatar,
          c.readingMode ? 1 : 0,
          c.dyslexicFont ? 1 : 0,
          JSON.stringify(c.subjects),
        ],
      );
    },
    /** Also deletes the child's mastery and attempts. Their flags stay, with no child. */
    async remove(id: string): Promise<void> {
      await db.runAsync('DELETE FROM children WHERE id = ?', [id]);
    },
  };

  const mastery = {
    async listForChild(childId: string): Promise<MasteryState[]> {
      const rows = await db.getAllAsync<MasteryRow>(
        'SELECT * FROM mastery WHERE child_id = ? ORDER BY skill_id',
        [childId],
      );
      return rows.map(toMastery);
    },
    async get(childId: string, skillId: string): Promise<MasteryState | null> {
      const row = await db.getFirstAsync<MasteryRow>(
        'SELECT * FROM mastery WHERE child_id = ? AND skill_id = ?',
        [childId, skillId],
      );
      return row ? toMastery(row) : null;
    },
    /** Inserts or replaces the row for this child and skill. */
    async save(state: MasteryState): Promise<void> {
      const m = MasteryStateSchema.parse(state);
      await db.runAsync(
        `INSERT OR REPLACE INTO mastery (child_id, skill_id, status, check_answered, check_correct,
           failed_checks, reviews_passed, next_review_on, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.childId,
          m.skillId,
          m.status,
          m.checkAnswered,
          m.checkCorrect,
          m.failedChecks,
          m.reviewsPassed,
          m.nextReviewOn,
          m.updatedAt,
        ],
      );
    },
    /**
     * Resets a child's progress, including any walk-back and placement. Attempts stay, so the
     * export still has the full history.
     */
    async removeForChild(childId: string): Promise<void> {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM mastery WHERE child_id = ?', [childId]);
        await db.runAsync('DELETE FROM placement WHERE child_id = ?', [childId]);
        await db.runAsync('UPDATE children SET walk_back = NULL WHERE id = ?', [childId]);
      });
    },
  };

  const walkBack = {
    /** Null when the child has no walk-back stored, or the child doesn't exist. */
    async get(childId: string): Promise<WalkBack | null> {
      const row = await db.getFirstAsync<{ walk_back: string | null }>(
        'SELECT walk_back FROM children WHERE id = ?',
        [childId],
      );
      return row?.walk_back ? WalkBackSchema.parse(JSON.parse(row.walk_back)) : null;
    },
    /** Pass null to clear it. Throws if the child doesn't exist. */
    async save(childId: string, value: WalkBack | null): Promise<void> {
      const json = value === null ? null : JSON.stringify(WalkBackSchema.parse(value));
      const result = await db.runAsync('UPDATE children SET walk_back = ? WHERE id = ?', [
        json,
        childId,
      ]);
      if (result.changes === 0) throw new Error(`No child with id ${childId}`);
    },
  };

  const placement = {
    /** Null until placement starts. */
    async get(childId: string): Promise<StoredPlacement | null> {
      const row = await db.getFirstAsync<PlacementRow>(
        'SELECT state, placed_grade, finished_at FROM placement WHERE child_id = ?',
        [childId],
      );
      return row ? toPlacement(row) : null;
    },
    /** Inserts or replaces the child's placement. */
    async save(childId: string, value: StoredPlacement): Promise<void> {
      const state = PlacementStateSchema.parse(value.state);
      if (state.childId !== childId) throw new Error(`Placement is for ${state.childId}`);
      const placedGrade =
        value.placedGrade === null ? null : SkillGradeSchema.parse(value.placedGrade);
      if (value.finishedAt !== null) IsoDateTimeSchema.parse(value.finishedAt);
      await db.runAsync(
        'INSERT OR REPLACE INTO placement (child_id, state, placed_grade, finished_at) VALUES (?, ?, ?, ?)',
        [childId, JSON.stringify(state), placedGrade, value.finishedAt],
      );
    },
  };

  const attempts = {
    async add(attempt: Attempt): Promise<void> {
      const a = AttemptSchema.parse(attempt);
      await db.runAsync(
        `INSERT INTO attempts (${ATTEMPT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.childId,
          a.skillId,
          a.itemId,
          JSON.stringify(a.answer),
          a.correct ? 1 : 0,
          a.timeToAnswerMs,
          a.narrationReplays,
          a.sessionId,
          a.phase,
          a.timestamp,
        ],
      );
    },
    /** In the order they were answered. */
    async listForChild(childId: string): Promise<Attempt[]> {
      const rows = await db.getAllAsync<AttemptRow>(
        `SELECT ${ATTEMPT_COLUMNS} FROM attempts WHERE child_id = ? ORDER BY id`,
        [childId],
      );
      return rows.map(toAttempt);
    },
    /** Every attempt for every child, ready to `JSON.stringify` for the parent export. */
    async listAll(): Promise<Attempt[]> {
      const rows = await db.getAllAsync<AttemptRow>(
        `SELECT ${ATTEMPT_COLUMNS} FROM attempts ORDER BY id`,
        [],
      );
      return rows.map(toAttempt);
    },
  };

  const flags = {
    async add(flag: ContentFlag): Promise<void> {
      const f = ContentFlagSchema.parse(flag);
      await db.runAsync(
        `INSERT INTO flags (child_id, content_kind, content_id, card_index, bundle_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [f.childId, f.contentKind, f.contentId, f.cardIndex, f.bundleVersion, f.createdAt],
      );
    },
    /** Newest first. Resolved flags are left out unless asked for. */
    async list({ includeResolved = true } = {}): Promise<StoredContentFlag[]> {
      const where = includeResolved ? '' : 'WHERE resolved_at IS NULL';
      const rows = await db.getAllAsync<FlagRow>(
        `SELECT * FROM flags ${where} ORDER BY id DESC`,
        [],
      );
      return rows.map(toFlag);
    },
    /** Marks a flag handled. It stays in the table and the export. */
    async resolve(id: number, resolvedAt: string): Promise<void> {
      IsoDateTimeSchema.parse(resolvedAt);
      await db.runAsync('UPDATE flags SET resolved_at = ? WHERE id = ?', [resolvedAt, id]);
    },
    /** Puts a resolved flag back on the open list. */
    async reopen(id: number): Promise<void> {
      await db.runAsync('UPDATE flags SET resolved_at = NULL WHERE id = ?', [id]);
    },
    async remove(id: number): Promise<void> {
      await db.runAsync('DELETE FROM flags WHERE id = ?', [id]);
    },
  };

  const settings = {
    async get(key: string): Promise<string | null> {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        [key],
      );
      return row?.value ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    },
    async remove(key: string): Promise<void> {
      await db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
    },
  };

  const packs = {
    async list(): Promise<InstalledPack[]> {
      const rows = await db.getAllAsync<{
        id: string;
        core_hash: string;
        sha256: string;
        installed_at: string;
      }>('SELECT id, core_hash, sha256, installed_at FROM content_packs ORDER BY id', []);
      return rows.map((r) => ({
        id: r.id,
        coreHash: r.core_hash,
        sha256: r.sha256,
        installedAt: r.installed_at,
      }));
    },
    /** The packs downloaded for this core, parsed and checked. */
    async forCore(coreHash: string): Promise<ContentPack[]> {
      const rows = await db.getAllAsync<{ body: string }>(
        'SELECT body FROM content_packs WHERE core_hash = ? ORDER BY id',
        [coreHash],
      );
      // A pack this build can't read, such as one saved by newer JS before a rollback, is left
      // out. Its sha256 no longer matches this build's manifest, so the next sync replaces it.
      return rows.flatMap((r) => {
        try {
          return [readContentPack(JSON.parse(r.body))];
        } catch {
          return [];
        }
      });
    },
    /** Inserts or replaces the pack with the same id. Throws if `body` isn't that pack. */
    async save(pack: InstalledPack & { body: string }): Promise<void> {
      const parsed = readContentPack(JSON.parse(pack.body));
      if (parsed.id !== pack.id) throw new Error(`Pack body is ${parsed.id}, not ${pack.id}`);
      IsoDateTimeSchema.parse(pack.installedAt);
      await db.runAsync(
        'INSERT OR REPLACE INTO content_packs (id, core_hash, sha256, body, installed_at) VALUES (?, ?, ?, ?, ?)',
        [pack.id, pack.coreHash, pack.sha256, pack.body, pack.installedAt],
      );
    },
    async remove(id: string): Promise<void> {
      await db.runAsync('DELETE FROM content_packs WHERE id = ?', [id]);
    },
  };

  return { children, mastery, walkBack, placement, attempts, flags, settings, packs };
}

export type Repository = ReturnType<typeof createRepository>;

/** Brings the database schema up to date, then wraps it in the repository. */
export async function openRepository(db: SqlDatabase): Promise<Repository> {
  await migrate(db);
  return createRepository(db);
}
