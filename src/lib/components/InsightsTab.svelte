<script lang="ts">
  import { FileText } from '@lucide/svelte';
  import { alcoholDays, average, caffeineByDay, compareDays, hydrationStreak, monthlyCounts, periodStats, timeline } from '$lib/analysis';
  import { entryDetailLines, formatComparison } from '$lib/format';
  import { addDays } from 'date-fns';
  import { dayKey, formatDuration, formatLiters, HOUR, lastDays } from '$lib/days';
  import { openSheet } from '$lib/ui.svelte';
  import { fmt, num, t, tagLabel, weekdayShort } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { dropToNextDay, isPressureDrop, PRESSURE_DROP_HPA } from '$lib/weather';
  import BarChart from './BarChart.svelte';
  import CardHeading from './CardHeading.svelte';
  import ComparisonChart, { type Pair } from './ComparisonChart.svelte';
  import ReportSheet from './ReportSheet.svelte';
  import HourTimeline from './HourTimeline.svelte';
  import TimelineChart, { type Row } from './TimelineChart.svelte';

  const PERIODS = [3, 7, 30, 90, 365];
  /** Up to this many days the timeline shows hours instead of days. */
  const HOUR_VIEW_DAYS = 7;
  const REPORT_MONTHS: Record<number, number> = { 3: 1, 7: 1, 30: 1, 90: 3, 365: 12 };
  const SLEEP_REFERENCE_HOURS = 7;
  let span = $state(90);
  let reportMonths = $state(3);

  const keys = $derived(lastDays(clock.now, span));
  const stats = $derived(periodStats(data, clock.now, span));
  /** The charts run on into tomorrow when the weather forecast covers it. */
  const forecastKey = $derived(dayKey(addDays(clock.now, 1)));
  const chartKeys = $derived(data.weather.has(forecastKey) ? [...keys, forecastKey] : keys);
  const series = $derived(timeline(data, chartKeys, clock.now));
  const streak = $derived(hydrationStreak(data.drinks, data.settings.waterGoalMl, clock.now));
  const months = $derived(monthlyCounts(data, clock.now, span === 365 ? 12 : 6));
  const hasData = $derived(stats.episodes > 0 || stats.intakes > 0 || stats.avgWaterMl !== null);
  const maxTag = $derived(Math.max(1, ...stats.tags.map((x) => x.count)));

  const known = (values: (number | null)[]) => values.filter((v): v is number => v !== null);
  const sleepAvg = $derived(average(known(series.sleepHours)));
  const caffeine = $derived.by(() => {
    const byDay = caffeineByDay(data.drinks);
    return average(keys.filter((k) => byDay.has(k)).map((k) => byDay.get(k)!));
  });
  const alcohol = $derived.by(() => {
    const days = alcoholDays(data.drinks);
    return keys.filter((k) => days.has(k)).length;
  });

  const rows = $derived.by(() => {
    const result: Row[] = [
      { key: 'headache', label: t('tl.headache'), summary: t('tl.days', { n: stats.headacheDays }), values: series.headache, color: 'var(--color-pain)', kind: 'bars', format: (v) => (v ? `${Math.round(v)}/10` : '–') }
    ];
    const water = known(series.hydration);
    if (water.length) {
      result.push({
        key: 'hydration',
        label: t('tl.hydration'),
        summary: t('tl.hydrationSummary', {
          ml: formatLiters(average(water)!),
          n: water.filter((v) => v >= data.settings.waterGoalMl).length
        }),
        values: series.hydration,
        color: 'var(--color-water)',
        kind: 'bars',
        format: formatLiters,
        reference: data.settings.waterGoalMl
      });
    }
    const sleep = known(series.sleepHours);
    if (sleep.length) {
      result.push({
        key: 'sleep',
        label: t('tl.sleep'),
        summary: t('tl.sleepSummary', { d: formatDuration(average(sleep)! * HOUR), n: sleep.length }),
        values: series.sleepHours,
        color: 'var(--color-primary)',
        kind: 'bars',
        format: (v) => `${num(v, 0, 1)} h`,
        reference: SLEEP_REFERENCE_HOURS
      });
    }
    if (known(series.pressure).length) {
      const marks = chartKeys.map((k) => isPressureDrop(dropToNextDay(data.weather, k) ?? 0));
      result.push({
        key: 'pressure',
        label: t('tl.pressure'),
        summary: t('tl.pressureSummary', { n: marks.filter(Boolean).length, hpa: PRESSURE_DROP_HPA }),
        values: series.pressure,
        color: 'var(--color-muted)',
        kind: 'line',
        format: (v) => String(Math.round(v)),
        marks,
        markColor: 'var(--color-caution)'
      });
    }
    return result;
  });

  /** Extra lines for the selected day: headaches with times, medication, the pressure drop. */
  function dayDetails(index: number): string[] {
    const key = chartKeys[index];
    const lines = entryDetailLines({
      episodes: data.episodes.filter((e) => dayKey(e.start) === key),
      intakes: data.intakes.filter((i) => dayKey(i.time) === key)
    });
    const drop = dropToNextDay(data.weather, key);
    if (drop !== null && isPressureDrop(drop)) lines.push(t('tl.detailDrop', { n: Math.round(drop) }));
    return lines;
  }

  const comparisons = $derived(compareDays(data, keys, clock.now));
  const pairs = $derived(
    comparisons.map(
      (c): Pair => ({
        label: t(`cmp.${c.key}`, { n: PRESSURE_DROP_HPA }),
        headache: c.headache,
        clear: c.clear,
        format: (v) => formatComparison(c.key, v),
        note: t('cmp.note', { h: c.nHeadache, c: c.nClear })
      })
    )
  );
</script>

{#snippet heading(title: string)}
  <h2 class="mt-3 -mb-1 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
{/snippet}

<div class="flex flex-col gap-3 pb-6">
  <header class="flex flex-col gap-2 pt-2">
<h1 class="text-3xl font-semibold">{t('tab.insights')}</h1>
    <div class="flex rounded-full bg-surface-2 p-1 text-xs font-medium">
      {#each PERIODS as p (p)}
        <button class="press min-h-10 flex-auto rounded-full px-1 py-1.5 whitespace-nowrap {span === p ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => (span = p)}>
          {t('ins.days', { n: p })}
        </button>
      {/each}
    </div>
  </header>

  <button
    class="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-fg"
    onclick={() => {
      reportMonths = REPORT_MONTHS[span];
      openSheet('report');
    }}
  >
    <FileText size={22} />
    {t('pdf.insightsButton', { n: REPORT_MONTHS[span] })}
  </button>

  {#if !hasData}
    <p class="card p-6 text-center text-muted">{t('ins.noData')}</p>
  {:else}
    {@render heading(t('ins.overview'))}
    <section class="grid grid-cols-3 gap-2">
      {#each [
        { label: t('ins.headacheDays'), value: String(stats.headacheDays), cls: 'text-pain' },
        { label: t('ins.avgIntensity'), value: stats.avgIntensity === null ? '–' : num(stats.avgIntensity, 1), cls: '' },
        { label: t('ins.avgDuration'), value: stats.avgDurationMs === null ? '–' : formatDuration(stats.avgDurationMs), cls: '' },
        { label: t('ins.medDays'), value: String(stats.medDays), cls: 'text-med' },
        { label: t('ins.avgWater'), value: stats.avgWaterMl === null ? '–' : formatLiters(stats.avgWaterMl), cls: 'text-water' },
        { label: t('sleep.avg'), value: sleepAvg === null ? '–' : formatDuration(sleepAvg * HOUR), cls: 'text-primary' }
      ] as tile (tile.label)}
        <div class="card p-3">
          <p class="text-xl font-semibold tabular {tile.cls}">{tile.value}</p>
          <p class="text-xs leading-tight hyphens-auto text-muted">{tile.label}</p>
        </div>
      {/each}
    </section>

    {@render heading(t('ins.connections'))}
    <section class="card p-4">
      {#if span <= HOUR_VIEW_DAYS}
        <CardHeading class="mb-3" title={t('hv.title')} info={t('hv.hint')} />
        <HourTimeline {rows} keys={chartKeys} now={clock.now} />
      {:else}
        <CardHeading class="mb-3" title={t('tl.title')} info={t('tl.hint')} />
        <TimelineChart {rows} keys={chartKeys} forecast={chartKeys.length - keys.length} bands={series.headache.map((v) => v > 0)} details={dayDetails} />
      {/if}
    </section>

    <section class="card p-4">
      <CardHeading class="mb-3" title={t('cmp.title')} info={t('cmp.hint')} />
      {#if pairs.length}
        <ComparisonChart {pairs} headacheLabel={t('cmp.headache')} clearLabel={t('cmp.clear')} />
      {:else}
        <p class="text-muted">{t('cmp.empty')}</p>
      {/if}
    </section>

    {@render heading(t('today.water'))}
    <section class="card grid grid-cols-3 gap-2 p-4">
      <div>
        <p class="text-xl font-semibold text-water tabular">🔥 {streak.current}</p>
        <p class="text-xs leading-tight text-muted">{t('streak.label')}<br />{t('streak.best', { n: streak.best })}</p>
      </div>
      <div>
        <p class="text-xl font-semibold tabular">{caffeine === null ? '–' : `${Math.round(caffeine)} mg`}</p>
        <p class="text-xs leading-tight text-muted">{t('drink.caffeineAvg')}</p>
      </div>
      <div>
        <p class="text-xl font-semibold tabular">{alcohol}</p>
        <p class="text-xs leading-tight text-muted">{t('drink.alcoholDays')}</p>
      </div>
    </section>

    {@render heading(t('ins.patterns'))}
    <section class="card p-4">
      <CardHeading class="mb-1" title={t('ins.monthly')} />
      <div class="mb-2 flex flex-wrap gap-x-4 text-xs text-muted">
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
        <CardHeading class="mb-1" title={t('ins.weekday')} />
        <BarChart height={72} bars={stats.weekday.map((v, i) => ({ label: weekdayShort()[i], value: v }))} />
      </section>

      <section class="card p-4">
        <CardHeading class="mb-1" title={t('ins.timeOfDay')} />
        <BarChart height={72} bars={stats.timeOfDay.map((v, i) => ({ label: `${String(i * 3).padStart(2, '0')}`, value: v }))} />
      </section>
    {/if}

    {#if stats.tags.length}
      <section class="card p-4">
        <CardHeading class="mb-3" title={t('ins.tags')} />
        <ul class="flex flex-col gap-2">
          {#each stats.tags as tag (tag.tag)}
            <li class="flex items-center gap-3">
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

<ReportSheet bind:months={reportMonths} />
