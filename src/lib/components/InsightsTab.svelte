<script lang="ts">
  import { FileText } from '@lucide/svelte';
  import { alcoholDays, caffeineByDay, compareDays, hydrationStreak, monthlyCounts, periodStats, timeline, type ComparisonKey } from '$lib/analysis';
  import { format } from 'date-fns';
  import { dayKey, formatDuration, formatLiters, lastDays } from '$lib/days';
  import { openSheet } from '$lib/ui.svelte';
  import { fmt, t, tagLabel, weekdayShort } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { isPressureDrop, PRESSURE_DROP_HPA } from '$lib/weather';
  import BarChart from './BarChart.svelte';
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
  const series = $derived(timeline(data, keys, clock.now));
  const streak = $derived(hydrationStreak(data.drinks, data.settings.waterGoalMl, clock.now));
  const months = $derived(monthlyCounts(data, clock.now, span === 365 ? 12 : 6));
  const hasData = $derived(stats.episodes > 0 || stats.intakes > 0 || stats.avgWaterMl !== null);
  const maxTag = $derived(Math.max(1, ...stats.tags.map((x) => x.count)));

  const known = (values: (number | null)[]) => values.filter((v): v is number => v !== null);
  const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
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
        summary: t('tl.sleepSummary', { d: formatDuration(average(sleep)! * 3600000), n: sleep.length }),
        values: series.sleepHours,
        color: 'var(--color-primary)',
        kind: 'bars',
        format: (v) => `${(Math.round(v * 10) / 10).toLocaleString()} h`,
        reference: SLEEP_REFERENCE_HOURS
      });
    }
    if (known(series.pressure).length) {
      const marks = series.pressureDrop.map((d) => d !== null && isPressureDrop(d));
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
    const key = keys[index];
    const lines: string[] = [];
    for (const e of data.episodes.filter((ep) => dayKey(ep.start) === key)) {
      lines.push(t('tl.detailHeadache', { from: format(e.start, 'HH:mm'), to: e.end ? format(e.end, 'HH:mm') : '…', n: e.intensity }));
    }
    const meds = data.intakes.filter((i) => dayKey(i.time) === key);
    if (meds.length) lines.push(`💊 ${meds.map((i) => `${i.name} ${format(i.time, 'HH:mm')}`).join(', ')}`);
    const drop = series.pressureDrop[index];
    if (drop !== null && drop >= 1) lines.push(t('tl.detailDrop', { n: Math.round(drop) }));
    return lines;
  }

  const comparisons = $derived(compareDays(data, keys, clock.now));
  const percent = (v: number) => `${Math.round(v * 100)} %`;
  const FORMAT: Record<ComparisonKey, (v: number) => string> = {
    hydration: formatLiters,
    sleep: (v) => formatDuration(v * 3600000),
    caffeine: (v) => `${Math.round(v)} mg`,
    pressure: percent,
    alcohol: percent
  };
  const pairs = $derived(
    comparisons.map(
      (c): Pair => ({
        label: t(`cmp.${c.key}`, { n: PRESSURE_DROP_HPA }),
        headache: c.headache,
        clear: c.clear,
        format: FORMAT[c.key],
        note: t('cmp.note', { h: c.nHeadache, c: c.nClear })
      })
    )
  );
</script>

{#snippet heading(title: string)}
  <h2 class="mt-3 -mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
{/snippet}

<div class="flex flex-col gap-3 pb-6">
  <header class="flex flex-col gap-2 pt-2">
    <h1 class="text-2xl font-semibold">{t('tab.insights')}</h1>
    <div class="grid grid-cols-5 rounded-full bg-surface-2 p-1 text-xs font-medium">
      {#each PERIODS as p (p)}
        <button class="press rounded-full py-1.5 {span === p ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => (span = p)}>
          {t('ins.days', { n: p })}
        </button>
      {/each}
    </div>
  </header>

  <button
    class="press flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-fg"
    onclick={() => {
      reportMonths = REPORT_MONTHS[span];
      openSheet('report');
    }}
  >
    <FileText size={18} />
    {t('pdf.insightsButton', { n: REPORT_MONTHS[span] })}
  </button>

  {#if !hasData}
    <p class="card p-6 text-center text-sm text-muted">{t('ins.noData')}</p>
  {:else}
    {@render heading(t('ins.overview'))}
    <section class="grid grid-cols-3 gap-2">
      {#each [
        { label: t('ins.headacheDays'), value: String(stats.headacheDays), cls: 'text-pain' },
        { label: t('ins.avgIntensity'), value: stats.avgIntensity === null ? '–' : stats.avgIntensity.toFixed(1), cls: '' },
        { label: t('ins.avgDuration'), value: stats.avgDurationMs === null ? '–' : formatDuration(stats.avgDurationMs), cls: '' },
        { label: t('ins.medDays'), value: String(stats.medDays), cls: 'text-med' },
        { label: t('ins.avgWater'), value: stats.avgWaterMl === null ? '–' : formatLiters(stats.avgWaterMl), cls: 'text-water' },
        { label: t('sleep.avg'), value: sleepAvg === null ? '–' : formatDuration(sleepAvg * 3600000), cls: 'text-primary' }
      ] as tile (tile.label)}
        <div class="card p-3">
          <p class="text-lg font-semibold tabular {tile.cls}">{tile.value}</p>
          <p class="text-xs leading-tight text-muted">{tile.label}</p>
        </div>
      {/each}
    </section>

    {@render heading(t('ins.connections'))}
    <section class="card p-4">
      {#if span <= HOUR_VIEW_DAYS}
        <h2 class="text-sm font-semibold">{t('hv.title')}</h2>
        <p class="mb-3 text-xs text-muted">{t('hv.hint')}</p>
        <HourTimeline {rows} {keys} now={clock.now} />
      {:else}
        <h2 class="text-sm font-semibold">{t('tl.title')}</h2>
        <p class="mb-3 text-xs text-muted">{t('tl.hint')}</p>
        <TimelineChart {rows} {keys} bands={series.headache.map((v) => v > 0)} details={dayDetails} />
      {/if}
    </section>

    <section class="card p-4">
      <h2 class="text-sm font-semibold">{t('cmp.title')}</h2>
      <p class="mb-3 text-xs text-muted">{t('cmp.hint')}</p>
      {#if pairs.length}
        <ComparisonChart {pairs} headacheLabel={t('cmp.headache')} clearLabel={t('cmp.clear')} />
      {:else}
        <p class="text-sm text-muted">{t('cmp.empty')}</p>
      {/if}
    </section>

    {@render heading(t('today.water'))}
    <section class="card grid grid-cols-3 gap-2 p-4">
      <div>
        <p class="text-lg font-semibold text-water tabular">🔥 {streak.current}</p>
        <p class="text-xs leading-tight text-muted">{t('streak.label')}<br />{t('streak.best', { n: streak.best })}</p>
      </div>
      <div>
        <p class="text-lg font-semibold tabular">{caffeine === null ? '–' : `${Math.round(caffeine)} mg`}</p>
        <p class="text-xs leading-tight text-muted">{t('drink.caffeineAvg')}</p>
      </div>
      <div>
        <p class="text-lg font-semibold tabular">{alcohol}</p>
        <p class="text-xs leading-tight text-muted">{t('drink.alcoholDays')}</p>
      </div>
    </section>

    {@render heading(t('ins.patterns'))}
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

<ReportSheet bind:months={reportMonths} />
