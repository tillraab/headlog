<script lang="ts">
  import { RELIEFS } from '$lib/db';
  import { hydrationMl } from '$lib/drinks';
  import { Droplets, Pencil, Pill, Zap } from '@lucide/svelte';
  import { isToday, startOfDay } from 'date-fns';
  import { hydrationStreak, intakeDays, medicationLimits, periodStats, tenTwenty, waterOn } from '$lib/analysis';
  import { DAY, formatDuration, formatLiters, hm, HOUR, MINUTE } from '$lib/days';
  import { edit } from '$lib/editor.svelte';
  import { fmt, reliefLabels, t } from '$lib/i18n.svelte';
  import { clock, data, logDrink, logIntake, ongoingEpisode, remove, saveEpisode, saveIntake, startHeadache, type EntryTable } from '$lib/store.svelte';
  import { celebrate, home, openSheet, tap, toast } from '$lib/ui.svelte';
  import { prognosis, prognosisInput } from '$lib/prognosis';
  import PrognosisCard from './PrognosisCard.svelte';
  import { LIGHT_COLOR } from './TrafficLight.svelte';
  import WelcomeCard from './WelcomeCard.svelte';
  import IntensityPicker from './IntensityPicker.svelte';
  import RuleBadge from './RuleBadge.svelte';
  import SleepCard from './SleepCard.svelte';

  let { onOpenTab }: { onOpenTab: (tab: 'meds') => void } = $props();

  /** Today asks "did it help?" for an unrated intake up to this long after it. */
  const RELIEF_ASK_WINDOW = 12 * HOUR;
  /** An ongoing headache longer than this asks whether it has ended. */
  const LONG_HEADACHE = DAY;

  const ongoing = $derived(ongoingEpisode());
  const forecast = $derived(
    prognosis(prognosisInput(data), clock.now)
  );
  let forecastOpen = $state(false);
  $effect(() => {
    if (home.resets) forecastOpen = false;
  });
  let forecastCard = $state<HTMLDivElement>();

  /** Opens the forecast and scrolls to it, from the marker at the top. */
  function showForecast() {
    forecastOpen = true;
    requestAnimationFrame(() => forecastCard?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  const dayStart = $derived(startOfDay(clock.now).getTime());
  const rule = $derived(tenTwenty(new Set(intakeDays(data.intakes).keys()), clock.now, data.settings.limit));
  const streak = $derived(periodStats(data, clock.now, 1).clearStreak);
  const meds = $derived(data.medications);
  const limits = $derived(new Map(medicationLimits(data.intakes, data.medications, clock.now).map((l) => [l.med.id, l.rule])));
  const presets = $derived(data.drinkPresets);
  const todayIntakes = $derived(data.intakes.filter((i) => i.time >= dayStart));
  const todayDrinks = $derived(data.drinks.filter((d) => d.time >= dayStart));
  const waterMl = $derived(waterOn(data.drinks, clock.now));
  const caffeineMg = $derived(todayDrinks.reduce((sum, d) => sum + (d.caffeineMg ?? 0), 0));
  const alcoholCount = $derived(todayDrinks.filter((d) => d.alcohol).length);
  const waterPct = $derived(Math.min(1, waterMl / data.settings.waterGoalMl));
  const hydration = $derived(hydrationStreak(data.drinks, data.settings.waterGoalMl, clock.now));
  const unrated = $derived(
    data.intakes.findLast((i) => i.relief === null && clock.now - i.time > (data.settings.reliefCheckMinutes || 60) * MINUTE && clock.now - i.time < RELIEF_ASK_WINDOW)
  );
  const todayEpisodes = $derived(data.episodes.filter((e) => (e.end ?? clock.now) >= dayStart));

  const log = $derived(
    [
      ...todayEpisodes.map((e) => ({ time: Math.max(e.start, dayStart), kind: 'episode' as const, item: e })),
      ...todayIntakes.map((i) => ({ time: i.time, kind: 'intake' as const, item: i })),
      ...todayDrinks.map((d) => ({ time: d.time, kind: 'drink' as const, item: d }))
    ].sort((a, b) => b.time - a.time)
  );

  async function start() {
    tap('heavy');
    const id = await startHeadache();
    toast(t('toast.started'), undoFor('episodes', id));
  }

  async function end() {
    if (!ongoing) return;
    tap('medium');
    const before = $state.snapshot(ongoing);
    await saveEpisode({ ...before, end: Date.now() });
    toast(t('toast.ended'), () => saveEpisode(before));
  }

  function undoFor(table: EntryTable, id: number) {
    return () => remove(table, id);
  }

  function earlier() {
    edit({ kind: 'episode', item: { start: Date.now() - 30 * MINUTE, end: null, intensity: 5, tags: [], note: '' } });
  }

  /** Celebrates reaching today's hydration goal, with the streak it extends. */
  function cheer() {
    const days = hydrationStreak(data.drinks, data.settings.waterGoalMl, Date.now()).current;
    const milestone = [3, 7, 14, 21, 30, 50, 100].includes(days);
    celebrate(t('streak.goal'), days > 1 ? t(milestone ? 'streak.milestone' : 'streak.days', { n: days }) : t('streak.first'));
  }
</script>

{#snippet hydrationCard()}
  <section class="card flex flex-col gap-3 p-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="flex items-center gap-1.5 text-base font-semibold">
        <Droplets size={22} class="shrink-0 text-water" />
        {t('today.water')}
        {#if hydration.current >= 1}
          <span class="shrink-0 rounded-full bg-water-soft px-2 py-0.5 text-sm font-semibold text-water tabular" title={t('streak.best', { n: hydration.best })}>
            🔥 {hydration.current}
          </span>
        {/if}
        <button class="press -my-2 -ml-1 grid size-11 shrink-0 place-items-center rounded-full text-muted" onclick={() => openSheet('drinkList')} aria-label={t('set.drinks')}>
          <Pencil size={20} />
        </button>
      </h2>
      <p class="ml-auto shrink-0 text-right whitespace-nowrap tabular">
        <span class="font-semibold">{formatLiters(waterMl)}</span>
        <span class="text-muted">{waterPct >= 1 ? `· ${t('today.goalReached')} 🎉` : t('today.goal', { goal: formatLiters(data.settings.waterGoalMl) })}</span>
      </p>
    </div>
    <div class="h-3 overflow-hidden rounded-full bg-water-soft">
      <div class="h-full rounded-full bg-water transition-[width] duration-500" style:width="{waterPct * 100}%"></div>
    </div>
    {#if caffeineMg || alcoholCount}
      <p class="-mt-1 text-sm text-muted tabular">
        {[caffeineMg ? `☕ ${t('drink.caffeineShort', { mg: caffeineMg })}` : '', alcoholCount ? `🍷 ${t('drink.alcoholToday', { n: alcoholCount })}` : ''].filter(Boolean).join(' · ')}
      </p>
    {/if}
    <div class="grid grid-cols-4 gap-2">
      {#each presets as preset (preset.id)}
        <button
          class="press flex min-w-0 flex-col items-center gap-0.5 rounded-2xl bg-surface-2 py-3"
          onclick={async () => {
            tap();
            const before = waterMl;
            const id = await logDrink(preset);
            if (before < data.settings.waterGoalMl && before + hydrationMl(preset) >= data.settings.waterGoalMl) cheer();
            toast(t('toast.drink', { ml: preset.ml }) + ` ${preset.emoji}`, undoFor('drinks', id));
          }}
        >
          <span class="text-3xl leading-none">{preset.emoji}</span>
          <span class="max-w-full truncate px-1 text-sm font-medium">{preset.name}</span>
          <span class="text-xs text-muted tabular">{preset.ml} ml</span>
        </button>
      {/each}
    </div>
  </section>
{/snippet}

{#snippet medsCard()}
  <section class="card flex flex-col gap-3 p-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="flex items-center gap-1.5 text-base font-semibold">
        <Pill size={22} class="shrink-0 text-med" />
        {t('today.meds')}
        <button class="press -my-2 -ml-1 grid size-11 shrink-0 place-items-center rounded-full text-muted" onclick={() => openSheet('medList')} aria-label={t('set.meds')}>
          <Pencil size={20} />
        </button>
      </h2>
      <button class="press ml-auto shrink-0" onclick={() => onOpenTab('meds')}><RuleBadge {rule} /></button>
    </div>
    {#if meds.length}
      <div class="grid grid-cols-2 gap-2">
        {#each meds as med (med.id)}
          {@const count = todayIntakes.filter((i) => i.medId === med.id).length}
          <button
            class="press relative flex min-h-16 min-w-0 flex-col items-start justify-center rounded-2xl border-l-4 bg-surface-2 py-2.5 pl-3 text-left {count ? 'pr-10' : 'pr-3'}"
            style:border-left-color={med.color}
            onclick={async () => {
              tap('medium');
              const before = limits.get(med.id);
              const id = await logIntake(med);
              const over = before && before.ifTakenToday > before.limit;
              toast(
                over ? t('toast.overLimit', { name: med.name, n: before.ifTakenToday, limit: before.limit }) : t('toast.intake', { name: med.name }),
                undoFor('intakes', id)
              );
            }}
          >
            <span class="max-w-full font-semibold break-words">{med.name}</span>
            <span class="text-sm text-muted">{med.dose}</span>
            {#if limits.get(med.id)}
              {@const r = limits.get(med.id)!}
              <span class="mt-0.5 text-xs font-semibold tabular {r.status === 'over' ? 'text-over' : r.status === 'caution' ? 'text-caution' : 'text-muted'}">
                {t('tenTwenty.limitCount', { n: r.count, limit: r.limit, window: r.window })}
              </span>
            {/if}
            {#if count}
              <span class="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-med text-sm font-semibold text-white tabular">{count}</span>
            {/if}
          </button>
        {/each}
      </div>
      {#if !rule.days[rule.days.length - 1].med}
        <p class="text-sm text-muted">{t('tenTwenty.ifToday', { n: rule.ifTakenToday, limit: rule.limit })}</p>
      {/if}
    {:else}
      <p class="text-muted">{t('today.noMeds')}</p>
    {/if}
  </section>
{/snippet}

<div class="flex flex-col gap-3 pb-6">
  <header class="flex items-center justify-between gap-3 pt-2">
    <div class="min-w-0">
      <p class="text-sm font-medium tracking-wide text-muted uppercase">{fmt(clock.now, 'EEEE')}</p>
      <h1 class="text-3xl font-semibold">{fmt(clock.now, 'd. MMMM')}</h1>
      {#if !ongoing && streak}
        <p class="text-sm font-medium text-ok">{streak === 1 ? t('today.clearStreakOne') : t('today.clearStreak', { n: streak })}</p>
      {/if}
    </div>
    <button
      class="press flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pr-3.5 pl-1.5 text-sm font-semibold"
      style:color={LIGHT_COLOR[forecast.light]}
      style:background-color="color-mix(in oklab, {LIGHT_COLOR[forecast.light]} 12%, transparent)"
      onclick={showForecast}
      aria-label={`${t('prog.title')}: ${t(`prog.${forecast.light}`)}`}
    >
      <span class="relative grid size-8 place-items-center">
        {#if forecast.light !== 'green'}
          <span class="absolute inset-0 animate-ping rounded-full opacity-50 [animation-duration:2s]" style:background-color={LIGHT_COLOR[forecast.light]}></span>
        {/if}
        <span
          class="relative size-8 rounded-full"
          style:background-color={LIGHT_COLOR[forecast.light]}
          style:box-shadow="0 0 12px {LIGHT_COLOR[forecast.light]}, inset 0 3px 5px rgb(255 255 255 / 0.35), inset 0 -3px 6px rgb(0 0 0 / 0.15)"
        ></span>
      </span>
      {t('prog.title')}
    </button>
  </header>

  <SleepCard />

  {#if ongoing}
    {@const long = clock.now - ongoing.start > LONG_HEADACHE}
    <section class="card overflow-hidden">
      <div class="bg-pain-soft p-4">
        <div class="flex items-center gap-2 font-medium text-pain">
          <span class="relative flex size-2.5">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-pain opacity-60"></span>
            <span class="relative inline-flex size-2.5 rounded-full bg-pain"></span>
          </span>
          {t('today.ongoing')} · {t('today.since')} {isToday(ongoing.start) ? hm(ongoing.start) : fmt(ongoing.start, 'EEE HH:mm')}
        </div>
        <p class="mt-1 text-display leading-none font-semibold tabular">{formatDuration(clock.now - ongoing.start)}</p>
        {#if long}<p class="mt-2 text-pain">{t('today.longRunning')}</p>{/if}
      </div>
      <div class="flex flex-col gap-3 p-4">
        <IntensityPicker value={ongoing.intensity} onchange={(v) => saveEpisode({ ...$state.snapshot(ongoing), intensity: v })} />
        <div class="flex gap-2">
          <button class="press flex-1 rounded-2xl bg-fg py-4 text-base font-semibold text-bg" onclick={end}>{t('today.end')}</button>
          <button class="press rounded-2xl bg-surface-2 px-4 font-medium" onclick={() => edit({ kind: 'episode', item: ongoing })}>
            {t('today.details')}
          </button>
        </div>
      </div>
    </section>
  {:else}
    <section class="flex flex-col items-center gap-2">
      <button
        class="press group relative flex h-36 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl bg-pain text-white shadow-lg shadow-pain/25"
        onclick={start}
      >
        <Zap size={36} strokeWidth={2.4} />
        <span class="text-2xl font-semibold">{t('today.start')}</span>
        <span class="text-sm opacity-90">{t('today.startHint')}</span>
      </button>
      <button class="press min-h-11 px-3 font-medium text-muted underline underline-offset-4" onclick={earlier}>{t('today.startedEarlier')}</button>
    </section>
  {/if}

  <WelcomeCard />


  {#if unrated}
    <section class="card flex flex-col gap-3 bg-med-soft p-4">
      <p>
        {t('today.reliefAsk', { name: unrated.name, time: hm(unrated.time) })}
      </p>
      <div class="grid grid-cols-3 gap-2">
        {#each RELIEFS as r (r)}
          <button
            class="press min-h-11 rounded-xl bg-surface py-2.5 font-medium"
            onclick={() => {
              tap();
              void saveIntake({ ...$state.snapshot(unrated), relief: r });
            }}>{reliefLabels()[r]}</button
          >
        {/each}
      </div>
    </section>
  {/if}

  {#if ongoing}
    {@render medsCard()}
    {@render hydrationCard()}
  {:else}
    {@render hydrationCard()}
    {@render medsCard()}
  {/if}

  <div bind:this={forecastCard} class="scroll-mt-4">
    <PrognosisCard bind:open={forecastOpen} />
  </div>

  <section class="card p-2">
    <h2 class="px-2 pt-2 pb-1 text-lg font-semibold">{t('today.log')}</h2>
    {#if log.length}
      <ul>
        {#each log as entry (entry.kind + entry.item.id)}
          <li>
            <button class="press flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2" onclick={() => edit(entry)}>
              <span class="w-13 shrink-0 text-muted tabular">{hm(entry.time)}</span>
              {#if entry.kind === 'episode'}
                <span class="grid size-10 shrink-0 place-items-center rounded-full bg-pain-soft text-pain"><Zap size={20} /></span>
                <span class="flex-1">
                  {t('today.headache')} · {entry.item.intensity}/10
                  <span class="text-muted">
                    {entry.item.end ? `· ${formatDuration(entry.item.end - entry.item.start)}` : `· ${t('edit.ongoing').toLowerCase()}`}
                  </span>
                </span>
              {:else if entry.kind === 'intake'}
                <span class="grid size-10 shrink-0 place-items-center rounded-full bg-med-soft text-med"><Pill size={20} /></span>
                <span class="flex-1">{entry.item.name} <span class="text-muted">{entry.item.dose}</span></span>
              {:else}
                <span class="grid size-10 shrink-0 place-items-center rounded-full bg-water-soft text-xl">{entry.item.emoji}</span>
                <span class="flex-1">{entry.item.name} <span class="text-muted tabular">{entry.item.ml} ml</span></span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="px-2 pb-3 text-muted">{t('today.nothing')}</p>
    {/if}
  </section>
</div>
