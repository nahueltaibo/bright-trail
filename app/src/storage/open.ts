import { openDatabaseAsync } from 'expo-sqlite';
import { openRepository, type Repository } from './repository';

export const DATABASE_NAME = 'bright-trail.db';

/** The app's on-device database. Data persists across restarts until the app is uninstalled. */
export async function openAppStorage(): Promise<Repository> {
  return openRepository(await openDatabaseAsync(DATABASE_NAME));
}
