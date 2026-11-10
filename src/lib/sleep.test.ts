import { describe, expect, it } from 'vitest';
import { awakeMs, defaultNight, estimateNight, manualNight, nightSpan, nightStartChoices, onPeriods, sleepSegments, splitBreaksAt, startForChoice, typedSleepTime, type ScreenEvent } from './sleep';

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

  it('starts sleep the given time after the screen goes off, also after a wake break', () => {
    const events = [off('2026-03-09T23:00'), on('2026-03-10T03:10'), off('2026-03-10T03:35'), on('2026-03-10T06:30')];
    const night = estimateNight(events, '2026-03-10', now, 15 * 60000)!;
    expect([night.start, night.breaks, night.asleepMs]).toEqual([at('2026-03-09T23:15'), [{ start: at('2026-03-10T03:10'), end: at('2026-03-10T03:50') }], 7.5 * HOUR - 55 * 60000]);
  });

  it('leaves out an off stretch that is too short once the time to fall asleep is taken off', () => {
    const events = [off('2026-03-09T22:00'), on('2026-03-09T22:30'), off('2026-03-09T23:00'), on('2026-03-10T06:30')];
    const night = estimateNight(events, '2026-03-10', now, 15 * 60000)!;
    expect([night.start, night.breaks]).toEqual([at('2026-03-09T23:15'), []]);
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

describe('manualNight', () => {
  it('cuts breaks to the night, joins overlapping ones and recomputes the sleep', () => {
    const night = manualNight('2026-03-10', at('2026-03-09T23:00'), at('2026-03-10T07:00'), [
      { start: at('2026-03-10T03:30'), end: at('2026-03-10T04:00') },
      { start: at('2026-03-10T03:00'), end: at('2026-03-10T03:45') },
      { start: at('2026-03-10T06:50'), end: at('2026-03-10T07:30') }
    ]);
    expect([night.breaks, night.asleepMs, night.source]).toEqual([
      [
        { start: at('2026-03-10T03:00'), end: at('2026-03-10T04:00') },
        { start: at('2026-03-10T06:50'), end: at('2026-03-10T07:00') }
      ],
      8 * HOUR - 70 * 60000,
      'manual'
    ]);
  });
});

describe('defaultNight', () => {
  it('runs from 23:00 to 7:00', () => {
    const night = defaultNight('2026-03-10');
    expect([night.start, night.end, night.asleepMs]).toEqual([at('2026-03-09T23:00'), at('2026-03-10T07:00'), 8 * HOUR]);
  });
});

describe('nightSpan', () => {
  it.each([
    ['2026-03-09T23:00', '2026-03-10T07:00', '2026-03-09T20:00', '2026-03-10T12:00'],
    ['2026-03-09T19:30', '2026-03-10T12:10', '2026-03-09T18:00', '2026-03-10T14:00']
  ])('for a night %s to %s shows %s to %s', (start, end, from, to) => {
    const span = nightSpan(manualNight('2026-03-10', at(start), at(end), []));
    expect([span.from, span.to]).toEqual([at(from), at(to)]);
  });
});

describe('onPeriods', () => {
  it('pairs on and off events and cuts them to the span', () => {
    const periods = onPeriods([on('2026-03-09T19:00'), off('2026-03-09T21:00'), on('2026-03-10T03:00'), off('2026-03-10T03:20'), on('2026-03-10T11:00')], at('2026-03-09T20:00'), at('2026-03-10T12:00'));
    expect(periods).toEqual([
      { start: at('2026-03-09T20:00'), end: at('2026-03-09T21:00') },
      { start: at('2026-03-10T03:00'), end: at('2026-03-10T03:20') },
      { start: at('2026-03-10T11:00'), end: at('2026-03-10T12:00') }
    ]);
  });
});

describe('sleepSegments', () => {
  const night = { start: at('2026-03-09T23:00'), end: at('2026-03-10T07:00') };

  it('is the whole night without breaks', () => {
    expect(sleepSegments({ ...night, breaks: [] })).toEqual([night]);
  });

  it('leaves out two breaks, in time order', () => {
    const late = { start: at('2026-03-10T04:00'), end: at('2026-03-10T04:30') };
    const early = { start: at('2026-03-10T01:00'), end: at('2026-03-10T01:20') };
    expect(sleepSegments({ ...night, breaks: [late, early] })).toEqual([
      { start: night.start, end: early.start },
      { start: early.end, end: late.start },
      { start: late.end, end: night.end }
    ]);
  });
});

describe('awakeMs', () => {
  it('adds up the breaks', () => {
    const breaks = [
      { start: at('2026-03-10T01:00'), end: at('2026-03-10T01:20') },
      { start: at('2026-03-10T04:00'), end: at('2026-03-10T04:30') }
    ];
    expect(awakeMs({ breaks })).toBe(50 * 60000);
  });
});

describe('typedSleepTime', () => {
  it.each([
    ['23:30', '2026-03-09T23:30'],
    ['15:00', '2026-03-09T15:00'],
    ['06:10', '2026-03-10T06:10'],
    ['14:59', '2026-03-10T14:59']
  ])('puts %s on the right day', (value, expected) => {
    expect(typedSleepTime('2026-03-10', value)).toBe(at(expected));
  });

  it('is null for an empty field', () => {
    expect(typedSleepTime('2026-03-10', '')).toBeNull();
  });
});

describe('estimateNight at the limits', () => {
  it.each([
    [19, at('2026-03-09T23:00')],
    [20, at('2026-03-09T22:00')]
  ])('joins an evening off stretch of %i minutes only from 20 minutes on', (minutes, start) => {
    const events = [off('2026-03-09T22:00'), { time: at('2026-03-09T22:00') + minutes * 60000, on: true }, off('2026-03-09T23:00'), on('2026-03-10T06:00')];
    expect(estimateNight(events, '2026-03-10', now)?.start).toBe(start);
  });

  it.each([
    ['03:30', at('2026-03-09T23:00')],
    ['03:31', at('2026-03-10T03:31')]
  ])('keeps a 90-minute wake break inside the night, but not a longer one (back to sleep at %s)', (back, start) => {
    const events = [off('2026-03-09T23:00'), on('2026-03-10T02:00'), off(`2026-03-10T${back}`), on('2026-03-10T07:00')];
    expect(estimateNight(events, '2026-03-10', now)?.start).toBe(start);
  });

  it('counts the real time asleep across the change to summer time', () => {
    const night = estimateNight([off('2026-03-28T23:00'), on('2026-03-29T07:00')], '2026-03-29', at('2026-03-29T12:00'));
    expect(night?.asleepMs).toBe(7 * HOUR);
  });
});

describe('nightStartChoices and splitBreaksAt', () => {
  const H = 3600000;
  const night = { start: 0, breaks: [{ start: 0.5 * H, end: 1.7 * H }, { start: 4 * H, end: 4.1 * H }] };

  it('offers the estimate and the end of each longer wake break', () => {
    expect(nightStartChoices(night, 0.25 * H)).toEqual([{ time: 0, awake: 0 }, { time: 1.7 * H, awake: 1.2 * H }]);
  });

  it('sets wake breaks before a later start aside and brings them back for the earlier one', () => {
    const later = splitBreaksAt(night.breaks, [], 1.7 * H);
    const back = splitBreaksAt(later.breaks, later.parked, 0);
    expect([later.breaks.length, later.parked.length, back.breaks]).toEqual([1, 1, night.breaks]);
  });
});

describe('startForChoice', () => {
  const M = 60000;
  const choices = [0, 106 * M];
  const breaks = [{ start: 36 * M, end: 106 * M }];

  it('keeps the chosen start when enough sleep is left before the wake break', () => {
    expect(startForChoice(choices, 0, 15 * M, breaks, 20 * M)).toBe(15 * M);
  });

  it('moves past the wake break when too little sleep is left', () => {
    expect(startForChoice(choices, 0, 30 * M, breaks, 20 * M)).toBe(136 * M);
  });

  it('returns to the chosen start when the time to fall asleep goes down again', () => {
    expect([30, 15].map((n) => startForChoice(choices, 0, n * M, breaks, 20 * M))).toEqual([136 * M, 15 * M]);
  });
});
