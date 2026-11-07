import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { addDays, setHours, startOfDay } from 'date-fns';
import { RELIEFS, type Night, type Relief } from './db';
import { dayKey, formatDuration, formatLiters, hm, HOUR, MINUTE } from './days';
import { reliefLabels, t } from './i18n.svelte';
import type { TomorrowRisk } from './prognosis';

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

const RISK_ID = 400;

/**
 * The evening warning: tomorrow's outlook as it stands at the chosen hour, if nothing more is logged
 * until then. Sent when it is yellow or red and the hour has not passed yet.
 */
export function planRiskAlert(now: number, settings: { enabled: boolean; hour: number }, atHour: (time: number) => TomorrowRisk): PlannedReminder[] {
  if (!settings.enabled) return [];
  const at = setHours(startOfDay(now), settings.hour).getTime();
  if (at <= now) return [];
  const risk = atHour(at);
  if (risk.light === 'green') return [];
  const factors = risk.factors.map((k) => t(`prog.tomorrowFactor.${k}`)).join(', ');
  return [{ id: RISK_ID, at, title: t(`prog.notify.${risk.light}`), body: t('prog.notifyBody', { factors }) }];
}

export function applyRiskAlert(plan: PlannedReminder[]) {
  return serial(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await LocalNotifications.cancel({ notifications: [{ id: RISK_ID }] });
    if (!plan.length || !(await requestReminderPermission())) return;
    await LocalNotifications.schedule({
      notifications: plan.map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: new Date(r.at), allowWhileIdle: true } }))
    });
  });
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
const SLEEP_TYPE = 'sleep';
const HEADACHE_TYPE = 'headache';


/** Buttons shown on notifications. Registered again before scheduling so the labels follow the language. */
async function registerActions() {
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: RELIEF_TYPE,
        actions: RELIEFS.map((r) => ({ id: `relief-${r}`, title: reliefLabels()[r] }))
      },
      {
        id: HEADACHE_TYPE,
        actions: [
          { id: 'headache-still', title: t('rem.headacheStill') },
          { id: 'headache-gone', title: t('rem.headacheGone') }
        ]
      },
      {
        id: SLEEP_TYPE,
        actions: [
          { id: 'sleep-ok', title: t('sleep.card.ok') },
          { id: 'sleep-fix', title: t('sleep.card.fix') }
        ]
      }
    ]
  });
}

const RELIEF_OFFSET = 100000;

/** Asks about an intake `delayMinutes` later, with No / A bit / Yes buttons. */
export async function scheduleReliefCheck(intake: { id: number; time: number; name: string }, delayMinutes: number) {
  const at = intake.time + delayMinutes * MINUTE;
  if (!Capacitor.isNativePlatform() || at <= Date.now()) return;
  if (!(await requestReminderPermission())) return;
  await registerActions();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: RELIEF_OFFSET + intake.id,
        title: t('rem.reliefTitle', { name: intake.name }),
        body: t('rem.reliefBody', { time: hm(intake.time) }),
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
  relief: (intakeId: number, relief: Relief) => void;
  headacheGone: (episodeId: number) => void;
  sleepOk: (day: string) => void;
  sleepFix: (day: string) => void;
}

/** Handles taps on notification buttons. */
export function onNotificationAction(answers: NotificationAnswers) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
    answers.opened();
    const extra = notification.extra as { intakeId?: number; episodeId?: number; day?: string } | undefined;
    const relief = /^relief-([012])$/.exec(actionId);
    if (relief && extra?.intakeId !== undefined) answers.relief(extra.intakeId, RELIEFS[Number(relief[1])]);
    if (actionId === 'headache-gone' && extra?.episodeId !== undefined) answers.headacheGone(extra.episodeId);
    if (actionId === 'sleep-ok' && extra?.day) answers.sleepOk(extra.day);
    if (actionId === 'sleep-fix' && extra?.day) answers.sleepFix(extra.day);
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
  const step = everyHours * HOUR;
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

export interface DrinkReminderSettings {
  enabled: boolean;
  /** Hours of the day the reminder is active, from and to. */
  from: number;
  to: number;
  /** Hours without a logged drink before the reminder comes. */
  everyHours: number;
}

const DRINK_FIRST_ID = 300;
const DRINK_DAYS = 3;
const DRINK_PER_DAY = 18;

/** A logged drink, as far as the drink reminder needs it. */
export interface LoggedDrink {
  time: number;
  name: string;
  emoji: string;
}

/**
 * "Don't forget to drink" whenever `everyHours` pass inside the daily window without a logged drink,
 * for today and the next two days. Counted from the last drink, or from the window start when there was
 * none that day. Logging a drink reschedules everything, which moves the next reminder out.
 */
export function planDrinkReminders(now: number, settings: DrinkReminderSettings, drinks: LoggedDrink[]): PlannedReminder[] {
  if (!settings.enabled || settings.everyHours <= 0 || settings.to <= settings.from) return [];
  const step = settings.everyHours * HOUR;
  const plan: PlannedReminder[] = [];
  for (let d = 0; d < DRINK_DAYS; d++) {
    const day = addDays(startOfDay(now), d);
    const from = setHours(day, settings.from).getTime();
    const to = setHours(day, settings.to).getTime();
    const today = drinks.filter((x) => x.time >= day.getTime() && x.time <= Math.min(now, to));
    const last = today.length ? today.reduce((a, b) => (b.time > a.time ? b : a)) : null;
    const base = Math.max(from, last?.time ?? 0);
    for (let k = 1, n = 0; n < DRINK_PER_DAY; k++) {
      const at = base + k * step;
      if (at > to) break;
      if (at <= now) continue;
      const body = last
        ? t('rem.drinkBodyLast', { d: formatDuration(at - last.time), drink: `${last.emoji} ${last.name}` })
        : t('rem.drinkBodyNone');
      plan.push({ id: DRINK_FIRST_ID + d * DRINK_PER_DAY + n, at, title: t('rem.drinkTitle'), body });
      n++;
    }
  }
  return plan;
}

/** Replaces the pending drink reminders with the plan. A tap opens HeadLog. */
export function applyDrinkReminders(plan: PlannedReminder[]) {
  return serial(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const ids = Array.from({ length: DRINK_DAYS * DRINK_PER_DAY }, (_, i) => ({ id: DRINK_FIRST_ID + i }));
    await LocalNotifications.cancel({ notifications: ids });
    if (!plan.length || !(await requestReminderPermission())) return;
    await LocalNotifications.schedule({
      notifications: plan.map((r) => ({ id: r.id, title: r.title, body: r.body, autoCancel: true, schedule: { at: new Date(r.at), allowWhileIdle: true } }))
    });
  });
}

const SLEEP_FIRST_ID = 500;
const SLEEP_DAYS = 2;

/**
 * "How did you sleep?" this morning and tomorrow morning at `hour`, while the night is not confirmed.
 * This morning's names the estimated times; tomorrow's night is not known yet.
 */
export function planSleepChecks(now: number, settings: { enabled: boolean; hour: number }, nights: Map<string, Night>): (PlannedReminder & { day: string })[] {
  if (!settings.enabled) return [];
  return Array.from({ length: SLEEP_DAYS }, (_, d) => addDays(startOfDay(now), d)).flatMap((morning, d) => {
    const day = dayKey(morning);
    const at = setHours(morning, settings.hour).getTime();
    const night = nights.get(day);
    if (at <= now || night?.source === 'manual') return [];
    const body =
      night && d === 0
        ? t('rem.sleepBody', { d: formatDuration(night.asleepMs), from: hm(night.start), to: hm(night.end) })
        : t('rem.sleepBodyLater');
    return [{ id: SLEEP_FIRST_ID + d, at, day, title: t('rem.sleepTitle'), body }];
  });
}

/** Replaces the pending sleep questions with the plan, with Looks right / Correct buttons. */
export function applySleepChecks(plan: (PlannedReminder & { day: string })[]) {
  return serial(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await LocalNotifications.cancel({ notifications: Array.from({ length: SLEEP_DAYS }, (_, i) => ({ id: SLEEP_FIRST_ID + i })) });
    if (!plan.length || !(await requestReminderPermission())) return;
    await registerActions();
    await LocalNotifications.schedule({
      notifications: plan.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        actionTypeId: SLEEP_TYPE,
        autoCancel: true,
        extra: { day: r.day },
        schedule: { at: new Date(r.at), allowWhileIdle: true }
      }))
    });
  });
}
