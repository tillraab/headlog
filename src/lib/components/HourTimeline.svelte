<script lang="ts">
  /**
   * A few days hour by hour: headaches with their exact times and intensity, medication, hydration
   * adding up through each day against the goal and the even pace towards it, sleep with its wake
   * breaks, and air pressure. Tap or drag to see the state at that moment and what happened around it.
   * Labels, summaries and colours come from the daily rows, so both views read the same.
   */
  import { addDays } from 'date-fns';
  import type { Snippet } from 'svelte';
  import { hydrationCurve } from '$lib/analysis';
  import { intakeColor } from '$lib/colors';
  import { formatLiters, HOUR, keyToDate, MINUTE } from '$lib/days';
  import { fmt, t } from '$lib/i18n.svelte';
  import { data } from '$lib/store.svelte';
  import { entryDetailLines } from '$lib/format';
  import { sleepSegments } from '$lib/sleep';
  import { isPressureDrop } from '$lib/weather';
  import type { Row } from './TimelineChart.svelte';

  let { rows, keys, now }: { rows: Row[]; keys: string[]; now: number } = $props();

  const H = 48;
  /** Around the selected moment, drinks and medication count as "then". */
  const NEAR = 30 * MINUTE;
  const PACE_FROM = 7;
  const PACE_TO = 22;

  const from = $derived(keyToDate(keys[0]).getTime());
  const to = $derived(addDays(keyToDate(keys[keys.length - 1]), 1).getTime());
  const width = $derived((to - from) / HOUR);
  const x = (time: number) => (Math.min(Math.max(time, from), to) - from) / HOUR;
  const row = (key: Row['key']) => rows.find((r) => r.key === key);
  const goal = $derived(data.settings.waterGoalMl);

  const episodes = $derived(data.episodes.filter((e) => (e.end ?? now) > from && e.start < to));
  const intakes = $derived(data.intakes.filter((i) => i.time >= from && i.time < to));
  const curve = $derived(hydrationCurve(data.drinks, keys, now));
  const waterMax = $derived(Math.max(goal, ...curve.flatMap((d) => d.points.map((p) => p.ml))) * 1.05);
  const yWater = (ml: number) => H - 2 - (ml / waterMax) * (H - 6);

  /** Asleep stretches: each night from falling asleep to waking, without its wake breaks. */
  const asleep = $derived([...data.sleep.values()].filter((night) => night.end > from && night.start < to).flatMap(sleepSegments));

  const pressure = $derived(
    keys.flatMap((key) => {
      const w = data.weather.get(key);
      const start = keyToDate(key).getTime();
      return w ? [{ start, end: addDays(start, 1).getTime(), value: w.pressure, drop: isPressureDrop(w.pressureDrop) }] : [];
    })
  );
  const pressureScale = $derived.by(() => {
    const values = pressure.map((p) => p.value);
    const min = Math.min(...values) - 1;
    const max = Math.max(...values) + 1;
    return { min, max, y: (v: number) => H - 4 - ((v - min) / (max - min)) * (H - 10) };
  });

  const days = $derived(keys.map((key) => ({ key, start: keyToDate(key).getTime() })));
  /** Faint lines every 6 hours for 3 days, every 12 hours for a week. */
  const hourLines = $derived.by(() => {
    const step = keys.length <= 3 ? 6 : 12;
    return days.flatMap((d) => Array.from({ length: 24 / step - 1 }, (_, i) => x(d.start + (i + 1) * step * HOUR)));
  });

  let selected = $state<number | null>(null);
  const shown = $derived(selected !== null && selected >= from && selected < to ? selected : null);

  function pick(event: PointerEvent) {
    const box = (event.currentTarget as Element).getBoundingClientRect();
    const share = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    const time = from + share * (to - from);
    selected = Math.round(time / (5 * MINUTE)) * 5 * MINUTE;
  }

  const lines = $derived.by(() => {
    if (shown === null) return null;
    const episode = episodes.find((e) => e.start <= shown && (e.end ?? now) >= shown);
    const day = curve.find((d) => d.points[0].time <= shown && d.points.at(-1)!.time >= shown);
    const ml = day ? day.points.filter((p) => p.time <= shown).at(-1)!.ml : null;
    const sleeping = asleep.some((s) => s.start <= shown && s.end > shown);
    const weather = pressure.find((p) => p.start <= shown && p.end > shown);
    const values = [
      { key: 'headache', value: episode ? `${episode.intensity}/10` : '–' },
      { key: 'hydration', value: ml === null ? '–' : formatLiters(ml) },
      { key: 'sleep', value: sleeping ? t('hv.asleep') : data.sleep.size && shown <= now ? t('hv.awake') : '–' },
      { key: 'pressure', value: weather ? String(Math.round(weather.value)) : '–' }
    ] as const;
    const near = (time: number) => Math.abs(time - shown) <= NEAR;
    const drinks = data.drinks.filter((d) => near(d.time)).sort((a, b) => a.time - b.time);
    const meds = intakes.filter((i) => near(i.time));
    const details = entryDetailLines({ episodes: episode ? [episode] : [], intakes: meds, drinks });
    return { values: values.filter((v) => row(v.key)), details };
  });

  /** Every readout line is one line of 1.25rem: the date, the value rows and three detail lines, so the box never changes height. */
  const DETAIL_LINES = 3;
  const boxHeight = $derived((1 + Math.ceil(rows.length / 2) + DETAIL_LINES) * 1.25 + 1);
</script>

{#snippet frame(r: Row, content: Snippet, axis: [string, string])}
  <div class="flex flex-col gap-1">
    <div class="flex items-baseline gap-x-2 pl-10 text-xs whitespace-nowrap">
      <span class="shrink-0 font-semibold">{r.label}</span>
      <span class="ml-auto min-w-0 truncate text-muted tabular">{r.summary}</span>
    </div>
    <div class="flex gap-1">
      <div class="flex h-12 w-9 shrink-0 flex-col justify-between text-right text-axis leading-none text-muted tabular">
        <span>{axis[0]}</span>
        <span>{axis[1]}</span>
      </div>
      <svg
        viewBox="0 0 {width} {H}"
        preserveAspectRatio="none"
        class="h-12 min-w-0 flex-1 touch-pan-y overflow-visible rounded-md bg-surface-2/60 select-none"
        role="img"
        aria-label={r.label}
        onpointerdown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onpointermove={(e) => {
          if (e.buttons || e.pointerType !== 'mouse') pick(e);
        }}
      >
        {#each episodes as e (e.id)}
          <rect x={x(e.start)} width={Math.max(x(e.end ?? now) - x(e.start), 0.3)} y="0" height={H} fill="var(--color-pain)" opacity="0.13" />
        {/each}
        {#each hourLines as line, i (i)}
          <line x1={line} x2={line} y1="0" y2={H} stroke="var(--color-line)" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke" />
        {/each}
        {#each days.slice(1) as d (d.key)}
          <line x1={x(d.start)} x2={x(d.start)} y1="0" y2={H} stroke="var(--color-muted)" stroke-width="1" opacity="0.6" vector-effect="non-scaling-stroke" />
        {/each}
        {@render content()}
        {#if now < to}
          <rect x={x(now)} width={width - x(now)} y="0" height={H} fill="var(--color-surface-2)" opacity="0.7" />
          <line x1={x(now)} x2={x(now)} y1="0" y2={H} stroke="var(--color-muted)" stroke-width="1" stroke-dasharray="3 2" vector-effect="non-scaling-stroke" />
        {/if}
        {#if shown !== null}
          <line x1={x(shown)} x2={x(shown)} y1="0" y2={H} stroke="var(--color-fg)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        {/if}
      </svg>
    </div>
  </div>
{/snippet}

{#snippet headache()}
  {#each episodes as e (e.id)}
    {@const top = H - 2 - (e.intensity / 10) * (H - 12)}
    <rect x={x(e.start)} width={Math.max(x(e.end ?? now) - x(e.start), 0.3)} y={top} height={H - 2 - top} fill="var(--color-pain)" />
  {/each}
  {#each intakes as i (i.id)}
    <line x1={x(i.time)} x2={x(i.time)} y1="0" y2="9" stroke={intakeColor(i, data.medications)} stroke-width="4" vector-effect="non-scaling-stroke" />
  {/each}
{/snippet}

{#snippet hydration()}
  <line x1="0" x2={width} y1={yWater(goal)} y2={yWater(goal)} stroke="var(--color-water)" stroke-width="1" stroke-dasharray="3 2" opacity="0.7" vector-effect="non-scaling-stroke" />
  {#each days.filter((d) => d.start <= now) as d (d.key)}
    <line
      x1={x(d.start + PACE_FROM * HOUR)}
      x2={x(d.start + PACE_TO * HOUR)}
      y1={yWater(0)}
      y2={yWater(goal)}
      stroke="var(--color-muted)"
      stroke-width="1"
      stroke-dasharray="2 2"
      opacity="0.6"
      vector-effect="non-scaling-stroke"
    />
  {/each}
  {#each curve as d (d.key)}
    <polyline
      points={d.points.map((p) => `${x(p.time)},${yWater(p.ml)}`).join(' ')}
      fill="none"
      stroke="var(--color-water)"
      stroke-width="2"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  {/each}
{/snippet}

{#snippet sleep()}
  {#each asleep as s (s.start)}
    <rect x={x(s.start)} width={Math.max(x(s.end) - x(s.start), 0)} y="10" height={H - 20} fill="var(--color-primary)" opacity="0.6" />
  {/each}
{/snippet}

{#snippet air()}
  {#each pressure as p, i (p.start)}
    {@const prev = pressure[i - 1]}
    {#if prev && prev.end === p.start}
      <line x1={x(p.start)} x2={x(p.start)} y1={pressureScale.y(prev.value)} y2={pressureScale.y(p.value)} stroke="var(--color-muted)" stroke-width="2" vector-effect="non-scaling-stroke" />
    {/if}
    <line
      x1={x(p.start)}
      x2={x(p.end)}
      y1={pressureScale.y(p.value)}
      y2={pressureScale.y(p.value)}
      stroke="var(--color-muted)"
      stroke-width="2"
      stroke-dasharray={p.start > now ? '3 2' : undefined}
      vector-effect="non-scaling-stroke"
    />
    {#if p.drop}
      <line x1={x(p.start) + 0.5} x2={x(p.end) - 0.5} y1="1.5" y2="1.5" stroke="var(--color-caution)" stroke-width="3" vector-effect="non-scaling-stroke" />
    {/if}
  {/each}
{/snippet}

<div class="flex flex-col gap-3">
  <div class="overflow-hidden rounded-xl bg-surface-2 px-3 py-2 text-xs leading-5" style:height="{boxHeight}rem">
    {#if shown === null || !lines}
      <p class="text-muted">{t('hv.tapHint')}</p>
    {:else}
      <p class="truncate font-semibold">
        {fmt(shown, 'EEEE, d. MMMM, HH:mm')}
        {#if shown > now}<span class="font-normal text-muted">· {t('tl.forecast')}</span>{/if}
      </p>
      <div class="grid grid-cols-2 gap-x-3 tabular">
        {#each lines.values as v (v.key)}
          {@const r = row(v.key)!}
          <span class="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            <span class="size-2 shrink-0 rounded-full" style:background-color={r.color}></span>
            <span class="truncate text-muted">{t(`tl.short.${v.key}`)}</span>
            <span class="ml-auto shrink-0 font-medium">{v.value}</span>
          </span>
        {/each}
      </div>
      {#each lines.details.slice(0, DETAIL_LINES) as line, i (i)}
        <p class="truncate text-muted">{line}</p>
      {/each}
    {/if}
  </div>

  {#if row('headache')}{@render frame(row('headache')!, headache, ['10', '0'])}{/if}
  {#if row('hydration')}{@render frame(row('hydration')!, hydration, [formatLiters(waterMax), '0'])}{/if}
  {#if row('sleep')}{@render frame(row('sleep')!, sleep, ['', ''])}{/if}
  {#if row('pressure') && pressure.length}
    {@render frame(row('pressure')!, air, [String(Math.round(pressureScale.max)), String(Math.round(pressureScale.min))])}
  {/if}

  <div class="relative ml-10 h-4 text-axis text-muted">
    {#each days as d (d.key)}
      <span class="absolute -translate-x-1/2 whitespace-nowrap" style:left="{((x(d.start) + 12) / width) * 100}%">
        {fmt(d.start, keys.length <= 3 ? 'EEEE' : 'EEEEEE d.')}
      </span>
    {/each}
  </div>
</div>
