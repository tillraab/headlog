import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { addDays, format, isSameDay, setHours, startOfDay } from 'date-fns';
import { hydrationMl } from './db';
import { formatDuration, formatLiters } from './days';
import { fmt, t } from './i18n.svelte';

export interface ReminderSettings {
  enabled: boolean;
  noon: number;
  evening: number;
}

export interface PlannedReminder {
  id: number;
  at: number;
  title: string;
  body: string;
  /** Text shown when the notification is expanded. */
  largeBody?: string;
}

let queue: Promise<unknown> = Promise.resolve();

/** Runs scheduling calls one after another, so an older plan cannot land after a newer one. */
function serial(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

const FIRST_ID = 100;
const DAYS = 7;

/**
 * Reminders for the next days: one at `noon` when less than half the goal is reached, one in the
 * `evening` when less than the full goal is reached. Only today's amount is known, later days count
 * from zero. Logging a drink reschedules everything, so a later day is corrected once it starts.
 */
export function planReminders(now: number, settings: ReminderSettings, goalMl: number, todayMl: number): PlannedReminder[] {
  if (!settings.enabled) return [];
  const plan: PlannedReminder[] = [];
  for (let d = 0; d < DAYS; d++) {
    const day = addDays(startOfDay(now), d);
    const ml = d === 0 ? todayMl : 0;
    const checks = [
      { hour: settings.noon, target: goalMl / 2, title: t('rem.noonTitle'), body: t('rem.noonBody', { ml: formatLiters(ml), target: formatLiters(goalMl / 2) }) },
      { hour: settings.evening, target: goalMl, title: t('rem.eveningTitle'), body: t('rem.eveningBody', { ml: formatLiters(ml), target: formatLiters(goalMl) }) }
    ];
    checks.forEach((c, i) => {
      const at = setHours(day, c.hour).getTime();
      if (at > now && ml < c.target) plan.push({ id: FIRST_ID + d * 2 + i, at, title: c.title, body: c.body });
    });
  }
  return plan;
}

/** Replaces all pending water reminders with the plan. Does nothing outside the Android app. */
export function applyReminders(plan: PlannedReminder[]) {
  return serial(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const ids = Array.from({ length: DAYS * 2 }, (_, i) => ({ id: FIRST_ID + i }));
    await LocalNotifications.cancel({ notifications: ids });
    if (!plan.length) return;
    await LocalNotifications.schedule({
      notifications: plan.map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: new Date(r.at), allowWhileIdle: true } }))
    });
  });
}

/** Asks for the notification permission. Returns whether reminders can be shown. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  const status = await LocalNotifications.requestPermissions();
  return status.display === 'granted';
}

const RELIEF_TYPE = 'relief';
const HEADACHE_TYPE = 'headache';
const DRINK_TYPE = 'drink';

/** Drink buttons on check-in notifications: the first three drinks of the list. */
let drinkButtons: { id: number; label: string }[] = [];

/** Buttons shown on notifications. Registered again before scheduling so the labels follow the language. */
async function registerActions() {
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: RELIEF_TYPE,
        actions: [
          { id: 'relief-0', title: t('edit.reliefNone') },
          { id: 'relief-1', title: t('edit.reliefSome') },
          { id: 'relief-2', title: t('edit.reliefGood') }
        ]
      },
      {
        id: HEADACHE_TYPE,
        actions: [
          { id: 'headache-still', title: t('rem.headacheStill') },
          { id: 'headache-gone', title: t('rem.headacheGone') }
        ]
      },
      { id: DRINK_TYPE, actions: drinkButtons.map((b) => ({ id: `drink-${b.id}`, title: b.label })) }
    ]
  });
}

const RELIEF_OFFSET = 100000;

/** Asks about an intake `delayMinutes` later, with No / A bit / Yes buttons. */
export async function scheduleReliefCheck(intake: { id: number; time: number; name: string }, delayMinutes: number) {
  const at = intake.time + delayMinutes * 60000;
  if (!Capacitor.isNativePlatform() || at <= Date.now()) return;
  if (!(await requestReminderPermission())) return;
  await registerActions();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: RELIEF_OFFSET + intake.id,
        title: t('rem.reliefTitle', { name: intake.name }),
        body: t('rem.reliefBody', { time: format(intake.time, 'HH:mm') }),
        actionTypeId: RELIEF_TYPE,
        autoCancel: true,
        extra: { intakeId: intake.id },
        schedule: { at: new Date(at), allowWhileIdle: true }
      }
    ]
  });
}

export async function cancelReliefCheck(intakeId: number) {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: RELIEF_OFFSET + intakeId }] });
}

export interface NotificationAnswers {
  /** Any tap on a notification or one of its buttons. */
  opened: () => void;
  relief: (intakeId: number, relief: number) => void;
  headacheGone: (episodeId: number) => void;
  drink: (presetId: number) => void;
}

/** Handles taps on notification buttons. */
export function onNotificationAction(answers: NotificationAnswers) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
    answers.opened();
    const extra = notification.extra as { intakeId?: number; episodeId?: number } | undefined;
    const relief = /^relief-(\d)$/.exec(actionId);
    if (relief && extra?.intakeId !== undefined) answers.relief(extra.intakeId, Number(relief[1]));
    if (actionId === 'headache-gone' && extra?.episodeId !== undefined) answers.headacheGone(extra.episodeId);
    const drink = /^drink-(\d+)$/.exec(actionId);
    if (drink) answers.drink(Number(drink[1]));
  });
  return () => void handle.then((h) => h.remove());
}

const HEADACHE_FIRST_ID = 200;
const HEADACHE_CHECKS = 12;

/** "Still a headache?" every `everyHours` while an episode is ongoing, the next 12 times. */
export function planHeadacheChecks(
  episode: { id: number; start: number; end: number | null } | undefined,
  now: number,
  everyHours: number
): (PlannedReminder & { episodeId: number })[] {
  if (!episode || episode.end !== null || everyHours <= 0) return [];
  const step = everyHours * 3600000;
  const first = Math.max(1, Math.floor((now - episode.start) / step) + 1);
  return Array.from({ length: HEADACHE_CHECKS }, (_, i) => {
    const at = episode.start + (first + i) * step;
    return {
      id: HEADACHE_FIRST_ID + i,
      at,
      episodeId: episode.id,
      title: t('rem.headacheTitle'),
      body: t('rem.headacheBody', { duration: formatDuration(at - episode.start) })
    };
  });
}

/** Replaces the pending "still a headache?" notifications with the plan. */
export function applyHeadacheChecks(plan: (PlannedReminder & { episodeId: number })[]) {
  return serial(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await LocalNotifications.cancel({ notifications: Array.from({ length: HEADACHE_CHECKS }, (_, i) => ({ id: HEADACHE_FIRST_ID + i })) });
    if (!plan.length || !(await requestReminderPermission())) return;
    await registerActions();
    await LocalNotifications.schedule({
      notifications: plan.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        actionTypeId: HEADACHE_TYPE,
        autoCancel: true,
        extra: { episodeId: r.episodeId },
        schedule: { at: new Date(r.at), allowWhileIdle: true }
      }))
    });
  });
}

export interface DrinkCheckinSettings {
  enabled: boolean;
  /** Times of day as `HH:mm`. */
  times: string[];
}

const CHECKIN_FIRST_ID = 300;
export const MAX_CHECKIN_TIMES = 8;
/** A check-in is skipped when a drink was logged this many minutes before it. */
export const CHECKIN_QUIET_MINUTES = 60;

/** A logged drink, as far as check-ins need it. */
export interface LoggedDrink {
  time: number;
  name: string;
  emoji: string;
  ml: number;
  alcohol?: boolean;
}

const CHECKIN_LIST = 3;

/**
 * "What did you drink?" at the chosen times for the next 7 days. Each check-in lists the drinks logged
 * since the check-in before it on the same day; the first one of a day names the last drink.
 */
export function planDrinkCheckins(now: number, settings: DrinkCheckinSettings, goalMl: number, drinks: LoggedDrink[]): PlannedReminder[] {
  if (!settings.enabled) return [];
  const times = [...settings.times].sort().slice(0, MAX_CHECKIN_TIMES);
  const plan: PlannedReminder[] = [];
  for (let d = 0; d < DAYS; d++) {
    const day = addDays(startOfDay(now), d);
    times.forEach((time, i) => {
      const at = atTime(day, time);
      if (at <= now) return;
      const before = drinks.filter((x) => x.time <= at);
      const last = before.length ? before.reduce((a, b) => (b.time > a.time ? b : a)) : null;
      if (last && at - last.time < CHECKIN_QUIET_MINUTES * 60000) return;
      const ml = before.filter((x) => isSameDay(x.time, at)).reduce((sum, x) => sum + hydrationMl(x), 0);
      const amount = t('rem.checkinBody', { ml: formatLiters(ml), goal: formatLiters(goalMl) });
      const sameDay = last !== null && isSameDay(last.time, at);
      const title = sameDay ? t('rem.checkinTitleSince', { time: format(last.time, 'HH:mm') }) : t('rem.checkinTitle');
      const id = CHECKIN_FIRST_ID + d * MAX_CHECKIN_TIMES + i;

      if (i === 0) {
        const body = last && !sameDay ? `${t('rem.checkinLast', { time: lastDrinkLabel(last.time, at) })} ${amount}` : amount;
        plan.push({ id, at, title, body });
        return;
      }
      const previous = format(atTime(day, times[i - 1]), 'HH:mm');
      const since = before.filter((x) => x.time >= atTime(day, times[i - 1])).sort((a, b) => a.time - b.time);
      if (!since.length) {
        plan.push({ id, at, title, body: `${t('rem.checkinNothing', { time: previous })} · ${amount}` });
        return;
      }
      const lines = since.slice(-CHECKIN_LIST).map((x) => `${format(x.time, 'HH:mm')}  ${x.emoji} ${x.name}  ${x.ml} ml`);
      if (since.length > CHECKIN_LIST) lines.unshift(t('rem.checkinMore', { n: since.length - CHECKIN_LIST }));
      plan.push({
        id,
        at,
        title,
        body: `${t('rem.checkinSince', { time: previous, drinks: since.map((x) => x.name).join(', ') })} · ${amount}`,
        largeBody: `${lines.join('\n')}\n${amount}`
      });
    });
  }
  return plan;
}

function atTime(day: Date, time: string): number {
  const [h, m] = time.split(':').map(Number);
  return day.getTime() + (h * 60 + m) * 60000;
}

/** "yesterday 21:30" or "Mon 5 Nov 21:30", seen from the day of the check-in. */
function lastDrinkLabel(lastDrink: number, at: number): string {
  if (isSameDay(lastDrink, addDays(at, -1))) return `${t('versions.yesterday').toLowerCase()} ${format(lastDrink, 'HH:mm')}`;
  return fmt(lastDrink, 'EEE d. MMM HH:mm');
}

/** Replaces the pending check-ins with the plan, with buttons for the first three drinks. */
export function applyDrinkCheckins(plan: PlannedReminder[], presets: { id: number; name: string; emoji: string }[]) {
  return serial(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const ids = Array.from({ length: DAYS * MAX_CHECKIN_TIMES }, (_, i) => ({ id: CHECKIN_FIRST_ID + i }));
    await LocalNotifications.cancel({ notifications: ids });
    if (!plan.length || !(await requestReminderPermission())) return;
    drinkButtons = presets.slice(0, 3).map((p) => ({ id: p.id, label: `${p.emoji} ${p.name}` }));
    await registerActions();
    await LocalNotifications.schedule({
      notifications: plan.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        largeBody: r.largeBody,
        actionTypeId: DRINK_TYPE,
        autoCancel: true,
        schedule: { at: new Date(r.at), allowWhileIdle: true }
      }))
    });
  });
}
