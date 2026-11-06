const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day and instant an event happens at. Injected so tests control time. */
export interface Clock {
  /** Local calendar date, `YYYY-MM-DD`. Drives review scheduling. */
  today: string;
  /** ISO 8601 date-time with an offset. Stamped on `updatedAt`. */
  now: string;
}

/** Adds whole days to a `YYYY-MM-DD` date. Works in UTC so DST shifts can't skip a day. */
export function addDays(date: string, days: number): string {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${date}"`);
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return utc.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Builds a clock from a `Date` in the device's time zone. */
export function localClock(date: Date = new Date()): Clock {
  const today = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const zone = `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return { today, now: `${today}T${time}${zone}` };
}
