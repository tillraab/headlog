import { formatDuration, formatLiters } from './days';
import { t } from './i18n.svelte';
import type { FactorKey, Prognosis } from './prognosis';
import { LOW_HYDRATION, MIN_SLEEP_EFFICIENCY, SHORT_SLEEP_HOURS } from './thresholds';
import { PRESSURE_DROP_HPA } from './weather';

/** One sentence on why a forecast factor has its status, with the numbers behind it. */
/** A pressure change to tomorrow that is not a big drop: a rise, no change, or a small drop. */
export function weatherOkText(change: number): string {
  const n = Math.round(Math.abs(change));
  if (n === 0) return t('prog.why.weatherStable');
  return t(change > 0 ? 'prog.why.weatherRise' : 'prog.why.weatherOk', { n });
}

/** The pressure change to tomorrow as a short value, e.g. "+10 hPa", "−3 hPa" or "stable". */
export function pressureChangeText(change: number): string {
  const n = Math.round(Math.abs(change));
  return n === 0 ? t('prog.stable') : `${change > 0 ? '+' : '−'}${n} hPa`;
}

/** Why a factor has its status. `hasTown`: a home town is set, so missing weather is only not loaded yet. */
export function whyText(p: Prognosis, key: FactorKey, hasTown = true): string {
  switch (key) {
    case 'weather':
      if (p.weather.status === 'unknown') return t(hasTown ? 'prog.why.weatherNoData' : 'prog.why.weatherUnknown');
      if (p.weather.status === 'bad') return t('prog.why.weatherBad', { n: Math.round(p.weather.drop), limit: PRESSURE_DROP_HPA });
      return weatherOkText(p.weather.change ?? -p.weather.drop);
    case 'hydration': {
      const h = p.hydration;
      if (h.status === 'unknown') return t('prog.why.hydrationUnknown');
      if (h.behind) return t('prog.why.hydrationBehind', { ml: formatLiters(h.today), pace: formatLiters(h.expected * LOW_HYDRATION) });
      if (h.lowYesterday) return t('prog.why.hydrationYesterday', { ml: formatLiters(h.yesterday ?? 0), limit: formatLiters(h.goal * LOW_HYDRATION) });
      return t(h.today >= h.goal ? 'prog.why.hydrationGoal' : 'prog.why.hydrationOk');
    }
    case 'sleep': {
      const night = p.sleep.night;
      if (!night) return t('prog.why.sleepNone');
      const values = { d: formatDuration(night.asleepMs), pct: Math.floor((p.sleep.efficiency ?? 1) * 100), limit: SHORT_SLEEP_HOURS, min: Math.round(MIN_SLEEP_EFFICIENCY * 100) };
      if (p.sleep.short) return t('prog.why.sleepShort', values);
      return t(p.sleep.fragmented ? 'prog.why.sleepFragmented' : 'prog.why.sleepOk', values);
    }
    case 'alcohol':
      if (p.alcohol.status === 'unknown') return t('prog.why.alcoholUnknown');
      if (p.alcohol.status === 'ok') return t('prog.why.alcoholOk');
      return t('prog.why.alcoholBad', {
        when: [p.alcohol.yesterday ? t('prog.yesterday') : '', p.alcohol.today ? t('prog.today') : ''].filter(Boolean).join(t('prog.and')).toLocaleLowerCase()
      });
    case 'caffeine': {
      const c = p.caffeine;
      if (c.status === 'unknown') return t('prog.why.caffeineLittle');
      const values = { mg: Math.round(c.today), byNow: Math.round(c.usualByNow ?? 0), yesterday: Math.round(c.yesterday), usual: Math.round(c.usual ?? 0) };
      if (c.todayLow) return t('prog.why.caffeineBadToday', values);
      if (c.yesterdayLow) return t('prog.why.caffeineBadYesterday', values);
      return t(c.tooEarly ? 'prog.why.caffeineEarly' : 'prog.why.caffeineOk', values);
    }
  }
}
