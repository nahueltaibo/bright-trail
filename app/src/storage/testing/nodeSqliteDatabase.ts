import type { SqlDatabase, SqlValue } from '../db';

// Minimal typing for Node's built-in `node:sqlite`, so the app needn't pull in @types/node.
type Statement = {
  run(...params: SqlValue[]): { changes: number | bigint };
  all(...params: SqlValue[]): Record<string, unknown>[];
  get(...params: SqlValue[]): Record<string, unknown> | undefined;
};
type DatabaseSync = {
  exec(source: string): void;
  prepare(source: string): Statement;
  close(): void;
};
type NodeSqlite = { DatabaseSync: new (path: string) => DatabaseSync };

/**
 * A real SQLite database for tests, behind the same interface expo-sqlite gives the app.
 * Pass `':memory:'` for a throwaway database or a file path to test reopening it.
 * Test-only: it loads Node's SQLite through jest.
 */
export function openNodeSqliteDatabase(path: string): SqlDatabase {
  const { DatabaseSync } = jest.requireActual<NodeSqlite>('node:sqlite');
  const db = new DatabaseSync(path);
  return {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, params) {
      return { changes: Number(db.prepare(source).run(...params).changes) };
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      // node:sqlite returns null-prototype rows; copy them so they behave like expo-sqlite's.
      return db
        .prepare(source)
        .all(...params)
        .map((row) => ({ ...row }) as T);
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      const row = db.prepare(source).get(...params);
      return row ? ({ ...row } as T) : null;
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async closeAsync() {
      db.close();
    },
  };
}

type NodeFs = {
  mkdtempSync(prefix: string): string;
  rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
};
type NodeOs = { tmpdir(): string };

/** A fresh directory for a file-backed test database, and a function that deletes it. */
export function makeTempDatabasePath(): { path: string; cleanup: () => void } {
  const fs = jest.requireActual<NodeFs>('node:fs');
  const os = jest.requireActual<NodeOs>('node:os');
  const dir = fs.mkdtempSync(`${os.tmpdir()}/bright-trail-test-`);
  return {
    path: `${dir}/test.db`,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
