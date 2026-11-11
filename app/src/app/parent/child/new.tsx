import { localClock } from '@bright-trail/shared';
import { router } from 'expo-router';
import { AVATARS } from '../../../avatars';
import { syncPacks } from '../../../content';
import { emptyDraft, saveChild } from '../../../parent/children';
import { ChildForm } from '../../../parent/components/ChildForm';
import { ParentScreen, Section } from '../../../parent/components/ui';
import { useStorage } from '../../../storage/StorageProvider';

export default function AddChildScreen() {
  const repo = useStorage();
  const { today } = localClock();

  return (
    <ParentScreen title="Add a child" backLabel="Grown-ups">
      <Section>
        <ChildForm
          initial={emptyDraft(today, AVATARS[0].key)}
          today={today}
          submitLabel="Add child"
          onSubmit={async (draft) => {
            await saveChild(repo, draft);
            // The parent home shows the download's progress.
            void syncPacks(repo);
            router.back();
          }}
        />
      </Section>
    </ParentScreen>
  );
}
