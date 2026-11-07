/** Web build. Browsers can't share a local file, so the JSON downloads instead. */
export async function shareExport(fileName: string, json: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
