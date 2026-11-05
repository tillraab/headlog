import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';

/** Local calendar day as `yyyy-MM-dd`. */
export function dayKey(time: number | Date): string {
  return format(time, 'yyyy-MM-dd');
}

export function keyToDate(key: string): Date {
  return parseISO(key);
}

/** Day keys from `from` to `to`, both included. */
export function dayRange(from: number | Date, to: number | Date): string[] {
  const keys: string[] = [];
  const start = startOfDay(from);
  const count = differenceInCalendarDays(to, start);
  for (let i = 0; i <= count; i++) keys.push(dayKey(addDays(start, i)));
  return keys;
}

/** The `count` days ending with `end`, oldest first. */
export function lastDays(end: number | Date, count: number): string[] {
  return dayRange(addDays(end, -(count - 1)), end);
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function formatLiters(ml: number): string {
  return `${(ml / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} l`;
}
