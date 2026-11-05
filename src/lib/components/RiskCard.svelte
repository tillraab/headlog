<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import { formatDuration, formatLiters } from '$lib/days';
  import { t } from '$lib/i18n.svelte';
  import type { ActiveFactor, Risk } from '$lib/risk';

  let { risk }: { risk: Risk } = $props();
  let open = $state(false);

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

<section class="card overflow-hidden {tone}">
  <button class="press flex w-full items-center gap-3 px-4 py-3 text-left" onclick={() => (open = !open)} aria-expanded={open}>
    <span class="text-xl">{risk.level === 'possible' ? '🔎' : '⚠️'}</span>
    <span class="flex-1 text-sm font-semibold leading-snug">{t(`risk.title.${risk.day}.${risk.level === 'none' ? 'possible' : risk.level}`)}</span>
    {#if risk.estimate !== null}<span class="text-sm font-semibold tabular">{percent(risk.estimate)}</span>{/if}
    <ChevronDown size={18} class="shrink-0 text-muted transition-transform {open ? 'rotate-180' : ''}" />
  </button>
  {#if open}
    <div class="flex flex-col gap-2 px-4 pb-4">
      {#if risk.estimate !== null}
        <p class="text-sm tabular">{t('risk.estimate', { p: percent(risk.estimate), usual: percent(risk.usual) })}</p>
      {/if}
      <ul class="flex flex-col gap-1.5 text-sm">
        {#each risk.factors as f (f.key)}
          <li>
            <span class="font-medium">{describe(f)}</span>
            <span class="block text-xs text-muted">{evidence(f)}</span>
          </li>
        {/each}
      </ul>
      <p class="text-xs text-muted">{t(`risk.tip.${risk.factors[0].key}`)}</p>
    </div>
  {/if}
</section>
