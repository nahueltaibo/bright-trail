import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { loadContent, usePackStatus } from '../../content';
import { useStorage } from '../../storage/StorageProvider';
import { buildInfoRows } from '../buildInfo';
import { Button, Section, Status, styles as ui } from './ui';

// The web module claims updates are on, and dev builds throw on every check.
const updatesEnabled = Updates.isEnabled && !__DEV__ && Platform.OS !== 'web';

/** App, runtime, update, and content versions, plus a manual update check. */
export function AboutSection() {
  const repo = useStorage();
  const packs = usePackStatus();
  const [bundleVersion, setBundleVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadContent(repo).then((b) => setBundleVersion(b.version));
  }, [repo, packs]);

  const rows = buildInfoRows(
    {
      appVersion: Constants.expoConfig?.version ?? null,
      runtimeVersion: Updates.runtimeVersion,
      updatesEnabled,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      updateId: Updates.updateId,
      createdAt: Updates.createdAt,
    },
    bundleVersion,
  );

  const check = async () => {
    setBusy(true);
    setStatus('Checking…');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setStatus('You have the latest version.');
        return;
      }
      setStatus('Downloading…');
      await Updates.fetchUpdateAsync();
      setReady(true);
      setStatus('New version downloaded. Restart now, or it loads the next time the app opens.');
    } catch (e) {
      setStatus(`Couldn't check: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="About this app">
      {rows.map(([label, value]) => (
        <View key={label}>
          <Text style={ui.hint}>{label}</Text>
          <Text style={ui.text} selectable>
            {value}
          </Text>
        </View>
      ))}
      {updatesEnabled && (
        <Button label="Check for updates" kind="secondary" disabled={busy} onPress={check} />
      )}
      {status && <Status text={status} />}
      {ready && <Button label="Restart now" onPress={() => Updates.reloadAsync()} />}
    </Section>
  );
}
