<script lang="ts">
  import { intakeColor } from '$lib/colors';
  import { fromPreset } from '$lib/drinks';
  import { ACUTE_CATEGORIES, fromMedication } from '$lib/medication';
  import { ChevronRight, Pill, Plus, Zap } from '@lucide/svelte';
  import { addDays, endOfDay, setHours } from 'date-fns';
  import { formatDuration, formatLiters, hm, keyToDate } from '$lib/days';
  import { edit } from '$lib/editor.svelte';
  import { fmt, t, tagLabel } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { hydrationBefore } from '$lib/analysis';
  import { factorIcon, prognosis, prognosisInput, type Status } from '$lib/prognosis';
  import { openFactor } from '$lib/ui.svelte';
  import { dayKey } from '$lib/days';
  import { weatherEmoji } from '$lib/weather';
  import Sheet from './Sheet.svelte';

  let { day }: { day: string } = $props();

  const from = $derived(keyToDate(day).getTime());
  const to = $derived(addDays(keyToDate(day), 1).getTime());
  const episodes = $derived(data.episodes.filter((e) => e.start < to && (e.end ?? clock.now) >= from));
  const intakes = $derived(data.intakes.filter((i) => i.time >= from && i.time < to));
  /** Headaches and medication of the day in time order. */
  const entries = $derived(
    [...episodes.map((e) => ({ time: e.start, kind: 'episode' as const, item: e })), ...intakes.map((i) => ({ time: i.time, kind: 'intake' as const, item: i }))].sort((a, b) => a.time - b.time)
  );
  /** The forecast factors as they stood at the end of the day, or now for today. */
  const p = $derived(prognosis(prognosisInput(data), day < dayKey(clock.now) ? endOfDay(keyToDate(day)).getTime() : clock.now));
  const weather = $derived(data.weather.get(day));
  const night = $derived(data.sleep.get(day));
  const STATUS: Record<Status, string> = { ok: 'var(--color-ok)', bad: 'var(--color-over)', unknown: 'var(--color-muted)' };
  const factors = $derived([
    {
      icon: factorIcon('weather'),
      label: t('prog.weather'),
      status: p.weather.status,
      value: weather ? `${weatherEmoji(weather.code)} ${Math.round(weather.tempMin)}–${Math.round(weather.tempMax)} °C · ${Math.round(weather.pressure)} hPa` : '–',
      open: () => openFactor('weather', day)
    },
    {
      icon: factorIcon('sleep'),
      label: t('prog.sleep'),
      status: p.sleep.status,
      value: night ? `${formatDuration(night.asleepMs)} · ${hm(night.start)}–${hm(night.end)}` : '–',
      open: () => (night ? edit({ kind: 'sleep', item: night }) : undefined)
    },
    { icon: factorIcon('hydration'), label: t('prog.hydration'), status: p.hydration.status, value: formatLiters(p.hydration.today), open: () => openFactor('hydration', day) },
    { icon: factorIcon('caffeine'), label: t('prog.caffeine'), status: p.caffeine.status, value: `${Math.round(p.caffeine.today)} mg`, open: () => openFactor('caffeine', day) },
    { icon: factorIcon('alcohol'), label: t('prog.alcohol'), status: p.alcohol.status, value: String(p.alcohol.drinksToday), open: () => openFactor('alcohol', day) }
  ]);
  const noon = $derived(Math.min(setHours(keyToDate(day), 12).getTime(), clock.now));

  function addMed() {
    const med = data.medications[0];
    if (!med) return;
    edit({ kind: 'intake', item: { time: noon, ...fromMedication(med), relief: null } });
  }

  function addDrink() {
    const p = data.drinkPresets[0];
    if (!p) return;
    edit({ kind: 'drink', item: { time: noon, ...fromPreset(p) } });
  }
</script>

<Sheet id="day" title={fmt(keyToDate(day), 'EEEE, d. MMMM yyyy')}>
  <div class="flex flex-col gap-3">
    {#if !entries.length}
      <p class="text-muted">{t('day.empty')}</p>
    {/if}

    {#each entries as entry (entry.kind + entry.item.id)}
      {#if entry.kind === 'episode'}
        {@const ep = entry.item}
        {@const before = hydrationBefore(data.drinks, ep.start)}
        <button class="press flex items-start gap-3 rounded-2xl bg-pain-soft p-3 text-left" onclick={() => edit({ kind: 'episode', item: ep })}>
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-pain text-white"><Zap size={20} /></span>
          <span class="flex min-w-0 flex-col">
            <span class="font-semibold">{t('today.headache')} · {ep.intensity}/10</span>
            <span class="text-muted tabular">
              {hm(ep.start)}–{ep.end ? hm(ep.end) : '…'}
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
      {:else}
        {@const intake = entry.item}
        <button class="press flex items-center gap-3 rounded-2xl bg-med-soft p-3 text-left" onclick={() => edit({ kind: 'intake', item: intake })}>
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-med text-white"><Pill size={20} /></span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span><span class="font-semibold">{intake.name}</span> {intake.dose}</span>
            <span class="flex items-center gap-1.5 text-xs text-muted">
              <span class="size-2.5 rounded-full" style:background-color={intakeColor(intake, data.medications)}></span>
              {ACUTE_CATEGORIES.includes(intake.category) ? t('grid.counts') : t('grid.notCounted')}
            </span>
          </span>
          <span class="text-muted tabular">{hm(intake.time)}</span>
        </button>
      {/if}
    {/each}

    <div class="flex flex-wrap gap-2">
      <button
        class="press flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 font-medium"
        onclick={() => edit({ kind: 'episode', item: { start: setHours(keyToDate(day), 9).getTime(), end: setHours(keyToDate(day), 12).getTime(), intensity: 5, tags: [], note: '' } })}
      >
        <Plus size={20} />{t('day.addHeadache')}
      </button>
      <button class="press flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 font-medium" onclick={addMed}><Plus size={20} />{t('day.addMed')}</button>
      <button class="press flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 font-medium" onclick={addDrink}><Plus size={20} />{t('day.addDrink')}</button>
    </div>

    <h3 class="mt-2 text-sm font-semibold tracking-wide text-muted uppercase">{t('day.factors')}</h3>
    <div class="flex flex-col overflow-hidden rounded-2xl bg-surface">
      {#each factors as f (f.label)}
        <button class="press flex min-h-12 items-center gap-3 border-b border-line px-3 py-2 text-left last:border-b-0" onclick={f.open}>
          <span class="text-xl leading-none">{f.icon}</span>
          <span class="flex-1 font-medium">{f.label}</span>
          <span class="min-w-0 truncate text-muted tabular">{f.value}</span>
          <span class="size-2.5 shrink-0 rounded-full" style:background-color={STATUS[f.status]}></span>
          <ChevronRight size={18} class="shrink-0 text-muted" />
        </button>
      {/each}
    </div>
  </div>
</Sheet>
