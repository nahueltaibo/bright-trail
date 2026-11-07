/** What's running on this device, as the parent area's About section shows it. */
export interface BuildInfo {
  appVersion: string | null;
  runtimeVersion: string | null;
  /** False in dev, on web, and in the e2e build. */
  updatesEnabled: boolean;
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  createdAt: Date | null;
}

/** "YYYY-MM-DD HH:MM" in the device's time zone. */
export function formatStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The label/value rows for the About section. */
export function buildInfoRows(info: BuildInfo, bundleVersion: string | null): [string, string][] {
  let update: string;
  if (!info.updatesEnabled) update = 'Off in this build';
  else if (info.isEmbeddedLaunch || !info.updateId)
    update = 'None yet (running the installed version)';
  else {
    update = info.updateId.slice(0, 8);
    if (info.createdAt) update += `, published ${formatStamp(info.createdAt)}`;
  }
  return [
    ['App version', info.appVersion ?? 'unknown'],
    ['Runtime version', info.runtimeVersion || 'n/a'],
    ['Update', update],
    ['Content bundle', bundleVersion ?? 'loading…'],
  ];
}
