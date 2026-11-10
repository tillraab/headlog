<script lang="ts">
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { addMonths, endOfMonth, getDay, isAfter, startOfDay, startOfMonth } from 'date-fns';
  import { headacheDays, intakeDays, monthSummary, rollingDays, ruleStatus, tenTwenty, waterByDay, type RuleStatus } from '$lib/analysis';
  import { dayKey, dayRange, formatLiters, keyToDate } from '$lib/days';
  import { fmt, t, weekdayShort } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { openSheet } from '$lib/ui.svelte';
  import { intakeColor } from '$lib/colors';
  import CardHeading from './CardHeading.svelte';
  import DaySheet from './DaySheet.svelte';
  import InfoButton from './InfoButton.svelte';
  import TimelineChart from './TimelineChart.svelte';
  import { SOURCES } from '$lib/sources';

  /** Days shown in the rolling chart. */
  const ROLLING_SPAN = 90;
  /** From 15 headache days a month, ICHD-3 speaks of chronic headache (chronic migraine: for more than 3 months). */
  const CHRONIC_DAYS = 15;

  let month = $state(startOfMonth(Date.now()));
  let selected = $state<string | null>(null);

  const hDays = $derived(headacheDays(data.episodes, clock.now));
  const mDays = $derived(intakeDays(data.intakes, false));
  const water = $derived(waterByDay(data.drinks));
  const keys = $derived(dayRange(month, endOfMonth(month)));
  const offset = $derived((getDay(month) + 6) % 7);
  const today = $derived(dayKey(clock.now));
  const summary = $derived(monthSummary(data, month, clock.now));

  const rolling = $derived(rollingDays(new Set(hDays.keys()), clock.now, ROLLING_SPAN));
  /** Days with acute medication; preventive medication does not count for the 10/20 rule. */
  const acuteDays = $derived(new Set(intakeDays(data.intakes).keys()));
  const medRolling = $derived(rollingDays(acuteDays, clock.now, ROLLING_SPAN));
  const rule = $derived(tenTwenty(acuteDays, clock.now, data.settings.limit));
  const RULE_COLOR: Record<RuleStatus, string> = { ok: 'var(--color-med)', caution: 'var(--color-caution)', over: 'var(--color-over)' };

  function open(key: string) {
    selected = key;
    openSheet('day');
  }

  function painStyle(intensity: number | undefined): string | undefined {
    if (!intensity) return undefined;
    return `color-mix(in oklab, var(--color-pain) ${25 + intensity * 7.5}%, transparent)`;
  }
</script>

<div class="flex flex-col gap-3 pb-6">
  <header class="flex items-center justify-between pt-2">
    <h1 class="text-3xl font-semibold capitalize">{fmt(month, 'LLLL yyyy')}</h1>
    <div class="flex gap-1">
      <button class="press grid size-11 place-items-center rounded-full bg-surface-2" onclick={() => (month = addMonths(month, -1))} aria-label={t('a11y.prevMonth')}>
        <ChevronLeft size={24} />
      </button>
      <button
        class="press grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-40"
        disabled={isAfter(addMonths(month, 1), clock.now)}
        onclick={() => (month = addMonths(month, 1))}
        aria-label={t('a11y.nextMonth')}
      >
        <ChevronRight size={24} />
      </button>
    </div>
  </header>

  <section class="card p-3">
    <div class="mb-1 grid grid-cols-7 text-center text-sm font-medium text-muted">
      {#each weekdayShort() as wd (wd)}<span>{wd}</span>{/each}
    </div>
    <div class="grid grid-cols-7 gap-1">
      {#each { length: offset } as _, i (i)}<span></span>{/each}
      {#each keys as key (key)}
        {@const intensity = hDays.get(key)}
        {@const meds = mDays.get(key)}
        {@const ml = water.get(key) ?? 0}
        {@const future = key > today}
        <button
          class="press relative flex aspect-square flex-col items-center justify-center rounded-xl pb-1.5 text-base tabular disabled:opacity-30
            {key === today ? 'ring-2 ring-primary' : ''} {intensity ? 'font-semibold text-white' : 'bg-surface-2'}"
          style:background-color={painStyle(intensity)}
          disabled={future}
          onclick={() => open(key)}
        >
          {keyToDate(key).getDate()}
          {#if meds?.length}
            <span class="absolute bottom-2 flex gap-0.5">
              {#each meds.slice(0, 3) as m (m.id)}
                <span class="size-2 rounded-full ring-1 ring-surface" style:background-color={intakeColor(m, data.medications)}></span>
              {/each}
            </span>
          {/if}
          {#if ml >= data.settings.waterGoalMl}
            <span class="absolute inset-x-2 bottom-0.5 h-1 rounded-full bg-water"></span>
          {/if}
        </button>
      {/each}
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-muted">
      <span class="flex items-center gap-1.5"><span class="size-3.5 rounded bg-pain"></span>{t('cal.headache')}</span>
      <span class="flex items-center gap-1.5"><span class="h-1 w-3.5 rounded-full bg-water"></span>{t('cal.water')}</span>
      {#each data.medications as med (med.id)}
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-full" style:background-color={intakeColor({ medId: med.id, name: med.name, category: med.category }, data.medications)}></span>{med.name}
        </span>
      {/each}
      <InfoButton class="-ml-2" title={t('tab.calendar')} text={t('cal.medsHint')} />
    </div>
  </section>

  <section class="grid grid-cols-3 gap-2">
    <div class="card p-3">
      <p class="text-2xl font-semibold text-pain tabular">{summary.headache}</p>
      <p class="text-xs leading-tight hyphens-auto text-muted">{t('cal.headacheDays')}</p>
    </div>
    <div class="card p-3">
      <p class="text-2xl font-semibold text-med tabular">{summary.med}</p>
      <p class="text-xs leading-tight hyphens-auto text-muted">{t('cal.medDays')}</p>
    </div>
    <div class="card p-3">
      <p class="text-2xl font-semibold text-water tabular">{formatLiters(summary.water)}</p>
      <p class="text-xs leading-tight hyphens-auto text-muted">{t('cal.avgWater')}</p>
    </div>
  </section>

  <section class="card p-4">
    <CardHeading
      class="mb-3"
      title={t('cal.rolling')}
      info={[t('cal.rollingHint', { n: CHRONIC_DAYS }), t('cal.rollingMedHint', { n: rule.limit })]}
      sources={[...SOURCES.chronic, ...SOURCES.medication]}
    />
    <TimelineChart
      keys={rolling.map((r) => r.key)}
      bands={rolling.map((r) => hDays.has(r.key))}
      rows={[
        {
          label: t('cal.headacheDaysRow'),
          summary: t('cal.rollingNow', { n: rolling[rolling.length - 1].count }),
          values: rolling.map((r) => r.count),
          colors: rolling.map((r) => (r.count >= CHRONIC_DAYS ? 'var(--color-over)' : 'var(--color-pain)')),
          color: 'var(--color-pain)',
          kind: 'bars',
          format: (v) => String(Math.round(v)),
          reference: CHRONIC_DAYS
        },
        {
          label: t('cal.medDays'),
          summary: t('cal.rollingNow', { n: medRolling[medRolling.length - 1].count }),
          values: medRolling.map((r) => r.count),
          colors: medRolling.map((r) => RULE_COLOR[ruleStatus(r.count, rule.allowed)]),
          color: 'var(--color-med)',
          kind: 'bars',
          format: (v) => String(Math.round(v)),
          reference: rule.limit
        }
      ]}
    />
  </section>
</div>

<DaySheet day={selected ?? dayKey(startOfDay(clock.now))} />
