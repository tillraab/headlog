import { formatDuration, formatLiters } from './days';
import { t } from './i18n.svelte';
import type { FactorKey, Prognosis } from './prognosis';
import { LOW_HYDRATION, MIN_SLEEP_EFFICIENCY, SHORT_SLEEP_HOURS } from './thresholds';
import { PRESSURE_DROP_HPA } from './weather';

/** One sentence on why a forecast factor has its status, with the numbers behind it. */
export function whyText(p: Prognosis, key: FactorKey): string {
  switch (key) {
    case 'weather':
      if (p.weather.status === 'unknown') return t('prog.why.weatherUnknown');
      return t(p.weather.status === 'bad' ? 'prog.why.weatherBad' : 'prog.why.weatherOk', { n: Math.round(p.weather.drop), limit: PRESSURE_DROP_HPA });
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
      const values = { d: formatDuration(night.asleepMs), pct: Math.round((p.sleep.efficiency ?? 1) * 100), limit: SHORT_SLEEP_HOURS, min: Math.round(MIN_SLEEP_EFFICIENCY * 100) };
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
