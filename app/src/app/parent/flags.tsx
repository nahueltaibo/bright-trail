import { localClock, type ChildProfile, type ContentBundle } from '@bright-trail/shared';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, radius } from '../../design/tokens';
import { loadContent } from '../../content';
import {
  Button,
  colors,
  Columns,
  EmptyState,
  ParentScreen,
  Section,
  styles as ui,
} from '../../parent/components/ui';
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
    loadContent(repo).then(setBundle);
    repo.children
      .list()
      .then((c: ChildProfile[]) => setNames(new Map(c.map((p) => [p.id, p.firstName]))));
    reload();
  }, [repo, reload]);

  const open = flags.filter((f) => f.resolvedAt === null);
  const resolved = flags.filter((f) => f.resolvedAt !== null);

  const card = (flag: StoredContentFlag, i: number) => {
    const d = bundle ? describeFlag(flag, bundle) : null;
    const who = flag.childId ? (names.get(flag.childId) ?? flag.childId) : 'a grown-up';
    return (
      <View key={flag.id} style={[styles.flag, i > 0 && styles.divider]}>
        <View>
          <Text style={styles.title}>
            {d?.kind ?? flag.contentKind}
            {d?.skillTitle ? ` · ${d.skillTitle}` : ''}
          </Text>
          <Text style={ui.hint}>
            Flagged by {who} · {flag.createdAt.slice(0, 10)}
          </Text>
        </View>
        <Text style={styles.quote}>
          {d?.text ?? `${flag.contentId} (not in this content bundle)`}
        </Text>
        <Text style={styles.code}>
          {flag.contentId} · bundle {flag.bundleVersion}
        </Text>
        {flag.resolvedAt === null ? (
          <Button
            label="Mark resolved"
            kind="secondary"
            icon="check"
            small
            onPress={async () => {
              await repo.flags.resolve(flag.id, localClock().now);
              reload();
            }}
          />
        ) : (
          <Button
            label="Reopen"
            kind="secondary"
            icon="refresh"
            small
            onPress={async () => {
              await repo.flags.reopen(flag.id);
              reload();
            }}
          />
        )}
      </View>
    );
  };

  const openSection = (
    <Section title={`Open (${open.length})`} padded={false}>
      {open.length === 0 ? (
        <EmptyState
          icon="flag"
          title="Nothing to look at."
          body="When someone taps “This looks wrong”, the card shows up here."
        />
      ) : (
        open.map(card)
      )}
    </Section>
  );
  const resolvedSection = resolved.length > 0 && (
    <Section title={`Resolved (${resolved.length})`} padded={false}>
      {resolved.map(card)}
    </Section>
  );

  return (
    <ParentScreen title="Flagged content" backLabel="Grown-ups">
      <Columns left={openSection} right={resolvedSection} />
    </ParentScreen>
  );
}

const styles = StyleSheet.create({
  flag: { padding: 16, gap: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  title: { ...font.body(700), fontSize: 16, lineHeight: 22, color: colors.text },
  quote: {
    ...font.body(),
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    backgroundColor: colors.sunken,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  code: { fontFamily: font.mono, fontSize: 12, lineHeight: 16, color: colors.muted },
});
