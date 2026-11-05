<script lang="ts">
  import { formatDuration, formatLiters } from '$lib/days';
  import { t } from '$lib/i18n.svelte';
  import type { ActiveFactor, Risk } from '$lib/risk';

  let { risk }: { risk: Risk } = $props();

  const tone = $derived(risk.level === 'high' ? 'bg-pain-soft' : risk.level === 'raised' ? 'bg-med-soft' : 'bg-surface-2');
  const percent = (v: number) => `${Math.round(v * 100)} %`;

  function describe(f: ActiveFactor): string {
    const when = risk.day === 'tomorrow' ? 'Tomorrow' : 'Today';
    switch (f.key) {
      case 'pressure':
        return t(`risk.pressure${when}`, { n: Math.round(f.value) });
      case 'hydration':
        return t(`risk.hydration${when}`, { ml: formatLiters(f.value) });
      case 'sleep':
        return t('risk.sleep', { d: formatDuration(f.value * 3600000) });
      case 'alcohol':
        return t(`risk.alcohol${when}`);
      case 'caffeine':
        return t('risk.caffeine', { mg: Math.round(f.value) });
    }
  }

  function evidence(f: ActiveFactor): string {
    if (f.stats.ratio === null) return t('risk.noData');
    return t('risk.evidence', { with: percent(f.stats.withRate), without: percent(f.stats.withoutRate) });
  }
</script>

<section class="card flex flex-col gap-2 p-4 {tone}">
  <div class="flex items-start gap-3">
    <span class="text-2xl">{risk.level === 'possible' ? '🔎' : '⚠️'}</span>
    <div class="flex-1">
      <p class="font-semibold">{t(`risk.title.${risk.day}.${risk.level === 'none' ? 'possible' : risk.level}`)}</p>
      {#if risk.estimate !== null}
        <p class="text-sm tabular">{t('risk.estimate', { p: percent(risk.estimate), usual: percent(risk.usual) })}</p>
      {/if}
    </div>
  </div>
  <ul class="flex flex-col gap-1.5 text-sm">
    {#each risk.factors as f (f.key)}
      <li>
        <span class="font-medium">{describe(f)}</span>
        <span class="block text-xs text-muted">{evidence(f)}</span>
      </li>
    {/each}
  </ul>
  <p class="text-xs text-muted">{t(`risk.tip.${risk.factors[0].key}`)}</p>
</section>
