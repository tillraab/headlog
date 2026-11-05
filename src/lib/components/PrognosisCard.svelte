<script lang="ts">
  import { ChevronDown, Pencil } from '@lucide/svelte';
  import { format } from 'date-fns';
  import { formatDuration, formatLiters } from '$lib/days';
  import { edit } from '$lib/editor.svelte';
  import { t } from '$lib/i18n.svelte';
  import { badFactors, prognosis, type Status } from '$lib/prognosis';
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

{#snippet dot(status: Status)}
  <span class="mt-1.5 size-2.5 shrink-0 rounded-full" style:background-color={STATUS[status]}></span>
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
      <div class="flex gap-2">
        {@render dot(p.weather.status)}
        <div class="flex-1">
          <p class="font-medium">{t('prog.weather')}</p>
          {#if p.weather.status === 'unknown'}
            <button class="text-xs text-primary underline underline-offset-4" onclick={() => openSheet('settings')}>{t('prog.noWeather')}</button>
          {:else}
            {#if p.weather.today}<p class="text-xs text-muted tabular">{t('prog.today')}: {weatherLine(p.weather.today)}</p>{/if}
            {#if p.weather.tomorrow}<p class="text-xs text-muted tabular">{t('prog.tomorrow')}: {weatherLine(p.weather.tomorrow)}</p>{/if}
          {/if}
        </div>
      </div>

      <div class="flex gap-2">
        {@render dot(p.hydration.status)}
        <div class="flex-1">
          <p class="font-medium">{t('prog.hydration')}</p>
          <p class="text-xs text-muted tabular">{t('prog.hydrationToday', { ml: formatLiters(p.hydration.today), expected: formatLiters(p.hydration.expected) })}</p>
          {#if p.hydration.yesterday !== null}
            <p class="text-xs text-muted tabular">{t('prog.hydrationYesterday', { ml: formatLiters(p.hydration.yesterday), goal: formatLiters(p.hydration.goal) })}</p>
          {/if}
        </div>
      </div>

      <div class="flex gap-2">
        {@render dot(p.sleep.status)}
        <div class="flex-1">
          <p class="font-medium">{t('prog.sleep')}</p>
          {#if p.sleep.night}
            {@const night = p.sleep.night}
            <p class="flex items-center gap-2 text-xs text-muted tabular">
              {t('prog.sleepNight', { d: formatDuration(night.asleepMs), from: hm(night.start), to: hm(night.end) })}
              <button class="press grid size-6 place-items-center rounded-full" onclick={() => edit({ kind: 'sleep', item: night })} aria-label={t('sleep.title')}>
                <Pencil size={12} />
              </button>
            </p>
            {#if night.breaks.length}
              <p class="text-xs text-muted tabular">
                {t('sleep.breaks', { n: night.breaks.length, d: formatDuration(night.breaks.reduce((s, b) => s + b.end - b.start, 0)) })}:
                {night.breaks.map((b) => `${hm(b.start)}–${hm(b.end)}`).join(', ')}
              </p>
            {/if}
            {#if p.sleep.average !== null}<p class="text-xs text-muted tabular">{t('prog.sleepAvg', { d: formatDuration(p.sleep.average * 3600000) })}</p>{/if}
          {:else}
            <button class="text-xs text-primary underline underline-offset-4" onclick={() => openSheet('settings')}>{t('prog.noSleep')}</button>
          {/if}
        </div>
      </div>

      {#if p.alcohol.status !== 'unknown'}
        <div class="flex gap-2">
          {@render dot(p.alcohol.status)}
          <div class="flex-1">
            <p class="font-medium">{t('drink.alcohol')}</p>
            <p class="text-xs text-muted">
              {p.alcohol.yesterday || p.alcohol.today
                ? [p.alcohol.yesterday ? t('prog.yesterday') : '', p.alcohol.today ? t('prog.today') : ''].filter(Boolean).join(', ')
                : t('prog.alcoholNone')}
            </p>
          </div>
        </div>
      {/if}

      {#if p.caffeine.usual !== null}
        <div class="flex gap-2">
          {@render dot(p.caffeine.status)}
          <div class="flex-1">
            <p class="font-medium">{t('prog.caffeine')}</p>
            <p class="text-xs text-muted tabular">{t('prog.caffeineValue', { mg: Math.round(p.caffeine.today), usual: Math.round(p.caffeine.usual) })}</p>
          </div>
        </div>
      {/if}

      <p class="text-xs text-muted">💡 {tip}</p>
    </div>
  {/if}
</section>
