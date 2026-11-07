import { localClock } from '@bright-trail/shared';
import { router } from 'expo-router';
import { AVATARS } from '../../../avatars';
import { emptyDraft, saveChild } from '../../../parent/children';
import { ChildForm } from '../../../parent/components/ChildForm';
import { ParentScreen } from '../../../parent/components/ui';
import { useStorage } from '../../../storage/StorageProvider';

export default function AddChildScreen() {
  const repo = useStorage();
  const { today } = localClock();

  return (
    <ParentScreen title="Add a child">
      <ChildForm
        initial={emptyDraft(today, AVATARS[0].key)}
        today={today}
        submitLabel="Add child"
        onSubmit={async (draft) => {
          await saveChild(repo, draft);
          router.back();
        }}
      />
    </ParentScreen>
  );
}
