<script lang="ts">
  import { ChevronDown, Pencil } from '@lucide/svelte';
  import { dayKey, formatDuration, formatLiters, hm, HOUR } from '$lib/days';
  import { t } from '$lib/i18n.svelte';
  import { awakeMs } from '$lib/sleep';
  import { badFactors, prognosis, prognosisInput, tomorrowRisk, type Status } from '$lib/prognosis';
  import { LOW_HYDRATION, MIN_SLEEP_EFFICIENCY, SHORT_SLEEP_HOURS } from '$lib/thresholds';
  import { openNight } from '$lib/editor.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { openSheet } from '$lib/ui.svelte';
  import InfoButton from './InfoButton.svelte';
  import TrafficLight, { LIGHT_COLOR } from './TrafficLight.svelte';
  import { PRESSURE_DROP_HPA, weatherEmoji } from '$lib/weather';
  import { SOURCES } from '$lib/sources';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const p = $derived(
    prognosis(prognosisInput(data), clock.now)
  );

  const toggle = () => (open = !open);

  /** Tomorrow's outlook as it stands now, the same rule as the evening warning. */
  const tomorrow = $derived(tomorrowRisk(prognosisInput(data), clock.now));

  const STATUS: Record<Status, string> = { ok: 'var(--color-ok)', bad: 'var(--color-over)', unknown: 'var(--color-muted)' };

  function hydrationWhy(): string {
    const h = p.hydration;
    if (h.status === 'unknown') return t('prog.why.hydrationUnknown');
    if (h.behind) return t('prog.why.hydrationBehind', { ml: formatLiters(h.today), pace: formatLiters(h.expected * LOW_HYDRATION) });
    if (h.lowYesterday) return t('prog.why.hydrationYesterday', { ml: formatLiters(h.yesterday ?? 0), limit: formatLiters(h.goal * LOW_HYDRATION) });
    if (h.today >= h.goal) return t('prog.why.hydrationGoal');
    return t('prog.why.hydrationOk');
  }

  function sleepWhy(night: NonNullable<typeof p.sleep.night>): string {
    const values = { d: formatDuration(night.asleepMs), pct: Math.round((p.sleep.efficiency ?? 1) * 100), limit: SHORT_SLEEP_HOURS, min: Math.round(MIN_SLEEP_EFFICIENCY * 100) };
    if (p.sleep.short) return t('prog.why.sleepShort', values);
    if (p.sleep.fragmented) return t('prog.why.sleepFragmented', values);
    return t('prog.why.sleepOk', values);
  }

  function caffeineWhy(): string {
    const c = p.caffeine;
    if (c.status === 'unknown') return t('prog.why.caffeineLittle');
    const values = {
      mg: Math.round(c.today),
      byNow: Math.round(c.usualByNow ?? 0),
      yesterday: Math.round(c.yesterday),
      usual: Math.round(c.usual ?? 0)
    };
    if (c.todayLow) return t('prog.why.caffeineBadToday', values);
    if (c.yesterdayLow) return t('prog.why.caffeineBadYesterday', values);
    return t(c.tooEarly ? 'prog.why.caffeineEarly' : 'prog.why.caffeineOk', values);
  }

  /** The tip for the first unfavourable factor, in the order weather, hydration, sleep, alcohol, caffeine. */
  const tip = $derived.by(() => {
    const first = badFactors(p)[0];
    return first ? t(`prog.tip.${first}`) : t('prog.tipGood');
  });

  const tiles = $derived([
    {
      icon: '🌦️',
      label: t('prog.weather'),
      status: p.weather.status,
      value: p.weather.status === 'unknown' ? '–' : p.weather.drop >= 1 ? `−${Math.round(p.weather.drop)} hPa` : t('prog.stable'),
      onclick: toggle
    },
    {
      icon: '💧',
      label: t('prog.hydration'),
      status: p.hydration.status,
      value: p.hydration.status === 'unknown' ? '–' : `${formatLiters(p.hydration.today)}`,
      onclick: toggle
    },
    {
      icon: '😴',
      label: t('prog.sleep'),
      status: p.sleep.status,
      value: p.sleep.night ? formatDuration(p.sleep.night.asleepMs) : '–',
      onclick: () => openNight(dayKey(clock.now))
    },
    {
      icon: '🍷',
      label: t('prog.alcohol'),
      status: p.alcohol.status,
      value: p.alcohol.status === 'unknown' ? '–' : t('prog.alcoholTile', { today: p.alcohol.drinksToday }),
      onclick: toggle
    },
    {
      icon: '☕',
      label: t('prog.caffeine'),
      status: p.caffeine.status,
      value: `${Math.round(p.caffeine.today)} mg`,
      onclick: toggle
    }
  ]);

  function weatherLine(w: NonNullable<typeof p.weather.today>) {
    const drop = w.pressureDrop >= 1 ? ` (−${Math.round(w.pressureDrop)})` : '';
    return `${weatherEmoji(w.code)} ${Math.round(w.tempMin)}–${Math.round(w.tempMax)} °C · ${Math.round(w.pressure)} hPa${drop}`;
  }
</script>

{#snippet factor(status: Status, title: string, facts: string[], why: string, rule: string, sources: readonly string[], action?: () => void)}
  <div class="flex gap-3">
    <span class="mt-2 size-3 shrink-0 rounded-full" style:background-color={STATUS[status]}></span>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="font-semibold">{title}</span>
        <span class="rounded-full px-2 py-0.5 text-xs font-semibold" style:color={STATUS[status]} style:background-color="color-mix(in oklab, {STATUS[status]} 14%, transparent)">
          {t(`prog.status.${status}`)}
        </span>
        <span class="ml-auto flex">
          <InfoButton {title} text={`${t('prog.ruleLabel')} ${rule}`} {sources} />
          {#if action}
            <button class="press -my-2 grid size-11 place-items-center rounded-full text-muted" onclick={action} aria-label={title}><Pencil size={20} /></button>
          {/if}
        </span>
      </div>
      {#each facts.filter(Boolean) as fact, i (i)}<p class="text-xs text-muted tabular">{fact}</p>{/each}
      <p><span class="font-semibold">{t('prog.why')}</span> {why}</p>
    </div>
  </div>
{/snippet}

<section class="card overflow-hidden">
  <div class="flex items-start gap-1 pr-2">
    <button class="press flex min-w-0 flex-1 items-center gap-3 p-4 pr-1 pb-3 text-left" onclick={toggle} aria-expanded={open}>
      <TrafficLight light={p.light} />
      <span class="min-w-0 flex-1">
        <span class="block text-xs text-muted">{t('prog.title')}</span>
        <span class="block text-lg font-semibold" style:color={LIGHT_COLOR[p.light]}>{t(`prog.${p.light}`)}</span>
        <span class="block text-xs text-muted">{t('prog.count', { n: p.bad })}</span>
      </span>
      <ChevronDown size={22} class="shrink-0 text-muted transition-transform {open ? 'rotate-180' : ''}" />
    </button>
    <InfoButton class="mt-4" title={t('prog.title')} text={t('prog.how')} />
  </div>
  <div class="grid grid-cols-6 gap-2 px-4 pb-4">
    {#each tiles as tile, i (tile.label)}
      <button class="press flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface-2 px-2.5 py-2 text-left {i < 3 ? 'col-span-2' : 'col-span-3'}" onclick={tile.onclick}>
        <span class="flex items-center justify-between">
          <span class="text-lg leading-none">{tile.icon}</span>
          <span class="size-2.5 rounded-full" style:background-color={STATUS[tile.status]}></span>
        </span>
        <span class="truncate text-xs text-muted">{tile.label}</span>
        <span class="font-semibold whitespace-nowrap tabular">{tile.value}</span>
      </button>
    {/each}
  </div>

  <button class="press mx-4 mb-4 flex w-[calc(100%-2rem)] min-w-0 items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2 text-left text-sm" onclick={toggle}>
    <span class="size-3 shrink-0 rounded-full" style:background-color={LIGHT_COLOR[tomorrow.light]}></span>
    <span class="shrink-0 font-semibold">{t('prog.tomorrow')}</span>
    <span class="min-w-0 truncate text-muted">
      {tomorrow.factors.length ? tomorrow.factors.map((k) => t(`prog.tomorrowFactor.${k}`)).join(', ') : t('prog.tomorrowFine')}
    </span>
  </button>

  {#if open}
    <div class="flex flex-col gap-4 px-4 pb-4 text-sm">

      {@render factor(
        p.weather.status,
        t('prog.weather'),
        [
          p.weather.today ? `${t('prog.today')}: ${weatherLine(p.weather.today)}` : '',
          p.weather.tomorrow ? `${t('prog.tomorrow')}: ${weatherLine(p.weather.tomorrow)}` : ''
        ],
        p.weather.status === 'unknown'
          ? t('prog.why.weatherUnknown')
          : t(p.weather.status === 'bad' ? 'prog.why.weatherBad' : 'prog.why.weatherOk', { n: Math.round(p.weather.drop), limit: PRESSURE_DROP_HPA }),
        t('prog.rule.weather', { limit: PRESSURE_DROP_HPA }),
        SOURCES.weather,
        p.weather.status === 'unknown' ? () => openSheet('settings') : undefined
      )}

      {@render factor(
        p.hydration.status,
        t('prog.hydration'),
        [
          t('prog.hydrationToday', { ml: formatLiters(p.hydration.today), expected: formatLiters(p.hydration.expected) }),
          p.hydration.yesterday !== null ? t('prog.hydrationYesterday', { ml: formatLiters(p.hydration.yesterday), goal: formatLiters(p.hydration.goal) }) : ''
        ],
        hydrationWhy(),
        t('prog.rule.hydration', { pace: formatLiters(p.hydration.expected * LOW_HYDRATION), yesterday: formatLiters(p.hydration.goal * LOW_HYDRATION) }),
        SOURCES.hydration
      )}

      {@render factor(
        p.sleep.status,
        t('prog.sleep'),
        p.sleep.night
          ? [
              t('prog.sleepNight', { d: formatDuration(p.sleep.night.asleepMs), from: hm(p.sleep.night.start), to: hm(p.sleep.night.end) }),
              p.sleep.night.breaks.length
                ? `${t('sleep.breaks', { n: p.sleep.night.breaks.length, d: formatDuration(awakeMs(p.sleep.night)) })}: ${p.sleep.night.breaks.map((b) => `${hm(b.start)}–${hm(b.end)}`).join(', ')}`
                : '',
              p.sleep.efficiency !== null ? t('prog.sleepEfficiency', { pct: Math.round(p.sleep.efficiency * 100) }) : '',
              p.sleep.average !== null ? t('prog.sleepAvg', { d: formatDuration(p.sleep.average * HOUR) }) : ''
            ]
          : [],
        !p.sleep.night
          ? t(data.settings.sleep.enabled ? 'prog.why.sleepNone' : 'prog.why.sleepOff')
          : sleepWhy(p.sleep.night),
        t('prog.rule.sleep', { limit: SHORT_SLEEP_HOURS, pct: Math.round(MIN_SLEEP_EFFICIENCY * 100) }),
        SOURCES.sleep,
        data.settings.sleep.enabled || p.sleep.night ? () => openNight(dayKey(clock.now)) : () => openSheet('settings')
      )}

      {@render factor(
        p.alcohol.status,
        t('prog.alcohol'),
        p.alcohol.status === 'unknown' ? [] : [t('prog.alcoholDrinks', { today: p.alcohol.drinksToday, yesterday: p.alcohol.drinksYesterday })],
        p.alcohol.status === 'unknown'
          ? t('prog.why.alcoholUnknown')
          : p.alcohol.status === 'bad'
            ? t('prog.why.alcoholBad', { when: [p.alcohol.yesterday ? t('prog.yesterday') : '', p.alcohol.today ? t('prog.today') : ''].filter(Boolean).join(t('prog.and')) })
            : t('prog.why.alcoholOk'),
        t('prog.rule.alcohol'),
        SOURCES.alcohol
      )}

      {@render factor(
        p.caffeine.status,
        t('prog.caffeine'),
        p.caffeine.usual === null
          ? [t('prog.caffeineSoFar', { mg: Math.round(p.caffeine.today), yesterday: Math.round(p.caffeine.yesterday) })]
          : [
              t('prog.caffeineValue', { mg: Math.round(p.caffeine.today), byNow: Math.round(p.caffeine.usualByNow ?? 0) }),
              t('prog.caffeineYesterday', { mg: Math.round(p.caffeine.yesterday), usual: Math.round(p.caffeine.usual) })
            ],
        caffeineWhy(),
        t('prog.rule.caffeine'),
        SOURCES.caffeine
      )}

      <p class="rounded-xl bg-surface-2 p-3">💡 {tip}</p>
    </div>
  {/if}
</section>
