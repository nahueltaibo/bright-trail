import { localClock, type ChildProfile, type ContentBundle } from '@bright-trail/shared';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { loadBundle } from '../../content/loadBundle';
import { Button, ParentScreen, Section, styles as ui } from '../../parent/components/ui';
import { describeFlag } from '../../parent/flagText';
import type { StoredContentFlag } from '../../storage/flag';
import { useStorage } from '../../storage/StorageProvider';

/** "This looks wrong" reports, with the flagged text, open ones first. */
export default function FlagsScreen() {
  const repo = useStorage();
  const [bundle, setBundle] = useState<ContentBundle | null>(null);
  const [flags, setFlags] = useState<StoredContentFlag[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const reload = useCallback(() => {
    repo.flags.list().then(setFlags);
  }, [repo]);

  useEffect(() => {
    loadBundle().then(setBundle);
    repo.children
      .list()
      .then((c: ChildProfile[]) => setNames(new Map(c.map((p) => [p.id, p.firstName]))));
    reload();
  }, [repo, reload]);

  const open = flags.filter((f) => f.resolvedAt === null);
  const resolved = flags.filter((f) => f.resolvedAt !== null);

  const card = (flag: StoredContentFlag) => {
    const d = bundle ? describeFlag(flag, bundle) : null;
    const who = flag.childId ? (names.get(flag.childId) ?? flag.childId) : 'A parent';
    return (
      <View key={flag.id} style={[ui.row, { flexDirection: 'column', alignItems: 'stretch' }]}>
        <Text style={ui.muted}>
          {d?.kind ?? flag.contentKind}
          {d?.skillTitle ? ` · ${d.skillTitle}` : ''} · {who} · {flag.createdAt.slice(0, 10)}
        </Text>
        <Text style={ui.text}>{d?.text ?? `${flag.contentId} (not in this content bundle)`}</Text>
        <Text style={ui.muted}>
          {flag.contentId} · bundle {flag.bundleVersion}
        </Text>
        {flag.resolvedAt === null ? (
          <Button
            label="Mark resolved"
            kind="secondary"
            onPress={async () => {
              await repo.flags.resolve(flag.id, localClock().now);
              reload();
            }}
          />
        ) : (
          <Button
            label="Reopen"
            kind="secondary"
            onPress={async () => {
              await repo.flags.reopen(flag.id);
              reload();
            }}
          />
        )}
      </View>
    );
  };

  return (
    <ParentScreen title="Flagged content">
      <Section title={`Open (${open.length})`}>
        {open.length === 0 && <Text style={ui.muted}>Nothing to look at.</Text>}
        {open.map(card)}
      </Section>
      {resolved.length > 0 && (
        <Section title={`Resolved (${resolved.length})`}>{resolved.map(card)}</Section>
      )}
    </ParentScreen>
  );
}
