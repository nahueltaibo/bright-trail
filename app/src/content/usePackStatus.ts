import { useSyncExternalStore } from 'react';
import { packStatus, type PackStatus } from './content';

/** Re-renders when downloads start, move, finish, or fail. */
export function usePackStatus(): PackStatus {
  return useSyncExternalStore(packStatus.subscribe, packStatus.get);
}
