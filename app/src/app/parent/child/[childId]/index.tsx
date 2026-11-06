import { localClock, type ChildProfile } from '@bright-trail/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { draftFromChild, saveChild } from '../../../../parent/children';
import { ChildForm } from '../../../../parent/components/ChildForm';
import { ConfirmButton } from '../../../../parent/components/ConfirmButton';
import { Button, ParentScreen, Section, styles as ui } from '../../../../parent/components/ui';
import { useStorage } from '../../../../storage/StorageProvider';

/** One child: edit the profile, open their skill tree and placement, reset, or delete. */
export default function ChildDetailScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const [child, setChild] = useState<ChildProfile | null | undefined>(undefined);
  const [status, setStatus] = useState<string | null>(null);
  const { today } = localClock();

  useEffect(() => {
    repo.children.get(childId).then(setChild);
  }, [repo, childId]);

  if (child === undefined) return <ParentScreen title="Child">{null}</ParentScreen>;
  if (child === null) {
    return (
      <ParentScreen title="Child">
        <Text style={ui.muted}>This profile no longer exists.</Text>
      </ParentScreen>
    );
  }

  const open = (pathname: '/parent/child/[childId]/skills' | '/parent/child/[childId]/placement') =>
    router.push({ pathname, params: { childId } });

  return (
    <ParentScreen title={child.firstName}>
      <Section title="Progress">
        <Button
          label="Skill tree"
          kind="secondary"
          onPress={() => open('/parent/child/[childId]/skills')}
        />
        <Button
          label="Placement review"
          kind="secondary"
          onPress={() => open('/parent/child/[childId]/placement')}
        />
      </Section>

      <Section title="Profile">
        <ChildForm
          key={JSON.stringify(child)}
          initial={draftFromChild(child)}
          today={today}
          submitLabel="Save changes"
          onSubmit={async (draft) => {
            setChild(await saveChild(repo, draft, child.id));
            setStatus('Saved.');
          }}
        />
        {status && <Text style={ui.text}>{status}</Text>}
      </Section>

      <Section title="Reset or delete">
        <Text style={ui.muted}>
          Reset clears mastery and walk-back so the next session starts with placement. Attempts
          stay for the export.
        </Text>
        <ConfirmButton
          label="Reset progress"
          question={`Reset ${child.firstName}'s progress? Their skill states are cleared. Attempts are kept.`}
          confirmLabel="Reset"
          onConfirm={async () => {
            await repo.mastery.removeForChild(child.id);
            setStatus('Progress reset.');
          }}
        />
        <ConfirmButton
          label="Delete child"
          question={`Delete ${child.firstName}? Their profile, progress, and attempts are removed for good.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            await repo.children.remove(child.id);
            router.back();
          }}
        />
      </Section>
    </ParentScreen>
  );
}
