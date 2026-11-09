<script lang="ts">
  import { addDays, startOfDay } from 'date-fns';
  import { alcoholDays, caffeineByDay, firstDrinkDay, hydrationCurve, usualCaffeine, usualCaffeineByTime } from '$lib/analysis';
  import { dayKey, formatLiters, hm, HOUR, keyToDate, lastDays } from '$lib/days';
  import { fmt, t } from '$lib/i18n.svelte';
  import { expectedByNow, prognosis, prognosisInput, type Status } from '$lib/prognosis';
  import { SOURCES } from '$lib/sources';
  import { clock, data } from '$lib/store.svelte';
  import { LOW_HYDRATION } from '$lib/thresholds';
  import { factorSheet } from '$lib/ui.svelte';
  import { dropToNextDay, isPressureDrop, PRESSURE_DROP_HPA, weatherEmoji } from '$lib/weather';
  import Sheet from './Sheet.svelte';

  /** A day chart: hours from 0 to 24 across, one or more lines, a marker at the current time. */
  type Line = { points: { hour: number; value: number }[]; color: string; dash?: string; step?: boolean; width?: number };

  const STATUS: Record<Status, string> = { ok: 'var(--color-ok)', bad: 'var(--color-over)', unknown: 'var(--color-muted)' };
  const W = 320;
  const H = 150;
  const PAD = { left: 46, right: 14, top: 10, bottom: 20 };

  const p = $derived(prognosis(prognosisInput(data), clock.now));
  const key = $derived(factorSheet.key);
  const today = $derived(dayKey(clock.now));
  const yesterday = $derived(dayKey(addDays(clock.now, -1)));
  const nowHour = $derived((clock.now - startOfDay(clock.now).getTime()) / HOUR);
  const status = $derived(p[key].status);

  const x = (hour: number) => PAD.left + (hour / 24) * (W - PAD.left - PAD.right);
  const y = (value: number, max: number) => H - PAD.bottom - (value / max) * (H - PAD.top - PAD.bottom);

  function path(line: Line, max: number): string {
    return line.points
      .map((pt, i) => {
        const prev = line.points[i - 1];
        const step = line.step && prev ? `L${x(pt.hour)},${y(prev.value, max)}` : '';
        return `${i ? step + 'L' : 'M'}${x(pt.hour)},${y(pt.value, max)}`;
      })
      .join('');
  }

  /** Today's running total of water, from midnight to now. */
  const water = $derived.by(() => {
    const day = hydrationCurve(data.drinks, [today], clock.now)[0];
    const start = startOfDay(clock.now).getTime();
    const points = (day?.points ?? []).map((pt) => ({ hour: (pt.time - start) / HOUR, value: pt.ml }));
    return [{ hour: 0, value: 0 }, ...points, { hour: nowHour, value: points.at(-1)?.value ?? 0 }];
  });

  /** Today's running total of caffeine, and what is usual by each half hour. */
  const caffeine = $derived.by(() => {
    const start = startOfDay(clock.now).getTime();
    const drinks = data.drinks.filter((d) => d.caffeineMg && dayKey(d.time) === today && d.time <= clock.now).sort((a, b) => a.time - b.time);
    let total = 0;
    const points = drinks.map((d) => ({ hour: (d.time - start) / HOUR, value: (total += d.caffeineMg ?? 0) }));
    const first = firstDrinkDay(data.drinks);
    const usual = Array.from({ length: 49 }, (_, i) => ({ hour: i / 2, value: usualCaffeineByTime(data.drinks, first, today, i * 30) ?? 0 }));
    return { today: [{ hour: 0, value: 0 }, ...points, { hour: nowHour, value: total }], usual, usualDay: usualCaffeine(caffeineByDay(data.drinks), first, today) };
  });

  /** Alcoholic drinks per day over the last week, oldest first. */
  const alcohol = $derived(
    lastDays(clock.now, 7).map((k) => ({ key: k, n: data.drinks.filter((d) => d.alcohol && dayKey(d.time) === k && d.time <= clock.now).length }))
  );
  const alcoholToday = $derived(data.drinks.filter((d) => d.alcohol && dayKey(d.time) === today && d.time <= clock.now).sort((a, b) => a.time - b.time));
  const tracksAlcohol = $derived(alcoholDays(data.drinks).size > 0);

  /** Daily mean pressure from yesterday to the day after tomorrow, with the drop to the next day. */
  const pressure = $derived(
    [-1, 0, 1, 2].flatMap((n) => {
      const k = dayKey(addDays(clock.now, n));
      const w = data.weather.get(k);
      if (!w) return [];
      const drop = dropToNextDay(data.weather, k);
      return [{ key: k, n, w, marked: drop !== null && isPressureDrop(drop) }];
    })
  );
  const pressureRange = $derived.by(() => {
    const values = pressure.map((d) => d.w.pressure);
    const min = Math.floor(Math.min(...values) - 3);
    const max = Math.ceil(Math.max(...values) + 3);
    return { min, max };
  });
  const px = (i: number) => PAD.left + ((i + 0.5) / Math.max(pressure.length, 1)) * (W - PAD.left - PAD.right);
  const py = (v: number) => H - PAD.bottom - ((v - pressureRange.min) / (pressureRange.max - pressureRange.min)) * (H - PAD.top - PAD.bottom);

  const title = $derived(t(`prog.${key}`));
  const info = $derived(
    key === 'hydration'
      ? t('prog.rule.hydration', { pace: formatLiters(p.hydration.expected * LOW_HYDRATION), yesterday: formatLiters(p.hydration.goal * LOW_HYDRATION) })
      : key === 'weather'
        ? t('prog.rule.weather', { limit: PRESSURE_DROP_HPA })
        : t(`prog.rule.${key}`)
  );
  const sources = $derived(SOURCES[key]);

  const waterMax = $derived(Math.max(p.hydration.goal, water.at(-1)?.value ?? 0) * 1.1);
  const caffeineMax = $derived(Math.max(50, ...caffeine.today.map((pt) => pt.value), ...caffeine.usual.map((pt) => pt.value)) * 1.15);
</script>

{#snippet metric(label: string, value: string)}
  <div class="flex min-w-0 flex-col rounded-xl bg-surface px-3 py-2">
    <span class="truncate text-xs text-muted">{label}</span>
    <span class="font-semibold tabular">{value}</span>
  </div>
{/snippet}

{#snippet hours(max: number, format: (v: number) => string, lines: Line[])}
  <svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label={title}>
    {#each [0, 6, 12, 18, 24] as h (h)}
      <line x1={x(h)} x2={x(h)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-line)" />
      <text x={x(h)} y={H - 6} text-anchor={h === 24 ? 'end' : h === 0 ? 'start' : 'middle'} class="fill-muted text-axis">{String(h).padStart(2, '0')}:00</text>
    {/each}
    <text x={PAD.left - 4} y={PAD.top + 8} text-anchor="end" class="fill-muted text-axis">{format(max)}</text>
    <text x={PAD.left - 4} y={H - PAD.bottom} text-anchor="end" class="fill-muted text-axis">0</text>
    {#each lines as line, i (i)}
      <path d={path(line, max)} fill="none" stroke={line.color} stroke-width={line.width ?? 2} stroke-dasharray={line.dash} stroke-linejoin="round" />
    {/each}
    <line x1={x(nowHour)} x2={x(nowHour)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-fg)" stroke-width="1.5" />
  </svg>
{/snippet}

{#snippet legend(color: string, dash: string | undefined, text: string)}
  <span class="flex items-center gap-2">
    <svg width="22" height="6" class="shrink-0"><line x1="0" x2="22" y1="3" y2="3" stroke={color} stroke-width="2" stroke-dasharray={dash} /></svg>
    <span class="min-w-0">{text}</span>
  </span>
{/snippet}

<Sheet id="factor" {title} info={[info]} {sources}>
  <div class="flex flex-col gap-4 text-sm">
    <span class="self-start rounded-full px-2.5 py-0.5 text-xs font-semibold" style:color={STATUS[status]} style:background-color="color-mix(in oklab, {STATUS[status]} 14%, transparent)">
      {t(`prog.status.${status}`)}
    </span>

    {#if key === 'hydration'}
      <div class="rounded-2xl bg-surface p-3">
        {@render hours(waterMax, (v) => formatLiters(v), [
          { points: [{ hour: 7, value: 0 }, { hour: 22, value: p.hydration.goal }, { hour: 24, value: p.hydration.goal }], color: 'var(--color-muted)', dash: '4 3', width: 1.5 },
          { points: [{ hour: 7, value: 0 }, { hour: 22, value: p.hydration.goal * LOW_HYDRATION }, { hour: 24, value: p.hydration.goal * LOW_HYDRATION }], color: 'var(--color-caution)', dash: '1.5 3', width: 1.5 },
          { points: water, color: 'var(--color-water)', step: true, width: 2.5 }
        ])}
      </div>
      <div class="flex flex-col gap-1 text-xs text-muted">
        {@render legend('var(--color-water)', undefined, t('fs.legendWater'))}
        {@render legend('var(--color-muted)', '4 3', t('fs.legendPace'))}
        {@render legend('var(--color-caution)', '1.5 3', t('fs.legendWarn'))}
      </div>
      <div class="grid grid-cols-2 gap-2">
        {@render metric(t('fs.soFar'), formatLiters(p.hydration.today))}
        {@render metric(t('fs.onPace'), formatLiters(expectedByNow(p.hydration.goal, clock.now)))}
        {@render metric(t('fs.goal'), formatLiters(p.hydration.goal))}
        {@render metric(t('fs.yesterday'), p.hydration.yesterday === null ? '–' : formatLiters(p.hydration.yesterday))}
      </div>
    {:else if key === 'caffeine'}
      <div class="rounded-2xl bg-surface p-3">
        {@render hours(caffeineMax, (v) => `${Math.round(v)} mg`, [
          { points: caffeine.usual, color: 'var(--color-muted)', dash: '4 3', width: 1.5 },
          { points: caffeine.today, color: 'var(--color-med)', step: true, width: 2.5 }
        ])}
      </div>
      <div class="flex flex-col gap-1 text-xs text-muted">
        {@render legend('var(--color-med)', undefined, t('fs.legendCaffeine'))}
        {@render legend('var(--color-muted)', '4 3', t('fs.legendUsual'))}
      </div>
      <div class="grid grid-cols-2 gap-2">
        {@render metric(t('fs.soFar'), `${Math.round(p.caffeine.today)} mg`)}
        {@render metric(t('fs.usualByNow'), p.caffeine.usualByNow === null ? '–' : `${Math.round(p.caffeine.usualByNow)} mg`)}
        {@render metric(t('fs.yesterday'), `${Math.round(p.caffeine.yesterday)} mg`)}
        {@render metric(t('fs.usualDay'), caffeine.usualDay === null ? '–' : `${Math.round(caffeine.usualDay)} mg`)}
      </div>
      {#if p.caffeine.usual === null}<p class="text-muted">{t('prog.why.caffeineLittle')}</p>{/if}
    {:else if key === 'alcohol'}
      <div class="rounded-2xl bg-surface p-3">
        <p class="mb-2 text-xs text-muted">{t('fs.last7')}</p>
        <div class="flex h-28 items-end gap-2">
          {#each alcohol as d (d.key)}
            {@const max = Math.max(3, ...alcohol.map((a) => a.n))}
            <div class="flex flex-1 flex-col items-center gap-1">
              <span class="text-xs font-semibold tabular">{d.n || ''}</span>
              <div class="w-full rounded-t-md" style:height="{(d.n / max) * 72}px" style:background-color={d.key === today || d.key === yesterday ? 'var(--color-over)' : 'var(--color-muted)'}></div>
              <span class="text-axis text-muted">{fmt(keyToDate(d.key), 'EEEEEE')}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        {@render metric(t('fs.today'), String(p.alcohol.drinksToday))}
        {@render metric(t('fs.yesterday'), String(p.alcohol.drinksYesterday))}
      </div>
      {#if !tracksAlcohol}
        <p class="text-muted">{t('prog.why.alcoholUnknown')}</p>
      {:else if alcoholToday.length}
        <ul class="flex flex-col gap-1">
          {#each alcoholToday as d (d.id)}<li class="tabular">{d.emoji} {hm(d.time)} · {d.name}</li>{/each}
        </ul>
      {:else}
        <p class="text-muted">{t('fs.noneToday')}</p>
      {/if}
    {:else if key === 'weather'}
      {#if pressure.length}
        <div class="rounded-2xl bg-surface p-3">
          <svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label={title}>
            <text x={PAD.left - 4} y={PAD.top + 8} text-anchor="end" class="fill-muted text-axis">{pressureRange.max}</text>
            <text x={PAD.left - 4} y={H - PAD.bottom} text-anchor="end" class="fill-muted text-axis">{pressureRange.min}</text>
            {#each pressure as d, i (d.key)}
              {#if d.marked}<line x1={px(i) - 26} x2={px(i) + 26} y1={PAD.top} y2={PAD.top} stroke="var(--color-caution)" stroke-width="4" />{/if}
              {#if i}<line x1={px(i - 1)} x2={px(i)} y1={py(pressure[i - 1].w.pressure)} y2={py(d.w.pressure)} stroke="var(--color-muted)" stroke-width="2" stroke-dasharray={d.n > 0 ? '4 3' : undefined} />{/if}
              <circle cx={px(i)} cy={py(d.w.pressure)} r="4" fill={d.n === 0 ? 'var(--color-fg)' : 'var(--color-muted)'} />
              <text x={px(i)} y={py(d.w.pressure) - 9} text-anchor="middle" class="fill-fg text-axis font-semibold">{Math.round(d.w.pressure)}</text>
              <text x={px(i)} y={H - 6} text-anchor="middle" class="fill-muted text-axis">{d.n === 0 ? t('prog.today') : d.n === 1 ? t('prog.tomorrow') : fmt(keyToDate(d.key), 'EEE')}</text>
            {/each}
          </svg>
        </div>
        <div class="flex flex-col gap-1 text-xs text-muted">
          {@render legend('var(--color-caution)', undefined, t('fs.legendMark', { limit: PRESSURE_DROP_HPA }))}
          {@render legend('var(--color-muted)', '4 3', t('fs.legendForecast'))}
        </div>
        <div class="grid grid-cols-2 gap-2">
          {#each pressure.filter((d) => d.n === 0 || d.n === 1) as d (d.key)}
            {@render metric(d.n === 0 ? t('fs.today') : t('fs.tomorrow'), `${weatherEmoji(d.w.code)} ${Math.round(d.w.pressure)} hPa · ${Math.round(d.w.tempMin)}–${Math.round(d.w.tempMax)} °C`)}
          {/each}
        </div>
      {:else}
        <p class="text-muted">{t('prog.why.weatherUnknown')}</p>
      {/if}
    {/if}
  </div>
</Sheet>
