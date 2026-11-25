<script lang="ts">
  import { Pencil } from '@lucide/svelte';
  import { edit } from '$lib/editor.svelte';
  import { openSheet } from '$lib/ui.svelte';
  import CardHeading from './CardHeading.svelte';
  import LimitBar from './LimitBar.svelte';
  import LimitWheel from './LimitWheel.svelte';
  import EntryRow from './EntryRow.svelte';
  import { medicationEffect, medicationLimits, medicationRule, overuseRows } from '$lib/analysis';
  import { medColor, RELIEF_COLOR, STATUS_COLOR } from '$lib/colors';
  import { DAY, hm, keyToDate } from '$lib/days';
  import { ifTakenTodayLine, limitReason } from '$lib/format';
  import { fmt, reliefLabels, t } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { SOURCES } from '$lib/sources';

  /** Days the effect of each medication looks back on. */
  const EFFECT_WINDOW_DAYS = 90;
  const rule = $derived(medicationRule(data.intakes, clock.now));
  /** Each class against its own limit, only when several were taken: with one, the main limit already is that class's. */
  const classRows = $derived(rule.classes.length > 1 ? overuseRows(data.intakes, clock.now) : []);
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
    <CardHeading title={t('meds.limits')} />
    <LimitWheel
      count={rule.count}
      limit={rule.limit}
      title={t('tenTwenty.title')}
      note={limitReason(rule)}
      color={STATUS_COLOR[rule.status]}
      info={[
        { title: t('info.rule'), body: t('tenTwenty.rule') },
        { title: t('info.evidence'), body: t('tenTwenty.evidence') }
      ]}
      sources={SOURCES.medication}
    />
    <div class="flex flex-col items-center gap-0.5 text-center text-sm">
      <p class="rounded-2xl px-3 py-1 font-semibold" style:color={tone} style:background-color="color-mix(in oklab, {tone} 14%, transparent)"><span class="whitespace-nowrap">{label} ·</span> <span class="whitespace-nowrap">{t('tenTwenty.freeDays', { n: rule.freeDays })}</span></p>
      {#if rule.days[rule.days.length - 1].med}
        <p class="text-muted">{t('tenTwenty.alreadyToday')}</p>
      {:else}
        <p class="text-muted">{ifTakenTodayLine(rule)}</p>
      {/if}
      {#if rule.nextRelief}
        <p class="text-muted">{t('tenTwenty.nextRelief', { date: fmt(keyToDate(rule.nextRelief), 'EEE d. MMM') })}</p>
      {/if}
    </div>
    {#if classRows.length || personal.length}
      <div class="flex flex-col border-t border-line pt-2">
        {#each classRows as row (row.key)}
          <LimitBar
            count={row.days}
            limit={row.limit}
            title={t(`cat.${row.key}`)}
            sub={t('meds.classLimit')}
            color={STATUS_COLOR[row.status]}
            info={[
              { title: t('info.rule'), body: t('overuse.classRule', { cls: t(`cat.${row.key}`), limit: row.limit }) },
              { title: t('info.which'), body: t(`catDesc.${row.key}`) },
              { title: t('info.evidence'), body: t('overuse.hint') }
            ]}
            sources={SOURCES.medication}
          />
        {/each}
        {#each personal as { med, rule: r } (med.id)}
          <LimitBar
            count={r.count}
            limit={r.limit}
            title={med.name}
            sub={t('meds.personalLimit', { n: r.window })}
            color={STATUS_COLOR[r.status]}
            info={[{ title: t('info.rule'), body: t('tenTwenty.personalRule', { name: med.name, limit: r.limit, window: r.window }) }]}
          />
        {/each}
      </div>
    {/if}
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
            <EntryRow
              kind="intake"
              time={hm(intake.time)}
              title={intake.name}
              sub={intake.dose}
              lines={[fmt(intake.time, 'EEE d. MMM')]}
              onclick={() => edit({ kind: 'intake', item: intake })}
            >
              {#snippet trailing()}
                <span class="shrink-0 text-right text-sm font-medium" style:color={intake.relief === null ? undefined : RELIEF_COLOR[intake.relief]}>
                  {intake.relief === null ? t('meds.rate') : reliefLabels()[intake.relief]}
                </span>
              {/snippet}
            </EntryRow>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <p class="px-2 text-center text-sm text-muted">{t('tenTwenty.disclaimer')}</p>
</div>
