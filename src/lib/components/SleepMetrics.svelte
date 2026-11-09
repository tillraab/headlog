<script lang="ts">
  import { poorNight, sleepEfficiency } from '$lib/analysis';
  import type { Night } from '$lib/db';
  import { formatDuration } from '$lib/days';
  import { t } from '$lib/i18n.svelte';
  import { manualNight } from '$lib/sleep';
  import { MIN_SLEEP_EFFICIENCY, SHORT_SLEEP_HOURS } from '$lib/thresholds';

  /** The numbers the forecast judges a night by, live while the night is edited. */
  let { night }: { night: Night } = $props();

  const n = $derived(manualNight(night.day, night.start, night.end, night.breaks));
  const share = $derived(sleepEfficiency(n));
  const poor = $derived(poorNight(n));
  const bad = $derived(poor.short || poor.fragmented);
  const awake = $derived(n.end - n.start - n.asleepMs);
  const min = Math.round(MIN_SLEEP_EFFICIENCY * 100);
  const pct = $derived(Math.round(share * 100));
  const color = $derived(bad ? 'var(--color-over)' : 'var(--color-ok)');
  const reason = $derived(
    poor.short
      ? t('sm.reasonShort', { limit: SHORT_SLEEP_HOURS })
      : poor.fragmented
        ? t('sm.reasonFragmented', { pct, min })
        : t('sm.reasonOk', { limit: SHORT_SLEEP_HOURS, min })
  );
</script>

{#snippet metric(label: string, value: string, warn = false, hint = '')}
  <div class="flex min-w-0 flex-col rounded-xl bg-surface px-3 py-2">
    <span class="truncate text-xs text-muted">{label}</span>
    <span class="font-semibold tabular" style:color={warn ? 'var(--color-over)' : undefined}>{value}</span>
    {#if hint}<span class="truncate text-caption text-muted">{hint}</span>{/if}
  </div>
{/snippet}

<div class="flex flex-col gap-2 text-sm">
  <p class="flex items-center gap-2">
    <span class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" style:color style:background-color="color-mix(in oklab, {color} 14%, transparent)">
      {t(bad ? 'prog.status.bad' : 'prog.status.ok')}
    </span>
    <span class="min-w-0 text-muted">{reason}</span>
  </p>
  <div class="grid grid-cols-2 gap-2">
    {@render metric(t('sm.asleep'), formatDuration(n.asleepMs), poor.short)}
    {@render metric(t('sm.inBed'), formatDuration(n.end - n.start))}
    {@render metric(t('sm.share'), `${pct} %`, poor.fragmented, t('sm.shareHint', { min }))}
    {@render metric(t('sm.breaks'), n.breaks.length ? t('sm.breaksValue', { n: n.breaks.length, d: formatDuration(awake) }) : t('sm.none'))}
  </div>
</div>
