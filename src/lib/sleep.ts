import { Capacitor, registerPlugin } from '@capacitor/core';
import { addDays, setHours, startOfDay } from 'date-fns';
import type { HeadLogDb, Night } from './db';
import { HOUR, lastDays, MINUTE } from './days';

export interface ScreenEvent {
  time: number;
  on: boolean;
}

interface ScreenEventsPlugin {
  hasAccess(): Promise<{ supported: boolean; granted: boolean }>;
  openSettings(): Promise<void>;
  events(options: { from: number; to: number }): Promise<{ events: ScreenEvent[] }>;
}

const ScreenEvents = registerPlugin<ScreenEventsPlugin>('ScreenEvents');

/** Whether the sleep estimate can work here: Android 9 or newer, and whether usage access is granted. */
export async function screenAccess(): Promise<{ supported: boolean; granted: boolean }> {
  if (!Capacitor.isNativePlatform()) return { supported: false, granted: false };
  return ScreenEvents.hasAccess();
}

export function openUsageAccessSettings() {
  return ScreenEvents.openSettings();
}

/** Off periods shorter than this are ignored, e.g. a few minutes between two phone sessions. */
const MIN_OFF_MINUTES = 20;
/** Screen time between two off periods up to this long counts as a wake break inside one night. */
const MAX_BREAK_MINUTES = 90;
/** A night needs at least this much screen-off time. */
const MIN_NIGHT_HOURS = 3;
/** The night ending on day D is looked for between D-1 18:00 and D 14:00. */
const WINDOW_START_HOUR = 18;
const WINDOW_END_HOUR = 14;

/** Periods with the screen off, from an off event to the next on event. */
function offPeriods(events: ScreenEvent[], until: number): { start: number; end: number }[] {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const periods: { start: number; end: number }[] = [];
  let offSince: number | null = null;
  for (const e of sorted) {
    if (!e.on && offSince === null) offSince = e.time;
    if (e.on && offSince !== null) {
      periods.push({ start: offSince, end: e.time });
      offSince = null;
    }
  }
  if (offSince !== null) periods.push({ start: offSince, end: until });
  return periods;
}

/**
 * Estimates the night that ends on `day` from screen events: the longest screen-off stretch in the
 * window, joined with neighbouring stretches when the screen was on in between for at most
 * 90 minutes. Those screen-on gaps are the wake breaks. Returns null without a night of 3 hours.
 */
export function estimateNight(events: ScreenEvent[], day: string, now = Date.now(), fallAsleepMs = 0): Night | null {
  const morning = startOfDay(new Date(`${day}T12:00`));
  const windowStart = setHours(addDays(morning, -1), WINDOW_START_HOUR).getTime();
  const windowEnd = Math.min(setHours(morning, WINDOW_END_HOUR).getTime(), now);
  // Sleep begins `fallAsleepMs` after the screen goes off; what is left of an off stretch must still be 20 minutes.
  const periods = offPeriods(events, now)
    .map((p) => ({ start: Math.max(p.start, windowStart) + fallAsleepMs, end: Math.min(p.end, windowEnd) }))
    .filter((p) => p.end - p.start >= MIN_OFF_MINUTES * MINUTE);
  if (!periods.length) return null;

  const longest = periods.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  let first = periods.indexOf(longest);
  let last = first;
  while (first > 0 && periods[first].start - periods[first - 1].end <= MAX_BREAK_MINUTES * MINUTE) first--;
  while (last < periods.length - 1 && periods[last + 1].start - periods[last].end <= MAX_BREAK_MINUTES * MINUTE) last++;
  const block = periods.slice(first, last + 1);
  const asleepMs = block.reduce((sum, p) => sum + p.end - p.start, 0);
  if (asleepMs < MIN_NIGHT_HOURS * 60 * MINUTE) return null;

  return {
    day,
    start: block[0].start,
    end: block[block.length - 1].end,
    asleepMs,
    breaks: block.slice(1).map((p, i) => ({ start: block[i].end, end: p.start })),
    source: 'screen'
  };
}

/** Recomputes the last nights from screen events. Nights the user edited stay as they are. */
export async function syncNights(database: HeadLogDb, days = 8, now = Date.now(), fallAsleepMs = 0) {
  const access = await screenAccess();
  if (!access.granted) return;
  const keys = lastDays(now, days);
  const from = setHours(addDays(new Date(`${keys[0]}T12:00`), -1), WINDOW_START_HOUR - 6).getTime();
  const { events } = await ScreenEvents.events({ from, to: now });
  const edited = new Set((await database.sleep.filter((n) => n.source === 'manual').toArray()).map((n) => n.day));
  for (const key of keys) {
    if (edited.has(key)) continue;
    const night = estimateNight(events, key, now, fallAsleepMs);
    if (night) await database.sleep.put(night);
  }
}

/** Time awake during the night's wake breaks. */
export function awakeMs(night: Pick<Night, 'breaks'>): number {
  return night.breaks.reduce((sum, b) => sum + b.end - b.start, 0);
}

/** The asleep stretches of a night: from falling asleep to waking, without its wake breaks. */
export function sleepSegments(night: Pick<Night, 'start' | 'end' | 'breaks'>): { start: number; end: number }[] {
  const segments: { start: number; end: number }[] = [];
  let start = night.start;
  for (const b of [...night.breaks].sort((a, c) => a.start - c.start)) {
    segments.push({ start, end: b.start });
    start = b.end;
  }
  segments.push({ start, end: night.end });
  return segments;
}

/**
 * A clock time typed for the night ending on `day`, as `HH:mm`: from 15:00 on it belongs to the
 * evening before, earlier to the morning of `day`. Null when the value is not a time.
 */
export function typedSleepTime(day: string, value: string): number | null {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  const morning = startOfDay(new Date(`${day}T12:00`));
  const date = h >= 15 ? addDays(morning, -1) : morning;
  return setHours(date, h).getTime() + m * MINUTE;
}

/**
 * A night as the user set it: breaks cut to the night, sorted and joined where they overlap, sleep
 * recomputed. Such nights are never estimated again.
 */
export function manualNight(day: string, start: number, end: number, breaks: { start: number; end: number }[]): Night {
  const inside = breaks
    .map((b) => ({ start: Math.max(b.start, start), end: Math.min(b.end, end) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  const joined: { start: number; end: number }[] = [];
  for (const b of inside) {
    const last = joined.at(-1);
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
    else joined.push(b);
  }
  return { day, start, end, breaks: joined, asleepMs: Math.max(0, end - start - awakeMs({ breaks: joined })), source: 'manual' };
}

/** A starting point for a night without data: 23:00 to 7:00. */
export function defaultNight(day: string): Night {
  const morning = startOfDay(new Date(`${day}T12:00`));
  return manualNight(day, setHours(addDays(morning, -1), 23).getTime(), setHours(morning, 7).getTime(), []);
}

/** The span the sleep editor shows: 20:00 to 12:00, wider when the night reaches beyond it. */
export function nightSpan(night: Night): { from: number; to: number } {
  const morning = startOfDay(new Date(`${night.day}T12:00`));
  return {
    from: Math.min(setHours(addDays(morning, -1), 20).getTime(), Math.floor((night.start - HOUR) / HOUR) * HOUR),
    to: Math.max(setHours(morning, 12).getTime(), Math.ceil((night.end + HOUR) / HOUR) * HOUR)
  };
}

/** Screen events between `from` and `to`; none outside the Android app or without usage access. */
export async function screenEvents(from: number, to: number): Promise<ScreenEvent[]> {
  const access = await screenAccess();
  if (!access.granted) return [];
  return (await ScreenEvents.events({ from, to })).events;
}

/** Screen-on stretches from the events, cut to `from`–`to`. */
export function onPeriods(events: ScreenEvent[], from: number, to: number): { start: number; end: number }[] {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const periods: { start: number; end: number }[] = [];
  let onSince: number | null = null;
  for (const e of sorted) {
    if (e.on && onSince === null) onSince = e.time;
    if (!e.on && onSince !== null) {
      periods.push({ start: onSince, end: e.time });
      onSince = null;
    }
  }
  if (onSince !== null) periods.push({ start: onSince, end: to });
  return periods.map((p) => ({ start: Math.max(p.start, from), end: Math.min(p.end, to) })).filter((p) => p.end > p.start);
}

/** Choices for how long falling asleep takes after the screen goes off, in minutes. */
export const FALL_ASLEEP_OPTIONS = [0, 5, 10, 15, 20, 30, 45];

/** Where a night may really have begun: the estimate, or the end of each wake break of at least `minBreak`. */
export function nightStartChoices(night: Pick<Night, 'start' | 'breaks'>, minBreak: number): { time: number; awake: number }[] {
  return [{ time: night.start, awake: 0 }, ...night.breaks.filter((b) => b.end - b.start >= minBreak).map((b) => ({ time: b.end, awake: b.end - b.start }))];
}

/**
 * The wake breaks of a night that starts at `time`, and those before it, which are set aside rather than
 * dropped so that another start can bring them back.
 */
export function splitBreaksAt(breaks: { start: number; end: number }[], parked: { start: number; end: number }[], time: number) {
  const all = [...breaks, ...parked].sort((a, b) => a.start - b.start);
  return { breaks: all.filter((b) => b.start >= time), parked: all.filter((b) => b.start < time) };
}
