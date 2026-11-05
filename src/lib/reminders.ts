import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { addDays, setHours, startOfDay } from 'date-fns';
import { formatLiters } from './days';
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
export async function applyReminders(plan: PlannedReminder[]) {
  if (!Capacitor.isNativePlatform()) return;
  const ids = Array.from({ length: DAYS * 2 }, (_, i) => ({ id: FIRST_ID + i }));
  await LocalNotifications.cancel({ notifications: ids });
  if (!plan.length) return;
  await LocalNotifications.schedule({
    notifications: plan.map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: new Date(r.at), allowWhileIdle: true } }))
  });
}

/** Asks for the notification permission. Returns whether reminders can be shown. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  const status = await LocalNotifications.requestPermissions();
  return status.display === 'granted';
}

const RELIEF_TYPE = 'relief';
const RELIEF_OFFSET = 100000;
export const RELIEF_DELAY = 60 * 60000;

/** Asks about an intake one hour later, with No / A bit / Yes buttons. */
export async function scheduleReliefCheck(intake: { id: number; time: number; name: string }) {
  if (!Capacitor.isNativePlatform() || intake.time + RELIEF_DELAY <= Date.now()) return;
  if (!(await requestReminderPermission())) return;
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: RELIEF_TYPE,
        actions: [
          { id: 'relief-0', title: t('edit.reliefNone') },
          { id: 'relief-1', title: t('edit.reliefSome') },
          { id: 'relief-2', title: t('edit.reliefGood') }
        ]
      }
    ]
  });
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

/** Calls `answer` when a relief button in a notification is tapped. */
export function onReliefAnswer(answer: (intakeId: number, relief: number) => void) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
    const match = /^relief-(\d)$/.exec(actionId);
    const intakeId = (notification.extra as { intakeId?: number } | undefined)?.intakeId;
    if (match && intakeId !== undefined) answer(intakeId, Number(match[1]));
  });
  return () => void handle.then((h) => h.remove());
}
