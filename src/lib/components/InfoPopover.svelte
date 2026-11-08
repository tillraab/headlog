<script lang="ts">
  import { X } from '@lucide/svelte';
  import { fade, fly } from 'svelte/transition';
  import { t } from '$lib/i18n.svelte';
  import { closeInfo, info } from '$lib/ui.svelte';

  /** The explanation an InfoButton opened. Closes on a tap outside, Escape or the Android back button. */
  let close = $state<HTMLButtonElement>();

  $effect(() => {
    if (info.open) close?.focus();
  });
</script>

<svelte:window onkeydown={(e) => info.open && e.key === 'Escape' && closeInfo()} />

{#if info.open}
  <div class="fixed inset-0 z-[80] bg-black/30" transition:fade={{ duration: 120 }} onclick={closeInfo} role="presentation"></div>
  <div
    class="safe-bottom fixed inset-x-0 bottom-0 z-[81] mx-auto max-h-[70vh] max-w-lg overflow-y-auto rounded-t-3xl bg-surface shadow-2xl"
    transition:fly={{ y: 200, duration: 180 }}
    role="dialog"
    aria-modal="true"
    aria-label={info.open.title}
  >
    <div class="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
      <h2 class="text-lg font-semibold">{info.open.title}</h2>
      <button bind:this={close} class="press -mr-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface-2" onclick={closeInfo} aria-label={t('a11y.close')}>
        <X size={22} />
      </button>
    </div>
    <div class="flex flex-col gap-3 px-5 pb-6 text-base leading-relaxed">
      {#each info.open.text as paragraph, i (i)}<p>{paragraph}</p>{/each}
      {#if info.open.sources.length}
        <h3 class="mt-1 text-sm font-semibold text-muted">{t('info.sources')}</h3>
        <ol class="flex list-decimal flex-col gap-2 pl-5 text-sm break-words text-muted select-text">
          {#each info.open.sources as source (source)}<li>{source}</li>{/each}
        </ol>
      {/if}
    </div>
  </div>
{/if}
