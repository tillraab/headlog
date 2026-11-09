<script lang="ts">
  import { dayKey, formatDuration, formatLiters } from '$lib/days';
  import { t } from '$lib/i18n.svelte';
  import { prognosis, prognosisInput, tomorrowRisk, type Status } from '$lib/prognosis';
  import { openNight } from '$lib/editor.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { openFactor } from '$lib/ui.svelte';
  import InfoButton from './InfoButton.svelte';
  import TrafficLight, { LIGHT_COLOR } from './TrafficLight.svelte';

  const p = $derived(prognosis(prognosisInput(data), clock.now));

  /** Tomorrow's outlook as it stands now, the same rule as the evening warning. */
  const tomorrow = $derived(tomorrowRisk(prognosisInput(data), clock.now));

  const STATUS: Record<Status, string> = { ok: 'var(--color-ok)', bad: 'var(--color-over)', unknown: 'var(--color-muted)' };

  const tiles = $derived([
    {
      icon: '🌦️',
      label: t('prog.weather'),
      status: p.weather.status,
      value: p.weather.status === 'unknown' ? '–' : p.weather.drop >= 1 ? `−${Math.round(p.weather.drop)} hPa` : t('prog.stable'),
      onclick: () => openFactor('weather')
    },
    {
      icon: '💧',
      label: t('prog.hydration'),
      status: p.hydration.status,
      value: p.hydration.status === 'unknown' ? '–' : `${formatLiters(p.hydration.today)}`,
      onclick: () => openFactor('hydration')
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
      onclick: () => openFactor('alcohol')
    },
    {
      icon: '☕',
      label: t('prog.caffeine'),
      status: p.caffeine.status,
      value: `${Math.round(p.caffeine.today)} mg`,
      onclick: () => openFactor('caffeine')
    }
  ]);
</script>

<section class="card overflow-hidden">
  <div class="flex items-start gap-1 pr-2">
    <div class="flex min-w-0 flex-1 items-center gap-3 p-4 pr-1 pb-3">
      <TrafficLight light={p.light} />
      <span class="min-w-0 flex-1">
        <span class="block text-xs text-muted">{t('prog.title')}</span>
        <span class="block text-lg font-semibold" style:color={LIGHT_COLOR[p.light]}>{t(`prog.${p.light}`)}</span>
        <span class="block text-xs text-muted">{t('prog.count', { n: p.bad })}</span>
      </span>
    </div>
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

  <button class="press mx-4 mb-4 flex w-[calc(100%-2rem)] min-w-0 items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2 text-left text-sm" onclick={() => openFactor('tomorrow')}>
    <span class="size-3 shrink-0 rounded-full" style:background-color={LIGHT_COLOR[tomorrow.light]}></span>
    <span class="shrink-0 font-semibold">{t('prog.tomorrow')}</span>
    <span class="min-w-0 truncate" style:color={tomorrow.light === 'green' ? undefined : LIGHT_COLOR[tomorrow.light]}>{t(`prog.tomorrowLight.${tomorrow.light}`)}</span>
  </button>
</section>
