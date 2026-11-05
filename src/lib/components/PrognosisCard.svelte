<script lang="ts">
  import { ChevronDown, Pencil } from '@lucide/svelte';
  import { format } from 'date-fns';
  import { formatDuration, formatLiters } from '$lib/days';
  import { edit } from '$lib/editor.svelte';
  import { t } from '$lib/i18n.svelte';
  import { badFactors, CAFFEINE_DROP, LOW_HYDRATION, prognosis, SHORT_SLEEP_HOURS, type Status } from '$lib/prognosis';
  import { clock, data } from '$lib/store.svelte';
  import { openSheet } from '$lib/ui.svelte';
  import { PRESSURE_DROP_HPA, weatherEmoji } from '$lib/weather';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const p = $derived(
    prognosis({ drinks: data.drinks, sleep: data.sleep, weather: data.weather, goalMl: data.settings.waterGoalMl, dropHpa: PRESSURE_DROP_HPA }, clock.now)
  );

  const LIGHT = { green: 'var(--color-ok)', yellow: 'var(--color-caution)', red: 'var(--color-over)' };
  const STATUS: Record<Status, string> = { ok: 'var(--color-ok)', bad: 'var(--color-over)', unknown: 'var(--color-muted)' };
  const hm = (time: number) => format(time, 'HH:mm');

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
      value: p.weather.status === 'unknown' ? '–' : p.weather.drop >= 1 ? `−${Math.round(p.weather.drop)} hPa` : t('prog.stable')
    },
    {
      icon: '💧',
      label: t('prog.hydration'),
      status: p.hydration.status,
      value: p.hydration.status === 'unknown' ? '–' : `${formatLiters(p.hydration.today)}`
    },
    {
      icon: '😴',
      label: t('prog.sleep'),
      status: p.sleep.status,
      value: p.sleep.night ? formatDuration(p.sleep.night.asleepMs) : '–'
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
  <button class="press flex w-full flex-col gap-3 p-4 text-left" onclick={() => (open = !open)} aria-expanded={open}>
    <div class="flex items-center gap-3">
      <span class="flex flex-col gap-1 rounded-full bg-fg p-1.5" aria-hidden="true">
        {#each ['red', 'yellow', 'green'] as const as light (light)}
          <span class="size-3 rounded-full" style:background-color={p.light === light ? LIGHT[light] : 'color-mix(in oklab, var(--color-bg) 25%, transparent)'}></span>
        {/each}
      </span>
      <span class="flex-1">
        <span class="block text-xs text-muted">{t('prog.title')}</span>
        <span class="block font-semibold" style:color={LIGHT[p.light]}>{t(`prog.${p.light}`)}</span>
        <span class="block text-xs text-muted">{t('prog.count', { n: p.bad })}</span>
      </span>
      <ChevronDown size={18} class="shrink-0 text-muted transition-transform {open ? 'rotate-180' : ''}" />
    </div>
    <div class="grid grid-cols-3 gap-2">
      {#each tiles as tile (tile.label)}
        <div class="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-2.5 py-2">
          <span class="flex items-center gap-1.5 text-xs text-muted">
            <span class="size-2 rounded-full" style:background-color={STATUS[tile.status]}></span>
            {tile.icon} {tile.label}
          </span>
          <span class="text-sm font-semibold tabular">{tile.value}</span>
        </div>
      {/each}
    </div>
  </button>

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
                ? `${t('sleep.breaks', { n: p.sleep.night.breaks.length, d: formatDuration(p.sleep.night.breaks.reduce((sum, b) => sum + b.end - b.start, 0)) })}: ${p.sleep.night.breaks.map((b) => `${hm(b.start)}–${hm(b.end)}`).join(', ')}`
                : '',
              p.sleep.average !== null ? t('prog.sleepAvg', { d: formatDuration(p.sleep.average * 3600000) }) : ''
            ]
          : [],
        !p.sleep.night
          ? t(data.settings.sleep.enabled ? 'prog.why.sleepNone' : 'prog.why.sleepOff')
          : t(p.sleep.status === 'bad' ? 'prog.why.sleepBad' : 'prog.why.sleepOk', { d: formatDuration(p.sleep.night.asleepMs), limit: SHORT_SLEEP_HOURS }),
        t('prog.rule.sleep', { limit: SHORT_SLEEP_HOURS }),
        p.sleep.night ? () => edit({ kind: 'sleep', item: p.sleep.night! }) : data.settings.sleep.enabled ? undefined : () => openSheet('settings')
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
