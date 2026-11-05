<script lang="ts">
  import { App } from '@capacitor/app';
  import { Capacitor } from '@capacitor/core';
  import { CalendarDays, ChartColumn, House, Pill, Settings } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import CalendarTab from '$lib/components/CalendarTab.svelte';
  import EditorSheet from '$lib/components/EditorSheet.svelte';
  import InsightsTab from '$lib/components/InsightsTab.svelte';
  import MedsTab from '$lib/components/MedsTab.svelte';
  import SettingsSheet from '$lib/components/SettingsSheet.svelte';
  import TodayTab from '$lib/components/TodayTab.svelte';
  import Toasts from '$lib/components/Toasts.svelte';
  import { i18n, t } from '$lib/i18n.svelte';
  import { data, load, startClock } from '$lib/store.svelte';
  import { applyTheme, closeTopSheet, openSheet, tap } from '$lib/ui.svelte';

  const tabs = $derived([
    { label: t('tab.today'), icon: House },
    { label: t('tab.calendar'), icon: CalendarDays },
    { label: t('tab.meds'), icon: Pill },
    { label: t('tab.insights'), icon: ChartColumn }
  ]);

  let pager = $state<HTMLDivElement>();
  let active = $state(0);

  function show(index: number, smooth = true) {
    if (!pager) return;
    pager.scrollTo({ left: index * pager.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
    active = index;
  }

  function onScroll() {
    if (!pager) return;
    active = Math.round(pager.scrollLeft / pager.clientWidth);
  }

  onMount(() => {
    document.documentElement.lang = i18n.lang;
    void load().then(() => applyTheme(data.settings.theme));
    const stopClock = startClock();
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => applyTheme(data.settings.theme);
    media.addEventListener('change', onScheme);
    const onResize = () => show(active, false);
    window.addEventListener('resize', onResize);

    let backListener: { remove: () => Promise<void> } | undefined;
    if (Capacitor.isNativePlatform()) {
      void App.addListener('backButton', () => {
        if (closeTopSheet()) return;
        if (active !== 0) show(0);
        else void App.minimizeApp();
      }).then((l) => (backListener = l));
    }

    return () => {
      stopClock();
      media.removeEventListener('change', onScheme);
      window.removeEventListener('resize', onResize);
      void backListener?.remove();
    };
  });
</script>

<div class="flex h-dvh flex-col">
  <header class="safe-top border-b border-line/60 bg-bg">
    <div class="mx-auto flex h-12 max-w-lg items-center justify-between px-4">
      <span class="flex items-center gap-2 font-semibold tracking-tight">
        <img src="favicon.svg" alt="" class="size-6" />
        HeadLog
      </span>
      <button class="press -mr-2 grid size-10 place-items-center rounded-full text-muted" onclick={() => openSheet('settings')} aria-label={t('set.title')}>
        <Settings size={20} />
      </button>
    </div>
  </header>

  <div bind:this={pager} class="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden" onscroll={onScroll}>
    {#each tabs as tab, i (i)}
      <section class="h-full w-full shrink-0 snap-start snap-always overflow-y-auto" aria-label={tab.label}>
        <div class="mx-auto max-w-lg px-4 pt-1">
          {#if data.ready}
            {#if i === 0}<TodayTab onOpenTab={show} />
            {:else if i === 1}<CalendarTab />
            {:else if i === 2}<MedsTab />
            {:else}<InsightsTab />{/if}
          {/if}
        </div>
      </section>
    {/each}
  </div>

  <nav class="safe-bottom border-t border-line bg-surface/90 backdrop-blur">
    <div class="mx-auto grid max-w-lg grid-cols-4">
      {#each tabs as tab, i (i)}
        <button
          class="press flex flex-col items-center gap-0.5 py-2 text-caption font-medium {active === i ? 'text-primary' : 'text-muted'}"
          onclick={() => {
            tap();
            show(i);
          }}
          aria-current={active === i ? 'page' : undefined}
        >
          <span class="grid h-7 w-14 place-items-center rounded-full transition-colors {active === i ? 'bg-primary/12' : ''}">
            <tab.icon size={20} strokeWidth={active === i ? 2.4 : 2} />
          </span>
          {tab.label}
        </button>
      {/each}
    </div>
  </nav>
</div>

<EditorSheet />
<SettingsSheet />
<Toasts />
