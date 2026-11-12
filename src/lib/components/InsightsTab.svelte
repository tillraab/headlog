<script lang="ts">
  import { FileText } from '@lucide/svelte';
  import { average, caffeineByDay, compareDays, firstDrinkDay, headacheDays, intakeDays, monthlyCounts, periodStats, rollingDays, ruleStatus, TEN_TWENTY_LIMIT, tenTwenty, timeline, type RuleStatus } from '$lib/analysis';
  import { entryDetailLines, formatComparison } from '$lib/format';
  import { addDays, endOfDay } from 'date-fns';
  import { dayKey, dayRange, formatDuration, formatLiters, HOUR, keyToDate, lastDays } from '$lib/days';
  import { openSheet } from '$lib/ui.svelte';
  import { fmt, num, t, tagLabel, weekdayShort } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { dropToNextDay, isPressureDrop, PRESSURE_DROP_HPA } from '$lib/weather';
  import { SOURCES } from '$lib/sources';
  import { SHORT_SLEEP_HOURS } from '$lib/thresholds';
  import BarChart from './BarChart.svelte';
  import CardHeading from './CardHeading.svelte';
  import ComparisonChart, { type Pair } from './ComparisonChart.svelte';
  import RangeButton from './RangeButton.svelte';
  import ReportSheet from './ReportSheet.svelte';
  import TimelineChart, { type Row } from './TimelineChart.svelte';

  const PERIODS = [3, 7, 30];
  /** From 15 headache days a month, ICHD-3 speaks of chronic headache (chronic migraine: for more than 3 months). */
  const CHRONIC_DAYS = 15;
  const RULE_COLOR: Record<RuleStatus, string> = { ok: 'var(--color-med)', caution: 'var(--color-caution)', over: 'var(--color-over)' };
  /** The chosen number of days, or a From–To range when `custom` is set. */
  let period = $state(30);
  let custom = $state<{ from: string; to: string } | null>(null);
  let reportMonths = $state(1);

  const today = $derived(dayKey(clock.now));
  const keys = $derived(custom ? dayRange(keyToDate(custom.from), keyToDate(custom.to)) : lastDays(clock.now, period));
  const span = $derived(keys.length);
  /** The end of the period: now, or the end of the range's last day. */
  const end = $derived(custom && custom.to < today ? endOfDay(keyToDate(custom.to)).getTime() : clock.now);
  const stats = $derived(periodStats(data, end, span));
  /** Days in the period scaled to 30 days, e.g. "(1 / 30 days)"; for periods under 30 days an extrapolation. */
  const per30 = (count: number) => (span === 30 ? '' : t('ins.per30', { n: num((count * 30) / span, (count * 30) % span === 0 ? 0 : 1) }));

  /** Months the doctor report covers for this period, from 1 to 12. */
  const reportFor = $derived(Math.min(12, Math.max(1, Math.round(span / 30))));

  function openCustom() {
    const from = dayKey(addDays(clock.now, -89));
    const first = firstDrinkDay(data.drinks);
    custom ??= { from: first && first > from ? first : from, to: today };
  }
  /**
   * The charts run on into the forecast days the weather covers, up to the day after tomorrow, so the
   * drop behind a mark on tomorrow is drawn too.
   */
  const forecastKeys = $derived.by(() => {
    const ahead: string[] = [];
    if (keys.at(-1) !== today) return ahead;
    for (const n of [1, 2]) {
      const key = dayKey(addDays(clock.now, n));
      if (!data.weather.has(key)) break;
      ahead.push(key);
    }
    return ahead;
  });
  const chartKeys = $derived([...keys, ...forecastKeys]);
  const series = $derived(timeline(data, chartKeys, clock.now));
  const months = $derived(monthlyCounts(data, end, span > 180 ? 12 : 6));
  const hasData = $derived(stats.episodes > 0 || stats.intakes > 0 || stats.avgWaterMl !== null);
  const maxTag = $derived(Math.max(1, ...stats.tags.map((x) => x.count)));

  const known = (values: (number | null)[]) => values.filter((v): v is number => v !== null);
  const sleepAvg = $derived(average(known(series.sleepHours)));
  const caffeine = $derived.by(() => {
    const byDay = caffeineByDay(data.drinks);
    return average(keys.filter((k) => byDay.has(k)).map((k) => byDay.get(k)!));
  });

  /** Headache and acute medication days in the 30 days up to each day, over the same days as the other charts. */
  const rollingRows = $derived.by((): Row[] => {
    const last = keyToDate(keys[keys.length - 1]);
    /** Preventive medication does not count for the 10/20 rule. */
    const acuteDays = new Set(intakeDays(data.intakes).keys());
    const rule = tenTwenty(acuteDays, clock.now);
    const headache = rollingDays(new Set(headacheDays(data.episodes, clock.now).keys()), last, span).map((r) => r.count);
    const med = rollingDays(acuteDays, last, span).map((r) => r.count);
    const ahead = forecastKeys.map(() => null);
    const lastCount = (counts: number[]) =>
      keys[keys.length - 1] === today ? t('cal.rollingNow', { n: counts[counts.length - 1] }) : t('cal.rollingOn', { n: counts[counts.length - 1], date: fmt(last, 'd. MMM') });
    return [
      {
        label: t('tl.headacheDays30'),
        summary: lastCount(headache),
        average: average(headache),
        values: [...headache, ...ahead],
        colors: [...headache.map((n) => (n >= CHRONIC_DAYS ? 'var(--color-over)' : 'var(--color-pain)')), ...ahead.map(() => 'var(--color-pain)')],
        color: 'var(--color-pain)',
        kind: 'bars',
        format: (v) => num(v, 0, 1),
        reference: CHRONIC_DAYS
      },
      {
        label: t('tl.medDays30'),
        summary: lastCount(med),
        average: average(med),
        values: [...med, ...ahead],
        colors: [...med.map((n) => RULE_COLOR[ruleStatus(n, rule.allowed)]), ...ahead.map(() => 'var(--color-med)')],
        color: 'var(--color-med)',
        kind: 'bars',
        format: (v) => num(v, 0, 1),
        reference: rule.limit
      }
    ];
  });

  /** What the two rows of days in 30 mean, for the timeline's (i). */
  const rollingInfo = $derived([t('cal.rollingHint', { n: CHRONIC_DAYS }), t('cal.rollingMedHint', { n: TEN_TWENTY_LIMIT })]);
  const rollingSources = [...SOURCES.chronic, ...SOURCES.medication];

  const rows = $derived.by(() => {
    const result: Row[] = [
      {
        label: t('tl.headache'),
        summary: stats.headacheDays === 1 ? t('tl.day') : t('tl.days', { n: stats.headacheDays }),
        values: series.headache,
        color: 'var(--color-pain)',
        kind: 'bars',
        format: (v) => (v ? `${num(v, 0, 1)}/10` : '–'),
        average: average(known(series.headache.slice(0, keys.length)).filter((v) => v > 0))
      },
      ...rollingRows
    ];
    const water = known(series.hydration);
    if (water.length) {
      result.push({
        label: t('tl.hydration'),
        summary: t('tl.hydrationSummary', { n: water.filter((v) => v >= data.settings.waterGoalMl).length }),
        average: average(water),
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
        label: t('tl.sleep'),
        summary: t('tl.sleepSummary', { n: sleep.length }),
        average: average(sleep),
        values: series.sleepHours,
        color: 'var(--color-primary)',
        kind: 'bars',
        format: (v) => `${num(v, 0, 1)} h`,
        reference: SHORT_SLEEP_HOURS
      });
    }
    if (known(series.pressure).length) {
      const marks = chartKeys.map((k) => isPressureDrop(dropToNextDay(data.weather, k) ?? 0));
      result.push({
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
        <button class="press min-h-10 flex-auto rounded-full px-1 py-1.5 whitespace-nowrap {!custom && period === p ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => ((period = p), (custom = null))}>
          {t('ins.days', { n: p })}
        </button>
      {/each}
      <button class="press min-h-10 flex-auto rounded-full px-1 py-1.5 whitespace-nowrap {custom ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={openCustom}>{t('ins.custom')}</button>
    </div>
    {#if custom}
      <RangeButton from={custom.from} to={custom.to} onpick={(r) => (custom = r)} />
    {/if}
  </header>


  {#if !hasData}
    <p class="card p-6 text-center text-muted">{t('ins.noData')}</p>
  {:else}
    {@render heading(t('ins.headaches'))}
    <section class="grid grid-cols-2 gap-2">
      {#each [
        { label: t('ins.headacheDays'), value: String(stats.headacheDays), sub: per30(stats.headacheDays), cls: 'text-pain' },
        { label: t('ins.medDays'), value: String(stats.medDays), sub: per30(stats.medDays), cls: 'text-med' },
        { label: t('ins.avgIntensity'), value: stats.avgIntensity === null ? '–' : num(stats.avgIntensity, 1), sub: stats.avgIntensity === null ? '' : t('ins.ofTen'), cls: '' },
        { label: t('ins.avgDuration'), value: stats.avgDurationMs === null ? '–' : formatDuration(stats.avgDurationMs), sub: '', cls: '' }
      ] as tile (tile.label)}
        <div class="card p-3">
          <p class="text-xl font-semibold tabular {tile.cls}">{tile.value}<span class="ml-1 text-sm font-normal text-muted">{tile.sub}</span></p>
          <p class="text-xs leading-tight hyphens-auto text-muted">{tile.label}</p>
          {#if span < 30 && tile.cls}<p class="mt-0.5 text-caption leading-tight text-caution">⚠ {t('ins.extrapolated')}</p>{/if}
        </div>
      {/each}
    </section>

    {@render heading(t('ins.dailyAverages'))}
    <section class="grid grid-cols-3 gap-2">
      {#each [
        { label: t('ins.avgWater'), value: stats.avgWaterMl === null ? '–' : formatLiters(stats.avgWaterMl), cls: 'text-water' },
        { label: t('sleep.avg'), value: sleepAvg === null ? '–' : formatDuration(sleepAvg * HOUR), cls: 'text-primary' },
        { label: t('ins.avgCaffeine'), value: caffeine === null ? '–' : `${Math.round(caffeine)} mg`, cls: '' }
      ] as tile (tile.label)}
        <div class="card p-3">
          <p class="text-xl font-semibold tabular {tile.cls}">{tile.value}</p>
          <p class="text-xs leading-tight hyphens-auto text-muted">{tile.label}</p>
        </div>
      {/each}
    </section>

    {@render heading(t('ins.connections'))}
    <section class="card p-4">
      <CardHeading class="mb-3" title={t('tl.title')} info={[t('tl.hint'), t('tl.linesHint', { sleep: SHORT_SLEEP_HOURS }), ...rollingInfo]} sources={rollingSources} />
      <TimelineChart {rows} keys={chartKeys} forecast={chartKeys.length - keys.length} bands={series.headache.map((v) => v > 0)} details={dayDetails} />
    </section>

    <section class="card p-4">
      <CardHeading class="mb-3" title={t('cmp.title')} info={t('cmp.hint')} />
      {#if pairs.length}
        <ComparisonChart {pairs} headacheLabel={t('cmp.headache')} clearLabel={t('cmp.clear')} />
      {:else}
        <p class="text-muted">{t('cmp.empty')}</p>
      {/if}
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
          limit={{ value: TEN_TWENTY_LIMIT, color: 'var(--color-over)' }}
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
  <button
    class="press mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 font-semibold"
    onclick={() => {
      reportMonths = reportFor;
      openSheet('report');
    }}
  >
    <FileText size={22} />
    {t('pdf.insightsButton', { n: reportFor })}
  </button>
</div>

<ReportSheet bind:months={reportMonths} />
