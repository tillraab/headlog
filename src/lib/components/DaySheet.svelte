<script lang="ts">
  import { fromPreset, hydrationMl } from '$lib/db';
  import { Droplets, Pill, Plus, Zap } from '@lucide/svelte';
  import { addDays, format, setHours } from 'date-fns';
  import { formatDuration, formatLiters, keyToDate } from '$lib/days';
  import { edit } from '$lib/editor.svelte';
  import { fmt, t, tagLabel } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { hydrationBefore } from '$lib/analysis';
  import { isPressureDrop, weatherEmoji } from '$lib/weather';
  import Sheet from './Sheet.svelte';

  let { day }: { day: string } = $props();

  const from = $derived(keyToDate(day).getTime());
  const to = $derived(addDays(keyToDate(day), 1).getTime());
  const episodes = $derived(data.episodes.filter((e) => e.start < to && (e.end ?? clock.now) >= from));
  const intakes = $derived(data.intakes.filter((i) => i.time >= from && i.time < to));
  const drinks = $derived(data.drinks.filter((d) => d.time >= from && d.time < to));
  const water = $derived(drinks.reduce((s, d) => s + hydrationMl(d), 0));
  const weather = $derived(data.weather.get(day));
  const night = $derived(data.sleep.get(day));
  const noon = $derived(Math.min(setHours(keyToDate(day), 12).getTime(), clock.now));

  function addMed() {
    const med = data.medications[0];
    if (!med) return;
    edit({ kind: 'intake', item: { time: noon, medId: med.id, name: med.name, dose: med.dose, category: med.category, relief: null } });
  }

  function addDrink() {
    const p = data.drinkPresets[0];
    if (!p) return;
    edit({ kind: 'drink', item: { time: noon, ...fromPreset(p) } });
  }
</script>

<Sheet id="day" title={fmt(keyToDate(day), 'EEEE, d. MMMM yyyy')}>
  <div class="flex flex-col gap-3">
    {#if weather}
      <p class="flex flex-wrap items-center gap-x-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm tabular">
        <span class="text-lg">{weatherEmoji(weather.code)}</span>
        <span>{Math.round(weather.tempMin)}–{Math.round(weather.tempMax)} °C</span>
        <span class="text-muted">·</span>
        <span class={isPressureDrop(weather.pressureDrop) ? 'font-semibold text-over' : ''}>
          {Math.round(weather.pressure)} hPa{weather.pressureDrop >= 1 ? ` (−${Math.round(weather.pressureDrop)})` : ''}
        </span>
        {#if weather.humidity !== null}<span class="text-muted">·</span><span>{weather.humidity} %</span>{/if}
        {#if weather.precipitation >= 0.5}<span class="text-muted">·</span><span>{weather.precipitation.toFixed(1)} mm</span>{/if}
      </p>
    {/if}

    {#if night}
      <button class="press flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2 text-left text-sm tabular" onclick={() => edit({ kind: 'sleep', item: night })}>
        <span class="text-lg">😴</span>
        <span class="font-semibold">{formatDuration(night.asleepMs)}</span>
        <span class="text-muted">{format(night.start, 'HH:mm')}–{format(night.end, 'HH:mm')}</span>
        {#if night.breaks.length}<span class="text-muted">· {t('sleep.breaks', { n: night.breaks.length, d: formatDuration(night.breaks.reduce((sum, b) => sum + b.end - b.start, 0)) })}</span>{/if}
      </button>
    {/if}

    {#if !episodes.length && !intakes.length && !drinks.length}
      <p class="text-sm text-muted">{t('day.empty')}</p>
    {/if}

    {#each episodes as ep (ep.id)}
      {@const before = hydrationBefore(data.drinks, ep.start)}
      <button class="press flex items-start gap-3 rounded-2xl bg-pain-soft p-3 text-left" onclick={() => edit({ kind: 'episode', item: ep })}>
        <span class="grid size-9 shrink-0 place-items-center rounded-full bg-pain text-white"><Zap size={18} /></span>
        <span class="flex flex-col text-sm">
          <span class="font-semibold">{t('today.headache')} · {ep.intensity}/10</span>
          <span class="text-muted tabular">
            {format(ep.start, 'HH:mm')}–{ep.end ? format(ep.end, 'HH:mm') : '…'}
            · {formatDuration((ep.end ?? clock.now) - ep.start)}
          </span>
          {#if ep.tags.length}
            <span class="text-xs text-muted">{ep.tags.map((tag) => tagLabel(tag)).join(' · ')}</span>
          {/if}
          {#if ep.note}<span class="mt-1 text-xs italic">{ep.note}</span>{/if}
          {#if before.ml || before.usual}
            <span class="mt-1 text-xs text-muted">
              💧 {t('day.hydrationBefore', { ml: formatLiters(before.ml) })}{before.usual ? ` ${t('day.hydrationUsual', { ml: formatLiters(before.usual) })}` : ''}
            </span>
          {/if}
        </span>
      </button>
    {/each}

    {#each intakes as intake (intake.id)}
      <button class="press flex items-center gap-3 rounded-2xl bg-med-soft p-3 text-left" onclick={() => edit({ kind: 'intake', item: intake })}>
        <span class="grid size-9 shrink-0 place-items-center rounded-full bg-med text-white"><Pill size={18} /></span>
        <span class="flex-1 text-sm"><span class="font-semibold">{intake.name}</span> {intake.dose}</span>
        <span class="text-sm text-muted tabular">{format(intake.time, 'HH:mm')}</span>
      </button>
    {/each}

    {#if drinks.length}
      <div class="flex flex-col gap-2 rounded-2xl bg-water-soft p-3">
        <div class="flex items-center gap-2 text-sm font-semibold"><Droplets size={16} class="text-water" /> {formatLiters(water)}</div>
        <div class="flex flex-wrap gap-1.5">
          {#each drinks as drink (drink.id)}
            <button class="press rounded-full bg-surface px-2.5 py-1 text-xs tabular" onclick={() => edit({ kind: 'drink', item: drink })}>
              {drink.emoji} {format(drink.time, 'HH:mm')}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="flex flex-wrap gap-2 pt-1">
      <button
        class="press flex items-center gap-1 rounded-full bg-surface-2 px-3 py-2 text-sm font-medium"
        onclick={() => edit({ kind: 'episode', item: { start: setHours(keyToDate(day), 9).getTime(), end: setHours(keyToDate(day), 12).getTime(), intensity: 5, tags: [], note: '' } })}
      >
        <Plus size={16} />{t('day.addHeadache')}
      </button>
      <button class="press flex items-center gap-1 rounded-full bg-surface-2 px-3 py-2 text-sm font-medium" onclick={addMed}><Plus size={16} />{t('day.addMed')}</button>
      <button class="press flex items-center gap-1 rounded-full bg-surface-2 px-3 py-2 text-sm font-medium" onclick={addDrink}><Plus size={16} />{t('day.addDrink')}</button>
    </div>
  </div>
</Sheet>
