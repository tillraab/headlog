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

/**
 * A date range with one end set to `value`: never past `today`, and the other end follows when they would
 * cross. Null when the result is the default range of the last `days` days.
 */
export function setRangeEnd(range: { from: string; to: string }, end: 'from' | 'to', value: string, today: string, days: number): { from: string; to: string } | null {
  const next = { ...range, [end]: value > today ? today : value };
  if (next.from > next.to) next[end === 'from' ? 'to' : 'from'] = next[end];
  return next.to === today && next.from === dayKey(addDays(keyToDate(today), -(days - 1))) ? null : next;
}
