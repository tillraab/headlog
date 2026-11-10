<script lang="ts">
  /**
   * Picks a date range in one month calendar: the first tap sets the start, the second the end. Days before the
   * first logged drink, when the app came into use, and days after today cannot be picked.
   */
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { addMonths, endOfMonth, getDay, startOfMonth } from 'date-fns';
  import { firstDrinkDay } from '$lib/analysis';
  import { dayKey, dayRange, keyToDate, pickRangeDay, rangeDayCount } from '$lib/days';
  import { fmt, t, weekdayShort } from '$lib/i18n.svelte';
  import { clock, data } from '$lib/store.svelte';
  import { closeSheet, rangePicker, sheets, tap } from '$lib/ui.svelte';
  import Sheet from './Sheet.svelte';

  const today = $derived(dayKey(clock.now));
  const first = $derived(firstDrinkDay(data.drinks) ?? today);
  let range = $state<{ from: string; to: string | null }>({ from: '', to: null });
  let month = $state(startOfMonth(Date.now()));

  /** Starts from the range handed over each time the picker opens. */
  $effect(() => {
    if (!sheets.stack.includes('range')) return;
    range = { from: rangePicker.from, to: rangePicker.to };
    month = startOfMonth(keyToDate(rangePicker.to));
  });

  const count = $derived(range.to ? rangeDayCount(range.from, range.to) : 1);
  const days = $derived(dayRange(month, endOfMonth(month)));
  const offset = $derived((getDay(month) + 6) % 7);
  const canBack = $derived(dayKey(month) > first);
  const canForward = $derived(dayKey(endOfMonth(month)) < today);

  function pick(day: string) {
    tap();
    range = pickRangeDay(range, day);
  }

  function apply() {
    rangePicker.onpick({ from: range.from, to: range.to ?? range.from });
    closeSheet('range');
  }
</script>

<Sheet id="range" title={t('range.title')}>
  <div class="flex flex-col gap-3">
    <p class="text-center font-semibold tabular">
      {fmt(keyToDate(range.from || today), 'd. MMM yyyy')} – {range.to ? fmt(keyToDate(range.to), 'd. MMM yyyy') : '…'}
    </p>
    <p class="-mt-2 text-center text-sm text-muted">
      {#if range.to}{t(count === 1 ? 'range.day' : 'range.days', { n: count })} · {t('range.again')}{:else}{t('range.pickEnd')}{/if}
    </p>
    <div class="flex items-center justify-between">
      <button class="press grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-30" disabled={!canBack} onclick={() => (month = addMonths(month, -1))} aria-label={t('a11y.prevMonth')}>
        <ChevronLeft size={22} />
      </button>
      <span class="font-semibold">{fmt(month, 'LLLL yyyy')}</span>
      <button class="press grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-30" disabled={!canForward} onclick={() => (month = addMonths(month, 1))} aria-label={t('a11y.nextMonth')}>
        <ChevronRight size={22} />
      </button>
    </div>
    <div class="grid grid-cols-7 gap-y-1 text-center">
      {#each weekdayShort() as w (w)}<span class="text-xs text-muted">{w}</span>{/each}
      {#each { length: offset } as _, i (i)}<span></span>{/each}
      {#each days as key (key)}
        {@const out = key < first || key > today}
        {@const end = key === range.from || key === range.to}
        {@const inside = range.to !== null && key > range.from && key < range.to}
        <button
          class="press h-11 text-sm tabular disabled:opacity-25 {end ? 'rounded-full bg-primary font-semibold text-primary-fg' : inside ? 'bg-primary/15' : 'rounded-full'}"
          disabled={out}
          onclick={() => pick(key)}
        >
          {keyToDate(key).getDate()}
        </button>
      {/each}
    </div>
    <p class="text-center text-xs text-muted">{t('range.firstDay', { date: fmt(keyToDate(first), 'd. MMM yyyy') })}</p>
    <div class="flex justify-end gap-2">
      <button class="press min-h-11 rounded-full px-4 font-medium" onclick={() => closeSheet('range')}>{t('edit.cancel')}</button>
      <button class="press min-h-11 rounded-full bg-primary px-5 font-semibold text-primary-fg" onclick={apply}>{t('range.apply')}</button>
    </div>
  </div>
</Sheet>
