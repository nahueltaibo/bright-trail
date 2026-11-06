import { MIGRATIONS, SCHEMA_VERSION, migrate } from './migrations';
import { openNodeSqliteDatabase } from './testing/nodeSqliteDatabase';

async function userVersion(db: ReturnType<typeof openNodeSqliteDatabase>) {
  return (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []))
    ?.user_version;
}

describe('migrate', () => {
  it('creates every table on a new database and records the schema version', async () => {
    const db = openNodeSqliteDatabase(':memory:');
    await migrate(db);

    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      [],
    );
    expect(tables.map((t) => t.name)).toEqual(['attempts', 'children', 'flags', 'mastery']);
    expect(await userVersion(db)).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length);
  });

  it('is a no-op when the database is already current', async () => {
    const db = openNodeSqliteDatabase(':memory:');
    await migrate(db);
    await db.runAsync(
      "INSERT INTO children (id, first_name, birthdate, grade_override, avatar, reading_mode) VALUES ('maya', 'Maya', '2020-03-01', NULL, 'fox', 0)",
      [],
    );
    await migrate(db);
    expect(await db.getAllAsync('SELECT id FROM children', [])).toEqual([{ id: 'maya' }]);
  });

  it('turns on foreign keys for the connection', async () => {
    const db = openNodeSqliteDatabase(':memory:');
    await migrate(db);
    expect(await db.getFirstAsync('PRAGMA foreign_keys', [])).toEqual({ foreign_keys: 1 });
  });

  it('refuses a database written by a newer app', async () => {
    const db = openNodeSqliteDatabase(':memory:');
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    await expect(migrate(db)).rejects.toThrow(/schema version/);
  });

  it('upgrades a version 1 database and keeps its rows', async () => {
    const db = openNodeSqliteDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 1));
    await db.runAsync(
      "INSERT INTO children VALUES ('maya', 'Maya', '2020-03-01', NULL, 'fox', 0)",
      [],
    );
    await migrate(db);
    expect(await db.getAllAsync('SELECT id, walk_back FROM children', [])).toEqual([
      { id: 'maya', walk_back: null },
    ]);
    expect(await userVersion(db)).toBe(SCHEMA_VERSION);
  });

  it('applies only the migrations a database is missing', async () => {
    const db = openNodeSqliteDatabase(':memory:');
    await migrate(db);
    await migrate(db, [...MIGRATIONS, 'CREATE TABLE extra (a)']);
    expect(await userVersion(db)).toBe(SCHEMA_VERSION + 1);
    expect(
      await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'extra'", []),
    ).toEqual({ name: 'extra' });
  });

  it('rolls back a migration that fails part way', async () => {
    const db = openNodeSqliteDatabase(':memory:');
    await migrate(db);
    const broken = [...MIGRATIONS, 'CREATE TABLE extra (a); CREATE TABLE extra (a);'];
    await expect(migrate(db, broken)).rejects.toThrow(/already exists/);
    expect(await userVersion(db)).toBe(SCHEMA_VERSION);
    expect(
      await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'extra'", []),
    ).toBeNull();
  });
});
