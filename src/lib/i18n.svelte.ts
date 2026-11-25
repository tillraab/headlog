import { differenceInCalendarDays, format } from 'date-fns';
import { de as deLocale, enGB } from 'date-fns/locale';
import type { Relief } from './db';
import { de } from './i18n/de';
import { en } from './i18n/en';

type Key = keyof typeof en;

/** Symptom and trigger tags an episode can carry, each with a `tag.…` text. */

export type Lang = 'en' | 'de';

const dictionaries: Record<Lang, Record<Key, string>> = { en, de };

function detect(): Lang {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null;
  if (stored === 'en' || stored === 'de') return stored;
  return typeof navigator !== 'undefined' && navigator.language.startsWith('de') ? 'de' : 'en';
}

export const i18n = $state<{ lang: Lang }>({ lang: detect() });

export function setLang(lang: Lang) {
  i18n.lang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
}

/** `text` with every `{name}` replaced by its value from `params`. */
export function fill(text: string, params: Record<string, string | number>): string {
  for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

export function t(key: Key, params: Record<string, string | number> = {}): string {
  return fill(dictionaries[i18n.lang][key], params);
}

const numberFormats = new Map<string, Intl.NumberFormat>();

/**
 * A number written the way the app language writes it ("1.5" or "1,5"), not the phone's language.
 * Shows at least `digits` and at most `maxDigits` decimals.
 */
export function num(value: number, digits = 0, maxDigits = digits): string {
  const key = `${i18n.lang}:${digits}:${maxDigits}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(i18n.lang, { minimumFractionDigits: digits, maximumFractionDigits: maxDigits });
    numberFormats.set(key, format);
  }
  return format.format(value);
}

function dateLocale() {
  return i18n.lang === 'de' ? deLocale : enGB;
}

/** Formats a date with a pattern written German-style (`d. MMM`); English drops the dot after the day. */
export function fmt(date: number | Date, pattern: string): string {
  return format(date, i18n.lang === 'de' ? pattern : pattern.replace('d. ', 'd '), { locale: dateLocale() });
}

/** "Today", "Yesterday" or the date in `pattern` (see `fmt`), seen from `now`. */
export function relativeDay(date: number | Date, now: number | Date, pattern: string): string {
  const days = differenceInCalendarDays(now, date);
  if (days === 0) return t('date.today');
  if (days === 1) return t('date.yesterday');
  return fmt(date, pattern);
}

export function weekdayShort(): string[] {
  return t('weekday.short').split(',');
}

/** Labels of the relief ratings, indexed by `Relief`. */
export function reliefLabels(): Record<Relief, string> {
  return [t('edit.reliefNone'), t('edit.reliefSome'), t('edit.reliefGood')];
}

export function intensityLabel(n: number): string {
  if (n >= 8) return t('intensity.8');
  if (n >= 5) return t('intensity.5');
  return t('intensity.1');
}
