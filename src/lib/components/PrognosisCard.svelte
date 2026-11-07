<script lang="ts">
  import { ChevronDown, Pencil } from '@lucide/svelte';
  import { dayKey, formatDuration, formatLiters, hm, HOUR } from '$lib/days';
  import { t } from '$lib/i18n.svelte';
  import { awakeMs } from '$lib/sleep';
  import { badFactors, prognosis, prognosisInput, type Status } from '$lib/prognosis';
  import { CAFFEINE_DROP, LOW_HYDRATION, SHORT_SLEEP_HOURS } from '$lib/thresholds';
  import { clock, data, openNight } from '$lib/store.svelte';
  import { openSheet } from '$lib/ui.svelte';
  import TrafficLight, { LIGHT_COLOR } from './TrafficLight.svelte';
  import { PRESSURE_DROP_HPA, weatherEmoji } from '$lib/weather';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const p = $derived(
    prognosis(prognosisInput(data), clock.now)
  );

  const toggle = () => (open = !open);

  const STATUS: Record<Status, string> = { ok: 'var(--color-ok)', bad: 'var(--color-over)', unknown: 'var(--color-muted)' };

  function hydrationWhy(): string {
    const h = p.hydration;
    if (h.status === 'unknown') return t('prog.why.hydrationUnknown');
    if (h.behind) return t('prog.why.hydrationBehind', { ml: formatLiters(h.today), pace: formatLiters(h.expected * LOW_HYDRATION) });
    if (h.lowYesterday) return t('prog.why.hydrationYesterday', { ml: formatLiters(h.yesterday ?? 0), limit: formatLiters(h.goal * LOW_HYDRATION) });
    if (h.today >= h.goal) return t('prog.why.hydrationGoal');
    return t('prog.why.hydrationOk');
  }

  function caffeineWhy(): string {
    const c = p.caffeine;
    if (c.tooEarly) return t('prog.why.caffeineEarly');
    if (c.status === 'unknown') return t('prog.why.caffeineLittle');
    const values = { mg: Math.round(c.today), half: Math.round((c.usual ?? 0) * CAFFEINE_DROP) };
    return t(c.status === 'bad' ? 'prog.why.caffeineBad' : 'prog.why.caffeineOk', values);
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
    }
  ]);

  function weatherLine(w: NonNullable<typeof p.weather.today>) {
    const drop = w.pressureDrop >= 1 ? ` (−${Math.round(w.pressureDrop)})` : '';
    return `${weatherEmoji(w.code)} ${Math.round(w.tempMin)}–${Math.round(w.tempMax)} °C · ${Math.round(w.pressure)} hPa${drop}`;
  }
</script>

{#snippet factor(status: Status, title: string, facts: string[], why: string, rule: string, action?: () => void)}
  <div class="flex gap-2.5">
    <span class="mt-1 size-2.5 shrink-0 rounded-full" style:background-color={STATUS[status]}></span>
    <div class="flex flex-1 flex-col gap-0.5">
      <p class="flex items-center gap-2">
        <span class="font-medium">{title}</span>
        <span class="rounded-full px-2 py-0.5 text-2xs font-semibold" style:color={STATUS[status]} style:background-color="color-mix(in oklab, {STATUS[status]} 14%, transparent)">
          {t(`prog.status.${status}`)}
        </span>
        {#if action}
          <button class="press ml-auto grid size-6 place-items-center rounded-full text-muted" onclick={action} aria-label={title}><Pencil size={12} /></button>
        {/if}
      </p>
      {#each facts.filter(Boolean) as fact, i (i)}<p class="text-xs text-muted tabular">{fact}</p>{/each}
      <p class="text-xs"><span class="font-semibold">{t('prog.why')}</span> {why}</p>
      <p class="text-2xs text-muted">{t('prog.ruleLabel')} {rule}</p>
    </div>
  </div>
{/snippet}

<section class="card overflow-hidden">
  <button class="press flex w-full flex-col gap-3 p-4 pb-3 text-left" onclick={toggle} aria-expanded={open}>
    <div class="flex items-center gap-3">
      <TrafficLight light={p.light} />
      <span class="flex-1">
        <span class="block text-xs text-muted">{t('prog.title')}</span>
        <span class="block font-semibold" style:color={LIGHT_COLOR[p.light]}>{t(`prog.${p.light}`)}</span>
        <span class="block text-xs text-muted">{t('prog.count', { n: p.bad })}</span>
      </span>
      <ChevronDown size={18} class="shrink-0 text-muted transition-transform {open ? 'rotate-180' : ''}" />
    </div>
  </button>
  <div class="grid grid-cols-3 gap-2 px-4 pb-4">
    {#each tiles as tile (tile.label)}
      <button class="press flex flex-col gap-0.5 rounded-xl bg-surface-2 px-2.5 py-2 text-left" onclick={tile.onclick}>
        <span class="flex items-center gap-1.5 text-xs text-muted">
          <span class="size-2 rounded-full" style:background-color={STATUS[tile.status]}></span>
          {tile.icon} {tile.label}
        </span>
        <span class="text-sm font-semibold tabular">{tile.value}</span>
      </button>
    {/each}
  </div>

  {#if open}
    <div class="flex flex-col gap-3 px-4 pb-4 text-sm">
      <p class="rounded-xl bg-surface-2 p-3 text-xs text-muted">{t('prog.how')}</p>

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
        t('prog.rule.hydration', { pace: formatLiters(p.hydration.expected * LOW_HYDRATION), yesterday: formatLiters(p.hydration.goal * LOW_HYDRATION) })
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
              p.sleep.average !== null ? t('prog.sleepAvg', { d: formatDuration(p.sleep.average * HOUR) }) : ''
            ]
          : [],
        !p.sleep.night
          ? t(data.settings.sleep.enabled ? 'prog.why.sleepNone' : 'prog.why.sleepOff')
          : t(p.sleep.status === 'bad' ? 'prog.why.sleepBad' : 'prog.why.sleepOk', { d: formatDuration(p.sleep.night.asleepMs), limit: SHORT_SLEEP_HOURS }),
        t('prog.rule.sleep', { limit: SHORT_SLEEP_HOURS }),
        data.settings.sleep.enabled || p.sleep.night ? () => openNight(dayKey(clock.now)) : () => openSheet('settings')
      )}

      {#if p.alcohol.status !== 'unknown'}
        {@render factor(
          p.alcohol.status,
          t('prog.alcohol'),
          [],
          p.alcohol.status === 'bad'
            ? t('prog.why.alcoholBad', { when: [p.alcohol.yesterday ? t('prog.yesterday') : '', p.alcohol.today ? t('prog.today') : ''].filter(Boolean).join(t('prog.and')) })
            : t('prog.why.alcoholOk'),
          t('prog.rule.alcohol')
        )}
      {/if}

      {#if p.caffeine.usual !== null}
        {@render factor(
          p.caffeine.status,
          t('prog.caffeine'),
          [t('prog.caffeineValue', { mg: Math.round(p.caffeine.today), usual: Math.round(p.caffeine.usual) })],
          caffeineWhy(),
          t('prog.rule.caffeine', { half: Math.round(p.caffeine.usual * CAFFEINE_DROP) })
        )}
      {/if}

      <p class="text-xs text-muted">💡 {tip}</p>
    </div>
  {/if}
</section>
