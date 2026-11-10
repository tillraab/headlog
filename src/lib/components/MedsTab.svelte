<script lang="ts">
  let { onOpenTab }: { onOpenTab: (tab: 'calendar') => void } = $props();

  import { Pencil } from '@lucide/svelte';
  import { edit } from '$lib/editor.svelte';
  import { openSheet } from '$lib/ui.svelte';
  import CardHeading from './CardHeading.svelte';
  import LimitWheel from './LimitWheel.svelte';
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

</script>

<div class="flex flex-col gap-3 pb-6">
  <header class="flex items-center justify-between pt-2">
    <h1 class="text-3xl font-semibold">{t('meds.title')}</h1>
    <button class="press grid size-11 place-items-center rounded-full bg-surface-2" onclick={() => openSheet('medList')} aria-label={t('set.meds')}>
      <Pencil size={22} />
    </button>
  </header>

  <section class="card flex flex-col gap-3 p-4">
    <CardHeading
      title={t('meds.limits')}
      info={[
        { title: t('info.rule'), body: t('tenTwenty.rule') },
        { title: t('info.evidence'), body: t('tenTwenty.evidence') },
        { title: t('overuse.title'), body: `${t('overuse.hint')} ${t('overuse.notCounted')}` },
        { title: t('tenTwenty.personal'), body: t('tenTwenty.personalHint') }
      ]}
      sources={SOURCES.medication}
    />
    <div class="grid grid-cols-2 gap-2">
      <LimitWheel count={rule.count} limit={rule.limit} title={t('tenTwenty.title')} period={t('meds.inDays', { n: rule.window })} color={STATUS_COLOR[rule.status]} />
      {#each overuse as row (row.key)}
        <LimitWheel
          count={row.days}
          limit={row.limit}
          title={row.key === 'multiple' ? t('overuse.multiple') : t(`cat.${row.key}`)}
          period={t('meds.thisMonth', { month: fmt(clock.now, 'LLLL') })}
          color={STATUS_COLOR[row.days >= row.limit ? 'over' : row.days >= row.limit * 0.7 ? 'caution' : 'ok']}
        />
      {/each}
      {#each personal as { med, rule: r } (med.id)}
        <LimitWheel count={r.count} limit={r.limit} title={med.name} period={t('meds.inDays', { n: r.window })} color={STATUS_COLOR[r.status]} />
      {/each}
    </div>
    <div class="flex flex-col items-center gap-0.5 text-center text-sm">
      <p class="rounded-full px-3 py-1 font-semibold" style:color={tone} style:background-color="color-mix(in oklab, {tone} 14%, transparent)">{label} · {t('tenTwenty.freeDays', { n: rule.freeDays })}</p>
      {#if rule.days[rule.days.length - 1].med}
        <p class="text-muted">{t('tenTwenty.alreadyToday')}</p>
      {:else}
        <p class="text-muted">{t('tenTwenty.ifToday', { n: rule.ifTakenToday, limit: rule.limit })}</p>
      {/if}
      {#if rule.nextRelief}
        <p class="text-muted">{t('tenTwenty.nextRelief', { date: fmt(keyToDate(rule.nextRelief), 'EEE d. MMM') })}</p>
      {/if}
    </div>
    <button class="press min-h-11 self-center rounded-full bg-surface-2 px-4 py-2 font-medium" onclick={() => onOpenTab('calendar')}>
      📅 {t('meds.toCalendar')}
    </button>
  </section>

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

  <p class="px-2 text-center text-sm text-muted">{t('tenTwenty.disclaimer')}</p>
</div>
