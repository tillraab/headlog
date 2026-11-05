import { describe, expect, it } from 'vitest';
import { editNight, estimateNight, type ScreenEvent } from './sleep';

const at = (s: string) => new Date(s).getTime();
const off = (s: string): ScreenEvent => ({ time: at(s), on: false });
const on = (s: string): ScreenEvent => ({ time: at(s), on: true });
const now = at('2026-03-10T12:00');
const HOUR = 3600000;

describe('estimateNight', () => {
  it('takes the screen-off stretch of the night', () => {
    const night = estimateNight([on('2026-03-09T21:00'), off('2026-03-09T23:00'), on('2026-03-10T06:30')], '2026-03-10', now);
    expect([night?.start, night?.end, night?.asleepMs, night?.breaks]).toEqual([at('2026-03-09T23:00'), at('2026-03-10T06:30'), 7.5 * HOUR, []]);
  });

  it('keeps a wake break inside the night and leaves it out of the sleep time', () => {
    const events = [off('2026-03-09T23:00'), on('2026-03-10T03:10'), off('2026-03-10T03:35'), on('2026-03-10T06:30')];
    const night = estimateNight(events, '2026-03-10', now)!;
    expect([night.breaks, night.asleepMs]).toEqual([[{ start: at('2026-03-10T03:10'), end: at('2026-03-10T03:35') }], 7.5 * HOUR - 25 * 60000]);
  });

  it('does not join an evening break that lasted longer than 90 minutes', () => {
    const events = [off('2026-03-09T18:30'), on('2026-03-09T20:30'), off('2026-03-09T23:00'), on('2026-03-10T07:00')];
    expect(estimateNight(events, '2026-03-10', now)?.start).toBe(at('2026-03-09T23:00'));
  });

  it('ignores off stretches shorter than 20 minutes', () => {
    const events = [off('2026-03-09T22:30'), on('2026-03-09T22:40'), off('2026-03-09T22:45'), on('2026-03-10T06:45')];
    const night = estimateNight(events, '2026-03-10', now)!;
    expect([night.start, night.breaks]).toEqual([at('2026-03-09T22:45'), []]);
  });

  it('finds no night under 3 hours', () => {
    expect(estimateNight([off('2026-03-10T01:00'), on('2026-03-10T03:30')], '2026-03-10', now)).toBeNull();
  });

  it('starts the window at 18:00 the evening before', () => {
    const night = estimateNight([off('2026-03-09T15:00'), on('2026-03-10T05:00')], '2026-03-10', now);
    expect(night?.start).toBe(at('2026-03-09T18:00'));
  });

  it('ends a night that is still going at now', () => {
    const night = estimateNight([off('2026-03-09T23:00')], '2026-03-10', at('2026-03-10T05:00'));
    expect(night?.end).toBe(at('2026-03-10T05:00'));
  });
});

describe('editNight', () => {
  it('keeps the breaks inside the new times and marks the night as set by hand', () => {
    const night = estimateNight([off('2026-03-09T23:00'), on('2026-03-10T03:10'), off('2026-03-10T03:35'), on('2026-03-10T06:30')], '2026-03-10', now)!;
    const edited = editNight(night, at('2026-03-09T22:30'), at('2026-03-10T07:00'));
    expect([edited.asleepMs, edited.source]).toEqual([8.5 * HOUR - 25 * 60000, 'manual']);
  });
});
