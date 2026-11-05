<script lang="ts">
  import { Info } from '@lucide/svelte';
  import { intakeDays, MONTHLY_LIMITS, monthlyCategoryDays, periodStats, rollingMedDays, tenTwenty } from '$lib/analysis';
  import { keyToDate } from '$lib/days';
  import { fmt, t } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';

  const medDays = $derived(new Set(intakeDays(data.intakes).keys()));
  const rule = $derived(tenTwenty(medDays, clock.now, data.settings.limit));
  const rolling = $derived(rollingMedDays(medDays, clock.now, 90));
  const max = $derived(Math.max(rule.limit + 4, ...rolling.map((r) => r.count)));
  const monthly = $derived(monthlyCategoryDays(data.intakes, new Date(clock.now)));
  const perMed = $derived(periodStats(data, clock.now, 30).meds);
  const tone = $derived({ ok: 'var(--color-ok)', caution: 'var(--color-caution)', over: 'var(--color-over)' }[rule.status]);
  const label = $derived({ ok: t('tenTwenty.ok'), caution: t('tenTwenty.caution'), over: t('tenTwenty.over') }[rule.status]);
  const colorOf = (name: string) => data.medications.find((m) => m.name === name)?.color ?? 'var(--color-med)';

  const R = 70;
  const C = 2 * Math.PI * R;
  const arc = 0.75;
  const fill = $derived(Math.min(1, rule.count / (rule.limit + 5)));

  let showInfo = $state(false);
</script>

<div class="flex flex-col gap-3 pb-6">
  <header class="flex items-center justify-between pt-2">
    <h1 class="text-2xl font-semibold">{t('tenTwenty.title')}</h1>
    <button class="press grid size-10 place-items-center rounded-full bg-surface-2" onclick={() => (showInfo = !showInfo)} aria-label="Info">
      <Info size={20} />
    </button>
  </header>

  {#if showInfo}
    <p class="card p-4 text-sm leading-relaxed">{t('tenTwenty.explain')}</p>
  {/if}

  <section class="card flex flex-col items-center p-4">
    <div class="relative size-44">
      <svg viewBox="0 0 160 160" class="size-full rotate-135">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--color-surface-2)" stroke-width="14" stroke-linecap="round" stroke-dasharray="{C * arc} {C}" />
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke="var(--color-over)"
          stroke-opacity="0.25"
          stroke-width="14"
          stroke-dasharray="0 {C * arc * ((rule.limit + 0.5) / (rule.limit + 5))} {C * arc * (4.5 / (rule.limit + 5))} {C}"
        />
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke={tone}
          stroke-width="14"
          stroke-linecap="round"
          stroke-dasharray="{Math.max(0.001, C * arc * fill)} {C}"
          class="transition-all duration-700"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <p class="text-display leading-none font-semibold tabular" style:color={tone}>{rule.count}<span class="text-xl text-muted">/{rule.limit}</span></p>
        <p class="mt-1 max-w-24 text-center text-xs leading-tight text-muted">{t('tenTwenty.short')}</p>
      </div>
    </div>
    <p class="-mt-4 rounded-full px-3 py-1 text-sm font-semibold" style:color={tone} style:background-color="color-mix(in oklab, {tone} 14%, transparent)">
      {label}
    </p>
    <div class="mt-3 flex flex-col items-center gap-0.5 text-center text-sm">
      <p>{t('tenTwenty.freeDays', { n: rule.freeDays })}</p>
      {#if rule.days[rule.days.length - 1].med}
        <p class="text-muted">{t('tenTwenty.alreadyToday')}</p>
      {:else}
        <p class="text-muted">{t('tenTwenty.ifToday', { n: rule.ifTakenToday, limit: rule.limit })}</p>
      {/if}
      {#if rule.nextRelief}
        <p class="text-muted">{t('tenTwenty.nextRelief', { date: fmt(keyToDate(rule.nextRelief), 'EEE d. MMM') })}</p>
      {/if}
    </div>
  </section>

  <section class="card p-4">
    <h2 class="mb-3 text-sm font-semibold">{t('tenTwenty.window')}</h2>
    <div class="grid grid-cols-10 gap-1">
      {#each rule.days as d (d.key)}
        <div
          class="flex aspect-square items-center justify-center rounded-md text-2xs tabular {d.med ? 'bg-med font-semibold text-white' : 'bg-surface-2 text-muted'}"
          title={d.key}
        >
          {keyToDate(d.key).getDate()}
        </div>
      {/each}
    </div>
  </section>

  <section class="card p-4">
    <h2 class="mb-3 text-sm font-semibold">{t('tenTwenty.trend')}</h2>
    <svg viewBox="0 0 90 32" preserveAspectRatio="none" class="h-28 w-full">
      <line x1="0" x2="90" y1={32 - (rule.limit / max) * 32} y2={32 - (rule.limit / max) * 32} stroke="var(--color-over)" stroke-width="0.4" stroke-dasharray="1.5 1" vector-effect="non-scaling-stroke" />
      {#each rolling as r, i (r.key)}
        <rect
          x={i + 0.1}
          width="0.8"
          y={32 - (r.count / max) * 32}
          height={(r.count / max) * 32}
          fill={r.count > rule.limit ? 'var(--color-over)' : r.count >= rule.limit - 2 ? 'var(--color-caution)' : 'var(--color-ok)'}
          opacity="0.85"
        />
      {/each}
    </svg>
    <div class="mt-1 flex justify-between text-2xs text-muted">
      <span>{fmt(keyToDate(rolling[0].key), 'd. MMM')}</span>
      <span>{fmt(clock.now, 'd. MMM')}</span>
    </div>
  </section>

  {#if perMed.length}
    <section class="card p-4">
      <h2 class="mb-3 text-sm font-semibold">{t('tenTwenty.perMed')}</h2>
      <ul class="flex flex-col gap-2">
        {#each perMed as m (m.name)}
          <li class="flex items-center gap-3 text-sm">
            <span class="size-3 rounded-full" style:background-color={colorOf(m.name)}></span>
            <span class="flex-1 font-medium">{m.name}</span>
            <span class="text-muted tabular">{t('tenTwenty.intakes', { n: m.intakes, d: m.days })}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if monthly.size}
    <section class="card p-4">
      <h2 class="mb-1 text-sm font-semibold">{t('tenTwenty.monthly')} · {fmt(clock.now, 'LLLL')}</h2>
      <p class="mb-3 text-xs text-muted">{t('tenTwenty.monthlyHint')}</p>
      <ul class="flex flex-col gap-3">
        {#each [...monthly] as [category, days] (category)}
          {@const limit = MONTHLY_LIMITS[category]}
          <li class="flex flex-col gap-1 text-sm">
            <div class="flex justify-between">
              <span>{t(`cat.${category}`)}</span>
              <span class="tabular">{days}{limit ? ` / ${limit}` : ''}</span>
            </div>
            {#if limit}
              <div class="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  class="h-full rounded-full"
                  style:width="{Math.min(100, (days / limit) * 100)}%"
                  style:background-color={days >= limit ? 'var(--color-over)' : days >= limit * 0.7 ? 'var(--color-caution)' : 'var(--color-ok)'}
                ></div>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <p class="px-2 text-center text-xs text-muted">{t('tenTwenty.disclaimer')}</p>
</div>
