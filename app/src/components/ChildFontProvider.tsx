import { useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { DyslexicFontProvider } from '../design/Text';
import { useStorage } from '../storage/StorageProvider';

/** Turns the dyslexia font on under `/child/[childId]` when that child has it set. */
export function ChildFontProvider({ children }: { children: ReactNode }) {
  const repo = useStorage();
  const [zone] = useSegments();
  const { childId } = useGlobalSearchParams<{ childId?: string }>();
  const pathname = usePathname();
  const kidId = zone === 'child' ? childId : undefined;
  const [saved, setSaved] = useState<{ id: string; on: boolean } | null>(null);

  // Re-read on every route change so a switch made in the parent area applies on return.
  useEffect(() => {
    if (!kidId) return;
    let live = true;
    repo.children.get(kidId).then(
      (child) => live && setSaved({ id: kidId, on: child?.dyslexicFont ?? false }),
      () => live && setSaved({ id: kidId, on: false }),
    );
    return () => {
      live = false;
    };
  }, [repo, kidId, pathname]);

  const on = !!kidId && saved?.id === kidId && saved.on;
  return <DyslexicFontProvider value={on}>{children}</DyslexicFontProvider>;
}
