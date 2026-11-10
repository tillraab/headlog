import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { num } from './i18n.svelte';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
/** 24 hours. Calendar days can be 23 or 25 hours long; use `addDays` to step from day to day. */
export const DAY = 24 * HOUR;

/** Local clock time as `HH:mm`. */
export function hm(time: number | Date): string {
  return format(time, 'HH:mm');
}

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

/** An hour of the day as a clock time, e.g. `08:00`. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function formatLiters(ml: number): string {
  return `${num(ml / 1000, 1, 2)} l`;
}

/** The next state of a range picked by taps: the first tap sets the start, a later day the end; an earlier one starts over. */
export function pickRangeDay(range: { from: string; to: string | null }, day: string): { from: string; to: string | null } {
  return range.to !== null || day < range.from ? { from: day, to: null } : { from: range.from, to: day };
}

/** The number of days from `from` to `to`, both included. */
export function rangeDayCount(from: string, to: string): number {
  return differenceInCalendarDays(keyToDate(to), keyToDate(from)) + 1;
}
