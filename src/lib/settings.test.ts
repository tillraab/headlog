import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from './settings';

describe('mergeSettings', () => {
  it('gives the defaults when nothing is stored', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps stored values over the defaults', () => {
    expect(mergeSettings({ waterGoalMl: 2500, theme: 'dark' })).toMatchObject({ waterGoalMl: 2500, theme: 'dark' });
  });

  it('turns the old switched-off relief question into 0 minutes', () => {
    expect(mergeSettings({ reliefCheck: false }).reliefCheckMinutes).toBe(0);
  });

  it('keeps the relief question on when the old switch was on', () => {
    expect(mergeSettings({ reliefCheck: true }).reliefCheckMinutes).toBe(60);
  });

  it('turns the drink reminder on for whoever had drink check-ins on', () => {
    expect(mergeSettings({ drinkCheckins: { enabled: true } }).drinkReminder).toEqual({ ...DEFAULT_SETTINGS.drinkReminder, enabled: true });
  });

  it('keeps a stored drink reminder over old check-ins', () => {
    const drinkReminder = { enabled: false, from: 9, to: 18, everyHours: 3 };
    expect(mergeSettings({ drinkCheckins: { enabled: true }, drinkReminder }).drinkReminder).toEqual(drinkReminder);
  });

  it('fills a sub-field missing from a stored setting with its default', () => {
    expect(mergeSettings({ drinkReminder: { enabled: true, from: 9, to: 18 } }).drinkReminder).toEqual({ enabled: true, from: 9, to: 18, everyHours: 2 });
  });

  it('drops the stored 10/20 limit, which is fixed', () => {
    expect(mergeSettings({ limit: 12 })).not.toHaveProperty('limit');
  });

  it('does not drop the stored renamed fields into the settings', () => {
    expect(Object.keys(mergeSettings({ reliefCheck: false, drinkCheckins: { enabled: false } }))).toEqual(Object.keys(DEFAULT_SETTINGS));
  });
});
