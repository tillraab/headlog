<script lang="ts">
  import { hydrationMl } from '$lib/db';
  import { Droplets, Pill, Zap } from '@lucide/svelte';
  import { format, isToday, startOfDay } from 'date-fns';
  import { hydrationStreak, intakeDays, medicationLimits, periodStats, tenTwenty } from '$lib/analysis';
  import { formatDuration, formatLiters } from '$lib/days';
  import { edit } from '$lib/editor.svelte';
  import { fmt, t } from '$lib/i18n.svelte';
  import { clock, data, logDrink, logIntake, ongoingEpisode, remove, saveEpisode, saveIntake, startHeadache } from '$lib/store.svelte';
  import { celebrate, tap, toast } from '$lib/ui.svelte';
  import { dayKey } from '$lib/days';
  import { PRESSURE_DROP_HPA, tomorrowKey, weatherEmoji } from '$lib/weather';
  import IntensityPicker from './IntensityPicker.svelte';
  import RuleBadge from './RuleBadge.svelte';

  let { onOpenTab }: { onOpenTab: (tab: 'meds') => void } = $props();

  const ongoing = $derived(ongoingEpisode());
  const lastNight = $derived(data.settings.sleep.enabled ? data.sleep.get(dayKey(clock.now)) : undefined);
  const pressureWarning = $derived.by(() => {
    if (!data.settings.weather.enabled) return null;
    const today = data.weather.get(dayKey(clock.now));
    const tomorrow = data.weather.get(tomorrowKey(clock.now));
    if (today && today.pressureDrop >= PRESSURE_DROP_HPA) return { today: true, weather: today };
    if (tomorrow && tomorrow.pressureDrop >= PRESSURE_DROP_HPA) return { today: false, weather: tomorrow };
    return null;
  });
  const dayStart = $derived(startOfDay(clock.now).getTime());
  const rule = $derived(tenTwenty(new Set(intakeDays(data.intakes).keys()), clock.now, data.settings.limit));
  const streak = $derived(periodStats(data, clock.now, 1).clearStreak);
  const meds = $derived(data.medications);
  const limits = $derived(new Map(medicationLimits(data.intakes, data.medications, clock.now).map((l) => [l.med.id, l.rule])));
  const presets = $derived(data.drinkPresets);
  const todayIntakes = $derived(data.intakes.filter((i) => i.time >= dayStart));
  const todayDrinks = $derived(data.drinks.filter((d) => d.time >= dayStart));
  const waterMl = $derived(todayDrinks.reduce((sum, d) => sum + hydrationMl(d), 0));
  const caffeineMg = $derived(todayDrinks.reduce((sum, d) => sum + (d.caffeineMg ?? 0), 0));
  const alcoholCount = $derived(todayDrinks.filter((d) => d.alcohol).length);
  const waterPct = $derived(Math.min(1, waterMl / data.settings.waterGoalMl));
  const hydration = $derived(hydrationStreak(data.drinks, data.settings.waterGoalMl, clock.now));
  const unrated = $derived(
    data.intakes.findLast((i) => i.relief === null && clock.now - i.time > (data.settings.reliefCheckMinutes || 60) * 60000 && clock.now - i.time < 12 * 3600000)
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

  function undoFor(table: 'episodes' | 'intakes' | 'drinks', id: number) {
    return () => remove(table, id);
  }

  function earlier() {
    edit({ kind: 'episode', item: { start: Date.now() - 30 * 60000, end: null, intensity: 5, tags: [], note: '' } });
  }

  /** Celebrates reaching today's hydration goal, with the streak it extends. */
  function cheer() {
    const days = hydrationStreak(data.drinks, data.settings.waterGoalMl, Date.now()).current;
    const milestone = [3, 7, 14, 21, 30, 50, 100].includes(days);
    celebrate(t('streak.goal'), days > 1 ? t(milestone ? 'streak.milestone' : 'streak.days', { n: days }) : t('streak.first'));
  }

  function hm(time: number) {
    return format(time, 'HH:mm');
  }
</script>

<div class="flex flex-col gap-3 pb-6">
  <header class="flex items-end justify-between pt-2">
    <div>
      <p class="text-xs font-medium tracking-wide text-muted uppercase">{fmt(clock.now, 'EEEE')}</p>
      <h1 class="text-2xl font-semibold">{fmt(clock.now, 'd. MMMM')}</h1>
    </div>
    {#if !ongoing && streak}
      <p class="rounded-full bg-ok/12 px-3 py-1 text-xs font-medium text-ok">
        {streak === 1 ? t('today.clearStreakOne') : t('today.clearStreak', { n: streak })}
      </p>
    {/if}
  </header>

  {#if ongoing}
    {@const long = clock.now - ongoing.start > 24 * 3600000}
    <section class="card overflow-hidden">
      <div class="bg-pain-soft p-4">
        <div class="flex items-center gap-2 text-sm font-medium text-pain">
          <span class="relative flex size-2.5">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-pain opacity-60"></span>
            <span class="relative inline-flex size-2.5 rounded-full bg-pain"></span>
          </span>
          {t('today.ongoing')} · {t('today.since')} {isToday(ongoing.start) ? hm(ongoing.start) : fmt(ongoing.start, 'EEE HH:mm')}
        </div>
        <p class="mt-1 text-display leading-none font-semibold tabular">{formatDuration(clock.now - ongoing.start)}</p>
        {#if long}<p class="mt-2 text-sm text-pain">{t('today.longRunning')}</p>{/if}
      </div>
      <div class="flex flex-col gap-3 p-4">
        <IntensityPicker value={ongoing.intensity} onchange={(v) => saveEpisode({ ...$state.snapshot(ongoing), intensity: v })} />
        <div class="flex gap-2">
          <button class="press flex-1 rounded-2xl bg-fg py-4 text-base font-semibold text-bg" onclick={end}>{t('today.end')}</button>
          <button class="press rounded-2xl bg-surface-2 px-4 text-sm font-medium" onclick={() => edit({ kind: 'episode', item: ongoing })}>
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
        <Zap size={34} strokeWidth={2.4} />
        <span class="text-xl font-semibold">{t('today.start')}</span>
        <span class="text-xs opacity-85">{t('today.startHint')}</span>
      </button>
      <button class="press text-sm font-medium text-muted underline underline-offset-4" onclick={earlier}>{t('today.startedEarlier')}</button>
    </section>
  {/if}

  {#if lastNight}
    <button class="card press flex items-center gap-3 p-3 text-left" onclick={() => edit({ kind: 'sleep', item: lastNight })}>
      <span class="grid size-10 place-items-center rounded-full bg-surface-2 text-xl">😴</span>
      <span class="flex flex-1 flex-col">
        <span class="text-xs text-muted">{t('sleep.lastNight')}</span>
        <span class="font-semibold tabular">{formatDuration(lastNight.asleepMs)}</span>
      </span>
      <span class="text-right text-xs text-muted tabular">
        {t('sleep.summary', { from: hm(lastNight.start), to: hm(lastNight.end) })}
        {#if lastNight.breaks.length}
          <br />{t('sleep.breaks', { n: lastNight.breaks.length, d: formatDuration(lastNight.breaks.reduce((s, b) => s + b.end - b.start, 0)) })}
        {/if}
      </span>
    </button>
  {/if}

  {#if pressureWarning}
    <section class="card flex items-start gap-3 bg-water-soft p-4 text-sm">
      <span class="text-2xl">{weatherEmoji(pressureWarning.weather.code)}</span>
      <p>
        {t(pressureWarning.today ? 'weather.dropToday' : 'weather.dropTomorrow', { n: Math.round(pressureWarning.weather.pressureDrop) })}
        <span class="text-muted">{t('weather.dropTip')}</span>
      </p>
    </section>
  {/if}

  {#if unrated}
    <section class="card flex flex-col gap-3 bg-med-soft p-4">
      <p class="text-sm">
        {t('today.reliefAsk', { name: unrated.name, time: hm(unrated.time) })}
      </p>
      <div class="grid grid-cols-3 gap-2">
        {#each [t('edit.reliefNone'), t('edit.reliefSome'), t('edit.reliefGood')] as label, i (i)}
          <button
            class="press rounded-xl bg-surface py-2.5 text-sm font-medium"
            onclick={() => {
              tap();
              void saveIntake({ ...$state.snapshot(unrated), relief: i });
            }}>{label}</button
          >
        {/each}
      </div>
    </section>
  {/if}

  <section class="card flex flex-col gap-3 p-4">
    <div class="flex items-center justify-between">
      <h2 class="flex items-center gap-2 font-semibold">
        <Droplets size={18} class="text-water" />
        {t('today.water')}
        {#if hydration.current > 1}
          <span class="rounded-full bg-water-soft px-2 py-0.5 text-xs font-semibold text-water tabular" title={t('streak.best', { n: hydration.best })}>
            🔥 {hydration.current}
          </span>
        {/if}
      </h2>
      <p class="text-sm tabular">
        <span class="font-semibold">{formatLiters(waterMl)}</span>
        <span class="text-muted">{waterPct >= 1 ? `· ${t('today.goalReached')} 🎉` : t('today.goal', { goal: formatLiters(data.settings.waterGoalMl) })}</span>
      </p>
    </div>
    <div class="h-3 overflow-hidden rounded-full bg-water-soft">
      <div class="h-full rounded-full bg-water transition-[width] duration-500" style:width="{waterPct * 100}%"></div>
    </div>
    {#if caffeineMg || alcoholCount}
      <p class="-mt-1 text-xs text-muted tabular">
        {[caffeineMg ? `☕ ${t('drink.caffeineShort', { mg: caffeineMg })}` : '', alcoholCount ? `🍷 ${t('drink.alcoholToday', { n: alcoholCount })}` : ''].filter(Boolean).join(' · ')}
      </p>
    {/if}
    <div class="grid grid-cols-4 gap-2">
      {#each presets as preset (preset.id)}
        <button
          class="press flex flex-col items-center gap-0.5 rounded-2xl bg-surface-2 py-2.5"
          onclick={async () => {
            tap();
            const before = waterMl;
            const id = await logDrink(preset);
            if (before < data.settings.waterGoalMl && before + hydrationMl(preset) >= data.settings.waterGoalMl) cheer();
            toast(t('toast.drink', { ml: preset.ml }) + ` ${preset.emoji}`, undoFor('drinks', id));
          }}
        >
          <span class="text-2xl leading-none">{preset.emoji}</span>
          <span class="max-w-full truncate px-1 text-xs font-medium">{preset.name}</span>
          <span class="text-2xs text-muted tabular">{preset.ml} ml</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="card flex flex-col gap-3 p-4">
    <div class="flex items-center justify-between">
      <h2 class="flex items-center gap-2 font-semibold"><Pill size={18} class="text-med" /> {t('today.meds')}</h2>
      <button class="press" onclick={() => onOpenTab('meds')}><RuleBadge {rule} /></button>
    </div>
    {#if meds.length}
      <div class="grid grid-cols-2 gap-2">
        {#each meds as med (med.id)}
          {@const count = todayIntakes.filter((i) => i.medId === med.id).length}
          <button
            class="press relative flex min-h-14 flex-col items-start justify-center rounded-2xl border-l-4 bg-surface-2 px-3 py-2 text-left"
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
            <span class="font-semibold">{med.name}</span>
            <span class="text-xs text-muted">{med.dose}</span>
            {#if limits.get(med.id)}
              {@const r = limits.get(med.id)!}
              <span class="mt-0.5 text-2xs font-semibold tabular {r.status === 'over' ? 'text-over' : r.status === 'caution' ? 'text-caution' : 'text-muted'}">
                {t('tenTwenty.limitCount', { n: r.count, limit: r.limit, window: r.window })}
              </span>
            {/if}
            {#if count}
              <span class="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-med text-xs font-semibold text-white tabular">{count}</span>
            {/if}
          </button>
        {/each}
      </div>
      {#if !rule.days[rule.days.length - 1].med}
        <p class="text-xs text-muted">{t('tenTwenty.ifToday', { n: rule.ifTakenToday, limit: rule.limit })}</p>
      {/if}
    {:else}
      <p class="text-sm text-muted">{t('today.noMeds')}</p>
    {/if}
  </section>

  <section class="card p-2">
    <h2 class="px-2 pt-2 pb-1 font-semibold">{t('today.log')}</h2>
    {#if log.length}
      <ul>
        {#each log as entry (entry.kind + entry.item.id)}
          <li>
            <button class="press flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2" onclick={() => edit(entry)}>
              <span class="w-11 text-sm text-muted tabular">{hm(entry.time)}</span>
              {#if entry.kind === 'episode'}
                <span class="grid size-8 place-items-center rounded-full bg-pain-soft text-pain"><Zap size={16} /></span>
                <span class="flex-1 text-sm">
                  {t('today.headache')} · {entry.item.intensity}/10
                  <span class="text-muted">
                    {entry.item.end ? `· ${formatDuration(entry.item.end - entry.item.start)}` : `· ${t('edit.ongoing').toLowerCase()}`}
                  </span>
                </span>
              {:else if entry.kind === 'intake'}
                <span class="grid size-8 place-items-center rounded-full bg-med-soft text-med"><Pill size={16} /></span>
                <span class="flex-1 text-sm">{entry.item.name} <span class="text-muted">{entry.item.dose}</span></span>
              {:else}
                <span class="grid size-8 place-items-center rounded-full bg-water-soft text-lg">{entry.item.emoji}</span>
                <span class="flex-1 text-sm">{entry.item.name} <span class="text-muted tabular">{entry.item.ml} ml</span></span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="px-2 pb-3 text-sm text-muted">{t('today.nothing')}</p>
    {/if}
  </section>
</div>
