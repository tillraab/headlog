<script lang="ts">
  let { onOpenTab }: { onOpenTab: (tab: 'calendar') => void } = $props();

  import { Pencil } from '@lucide/svelte';
  import { edit } from '$lib/editor.svelte';
  import { openSheet } from '$lib/ui.svelte';
  import CardHeading from './CardHeading.svelte';
  import { intakeDays, medicationEffect, medicationLimits, overuseRows, tenTwenty, type RuleStatus } from '$lib/analysis';
  import { medColor } from '$lib/colors';
  import { DAY, keyToDate } from '$lib/days';
  import { fmt, reliefLabels, t } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { SOURCES } from '$lib/sources';

  /** Days the effect of each medication looks back on. */
  const EFFECT_WINDOW_DAYS = 90;
  const STATUS_COLOR: Record<RuleStatus, string> = { ok: 'var(--color-ok)', caution: 'var(--color-caution)', over: 'var(--color-over)' };
  const medDays = $derived(new Set(intakeDays(data.intakes).keys()));
  const rule = $derived(tenTwenty(medDays, clock.now, data.settings.limit));
  const overuse = $derived(overuseRows(data.intakes, new Date(clock.now)));
  const RELIEF_COLOR = ['var(--color-over)', 'var(--color-caution)', 'var(--color-ok)'];
  /** Intakes and relief ratings per medication name over the last 90 days. */
  const effect = $derived(medicationEffect(data.intakes, clock.now - EFFECT_WINDOW_DAYS * DAY, clock.now, (i) => i.name));
  const recent = $derived([...data.intakes].sort((a, b) => b.time - a.time).slice(0, 8));
  const personal = $derived(medicationLimits(data.intakes, data.medications, clock.now));
  const tone = $derived(STATUS_COLOR[rule.status]);
  const label = $derived({ ok: t('tenTwenty.ok'), caution: t('tenTwenty.caution'), over: t('tenTwenty.over') }[rule.status]);

  const R = 70;
  const C = 2 * Math.PI * R;
  const arc = 0.75;
  const fill = $derived(Math.min(1, rule.count / (rule.limit + 5)));
</script>

<div class="flex flex-col gap-3 pb-6">
  <header class="flex items-center justify-between pt-2">
    <h1 class="text-3xl font-semibold">{t('meds.title')}</h1>
    <button class="press grid size-11 place-items-center rounded-full bg-surface-2" onclick={() => openSheet('medList')} aria-label={t('set.meds')}>
      <Pencil size={22} />
    </button>
  </header>

  <section class="card flex flex-col items-center p-4">
    <CardHeading class="self-stretch" title={t('tenTwenty.title')} info={[
        { title: t('info.rule'), body: t('tenTwenty.rule') },
        { title: t('info.evidence'), body: t('tenTwenty.evidence') }
      ]} sources={SOURCES.medication} />
    <div class="relative size-44">
      <svg viewBox="0 0 160 160" class="pointer-events-none size-full rotate-135">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--color-surface-2)" stroke-width="14" stroke-linecap="round" stroke-dasharray="{C * arc} {C}" />
        <circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke="var(--color-over)"
          stroke-opacity="0.25"
          stroke-width="14"
          stroke-dasharray="0 {C * arc * ((rule.allowed + 0.5) / (rule.limit + 5))} {C * arc * ((rule.limit + 4.5 - rule.allowed) / (rule.limit + 5))} {C}"
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
        <p class="mt-1 max-w-28 text-center text-xs leading-tight text-muted">{t('tenTwenty.short')}</p>
      </div>
    </div>
    <p class="-mt-4 rounded-full px-3 py-1 font-semibold" style:color={tone} style:background-color="color-mix(in oklab, {tone} 14%, transparent)">
      {label}
    </p>
    <div class="mt-3 flex flex-col items-center gap-0.5 text-center">
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
    <button class="press mt-3 min-h-11 rounded-full bg-surface-2 px-4 py-2 font-medium" onclick={() => onOpenTab('calendar')}>
      📅 {t('meds.toCalendar')}
    </button>
  </section>

  {#if personal.length}
    <section class="card p-4">
      <CardHeading class="mb-2" title={t('tenTwenty.personal')} info={t('tenTwenty.personalHint')} />
      <ul class="flex flex-col gap-3">
        {#each personal as { med, rule: r } (med.id)}
          <li class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="size-3 shrink-0 rounded-full" style:background-color={med.color}></span>
              <span class="flex-1 font-medium">{med.name}</span>
              <span class="font-semibold tabular" style:color={STATUS_COLOR[r.status]}>{t('tenTwenty.limitCount', { n: r.count, limit: r.limit, window: r.window })}</span>
            </div>
            <div class="flex gap-0.5">
              {#each { length: r.limit } as _, i (i)}
                <div class="h-2.5 flex-1 rounded-full" style:background-color={i < r.count ? STATUS_COLOR[r.status] : 'var(--color-surface-2)'}></div>
              {/each}
              {#each { length: Math.max(0, r.count - r.limit) } as _, i (i)}
                <div class="h-2.5 flex-1 rounded-full bg-over"></div>
              {/each}
            </div>
            {#if r.nextRelief}
              <p class="text-xs text-muted">{t('tenTwenty.nextRelief', { date: fmt(keyToDate(r.nextRelief), 'EEE d. MMM') })}</p>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}



  {#if effect.length}
    <section class="card p-4">
      <CardHeading class="mb-2" title={t('meds.effect')} info={t('meds.effectHint')} />
      <ul class="flex flex-col gap-3">
        {#each effect as m (m.name)}
<li class="flex flex-col gap-1">
            <div class="flex items-center gap-3">
              <span class="size-3 shrink-0 rounded-full" style:background-color={medColor(m, data.medications)}></span>
              <span class="flex-1 font-medium">{m.name}</span>
              <span class="text-xs text-muted tabular">{t('tenTwenty.intakes', { n: m.intakes, d: m.days })}</span>
            </div>
            {#if m.rated}
              <div class="ml-6 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
                {#each [['var(--color-over)', m.relief[0]], ['var(--color-caution)', m.relief[1]], ['var(--color-ok)', m.relief[2]]] as [color, n], i (i)}
                  <div style:width="{(Number(n) / m.rated) * 100}%" style:background-color={String(color)}></div>
                {/each}
              </div>
              <span class="ml-6 text-xs text-muted tabular">
                {t('meds.reliefCounts', { no: m.relief[0], some: m.relief[1], yes: m.relief[2] })}
              </span>
            {:else}
              <span class="ml-6 text-xs text-muted">{t('ins.noRelief')}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if recent.length}
    <section class="card p-2">
      <h2 class="px-2 pt-2 pb-1 text-lg font-semibold">{t('meds.recent')}</h2>
      <ul>
        {#each recent as intake (intake.id)}
          <li>
            <button class="press flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2" onclick={() => edit({ kind: 'intake', item: intake })}>
              <span class="size-3 shrink-0 rounded-full" style:background-color={medColor(intake, data.medications)}></span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span>{intake.name} <span class="text-muted">{intake.dose}</span></span>
                <span class="text-xs text-muted tabular">{fmt(intake.time, 'EEE d. MMM HH:mm')}</span>
              </span>
              <span class="shrink-0 text-right text-sm font-medium" style:color={intake.relief === null ? undefined : RELIEF_COLOR[intake.relief]}>
                {intake.relief === null ? t('meds.rate') : reliefLabels()[intake.relief]}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="card p-4">
    <CardHeading class="mb-2" title={`${t('overuse.title')} · ${fmt(clock.now, 'LLLL')}`} info={[t('overuse.hint'), t('overuse.notCounted')]} sources={SOURCES.medication} />
    <ul class="flex flex-col gap-3">
      {#each overuse as row (row.key)}
        <li class="flex flex-col gap-1">
          <div class="flex justify-between gap-3">
            <span>{row.key === 'multiple' ? t('overuse.multiple') : t(`cat.${row.key}`)}</span>
            <span class="shrink-0 tabular">{row.days} / {row.limit} {t('overuse.days')}</span>
          </div>
          <div class="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              class="h-full rounded-full"
              style:width="{Math.min(100, (row.days / row.limit) * 100)}%"
              style:background-color={row.days >= row.limit ? 'var(--color-over)' : row.days >= row.limit * 0.7 ? 'var(--color-caution)' : 'var(--color-ok)'}
            ></div>
          </div>
        </li>
      {:else}
        <li class="text-muted">{t('overuse.none')}</li>
      {/each}
    </ul>
  </section>

  <p class="px-2 text-center text-sm text-muted">{t('tenTwenty.disclaimer')}</p>
</div>
