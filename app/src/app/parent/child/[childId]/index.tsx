import {
  isReviewDue,
  localClock,
  type ChildProfile,
  type MasteryState,
} from '@bright-trail/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Icon } from '../../../../design/Icon';
import { draftFromChild, saveChild } from '../../../../parent/children';
import { ChildForm } from '../../../../parent/components/ChildForm';
import { ConfirmButton } from '../../../../parent/components/ConfirmButton';
import {
  colors,
  Columns,
  ParentRow,
  ParentScreen,
  Section,
  Status,
  styles as ui,
  useWide,
} from '../../../../parent/components/ui';
import type { StoredPlacement } from '../../../../storage/repository';
import { useStorage } from '../../../../storage/StorageProvider';

function progressMeta(mastery: readonly MasteryState[], today: string): string {
  const mastered = mastery.filter((m) => m.status === 'mastered' || m.status === 'review-due');
  const due = mastered.filter((m) => isReviewDue(m, today)).length;
  return due > 0
    ? `${mastered.length} mastered · ${due} review due`
    : `${mastered.length} mastered`;
}

function placementMeta(placement: StoredPlacement | null): string {
  if (!placement) return 'Not run yet';
  if (!placement.finishedAt) return 'In progress';
  return `Placed ${placement.finishedAt.slice(0, 10)}`;
}

/** One child: open their skill tree and placement, edit the profile, reset, or delete. */
export default function ChildDetailScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const [child, setChild] = useState<ChildProfile | null | undefined>(undefined);
  const [mastery, setMastery] = useState<MasteryState[]>([]);
  const [placement, setPlacement] = useState<StoredPlacement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { today } = localClock();
  const wide = useWide();

  useFocusEffect(
    useCallback(() => {
      repo.children.get(childId).then(setChild);
      repo.mastery.listForChild(childId).then(setMastery);
      repo.placement.get(childId).then(setPlacement);
    }, [repo, childId]),
  );

  if (child === undefined) return <ParentScreen backLabel="Grown-ups">{null}</ParentScreen>;
  if (child === null) {
    return (
      <ParentScreen title="Child" backLabel="Grown-ups">
        <Text style={ui.muted}>This profile no longer exists.</Text>
      </ParentScreen>
    );
  }

  const open = (pathname: '/parent/child/[childId]/skills' | '/parent/child/[childId]/placement') =>
    router.push({ pathname, params: { childId } });

  const progress = (
    <Section title="Progress" padded={false}>
      <ParentRow
        first
        leading={<Icon name="tree" size={22} tint={colors.muted} />}
        title="Skill tree"
        meta={progressMeta(mastery, today)}
        chevron
        onPress={() => open('/parent/child/[childId]/skills')}
      />
      <ParentRow
        leading={<Icon name="list" size={22} tint={colors.muted} />}
        title="Placement review"
        meta={placementMeta(placement)}
        chevron
        onPress={() => open('/parent/child/[childId]/placement')}
      />
    </Section>
  );

  const profile = (
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
      {status && <Status text={status} ok />}
    </Section>
  );

  const danger = (
    <Section title="Reset or delete">
      <ConfirmButton
        label="Reset progress"
        icon="refresh"
        question={`Reset ${child.firstName}'s progress?`}
        consequence="Skill states are cleared, so the next session starts with placement. Attempts are kept for the export."
        confirmLabel="Reset"
        onConfirm={async () => {
          await repo.mastery.removeForChild(child.id);
          setMastery([]);
          setStatus('Progress reset.');
        }}
      />
      <ConfirmButton
        label="Delete child"
        icon="close"
        question={`Delete ${child.firstName}?`}
        consequence="Their profile, progress, and attempts leave this device for good. This can’t be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          await repo.children.remove(child.id);
          router.back();
        }}
      />
    </Section>
  );

  return (
    <ParentScreen title={child.firstName} backLabel="Grown-ups">
      {wide ? (
        <Columns
          left={
            <>
              {progress}
              {danger}
            </>
          }
          right={profile}
        />
      ) : (
        <>
          {progress}
          {profile}
          {danger}
        </>
      )}
    </ParentScreen>
  );
}
