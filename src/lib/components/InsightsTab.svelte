<script lang="ts">
  import { alcoholDays, caffeineByDay, hydrationStreak, monthlyCounts, periodStats } from '$lib/analysis';
  import { lastDays } from '$lib/days';
  import { formatDuration, formatLiters } from '$lib/days';
  import { fmt, t, tagLabel, weekdayShort } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { FileText } from '@lucide/svelte';
  import { exportForDoctor } from '$lib/doctor.svelte';
  import BarChart from './BarChart.svelte';

  const PERIODS = [30, 90, 365];
  const REPORT_MONTHS: Record<number, number> = { 30: 1, 90: 3, 365: 12 };
  let span = $state(90);

  const stats = $derived(periodStats(data, clock.now, span));
  const hydration = $derived(hydrationStreak(data.drinks, data.settings.waterGoalMl, clock.now));
  const periodKeys = $derived(lastDays(clock.now, span));
  const caffeine = $derived.by(() => {
    const byDay = caffeineByDay(data.drinks);
    const days = periodKeys.filter((k) => byDay.has(k));
    return days.length ? days.reduce((s, k) => s + byDay.get(k)!, 0) / days.length : null;
  });
  const alcohol = $derived.by(() => {
    const days = alcoholDays(data.drinks);
    return periodKeys.filter((k) => days.has(k)).length;
  });
  const months = $derived(monthlyCounts(data, clock.now, span === 365 ? 12 : 6));
  const hasData = $derived(stats.episodes > 0 || stats.intakes > 0 || stats.avgWaterMl !== null);
  const waterDiff = $derived(
    stats.waterBeforeHeadache !== null && stats.waterBeforeClear
      ? Math.round((1 - stats.waterBeforeHeadache / stats.waterBeforeClear) * 100)
      : null
  );
  const reliefLabels = $derived([t('edit.reliefNone'), t('edit.reliefSome'), t('edit.reliefGood')]);
  const maxTag = $derived(Math.max(1, ...stats.tags.map((x) => x.count)));
</script>

<div class="flex flex-col gap-3 pb-6">
  <header class="flex items-center justify-between pt-2">
    <h1 class="text-2xl font-semibold">{t('tab.insights')}</h1>
    <div class="flex rounded-full bg-surface-2 p-1 text-xs font-medium">
      {#each PERIODS as p (p)}
        <button class="press rounded-full px-3 py-1.5 {span === p ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => (span = p)}>
          {t('ins.days', { n: p })}
        </button>
      {/each}
    </div>
  </header>

  <button
    class="press flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-fg"
    onclick={() => exportForDoctor(REPORT_MONTHS[span])}
  >
    <FileText size={18} />
    {t('pdf.insightsButton', { n: REPORT_MONTHS[span] })}
  </button>

  {#if !hasData}
    <p class="card p-6 text-center text-sm text-muted">{t('ins.noData')}</p>
  {:else}
    <section class="grid grid-cols-3 gap-2">
      {#each [
        { label: t('ins.headacheDays'), value: String(stats.headacheDays), cls: 'text-pain' },
        { label: t('ins.episodes'), value: String(stats.episodes), cls: '' },
        { label: t('ins.avgIntensity'), value: stats.avgIntensity === null ? '–' : stats.avgIntensity.toFixed(1), cls: '' },
        { label: t('ins.avgDuration'), value: stats.avgDurationMs === null ? '–' : formatDuration(stats.avgDurationMs), cls: '' },
        { label: t('ins.medDays'), value: String(stats.medDays), cls: 'text-med' },
        { label: t('ins.avgWater'), value: stats.avgWaterMl === null ? '–' : formatLiters(stats.avgWaterMl), cls: 'text-water' }
      ] as tile (tile.label)}
        <div class="card p-3">
          <p class="text-lg font-semibold tabular {tile.cls}">{tile.value}</p>
          <p class="text-xs leading-tight text-muted">{tile.label}</p>
        </div>
      {/each}
    </section>

    {#if caffeine !== null || alcohol}
      <section class="grid grid-cols-2 gap-2">
        <div class="card p-3">
          <p class="text-lg font-semibold tabular">{caffeine === null ? '–' : `${Math.round(caffeine)} mg`}</p>
          <p class="text-xs leading-tight text-muted">{t('drink.caffeineAvg')}</p>
        </div>
        <div class="card p-3">
          <p class="text-lg font-semibold tabular">{alcohol}</p>
          <p class="text-xs leading-tight text-muted">{t('drink.alcoholDays')}</p>
        </div>
      </section>
    {/if}

    <section class="card flex items-center gap-3 p-4">
      <span class="text-3xl">🔥</span>
      <div class="flex-1">
        <p class="text-sm font-semibold">{t('streak.label')}</p>
        <p class="text-xs text-muted">{t('streak.best', { n: hydration.best })}</p>
      </div>
      <p class="text-2xl font-semibold text-water tabular">{hydration.current}</p>
    </section>

    <section class="card p-4">
      <h2 class="mb-1 text-sm font-semibold">{t('ins.monthly')}</h2>
      <div class="mb-1 flex gap-4 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-pain"></span>{t('cal.headacheDays')}</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-med"></span>{t('cal.medDays')}</span>
      </div>
      <div class="grid grid-cols-1 gap-2">
        <BarChart color="var(--color-pain)" height={80} bars={months.map((m) => ({ label: fmt(m.month, 'MMM'), value: m.headache }))} />
        <BarChart
          color="var(--color-med)"
          height={64}
          limit={{ value: data.settings.limit, color: 'var(--color-over)' }}
          bars={months.map((m) => ({ label: fmt(m.month, 'MMM'), value: m.med }))}
        />
      </div>
    </section>

    {#if stats.episodes}
      <section class="card p-4">
        <h2 class="mb-1 text-sm font-semibold">{t('ins.weekday')}</h2>
        <BarChart height={72} bars={stats.weekday.map((v, i) => ({ label: weekdayShort()[i], value: v }))} />
      </section>

      <section class="card p-4">
        <h2 class="mb-1 text-sm font-semibold">{t('ins.timeOfDay')}</h2>
        <BarChart height={72} bars={stats.timeOfDay.map((v, i) => ({ label: `${String(i * 3).padStart(2, '0')}`, value: v }))} />
      </section>
    {/if}

    {#if stats.waterBeforeHeadache !== null && stats.waterBeforeClear !== null}
      <section class="card flex flex-col gap-3 p-4">
        <h2 class="text-sm font-semibold">{t('ins.waterLink')}</h2>
        {#each [
          { label: t('ins.waterBefore'), ml: stats.waterBeforeHeadache, color: 'var(--color-pain)' },
          { label: t('ins.waterClear'), ml: stats.waterBeforeClear, color: 'var(--color-water)' }
        ] as row (row.label)}
          {@const max = Math.max(stats.waterBeforeHeadache, stats.waterBeforeClear, data.settings.waterGoalMl)}
          <div class="flex flex-col gap-1 text-sm">
            <div class="flex justify-between"><span>{row.label}</span><span class="font-semibold tabular">{formatLiters(row.ml)}</span></div>
            <div class="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div class="h-full rounded-full" style:width="{(row.ml / max) * 100}%" style:background-color={row.color}></div>
            </div>
          </div>
        {/each}
        <p class="text-sm text-muted">
          {waterDiff !== null && waterDiff >= 10 ? t('ins.waterMore', { pct: waterDiff }) : t('ins.waterSame')}
        </p>
      </section>
    {/if}

    {#if stats.meds.length}
      <section class="card p-4">
        <h2 class="mb-3 text-sm font-semibold">{t('ins.meds')}</h2>
        <ul class="flex flex-col gap-2.5">
          {#each stats.meds as m (m.name)}
            <li class="flex items-center gap-3 text-sm">
              <span class="flex-1 font-medium">{m.name}</span>
              <span class="text-muted tabular">{t('tenTwenty.intakes', { n: m.intakes, d: m.days })}</span>
              <span class="w-20 text-right text-xs">
                {#if m.avgRelief === null}
                  <span class="text-muted">{t('ins.noRelief')}</span>
                {:else}
                  <span class="font-medium" style:color={m.avgRelief >= 1.5 ? 'var(--color-ok)' : m.avgRelief >= 0.75 ? 'var(--color-caution)' : 'var(--color-over)'}>
                    {reliefLabels[Math.round(m.avgRelief)]}
                  </span>
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if stats.tags.length}
      <section class="card p-4">
        <h2 class="mb-3 text-sm font-semibold">{t('ins.tags')}</h2>
        <ul class="flex flex-col gap-2">
          {#each stats.tags as tag (tag.tag)}
            <li class="flex items-center gap-3 text-sm">
              <span class="w-36 truncate">{tagLabel(tag.tag)}</span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div class="h-full rounded-full bg-primary" style:width="{(tag.count / maxTag) * 100}%"></div>
              </div>
              <span class="w-6 text-right text-muted tabular">{tag.count}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</div>
