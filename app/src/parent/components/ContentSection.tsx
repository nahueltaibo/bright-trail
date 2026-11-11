import { syncPacks, usePackStatus, type PackStatus } from '../../content';
import { useStorage } from '../../storage/StorageProvider';
import { Button, Section, Status } from './ui';

/** What the parent sees of a download. Null when there's nothing to say. */
export function packStatusText(status: PackStatus): string | null {
  switch (status.state) {
    case 'downloading':
      return `Downloading learning content: ${status.done} of ${status.total} packs.`;
    case 'failed':
      return status.offline
        ? 'Couldn’t download learning content. Connect to the internet and try again.'
        : `Couldn’t download learning content. ${status.message}`;
    default:
      return null;
  }
}

/** Download progress after a parent adds or changes a child, with a retry when it fails. */
export function ContentSection() {
  const repo = useStorage();
  const status = usePackStatus();
  const text = packStatusText(status);
  if (!text) return null;
  return (
    <Section title="Learning content">
      <Status text={text} />
      {status.state === 'failed' && (
        <Button
          label="Try again"
          kind="secondary"
          icon="refresh"
          onPress={() => void syncPacks(repo)}
        />
      )}
    </Section>
  );
}
