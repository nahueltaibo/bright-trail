import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { lastFeedbackEvent, syncFeedback, type FeedbackEvent } from '../../feedback';
import { useStorage } from '../../storage/StorageProvider';
import { formatStamp } from '../buildInfo';
import { Button, Section, styles as ui } from './ui';

/** Where flagged reports go from this device, and what happened to the last upload. */
export function FeedbackSection() {
  const repo = useStorage();
  const [counts, setCounts] = useState<{ pending: number; rejected: number } | null>(null);
  const [last, setLast] = useState<FeedbackEvent | null>(lastFeedbackEvent());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setCounts(await repo.reports.counts());
    setLast(lastFeedbackEvent());
  }, [repo]);

  useEffect(() => {
    repo.reports.counts().then(setCounts);
  }, [repo]);

  const send = async () => {
    setBusy(true);
    await syncFeedback(repo);
    await refresh();
    setBusy(false);
  };

  const rows: [string, string][] = [
    ['Feedback server', process.env.EXPO_PUBLIC_FEEDBACK_URL || 'Not set in this build'],
    ['Waiting to send', counts ? String(counts.pending) : 'loading…'],
    ['Refused by the server', counts ? String(counts.rejected) : 'loading…'],
    [
      'Last result',
      last ? `${last.text} (${formatStamp(last.at)})` : 'Nothing since the app opened',
    ],
  ];

  return (
    <Section title="Feedback">
      {rows.map(([label, value]) => (
        <View key={label}>
          <Text style={ui.hint}>{label}</Text>
          <Text style={ui.text} selectable>
            {value}
          </Text>
        </View>
      ))}
      <Button label="Send reports now" kind="secondary" disabled={busy} onPress={send} />
    </Section>
  );
}
