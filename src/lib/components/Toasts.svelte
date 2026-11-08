<script lang="ts">
  import { fly } from 'svelte/transition';
  import { t } from '$lib/i18n.svelte';
  import { dismiss, toasts } from '$lib/ui.svelte';
</script>

<div class="pointer-events-none fixed inset-x-0 z-[100] mx-auto flex max-w-lg flex-col items-center gap-2 px-4" style="bottom: calc(env(safe-area-inset-bottom) + 84px)">
  {#each toasts.list as toast (toast.id)}
    <div
      class="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl bg-fg px-4 py-3 text-bg shadow-lg"
      transition:fly={{ y: 30, duration: 180 }}
      role="status"
    >
      <span>{toast.text}</span>
      {#if toast.undo}
        <button
          class="press -my-2 min-h-11 shrink-0 font-semibold underline underline-offset-4"
          onclick={() => {
            toast.undo?.();
            dismiss(toast.id);
          }}>{t('toast.undo')}</button
        >
      {/if}
    </div>
  {/each}
</div>
