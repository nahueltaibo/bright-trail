export type SqlValue = string | number | null;

/**
 * The slice of expo-sqlite's `SQLiteDatabase` the storage layer uses. Keeping it this small lets
 * tests run the same SQL against Node's built-in SQLite.
 */
export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}
