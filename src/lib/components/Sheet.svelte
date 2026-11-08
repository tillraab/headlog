<script lang="ts">
  import { X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import InfoButton from './InfoButton.svelte';
  import { fade, fly } from 'svelte/transition';
  import { t } from '$lib/i18n.svelte';
  import { closeSheet, sheets, type SheetId } from '$lib/ui.svelte';

  let {
    id,
    title,
    full = false,
    info,
    children
  }: { id: SheetId; title: string; full?: boolean; info?: string | string[]; children: Snippet } = $props();

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
    <div class="flex items-center gap-1 px-5 pt-4 pb-2 {full ? 'safe-top' : ''}">
      <h2 class="min-w-0 text-lg font-semibold">{title}</h2>
      {#if info}<InfoButton {title} text={info} />{/if}
      <button class="press -mr-2 ml-auto grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface-2" onclick={() => closeSheet(id)} aria-label={t('a11y.close')}>
        <X size={24} />
      </button>
    </div>
    <div class="overflow-y-auto px-5 pb-6">
      {@render children()}
    </div>
  </div>
{/if}
