import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

/** Writes the JSON to the cache directory and opens the share sheet on it. */
export async function shareExport(fileName: string, json: string): Promise<void> {
  if (!(await isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(json);
  await shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Export BrightTrail data',
  });
}
