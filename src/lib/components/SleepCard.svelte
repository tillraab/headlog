<script lang="ts">
  /**
   * Last night on Today. An estimate waits here with Looks right / Correct until it is confirmed,
   * then the card goes away. A confirmed night stays editable from the forecast's sleep tile.
   */
  import { Moon } from '@lucide/svelte';
  import { dayKey, formatDuration, hm } from '$lib/days';
  import { t } from '$lib/i18n.svelte';
  import { awakeMs } from '$lib/sleep';
  import { openNight } from '$lib/editor.svelte';
  import { clock, confirmNight, data } from '$lib/store.svelte';
  import { tap, toast } from '$lib/ui.svelte';

  const day = $derived(dayKey(clock.now));
  const night = $derived(data.sleep.get(day));
  const awake = $derived(night ? awakeMs(night) : 0);

  async function confirm() {
    tap();
    await confirmNight(day);
    toast(t('toast.saved'));
  }
</script>

{#if night && night.source !== 'manual'}
  <section class="card flex flex-col gap-3 p-4">
    <div class="flex items-center gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Moon size={20} /></span>
      <div class="flex-1">
        <p class="text-xs text-muted">{t('sleep.card.title')}</p>
        <p class="font-semibold tabular">
          {hm(night.start)}–{hm(night.end)} · {formatDuration(night.asleepMs)}
        </p>
        {#if night.breaks.length}
          <p class="text-xs text-muted tabular">{t('sleep.breaks', { n: night.breaks.length, d: formatDuration(awake) })}</p>
        {/if}
      </div>
    </div>
    <p class="text-xs text-muted">{t('sleep.card.question')}</p>
    <div class="grid grid-cols-2 gap-2">
      <button class="press rounded-xl bg-surface-2 py-2.5 text-sm font-medium" onclick={() => openNight(day)}>{t('sleep.card.fix')}</button>
      <button class="press rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-fg" onclick={confirm}>{t('sleep.card.ok')}</button>
    </div>
  </section>
{:else if !night && data.settings.sleep.enabled}
  <section class="card flex items-center gap-3 p-4">
    <span class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"><Moon size={20} /></span>
    <p class="flex-1 text-sm text-muted">{t('sleep.card.none')}</p>
    <button class="press rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg" onclick={() => openNight(day)}>{t('sleep.card.add')}</button>
  </section>
{/if}
