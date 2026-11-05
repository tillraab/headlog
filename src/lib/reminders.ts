import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { addDays, setHours, startOfDay } from 'date-fns';
import { formatDuration, formatLiters } from './days';
import { t } from './i18n.svelte';

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
      }
    ]
  });
}

const RELIEF_OFFSET = 100000;
export const RELIEF_DELAY = 60 * 60000;

/** Asks about an intake one hour later, with No / A bit / Yes buttons. */
export async function scheduleReliefCheck(intake: { id: number; time: number; name: string }) {
  if (!Capacitor.isNativePlatform() || intake.time + RELIEF_DELAY <= Date.now()) return;
  if (!(await requestReminderPermission())) return;
  await registerActions();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: RELIEF_OFFSET + intake.id,
        title: t('rem.reliefTitle', { name: intake.name }),
        body: t('rem.reliefBody'),
        actionTypeId: RELIEF_TYPE,
        autoCancel: true,
        extra: { intakeId: intake.id },
        schedule: { at: new Date(intake.time + RELIEF_DELAY), allowWhileIdle: true }
      }
    ]
  });
}

export async function cancelReliefCheck(intakeId: number) {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: RELIEF_OFFSET + intakeId }] });
}

export interface NotificationAnswers {
  relief: (intakeId: number, relief: number) => void;
  headacheGone: (episodeId: number) => void;
}

/** Handles taps on notification buttons. */
export function onNotificationAction(answers: NotificationAnswers) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
    const extra = notification.extra as { intakeId?: number; episodeId?: number } | undefined;
    const relief = /^relief-(\d)$/.exec(actionId);
    if (relief && extra?.intakeId !== undefined) answers.relief(extra.intakeId, Number(relief[1]));
    if (actionId === 'headache-gone' && extra?.episodeId !== undefined) answers.headacheGone(extra.episodeId);
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
