import type { ChildProfile } from '@bright-trail/shared';
import type { Repository } from '../storage/repository';

// Dev-only stand-ins for the two testers until A7 lets a parent add children.
export const SAMPLE_CHILDREN: readonly ChildProfile[] = [
  {
    id: 'sample-maya',
    firstName: 'Maya',
    birthdate: '2020-03-14',
    avatar: 'fox',
    readingMode: false,
  },
  {
    id: 'sample-leo',
    firstName: 'Leo',
    birthdate: '2016-07-02',
    avatar: 'owl',
    readingMode: true,
  },
];

/** Saves the sample children. Safe to run twice: fixed ids overwrite instead of duplicating. */
export async function addSampleChildren(repo: Repository): Promise<void> {
  for (const child of SAMPLE_CHILDREN) await repo.children.save(child);
}
