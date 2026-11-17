import { localClock, type ChildProfile } from '@bright-trail/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Icon } from '../../design/Icon';
import { AvatarDisc } from '../../design/kid';
import { loadContent } from '../../content';
import { effectiveGrade } from '../../parent/children';
import { AboutSection } from '../../parent/components/AboutSection';
import { ContentSection } from '../../parent/components/ContentSection';
import { FeedbackSection } from '../../parent/components/FeedbackSection';
import {
  Button,
  colors,
  Columns,
  EmptyState,
  ParentRow,
  ParentScreen,
  Section,
  Status,
  styles as ui,
} from '../../parent/components/ui';
import { buildExport, exportFileName } from '../../parent/exportData';
import { gradeLabel } from '../../parent/grades';
import { shareExport } from '../../parent/shareExport';
import { useStorage } from '../../storage/StorageProvider';

/** Parent home: children, flagged content, the data export, and app versions. */
export default function ParentHomeScreen() {
  const repo = useStorage();
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [openFlags, setOpenFlags] = useState(0);
  const [exportStatus, setExportStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const { today } = localClock();

  useFocusEffect(
    useCallback(() => {
      repo.children.list().then(setProfiles);
      repo.flags.list({ includeResolved: false }).then((f) => setOpenFlags(f.length));
    }, [repo]),
  );

  const exportAll = async () => {
    setExportStatus({ text: 'Preparing…', ok: false });
    try {
      const { now, today: day } = localClock();
      const bundle = await loadContent(repo);
      const payload = await buildExport(repo, { now, today: day, bundleVersion: bundle.version });
      await shareExport(exportFileName(now), JSON.stringify(payload, null, 2));
      setExportStatus({
        text: `Exported ${payload.attempts.length} attempts for ${payload.children.length} children.`,
        ok: true,
      });
    } catch (e) {
      setExportStatus({
        text: `Export failed: ${e instanceof Error ? e.message : String(e)}`,
        ok: false,
      });
    }
  };

  const addChild = () => router.push('/parent/child/new');
  const children = (
    <Section title="Children" padded={false}>
      {profiles.length === 0 ? (
        <EmptyState
          icon="plus"
          title="No children yet. Add one to start."
          body="Each child gets their own trail."
          action={<Button label="Add a child" icon="plus" onPress={addChild} />}
        />
      ) : (
        <>
          {profiles.map((child, i) => {
            const grade = gradeLabel(effectiveGrade(child, today));
            return (
              <ParentRow
                key={child.id}
                first={i === 0}
                accessibilityLabel={`${child.firstName}, ${grade}`}
                leading={<AvatarDisc animal={child.avatar} size={40} />}
                title={child.firstName}
                meta={child.gradeOverride ? `${grade} (set by parent)` : grade}
                chevron
                onPress={() =>
                  router.push({
                    pathname: '/parent/child/[childId]',
                    params: { childId: child.id },
                  })
                }
              />
            );
          })}
          <ParentRow
            title="Add a child"
            action
            leading={<Icon name="plus" size={22} tint={colors.primary} />}
            onPress={addChild}
          />
        </>
      )}
    </Section>
  );

  const flags = (
    <Section title="Flagged content" padded={false}>
      <ParentRow
        first
        leading={<Icon name="flag" size={22} tint={colors.muted} />}
        title={
          openFlags === 0 ? 'No open flags' : `${openFlags} open flag${openFlags === 1 ? '' : 's'}`
        }
        meta={
          openFlags === 0
            ? 'Kids can tap the flag on any card.'
            : 'Kids or grown-ups tapped “This looks wrong”.'
        }
        trailing={
          <Button
            label="See flags"
            kind="secondary"
            small
            onPress={() => router.push('/parent/flags')}
          />
        }
      />
    </Section>
  );

  const exportSection = (
    <Section title="Export">
      <Text style={ui.text}>Every attempt, with children and mastery, as one JSON file.</Text>
      <Button label="Export all data" kind="secondary" icon="share" onPress={exportAll} />
      <Status text={exportStatus?.text ?? 'Not exported yet'} ok={exportStatus?.ok} />
    </Section>
  );

  return (
    <ParentScreen title="Grown-ups" backTo="/" backLabel="Kids’ home">
      <Columns
        left={
          <>
            {children}
            <ContentSection />
          </>
        }
        right={
          <>
            {flags}
            {exportSection}
            <FeedbackSection />
            <AboutSection />
          </>
        }
      />
    </ParentScreen>
  );
}
