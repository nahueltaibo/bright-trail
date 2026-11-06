import {
  ChildProfileSchema,
  deriveGrade,
  type ChildProfile,
  type SchoolGrade,
} from '@bright-trail/shared';
import type { Repository } from '../storage/repository';

/** What the add and edit form holds. `gradeOverride: null` means use the derived grade. */
export type ChildDraft = {
  firstName: string;
  birthdate: string;
  avatar: string;
  gradeOverride: SchoolGrade | null;
  readingMode: boolean;
};

export function emptyDraft(today: string, avatar: string): ChildDraft {
  // Six years back starts the date picker near the younger tester's age.
  const year = Number(today.slice(0, 4)) - 6;
  return {
    firstName: '',
    birthdate: `${year}-01-01`,
    avatar,
    gradeOverride: null,
    readingMode: false,
  };
}

export function draftFromChild(child: ChildProfile): ChildDraft {
  return {
    firstName: child.firstName,
    birthdate: child.birthdate,
    avatar: child.avatar,
    gradeOverride: child.gradeOverride ?? null,
    readingMode: child.readingMode,
  };
}

export function childFromDraft(id: string, draft: ChildDraft): ChildProfile {
  return ChildProfileSchema.parse({
    id,
    firstName: draft.firstName.trim(),
    birthdate: draft.birthdate,
    gradeOverride: draft.gradeOverride ?? undefined,
    avatar: draft.avatar,
    readingMode: draft.readingMode,
  });
}

/** A kebab-case id from the first name, with a suffix so two kids with one name never collide. */
export function newChildId(
  firstName: string,
  taken: readonly string[],
  random: () => number = Math.random,
): string {
  const slug =
    firstName
      .normalize('NFD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'child';
  for (;;) {
    const id = `${slug}-${Math.floor(random() * 36 ** 4).toString(36)}`;
    if (!taken.includes(id)) return id;
  }
}

/** The grade the app teaches from: the parent's override, else the one from the birthdate. */
export function effectiveGrade(
  child: Pick<ChildProfile, 'birthdate' | 'gradeOverride'>,
  today: string,
): SchoolGrade {
  return child.gradeOverride ?? deriveGrade(child.birthdate, today);
}

/** Adds a child when `id` is omitted, otherwise updates that child. Returns the saved profile. */
export async function saveChild(
  repo: Repository,
  draft: ChildDraft,
  id?: string,
): Promise<ChildProfile> {
  const taken = (await repo.children.list()).map((c) => c.id);
  const child = childFromDraft(id ?? newChildId(draft.firstName, taken), draft);
  await repo.children.save(child);
  return child;
}
