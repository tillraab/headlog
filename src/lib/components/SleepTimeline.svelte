<script lang="ts">
  /**
   * A night on a time axis from evening to noon. The dots at both ends of the sleep bar move falling
   * asleep and waking up; tapping a gap, or the wake break in the list below, selects it and opens a
   * magnified bar around it, where its edges can be dragged. Grey ticks below show when the screen was
   * on, the source of the estimate.
   */
  import { format, startOfDay } from 'date-fns';
  import type { Night } from '$lib/db';
  import { formatDuration, hm, HOUR, MINUTE } from '$lib/days';
  import { t } from '$lib/i18n.svelte';
  import { FALL_ASLEEP_OPTIONS, nightEndChoices, nightSpan, nightStartChoices, onPeriods, screenEvents, sleepSegments, splitBreaks, startForChoice, typedSleepTime } from '$lib/sleep';
  import { data } from '$lib/store.svelte';
  import { tap } from '$lib/ui.svelte';

  let { night = $bindable() }: { night: Night } = $props();

  const SNAP = 5 * MINUTE;
  /** Shortest sleep before or after a break, and shortest break. */
  const MIN_GAP = 5 * MINUTE;
  const NEW_BREAK = 15 * MINUTE;
  /** The magnified bar shows this much before and after the selected break. */
  const ZOOM_MARGIN = 45 * MINUTE;
  const HALF_HOUR = 30 * MINUTE;

  type Span = { from: number; to: number };

  /** The span is fixed when the editor opens, so it does not move under the finger. */
  const span: Span = nightSpan(night);
  const pct = (time: number, within: Span = span) => ((time - within.from) / (within.to - within.from)) * 100;
  const ticks = (within: Span, step: number) => {
    const list: number[] = [];
    const midnight = startOfDay(within.from).getTime();
    for (let h = midnight + Math.ceil((within.from - midnight) / step) * step; h <= within.to; h += step) list.push(h);
    return list;
  };

  let screen = $state<{ start: number; end: number }[]>([]);
  void screenEvents(span.from, span.to)
    .then((events) => (screen = onPeriods(events, span.from, span.to)))
    .catch(() => {});

  let selected = $state<number | null>(null);
  /** Fixed while a break is selected, so the magnified bar does not move under the finger. */
  let zoom = $state<Span | null>(null);
  type Handle = 'start' | 'end' | 'breakStart' | 'breakEnd';
  let dragging = $state<{ handle: Handle; track: Element; within: Span } | null>(null);

  const segments = $derived(sleepSegments(night));

  function timeAt(clientX: number, track: Element, within: Span): number {
    const box = track.getBoundingClientRect();
    const share = Math.min(Math.max((clientX - box.left) / box.width, 0), 1);
    return Math.round((within.from + share * (within.to - within.from)) / SNAP) * SNAP;
  }

  function select(index: number | null) {
    selected = index;
    const b = index === null ? undefined : night.breaks[index];
    zoom = b
      ? {
          from: Math.max(span.from, Math.floor((b.start - ZOOM_MARGIN) / HALF_HOUR) * HALF_HOUR),
          to: Math.min(span.to, Math.ceil((b.end + ZOOM_MARGIN) / HALF_HOUR) * HALF_HOUR)
        }
      : null;
  }

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  function move(handle: Handle, time: number) {
    const b = night.breaks;
    const i = selected ?? 0;
    const before = Math.floor(time / (15 * MINUTE));
    if (handle === 'start') chosen = null;
    if (handle === 'end') chosenEnd = null;
    if (handle === 'start') night.start = clamp(time, span.from, (b[0]?.start ?? night.end) - MIN_GAP);
    if (handle === 'end') night.end = clamp(time, (b.at(-1)?.end ?? night.start) + MIN_GAP, span.to);
    if (handle === 'breakStart') b[i].start = clamp(time, (i ? b[i - 1].end : night.start) + MIN_GAP, b[i].end - MIN_GAP);
    if (handle === 'breakEnd') b[i].end = clamp(time, b[i].start + MIN_GAP, (b[i + 1]?.start ?? night.end) - MIN_GAP);
    if (before !== lastQuarter) tap('light');
    lastQuarter = before;
  }
  let lastQuarter = 0;

  function grab(handle: Handle, within: Span) {
    return (e: PointerEvent) => {
      e.stopPropagation();
      const target = e.currentTarget as Element;
      target.setPointerCapture(e.pointerId);
      dragging = { handle, track: target.parentElement!, within };
      lastQuarter = Math.floor(timeAt(e.clientX, dragging.track, within) / (15 * MINUTE));
    };
  }

  function drag(e: PointerEvent) {
    if (dragging) move(dragging.handle, timeAt(e.clientX, dragging.track, dragging.within));
  }

  function release() {
    dragging = null;
  }

  /** Selects the break under a tap on the bar, or clears the selection. */
  function pick(e: MouseEvent) {
    const time = timeAt(e.clientX, e.currentTarget as Element, span);
    const hit = night.breaks.findIndex((b) => time >= b.start - 10 * MINUTE && time <= b.end + 10 * MINUTE);
    select(hit < 0 ? null : hit);
  }

  /** A 15-minute break in the middle of the longest sleep stretch. */
  function addBreak() {
    const longest = segments.reduce((a, s) => (s.end - s.start > a.end - a.start ? s : a));
    if (longest.end - longest.start < NEW_BREAK + 2 * MIN_GAP) return;
    const middle = Math.round((longest.start + longest.end) / 2 / SNAP) * SNAP;
    const added = { start: middle - NEW_BREAK / 2, end: middle + NEW_BREAK / 2 };
    night.breaks = [...night.breaks, added].sort((a, b) => a.start - b.start);
    select(night.breaks.findIndex((b) => b.start === added.start));
  }

  function removeBreak() {
    if (selected === null) return;
    night.breaks = night.breaks.filter((_, i) => i !== selected);
    select(null);
  }

  const sel = $derived(selected !== null ? night.breaks[selected] : undefined);

  /** The end of a wake break at least this long is offered as the start of the night. */
  const START_BREAK = 15 * MINUTE;
  /** A first sleep stretch shorter than this is not counted; the night then starts after the first wake break. */
  const MIN_FIRST_SLEEP = 20 * MINUTE;
  /** The estimated night as the editor opened; the start and end choices are offered relative to it. */
  const estimate = { start: night.start, end: night.end };
  /** Minutes from the screen going off to falling asleep, for this night; the choices move with it. */
  const usualFallAsleep = data.settings.sleep.fallAsleepMinutes;
  let fallAsleep = $state(usualFallAsleep);
  /** Wake breaks outside the chosen start and end; they are kept until saving, so another choice brings them back. */
  let parked = $state<{ start: number; end: number }[]>([]);
  const shift = $derived((fallAsleep - usualFallAsleep) * MINUTE);
  const allBreaks = $derived([...night.breaks, ...parked].sort((a, b) => a.start - b.start));
  /** Where the night may have begun: the estimate, or the end of a longer wake break, following edits to the breaks. */
  const baseChoices = $derived(nightStartChoices({ start: estimate.start, breaks: allBreaks }, START_BREAK));
  /** The start choice the night follows, by its time before the shift; null once the start is set by hand. */
  let chosen = $state<number | null>(estimate.start);
  /** Each choice moved by this night's time to fall asleep, without those that would leave under 20 minutes of sleep before a wake break. */
  const startChoices = $derived(
    baseChoices
      .map((c) => ({ ...c, base: c.time, time: c.time + shift }))
      .filter((c) => !allBreaks.some((b) => b.end > c.time && b.start < c.time + MIN_FIRST_SLEEP))
  );

  function choose(base: number) {
    chosen = base;
    startAt(base + shift);
  }

  function setFallAsleep(minutes: number) {
    const before = shift;
    fallAsleep = minutes;
    if (chosen === null) {
      night.start = clamp(night.start + shift - before, span.from, (night.breaks[0]?.start ?? night.end) - MIN_FIRST_SLEEP);
      return;
    }
    const times = baseChoices.map((c) => c.time);
    startAt(startForChoice(times, Math.max(0, times.indexOf(chosen)), shift, allBreaks, MIN_FIRST_SLEEP));
  }

  function startAt(time: number) {
    tap();
    ({ breaks: night.breaks, parked } = splitBreaks(night.breaks, parked, time, night.end));
    night.start = time;
    select(null);
  }

  /** Where the night may have ended: the estimate, or the start of a wake break, following edits to the breaks. */
  const baseEndChoices = $derived(nightEndChoices({ ...estimate, breaks: allBreaks }));
  /** The end choice the night follows, by its time; null once the end is set by hand. */
  let chosenEnd = $state<number | null>(estimate.end);
  /** The end choices that leave at least 20 minutes of sleep after the start. */
  const endChoices = $derived(baseEndChoices.filter((c) => c.time - night.start >= MIN_FIRST_SLEEP));

  function endAt(time: number) {
    tap();
    chosenEnd = time;
    ({ breaks: night.breaks, parked } = splitBreaks(night.breaks, parked, night.start, time));
    night.end = time;
    select(null);
  }
</script>

<div class="flex flex-col gap-3 select-none">
  <div class="grid grid-cols-2 gap-3">
    <label class="flex min-w-0 flex-col text-xs text-muted">
      {t('sleep.asleep')}
      <input
        type="time"
        class="mt-0.5 w-full px-2 text-lg font-semibold text-fg tabular"
        value={hm(night.start)}
        onchange={(e) => {
          const time = typedSleepTime(night.day, e.currentTarget.value);
          if (time !== null) move('start', time);
        }}
      />
    </label>
    <label class="flex min-w-0 flex-col text-right text-xs text-muted">
      {t('sleep.awake')}
      <input
        type="time"
        class="mt-0.5 w-full px-2 text-right text-lg font-semibold text-fg tabular"
        value={hm(night.end)}
        onchange={(e) => {
          const time = typedSleepTime(night.day, e.currentTarget.value);
          if (time !== null) move('end', time);
        }}
      />
    </label>
  </div>

  <label class="-mt-1 flex items-center justify-between gap-3 text-xs text-muted">
    {t('sleep.fallAsleep')}
    <select class="w-28 shrink-0 py-1.5 text-sm text-fg" value={fallAsleep} onchange={(e) => setFallAsleep(Number(e.currentTarget.value))}>
      {#each FALL_ASLEEP_OPTIONS as n (n)}<option value={n}>{t('sleep.minutes', { n })}</option>{/each}
    </select>
  </label>

  {#snippet choice(time: number, note: string, active: boolean, onpick: () => void)}
    <button
      class="press flex min-h-11 flex-col items-start rounded-xl px-3 py-1.5 text-left tabular {active ? 'bg-primary text-primary-fg' : 'bg-surface-2'}"
      onclick={onpick}
      aria-pressed={active}
    >
      <span class="font-semibold">{hm(time)}</span>
      <span class="text-xs leading-tight opacity-80">{note}</span>
    </button>
  {/snippet}

  {#if (baseChoices.length > 1 && startChoices.length) || endChoices.length > 1}
    <div class="-mt-1 grid grid-cols-2 gap-3">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-xs text-muted">{t('sleep.startedAt')}</span>
        {#each startChoices as c (c.time)}
          {@render choice(c.time, c.awake ? t('sleep.afterAwake', { d: formatDuration(c.awake) }) : t('sleep.estimated'), night.start === c.time, () => choose(c.base))}
        {/each}
      </div>
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-xs text-muted">{t('sleep.endedAt')}</span>
        {#each endChoices as c (c.time)}
          {@render choice(c.time, c.earlier ? t('sleep.earlier', { d: formatDuration(c.earlier) }) : t('sleep.estimated'), chosenEnd === c.time, () => endAt(c.time))}
        {/each}
      </div>
    </div>
  {/if}

  {#snippet bar(within: Span, handles: [Handle, number][], ontap?: (e: MouseEvent) => void)}
    <div
      class="relative h-14 touch-none rounded-xl bg-surface-2"
      role="presentation"
      onclick={ontap}
      onpointermove={drag}
      onpointerup={release}
      onpointercancel={release}
    >
      <div class="absolute inset-0 overflow-hidden rounded-xl">
        {#each segments as seg, i (i)}
          <div class="absolute inset-y-3 bg-primary" style:left="{pct(seg.start, within)}%" style:width="{pct(seg.end, within) - pct(seg.start, within)}%"></div>
        {/each}
        {#each night.breaks as b, i (i)}
          <div
            class="absolute inset-y-2 rounded-sm border-2 border-dashed {selected === i ? 'border-caution bg-caution/25' : 'border-caution/60 bg-caution/10'}"
            style:left="{pct(b.start, within)}%"
            style:width="max(4px, {pct(b.end, within) - pct(b.start, within)}%)"
          ></div>
        {/each}
      </div>
      {#each handles as [handle, time] (handle)}
        {@const big = handle === 'start' || handle === 'end'}
        <button
          class="absolute top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center"
          style:left="{pct(time, within)}%"
          aria-label={handle === 'start' ? t('sleep.asleep') : handle === 'end' ? t('sleep.awake') : t('sleep.breakEdge')}
          onpointerdown={grab(handle, within)}
          onpointermove={drag}
          onpointerup={release}
          onclick={(e) => e.stopPropagation()}
        >
          <span
            class="rounded-full border-4 border-surface shadow-md transition-transform {big ? 'size-7 bg-primary' : 'size-6 bg-caution'} {dragging?.handle === handle
              ? 'scale-125'
              : ''}"
          ></span>
        </button>
      {/each}
    </div>
  {/snippet}

  {#snippet axis(within: Span, step: number, label: string)}
    <div class="relative mt-1 h-4 text-axis text-muted tabular">
      {#each ticks(within, step) as h (h)}
        <span class="absolute -translate-x-1/2" style:left="{pct(h, within)}%">{format(h, label)}</span>
      {/each}
    </div>
  {/snippet}

  <div class="px-3.5">
    {@render bar(span, [['start', night.start], ['end', night.end]], pick)}
    <div class="relative mt-1.5 h-1.5">
      {#each screen as on, i (i)}
        <div class="absolute inset-y-0 rounded-full bg-muted/60" style:left="{pct(on.start)}%" style:width="max(2px, {pct(on.end) - pct(on.start)}%)"></div>
      {/each}
    </div>
    {@render axis(span, 2 * HOUR, 'H')}

    {#if night.breaks.length}
      <p class="mt-3 mb-1.5 text-xs text-muted">{t('sleep.editBreaks')}</p>
      <div class="flex flex-wrap items-center gap-2">
        {#each night.breaks as b, i (i)}
          <button
            class="press min-h-11 rounded-full px-3 py-1.5 text-sm font-medium tabular {selected === i ? 'bg-caution text-white' : 'bg-caution/15 text-caution'}"
            onclick={() => select(selected === i ? null : i)}
          >
            {hm(b.start)}–{hm(b.end)} · {formatDuration(b.end - b.start)}
          </button>
        {/each}
      </div>
    {/if}

    {#if sel && zoom}
      <p class="mt-2 mb-1.5 text-xs text-muted">{t('sleep.zoom')}</p>
      {@render bar(zoom, [['breakStart', sel.start], ['breakEnd', sel.end]])}
      <div class="relative mt-1.5 h-1.5">
        {#each screen as on, i (i)}
          {#if on.end > zoom.from && on.start < zoom.to}
            {@const left = Math.max(pct(on.start, zoom), 0)}
            <div class="absolute inset-y-0 rounded-full bg-muted/60" style:left="{left}%" style:width="max(2px, {Math.min(pct(on.end, zoom), 100) - left}%)"></div>
          {/if}
        {/each}
      </div>
      {@render axis(zoom, HALF_HOUR, 'H:mm')}
    {/if}
  </div>

  <div class="flex min-h-11 flex-wrap items-center gap-2">
    {#if sel}
      <span class="flex-1 font-medium text-caution tabular">{t('sleep.breakLabel', { from: hm(sel.start), to: hm(sel.end) })}</span>
      <button class="press min-h-11 rounded-xl px-3 py-2 font-medium text-over" onclick={removeBreak}>{t('sleep.removeBreak')}</button>
    {:else}
      <span class="flex-1"></span>
    {/if}
    <button class="press min-h-11 rounded-xl bg-surface-2 px-3 py-2 font-medium" onclick={addBreak}>{t('sleep.addBreak')}</button>
  </div>
</div>
