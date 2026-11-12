<script lang="ts" module>
  export interface Row {
    label: string;
    summary: string;
    values: (number | null)[];
    color: string;
    /** Colour per bar, e.g. by status; `color` otherwise. */
    colors?: string[];
    kind: 'bars' | 'line';
    /** How a value reads in the axis labels and the detail box. */
    format: (value: number) => string;
    /** Dashed reference line, e.g. the hydration goal. */
    reference?: number;
    /** The average over the period, shown next to the selected day's value. */
    average?: number | null;
    /** Days to mark with a tick at the top, e.g. pressure drops. */
    marks?: boolean[];
    markColor?: string;
  }
</script>

<script lang="ts">
  /**
   * Charts that share one time axis, one row each, with headache days as faint red bands through
   * every row. Tap or drag across a chart to see all values of that day.
   */
  import { getDay } from 'date-fns';
  import { keyToDate } from '$lib/days';
  import { fmt, t } from '$lib/i18n.svelte';

  let {
    rows,
    bands,
    keys,
    details,
    forecast = 0,
    showLast = false
  }: {
    rows: Row[];
    bands: boolean[];
    keys: string[];
    details?: (index: number) => string[];
    /** Trailing days that are a forecast: shaded, with dashed lines. */
    forecast?: number;
    /** Shows the values of the last day before the forecast until another day is tapped. */
    showLast?: boolean;
  } = $props();

  const H = 48;
  const n = $derived(keys.length);
  /** The selected day, kept by date so it survives a change of period or stays out of it. */
  let selectedKey = $state<string | null>(null);
  const selected = $derived.by(() => {
    const index = selectedKey === null ? -1 : keys.indexOf(selectedKey);
    return index >= 0 ? index : showLast && n > forecast ? n - 1 - forecast : null;
  });

  /** Fixed height for the detail box, so the charts below never move: date, value rows, two extra lines. */
  /** One line of 1.25rem for the date and two for the details, so the box never changes height. */
  const DETAIL_LINES = 2;
  const boxHeight = $derived((1 + (details ? DETAIL_LINES : 0)) * 1.25 + 1);

  /** Every day up to 10 days, weekly ticks up to 45 days, the 1st and 15th up to 120 days, otherwise the 1st of each month. */
  const ticks = $derived.by(() => {
    const every = n <= 10 ? 'day' : n <= 45 ? 'week' : n <= 120 ? 'half-month' : 'month';
    return keys.flatMap((key, i) => {
      const date = keyToDate(key);
      const d = date.getDate();
      if (every === 'day') return [{ i, label: fmt(date, 'EEEEEE d.') }];
      const hit = every === 'week' ? getDay(date) === 1 : every === 'half-month' ? d === 1 || d === 15 : d === 1;
      return hit ? [{ i, label: fmt(date, every === 'month' ? 'MMM' : 'd. MMM') }] : [];
    });
  });

  function scale(row: Row) {
    const known = row.values.filter((v): v is number => v !== null);
    const max = Math.max(row.reference ?? 0, ...known, 1);
    const min = row.kind === 'line' && known.length ? Math.min(...known) : 0;
    const range = Math.max(max - min, 1);
    return { min, max, y: (v: number) => H - ((v - min) / range) * (H - 4) - 2 };
  }

  /** Day under the pointer, from its position across the chart. */
  function pick(event: PointerEvent) {
    const box = (event.currentTarget as Element).getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - box.left, 0), box.width - 1);
    selectedKey = keys[Math.floor((x / box.width) * n)];
  }
</script>

<div class="flex flex-col gap-3">
  <div class="overflow-hidden rounded-xl bg-surface-2 px-3 py-2 text-xs leading-5" style:height="{boxHeight}rem">
    {#if selected === null}
      <p class="text-muted">{t('tl.tapHint')}</p>
    {:else}
      <p class="truncate font-semibold">
        {fmt(keyToDate(keys[selected]), 'EEEE, d. MMMM')}
        {#if selected >= n - forecast}<span class="font-normal text-muted">· {t('tl.forecast')}</span>{/if}
      </p>
      {#each (details?.(selected) ?? []).slice(0, DETAIL_LINES) as line, i (i)}
        <p class="truncate text-muted">{line}</p>
      {/each}
    {/if}
  </div>

  {#each rows as row (row.label)}
    {@const s = scale(row)}
    <div class="flex flex-col gap-1">
      <div class="flex items-baseline gap-x-2 pl-10 text-xs whitespace-nowrap">
        <span class="shrink-0 font-semibold">{row.label}</span>
        {#if selected === null}
          <span class="ml-auto min-w-0 truncate text-muted tabular">{row.summary}</span>
        {/if}
        {#if row.average !== undefined}
          <span
            class="shrink-0 rounded-full border px-2 font-semibold tabular {selected === null ? '' : 'ml-auto'}"
            style:color={row.color}
            style:border-color="color-mix(in oklab, {row.color} 45%, transparent)"
            aria-label={t('tl.average')}
          >
            Ø {row.average === null ? '–' : row.format(row.average)}
          </span>
        {/if}
        {#if selected !== null}
          {@const v = row.values[selected]}
          {@const color = row.colors?.[selected] ?? row.color}
          <span
            class="shrink-0 rounded-full border border-transparent px-2 font-semibold tabular {row.average === undefined ? 'ml-auto' : ''}"
            style:color
            style:background-color="color-mix(in oklab, {color} 16%, transparent)">{v === null ? '–' : row.format(v)}</span
          >
        {/if}
      </div>
      <div class="flex gap-1">
        <div class="flex h-12 w-9 shrink-0 flex-col justify-between text-right text-axis leading-none text-muted tabular">
          <span>{row.format(s.max)}</span>
          <span>{row.format(s.min)}</span>
        </div>
        <svg
          viewBox="0 0 {n} {H}"
          preserveAspectRatio="none"
          class="h-12 min-w-0 flex-1 touch-pan-y overflow-visible rounded-md bg-surface-2/60 select-none"
          role="img"
          aria-label={row.label}
          onpointerdown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onpointermove={(e) => {
            if (e.buttons || e.pointerType !== 'mouse') pick(e);
          }}
        >
          {#each bands as band, i (i)}
            {#if band}<rect x={i} width="1" y="0" height={H} fill="var(--color-pain)" opacity="0.13" />{/if}
          {/each}
          {#each ticks as tick (tick.i)}
            <line x1={tick.i} x2={tick.i} y1="0" y2={H} stroke="var(--color-line)" stroke-width="1" vector-effect="non-scaling-stroke" />
          {/each}
          {#if row.reference !== undefined}
            <line x1="0" x2={n} y1={s.y(row.reference)} y2={s.y(row.reference)} stroke={row.color} stroke-width="1" stroke-dasharray="3 2" opacity="0.7" vector-effect="non-scaling-stroke" />
          {/if}
          {#if row.kind === 'bars'}
            {#each row.values as v, i (i)}
              {#if v}<rect x={i + 0.15} width="0.7" y={s.y(v)} height={H - 2 - s.y(v)} fill={row.colors?.[i] ?? row.color} opacity={selectedKey === null || selected === i ? 1 : 0.5} />{/if}
            {/each}
          {:else}
            {#each row.values as v, i (i)}
              {@const next = row.values[i + 1]}
              {#if v !== null && next !== null && next !== undefined}
                <line
                  x1={i + 0.5}
                  x2={i + 1.5}
                  y1={s.y(v)}
                  y2={s.y(next)}
                  stroke={row.color}
                  stroke-width="2"
                  stroke-dasharray={i + 1 >= n - forecast ? '3 2' : undefined}
                  vector-effect="non-scaling-stroke"
                />
              {/if}
            {/each}
          {/if}
          {#each row.marks ?? [] as mark, i (i)}
            {#if mark}<line x1={i + 0.5} x2={i + 0.5} y1="0" y2="7" stroke={row.markColor ?? row.color} stroke-width="3" vector-effect="non-scaling-stroke" />{/if}
          {/each}
          {#if forecast}
            <rect x={n - forecast} width={forecast} y="0" height={H} fill="var(--color-surface-2)" opacity="0.6" />
          {/if}
          {#if selected !== null}
            <line x1={selected + 0.5} x2={selected + 0.5} y1="0" y2={H} stroke="var(--color-fg)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
          {/if}
        </svg>
      </div>
    </div>
  {/each}

  <div class="relative ml-10 h-4 text-axis text-muted">
    {#each ticks as tick (tick.i)}
      <span class="absolute -translate-x-1/2 whitespace-nowrap" style:left="{((tick.i + (n <= 10 ? 0.5 : 0)) / n) * 100}%">{tick.label}</span>
    {/each}
  </div>
</div>
