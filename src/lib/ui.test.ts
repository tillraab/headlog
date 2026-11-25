import { afterEach, describe, expect, it, vi } from 'vitest';
import { AWAY_RESET_MS, awayLongEnough, busyInSheet, calendarView, dayView, stepDay, closeAllSheets, factorSheet, openFactor, closeTopSheet, fromLocalInput, info, openSheet, requestClose, sheets, showInfo, toLocalInput, trackUnsaved } from './ui.svelte';

describe('fromLocalInput', () => {
  it.each(['', 'garbage', '2026-13-40T99:99'])('returns null for %j', (value) => {
    expect(fromLocalInput(value)).toBeNull();
  });

  it('reads back what toLocalInput wrote', () => {
    const time = new Date('2026-03-10T14:35').getTime();
    expect(fromLocalInput(toLocalInput(time))).toBe(time);
  });
});

describe('showInfo', () => {
  it('shows one text as one paragraph', () => {
    showInfo('Title', 'One paragraph.');
    expect(info.open).toEqual({ title: 'Title', text: ['One paragraph.'], sources: [] });
  });

  it('keeps paragraphs given as a list', () => {
    showInfo('Title', ['First.', 'Second.']);
    expect(info.open?.text).toEqual(['First.', 'Second.']);
  });

  it('keeps sections with their headings', () => {
    showInfo('Title', [{ title: 'Rule', body: 'Under 5 h.' }]);
    expect(info.open?.text).toEqual([{ title: 'Rule', body: 'Under 5 h.' }]);
  });

  it('keeps the sources apart from the text', () => {
    showInfo('Title', 'Text', ['Author (2020). Title.']);
    expect(info.open?.sources).toEqual(['Author (2020). Title.']);
  });
});

describe('closeTopSheet', () => {
  it('closes an open explanation before the sheet under it', () => {
    closeAllSheets();
    openSheet('settings');
    showInfo('Title', 'Text');

    closeTopSheet();

    expect([info.open, sheets.stack]).toEqual([null, ['settings']]);
  });

  it('closes the newest sheet when no explanation is open', () => {
    closeAllSheets();
    openSheet('settings');
    openSheet('medList');

    closeTopSheet();

    expect(sheets.stack).toEqual(['settings']);
  });

  it('returns false when nothing is open', () => {
    closeAllSheets();
    expect(closeTopSheet()).toBe(false);
  });
});

describe('awayLongEnough', () => {
  it.each([
    [null, 0, false],
    [0, AWAY_RESET_MS - 1, false],
    [0, AWAY_RESET_MS, true]
  ] as const)('after hiding at %s and returning at %i is %s', (hiddenAt, now, expected) => {
    expect(awayLongEnough(hiddenAt, now)).toBe(expected);
  });
});

describe('openFactor', () => {
  it('opens the factor sheet on the chosen factor', () => {
    closeAllSheets();
    openFactor('caffeine');
    expect([factorSheet.key, sheets.stack]).toEqual(['caffeine', ['factor']]);
  });
});

afterEach(() => {
  closeAllSheets();
  vi.unstubAllGlobals();
});

describe('requestClose', () => {
  it('keeps a sheet with unsaved changes open when the user does not discard them', () => {
    const untrack = trackUnsaved('editor', () => true);
    vi.stubGlobal('confirm', () => false);
    openSheet('editor');
    requestClose('editor');
    untrack();
    expect(sheets.stack).toEqual(['editor']);
  });

  it('closes a sheet without changes at once', () => {
    const untrack = trackUnsaved('editor', () => false);
    openSheet('editor');
    requestClose('editor');
    untrack();
    expect(sheets.stack).toEqual([]);
  });
});

describe('busyInSheet', () => {
  it.each([
    ['settings', false, true],
    ['editor', true, true],
    ['editor', false, false]
  ] as const)('is %s with changes %s: %s', (id, changes, busy) => {
    const untrack = trackUnsaved('editor', () => changes);
    openSheet(id);
    const result = busyInSheet();
    untrack();
    expect(result).toBe(busy);
  });
});

describe('stepDay', () => {
  it.each([
    { day: '2026-03-10', delta: -1, today: '2026-03-20', moved: true, shown: '2026-03-09' },
    { day: '2026-03-10', delta: 1, today: '2026-03-20', moved: true, shown: '2026-03-11' },
    { day: '2026-03-20', delta: 1, today: '2026-03-20', moved: false, shown: '2026-03-20' },
    { day: '2026-03-19', delta: 1, today: '2026-03-20', moved: true, shown: '2026-03-20' }
  ])('$day by $delta with today $today shows $shown', ({ day, delta, today, moved, shown }) => {
    dayView.day = day;
    expect({ moved: stepDay(day, delta, today), shown: dayView.day }).toEqual({ moved, shown });
  });

  it.each([
    { calendar: '2026-03-01', day: '2026-03-01', delta: -1, month: '2026-02-01', why: 'follows into the previous month' },
    { calendar: '2026-02-01', day: '2026-02-28', delta: 1, month: '2026-03-01', why: 'follows into the next month' },
    { calendar: '2026-03-01', day: '2026-03-10', delta: 1, month: '2026-03-01', why: 'stays within the month' },
    { calendar: '2025-12-01', day: '2026-03-01', delta: -1, month: '2025-12-01', why: 'leaves another month alone' }
  ])('calendar $why', ({ calendar, day, delta, month }) => {
    calendarView.month = new Date(`${calendar}T00:00`);
    stepDay(day, delta, '2026-12-31');
    expect(calendarView.month).toEqual(new Date(`${month}T00:00`));
  });
});
