<script lang="ts">
  import { FACTOR_COLOR } from '$lib/colors';
  import { fromPreset } from '$lib/drinks';
  import { fromMedication, isAcute } from '$lib/medication';
  import { ChevronRight, Plus } from '@lucide/svelte';
  import { addDays, endOfDay, setHours } from 'date-fns';
  import { formatDuration, formatLiters, hm, keyToDate } from '$lib/days';
  import { edit, openNight } from '$lib/editor.svelte';
  import { fmt, t } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { hydrationBefore } from '$lib/analysis';
  import { factorIcon, prognosis, prognosisInput } from '$lib/prognosis';
  import { dayView, openFactor, openSheet, stepDay, tap } from '$lib/ui.svelte';
  import { swipeStep } from '$lib/swipe';
  import { fly } from 'svelte/transition';
  import { dayKey } from '$lib/days';
  import { weatherEmoji } from '$lib/weather';
  import EntryRow from './EntryRow.svelte';
  import PrevNextButtons from './PrevNextButtons.svelte';
  import SectionLabel from './SectionLabel.svelte';
  import Sheet from './Sheet.svelte';

  let { day }: { day: string } = $props();

  const from = $derived(keyToDate(day).getTime());
  const to = $derived(addDays(keyToDate(day), 1).getTime());
  const episodes = $derived(data.episodes.filter((e) => e.start < to && (e.end ?? clock.now) >= from));
  const intakes = $derived(data.intakes.filter((i) => i.time >= from && i.time < to));
  const drinks = $derived(data.drinks.filter((d) => d.time >= from && d.time < to));
  /** Headaches, medication and drinks of the day, latest first, going back to the morning. */
  const entries = $derived(
    [
      ...episodes.map((e) => ({ time: e.start, kind: 'episode' as const, item: e })),
      ...intakes.map((i) => ({ time: i.time, kind: 'intake' as const, item: i })),
      ...drinks.map((d) => ({ time: d.time, kind: 'drink' as const, item: d }))
    ].sort((a, b) => b.time - a.time)
  );
  /** The forecast factors as they stood at the end of the day, or now for today. */
  const p = $derived(prognosis(prognosisInput(data), day < dayKey(clock.now) ? endOfDay(keyToDate(day)).getTime() : clock.now));
  const weather = $derived(data.weather.get(day));
  const night = $derived(data.sleep.get(day));
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
      open: () => (night ? edit({ kind: 'sleep', item: night }) : openNight(day, true))
    },
    { icon: factorIcon('hydration'), label: t('prog.hydration'), status: p.hydration.status, value: formatLiters(p.hydration.today), open: () => openFactor('hydration', day) },
    { icon: factorIcon('caffeine'), label: t('prog.caffeine'), status: p.caffeine.status, value: `${Math.round(p.caffeine.today)} mg`, open: () => openFactor('caffeine', day) },
    { icon: factorIcon('alcohol'), label: t('prog.alcohol'), status: p.alcohol.status, value: String(p.alcohol.drinksToday), open: () => openFactor('alcohol', day) }
  ]);
  const noon = $derived(Math.min(setHours(keyToDate(day), 12).getTime(), clock.now));

  /** A new headache on this day, from 9:00 to 12:00; today it ends now at the latest. */
  function addHeadache() {
    const start = Math.min(setHours(keyToDate(day), 9).getTime(), clock.now);
    edit({ kind: 'episode', item: { start, end: Math.min(setHours(keyToDate(day), 12).getTime(), clock.now), intensity: 5, tags: [], note: '' } });
  }

  function addMed() {
    const med = data.medications[0];
    if (!med) return openSheet('medList');
    edit({ kind: 'intake', item: { time: noon, ...fromMedication(med), relief: null } });
  }

  const today = $derived(dayKey(clock.now));
  /** The day the sheet last stepped to and in which direction, so only a step slides the content in. */
  let stepped = $state({ day: '', delta: 0 });

  let content = $state<HTMLElement>();

  /** Shows the day `delta` days away, from its top. */
  function step(delta: number) {
    if (!stepDay(day, delta, today)) return;
    stepped = { day: dayView.day, delta };
    content?.parentElement?.scrollTo({ top: 0 });
    tap();
  }

  let touchStart: { x: number; y: number } | null = null;

  function ontouchstart(e: TouchEvent) {
    touchStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }

  function ontouchend(e: TouchEvent) {
    if (!touchStart) return;
    const touch = e.changedTouches[0];
    const delta = swipeStep(touch.clientX - touchStart.x, touch.clientY - touchStart.y);
    touchStart = null;
    if (delta) step(delta);
  }

  function addDrink() {
    const p = data.drinkPresets[0];
    if (!p) return openSheet('drinkList');
    edit({ kind: 'drink', item: { time: noon, ...fromPreset(p) } });
  }
</script>

<Sheet id="day" title={fmt(keyToDate(day), 'EEE, d. MMM yyyy')}>
  {#snippet actions()}
    <PrevNextButtons prevLabel={t('a11y.prevDay')} nextLabel={t('a11y.nextDay')} onprev={() => step(-1)} onnext={() => step(1)} nextDisabled={day >= today} />
  {/snippet}
  {#key day}
    <div
      class="flex flex-col gap-3"
      role="group"
      bind:this={content}
      in:fly={{ x: stepped.day === day ? 48 * stepped.delta : 0, duration: stepped.day === day ? 180 : 0 }}
      {ontouchstart}
      {ontouchend}
      ontouchcancel={() => (touchStart = null)}
    >
      <SectionLabel>{t('day.factors')}</SectionLabel>
      <div class="flex flex-col overflow-hidden rounded-2xl bg-surface">
        {#each factors as f (f.label)}
          <button class="press flex min-h-12 items-center gap-3 border-b border-line px-3 py-2 text-left last:border-b-0" onclick={f.open}>
            <span class="text-xl leading-none">{f.icon}</span>
            <span class="flex-1 font-medium">{f.label}</span>
            <span class="min-w-0 truncate text-muted tabular">{f.value}</span>
            <span class="size-2.5 shrink-0 rounded-full" style:background-color={FACTOR_COLOR[f.status]}></span>
            <ChevronRight size={18} class="shrink-0 text-muted" />
          </button>
        {/each}
      </div>

      <SectionLabel class="mt-2">{t('day.entries')}</SectionLabel>
      <div class="flex flex-wrap gap-2">
        <button
          class="press flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 font-medium"
          onclick={addHeadache}
        >
          <Plus size={20} />{t('day.addHeadache')}
        </button>
        <button class="press flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 font-medium" onclick={addMed}><Plus size={20} />{t('day.addMed')}</button>
        <button class="press flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 font-medium" onclick={addDrink}><Plus size={20} />{t('day.addDrink')}</button>
      </div>
      {#if !entries.length}
        <p class="text-muted">{t('day.empty')}</p>
      {/if}

      {#each entries as entry (entry.kind + entry.item.id)}
        {#if entry.kind === 'episode'}
          {@const ep = entry.item}
          {@const before = hydrationBefore(data.drinks, ep.start)}
          <EntryRow
            kind="episode"
            lead={hm(ep.start)}
            title={`${t('today.headache')} · ${ep.intensity}/10`}
            lines={[
              `${hm(ep.start)}–${ep.end ? hm(ep.end) : '…'} · ${formatDuration((ep.end ?? clock.now) - ep.start)}`,
              ep.tags.join(' · '),
              ep.note,
              before.ml || before.usual
                ? `💧 ${t('day.hydrationBefore', { ml: formatLiters(before.ml) })}${before.usual ? ` ${t('day.hydrationUsual', { ml: formatLiters(before.usual) })}` : ''}`
                : ''
            ].filter(Boolean)}
            onclick={() => edit({ kind: 'episode', item: ep })}
          />
        {:else if entry.kind === 'intake'}
          {@const intake = entry.item}
          <EntryRow
            kind="intake"
            lead={hm(intake.time)}
            title={intake.name}
            sub={intake.dose}
            lines={[isAcute(intake.category) ? t('grid.counts') : t('grid.notCounted')]}
            onclick={() => edit({ kind: 'intake', item: intake })}
          />
        {:else}
          <EntryRow kind="drink" lead={hm(entry.item.time)} title={entry.item.name} sub={`${entry.item.ml} ml`} emoji={entry.item.emoji} onclick={() => edit({ kind: 'drink', item: entry.item })} />
        {/if}
      {/each}
    </div>
  {/key}
</Sheet>
