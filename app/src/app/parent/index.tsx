import { localClock, type ChildProfile } from '@bright-trail/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getAvatar } from '../../avatars';
import { loadBundle } from '../../content/loadBundle';
import { effectiveGrade } from '../../parent/children';
import { Button, ParentScreen, Section, styles as ui } from '../../parent/components/ui';
import { buildExport, exportFileName } from '../../parent/exportData';
import { gradeLabel } from '../../parent/grades';
import { shareExport } from '../../parent/shareExport';
import { useStorage } from '../../storage/StorageProvider';

/** Parent home: children, flagged content, and the data export. */
export default function ParentHomeScreen() {
  const repo = useStorage();
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [openFlags, setOpenFlags] = useState(0);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const { today } = localClock();

  useFocusEffect(
    useCallback(() => {
      repo.children.list().then(setProfiles);
      repo.flags.list({ includeResolved: false }).then((f) => setOpenFlags(f.length));
    }, [repo]),
  );

  const exportAll = async () => {
    setExportStatus('Preparing…');
    try {
      const { now, today: day } = localClock();
      const bundle = await loadBundle();
      const payload = await buildExport(repo, { now, today: day, bundleVersion: bundle.version });
      await shareExport(exportFileName(now), JSON.stringify(payload, null, 2));
      setExportStatus(
        `Exported ${payload.attempts.length} attempts for ${payload.children.length} children.`,
      );
    } catch (e) {
      setExportStatus(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <ParentScreen title="Parent area" backTo="/" backLabel="Kids">
      <Section title="Children">
        {profiles.length === 0 && <Text style={ui.muted}>No children yet. Add one to start.</Text>}
        {profiles.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            accessibilityLabel={`${child.firstName}, ${gradeLabel(effectiveGrade(child, today))}`}
            onPress={() =>
              router.push({ pathname: '/parent/child/[childId]', params: { childId: child.id } })
            }
            style={ui.row}
          >
            <Text style={{ fontSize: 32 }}>{getAvatar(child.avatar).emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{child.firstName}</Text>
              <Text style={ui.muted}>
                {gradeLabel(effectiveGrade(child, today))}
                {child.gradeOverride ? ' (set by parent)' : ''}
              </Text>
            </View>
            <Text style={ui.muted}>›</Text>
          </Pressable>
        ))}
        <Button label="Add a child" onPress={() => router.push('/parent/child/new')} />
      </Section>

      <Section title="Flagged content">
        <Text style={ui.muted}>{openFlags === 0 ? 'Nothing flagged.' : `${openFlags} open`}</Text>
        <Button label="See flags" kind="secondary" onPress={() => router.push('/parent/flags')} />
      </Section>

      <Section title="Export">
        <Text style={ui.muted}>Every attempt, with children and mastery, as one JSON file.</Text>
        <Button label="Export all data" kind="secondary" onPress={exportAll} />
        {exportStatus && <Text style={ui.text}>{exportStatus}</Text>}
      </Section>
    </ParentScreen>
  );
}
