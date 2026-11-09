import { describe, expect, it } from 'vitest';
import { AWAY_RESET_MS, awayLongEnough, closeAllSheets, factorSheet, openFactor, closeTopSheet, fromLocalInput, info, openSheet, sheets, showInfo, toLocalInput } from './ui.svelte';

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
