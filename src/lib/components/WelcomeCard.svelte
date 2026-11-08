<script lang="ts">
  import { X } from '@lucide/svelte';
  import { t } from '$lib/i18n.svelte';
  import { data } from '$lib/store.svelte';
  import { openSheet } from '$lib/ui.svelte';

  const KEY = 'headlog.welcomeDone';
  let dismissed = $state(localStorage.getItem(KEY) === '1');
  const empty = $derived(!data.episodes.length && !data.intakes.length && !data.drinks.length);

  function dismiss() {
    dismissed = true;
    localStorage.setItem(KEY, '1');
  }

  const steps = [
    { icon: '💊', title: 'welcome.meds', sheet: 'medList' },
    { icon: '💧', title: 'welcome.drinks', sheet: 'drinkList' },
    { icon: '🌦️', title: 'welcome.more', sheet: 'settings' }
  ] as const;
</script>

{#if empty && !dismissed}
  <section class="card flex flex-col gap-3 p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">{t('welcome.title')}</h2>
        <p class="text-muted">{t('welcome.hint')}</p>
      </div>
      <button class="press -mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted" onclick={dismiss} aria-label={t('edit.cancel')}>
        <X size={22} />
      </button>
    </div>
    <ol class="flex flex-col gap-2">
      {#each steps as step, i (step.sheet)}
        <li>
          <button class="press flex w-full items-center gap-3 rounded-xl bg-surface-2 px-3 py-3 text-left" onclick={() => openSheet(step.sheet)}>
            <span class="text-2xl">{step.icon}</span>
            <span class="flex-1"><span class="text-muted">{i + 1}.</span> {t(step.title)}</span>
          </button>
        </li>
      {/each}
    </ol>
    <p class="text-sm text-muted">{t('welcome.demo')}</p>
  </section>
{/if}
