<script lang="ts">
  import { X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { t } from '$lib/i18n.svelte';
  import { closeSheet, sheets } from '$lib/ui.svelte';

  let { id, title, full = false, children }: { id: string; title: string; full?: boolean; children: Snippet } = $props();

  const open = $derived(sheets.stack.includes(id));
  const z = $derived(50 + sheets.stack.indexOf(id) * 2);
</script>

{#if open}
  <div
    class="fixed inset-0 bg-black/40"
    style:z-index={z}
    transition:fade={{ duration: 150 }}
    onclick={() => closeSheet(id)}
    role="presentation"
  ></div>
  <div
    class="safe-bottom fixed inset-x-0 bottom-0 mx-auto flex max-w-lg flex-col rounded-t-3xl bg-bg shadow-2xl {full ? 'top-0 rounded-t-none sm:top-6 sm:rounded-t-3xl' : 'max-h-[88vh]'}"
    style:z-index={z + 1}
    transition:fly={{ y: 400, duration: 220 }}
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <div class="flex items-center justify-between px-5 pt-4 pb-2 {full ? 'safe-top' : ''}">
      <h2 class="text-lg font-semibold">{title}</h2>
      <button class="press -mr-2 grid size-10 place-items-center rounded-full hover:bg-surface-2" onclick={() => closeSheet(id)} aria-label={t('a11y.close')}>
        <X size={20} />
      </button>
    </div>
    <div class="overflow-y-auto px-5 pb-6">
      {@render children()}
    </div>
  </div>
{/if}
