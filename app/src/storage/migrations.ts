import type { SqlDatabase } from './db';

/**
 * Append-only. Migration N moves the schema from version N-1 to N, tracked in
 * `PRAGMA user_version`. Never edit a migration that has shipped to a device; add a new one.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE children (
    id TEXT PRIMARY KEY NOT NULL,
    first_name TEXT NOT NULL,
    birthdate TEXT NOT NULL,
    grade_override TEXT,
    avatar TEXT NOT NULL,
    reading_mode INTEGER NOT NULL
  );

  CREATE TABLE mastery (
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    status TEXT NOT NULL,
    check_answered INTEGER NOT NULL,
    check_correct INTEGER NOT NULL,
    failed_checks INTEGER NOT NULL,
    reviews_passed INTEGER NOT NULL,
    next_review_on TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (child_id, skill_id)
  );

  CREATE TABLE attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    correct INTEGER NOT NULL,
    time_to_answer_ms INTEGER NOT NULL,
    narration_replays INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
  CREATE INDEX attempts_child ON attempts (child_id, id);

  CREATE TABLE flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id TEXT REFERENCES children(id) ON DELETE SET NULL,
    content_kind TEXT NOT NULL,
    content_id TEXT NOT NULL,
    card_index INTEGER,
    bundle_version TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // JSON of the learner engine's walk-back state. Null when no walk-back has run.
  `ALTER TABLE children ADD COLUMN walk_back TEXT;`,
  // Flags are resolved, not deleted, so the test log keeps every report. `settings` holds
  // device-wide key-value pairs, such as the parent PIN hash on web.
  `
  ALTER TABLE flags ADD COLUMN resolved_at TEXT;
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // One placement per child. `state` is the placement engine's JSON, saved after every answer so
  // placement resumes after a restart. `finished_at` stays null until the learner state is saved.
  `
  CREATE TABLE placement (
    child_id TEXT PRIMARY KEY NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    state TEXT NOT NULL,
    placed_grade TEXT,
    finished_at TEXT
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Runs every migration newer than the database, each in its own transaction. */
export async function migrate(
  db: SqlDatabase,
  migrations: readonly string[] = MIGRATIONS,
): Promise<void> {
  // SQLite turns foreign keys off for every new connection.
  await db.execAsync('PRAGMA foreign_keys = ON');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;
  if (current > migrations.length) {
    throw new Error(
      `Database is at schema version ${current}, but this app only knows ${migrations.length}`,
    );
  }
  for (let version = current + 1; version <= migrations.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrations[version - 1]);
      // PRAGMA takes no bound parameters; version is a trusted integer.
      await db.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}
