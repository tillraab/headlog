<script lang="ts">
  import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from '@lucide/svelte';
  import { addMonths, endOfDay, endOfMonth, getDay, isAfter, startOfMonth } from 'date-fns';
  import { headacheDays, intakeDays } from '$lib/analysis';
  import { FACTOR_ICONS, prognosis, prognosisInput } from '$lib/prognosis';
  import { dayKey, dayRange, keyToDate } from '$lib/days';
  import { fmt, t, weekdayShort } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { openDay, openSheet, tap } from '$lib/ui.svelte';
  import { intakeColor } from '$lib/colors';
  import InfoButton from './InfoButton.svelte';

  let month = $state(startOfMonth(Date.now()));

  const hDays = $derived(headacheDays(data.episodes, clock.now));
  const mDays = $derived(intakeDays(data.intakes, false));
  const keys = $derived(dayRange(month, endOfMonth(month)));
  const offset = $derived((getDay(month) + 6) % 7);
  const today = $derived(dayKey(clock.now));

  const show = $derived(data.settings.calendar);
  const shownFactors = $derived(FACTOR_ICONS.filter(([key]) => show[key]));
  /** For each past day of the month and today, the shown factors that were unfavourable: at the end of the day, for today now. */
  const badFactors = $derived.by(() => {
    const result = new Map<string, string[]>();
    if (!shownFactors.length) return result;
    const input = prognosisInput(data);
    for (const key of keys) {
      if (key > today) break;
      const p = prognosis(input, key < today ? endOfDay(keyToDate(key)).getTime() : clock.now);
      const icons = shownFactors.filter(([factor]) => p[factor].status === 'bad').map(([, icon]) => icon);
      if (icons.length) result.set(key, icons);
    }
    return result;
  });

  /** Medications whose dots are shown. */
  const shownMeds = $derived(show.medication ? data.medications.filter((m) => !data.settings.calendarHiddenMeds.includes(m.id)) : []);
  /** What the calendar marks, in a few words, for the filter button. */
  const summary = $derived(
    [
      show.headache ? t('cal.headache') : '',
      shownMeds.length === data.medications.length && shownMeds.length ? t('cal.medication') : shownMeds.map((m) => m.name).join(', '),
      shownFactors.length ? shownFactors.map(([, icon]) => icon).join('') : ''
    ]
      .filter(Boolean)
      .join(' · ') || t('cal.nothing')
  );

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

  <button class="press flex min-h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 text-left text-sm" aria-haspopup="dialog" onclick={() => (tap(), openSheet('calendarFilter'))}>
    <SlidersHorizontal size={18} class="shrink-0 text-muted" />
    <span class="shrink-0 font-medium">{t('cal.filter')}</span>
    <span class="min-w-0 flex-1 truncate text-muted">{summary}</span>
    <ChevronDown size={18} class="shrink-0 text-muted" />
  </button>

  <section class="card p-3">
    <div class="mb-1 grid grid-cols-7 text-center text-sm font-medium text-muted">
      {#each weekdayShort() as wd (wd)}<span>{wd}</span>{/each}
    </div>
    <div class="grid grid-cols-7 gap-1">
      {#each { length: offset } as _, i (i)}<span></span>{/each}
      {#each keys as key (key)}
        {@const intensity = show.headache ? hDays.get(key) : undefined}
        {@const meds = show.medication ? mDays.get(key)?.filter((m) => !data.settings.calendarHiddenMeds.includes(m.medId)) : undefined}
        {@const icons = badFactors.get(key)}
        {@const future = key > today}
        <button
          class="press relative flex aspect-square flex-col items-center justify-center rounded-xl pb-1.5 text-base tabular disabled:opacity-30
            {key === today ? 'ring-2 ring-primary' : ''} {intensity ? 'font-semibold text-white' : 'bg-surface-2'}"
          style:background-color={painStyle(intensity)}
          disabled={future}
          onclick={() => openDay(key)}
        >
          {#if icons}
            <span class="absolute inset-x-0 top-0.5 flex justify-center text-[0.65rem] leading-none tracking-[-0.1em]" aria-hidden="true">{icons.join('')}</span>
          {/if}
          {keyToDate(key).getDate()}
          {#if meds?.length}
            <span class="absolute bottom-2 flex gap-0.5">
              {#each meds.slice(0, 3) as m (m.id)}
                <span class="size-2 rounded-full ring-1 ring-surface" style:background-color={intakeColor(m, data.medications)}></span>
              {/each}
            </span>
          {/if}
        </button>
      {/each}
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-muted">
      {#if show.headache}<span class="flex items-center gap-1.5"><span class="size-3.5 rounded bg-pain"></span>{t('cal.headache')}</span>{/if}
      {#each shownMeds as med (med.id)}
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-full" style:background-color={intakeColor({ medId: med.id, name: med.name, category: med.category }, data.medications)}></span>{med.name}
        </span>
      {/each}
      {#if shownFactors.length}<span>{shownFactors.map(([, icon]) => icon).join(' ')} {t('cal.unfavourable')}</span>{/if}
      <InfoButton class="-ml-2" title={t('tab.calendar')} text={[t('cal.medsHint'), t('cal.factorHint')]} />
    </div>
  </section>
</div>

