<script lang="ts">
  import { App } from '@capacitor/app';
  import { Capacitor } from '@capacitor/core';
  import { CalendarDays, ChartColumn, House, Pill, Settings } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import CalendarTab from '$lib/components/CalendarTab.svelte';
  import DrinkListSheet from '$lib/components/DrinkListSheet.svelte';
  import MedListSheet from '$lib/components/MedListSheet.svelte';
  import Celebration from '$lib/components/Celebration.svelte';
  import EditorSheet from '$lib/components/EditorSheet.svelte';
  import FactorSheet from '$lib/components/FactorSheet.svelte';
  import RangeSheet from '$lib/components/RangeSheet.svelte';
  import InfoPopover from '$lib/components/InfoPopover.svelte';
  import InsightsTab from '$lib/components/InsightsTab.svelte';
  import MedsTab from '$lib/components/MedsTab.svelte';
  import SettingsSheet from '$lib/components/SettingsSheet.svelte';
  import TodayTab from '$lib/components/TodayTab.svelte';
  import VersionsSheet from '$lib/components/VersionsSheet.svelte';
  import Toasts from '$lib/components/Toasts.svelte';
  import { i18n, t } from '$lib/i18n.svelte';
  import { openNight } from '$lib/editor.svelte';
  import { confirmNight, data, endEpisode, load, setRelief, startClock, updateSleep, updateWeather } from '$lib/store.svelte';
  import { applyDrinkReminders, applyHeadacheChecks, applyReminders, applyRiskAlert, applySleepChecks, onNotificationAction, planAll } from '$lib/reminders';
  import { syncQuietly } from '$lib/sync.svelte';
  import { applyTheme, awayLongEnough, closeAllSheets, closeTopSheet, home, openSheet, tap } from '$lib/ui.svelte';

  const tabs = $derived([
    { id: 'today', label: t('tab.today'), icon: House },
    { id: 'meds', label: t('tab.meds'), icon: Pill },
    { id: 'calendar', label: t('tab.calendar'), icon: CalendarDays },
    { id: 'insights', label: t('tab.insights'), icon: ChartColumn }
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

  /** Starts on top of Today with every sheet closed, as after opening the app fresh. */
  function backToToday() {
    closeAllSheets();
    show(0, false);
    pager?.querySelector('section')?.scrollTo({ top: 0 });
    home.resets++;
  }

  /** Reschedules reminders after every change and on return to the app. */
  function reschedule() {
    if (!data.ready) return;
    const plans = planAll(data, Date.now());
    void applyReminders(plans.water).catch(() => {});
    void applyHeadacheChecks(plans.headache).catch(() => {});
    void applyDrinkReminders(plans.drink).catch(() => {});
    void applyRiskAlert(plans.risk).catch(() => {});
    void applySleepChecks(plans.sleep).catch(() => {});
  }

  $effect(reschedule);

  onMount(() => {
    document.documentElement.lang = i18n.lang;
    void load().then(() => {
      applyTheme(data.settings.theme);
      syncQuietly();
      void updateWeather().catch(() => {});
      void updateSleep().catch(() => {});
    });
    let hiddenAt: number | null = null;
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return syncQuietly();
      }
      if (awayLongEnough(hiddenAt, Date.now())) backToToday();
      hiddenAt = null;
      reschedule();
      void updateWeather().catch(() => {});
      void updateSleep().catch(() => {});
    };
    document.addEventListener('visibilitychange', onHide);
    const stopClock = startClock();
    const stopRelief = onNotificationAction({
      opened: () => {
        closeAllSheets();
        show(0, false);
      },
      relief: (id, relief, time) => void setRelief(id, relief, time),
      headacheGone: (id) => void endEpisode(id),
      sleepOk: (day) => void confirmNight(day),
      sleepFix: (day) => void openNight(day)
    });
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
      stopRelief();
      document.removeEventListener('visibilitychange', onHide);
      media.removeEventListener('change', onScheme);
      window.removeEventListener('resize', onResize);
      void backListener?.remove();
    };
  });
</script>

<div class="flex h-dvh flex-col">
  <header class="safe-top border-b border-line/60 bg-bg">
    <div class="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
      <span class="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <img src="favicon.svg" alt="" class="size-7" />
        HeadLog
      </span>
      <button class="press -mr-2 grid size-11 place-items-center rounded-full text-muted" onclick={() => openSheet('settings')} aria-label={t('set.title')}>
        <Settings size={22} />
      </button>
    </div>
  </header>

  <div bind:this={pager} class="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden" onscroll={onScroll}>
    {#each tabs as tab, i (i)}
      <section class="h-full w-full shrink-0 snap-start snap-always overflow-y-auto" aria-label={tab.label}>
        <div class="mx-auto max-w-lg px-4 pt-1">
          {#if data.ready}
            {#if tab.id === 'today'}<TodayTab onOpenTab={(id) => show(tabs.findIndex((x) => x.id === id))} />
            {:else if tab.id === 'meds'}<MedsTab onOpenTab={(id) => show(tabs.findIndex((x) => x.id === id))} />
            {:else if tab.id === 'calendar'}<CalendarTab />
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
          <span class="grid h-8 w-16 place-items-center rounded-full transition-colors {active === i ? 'bg-primary/12' : ''}">
            <tab.icon size={21} strokeWidth={active === i ? 2.4 : 2} />
          </span>
          {tab.label}
        </button>
      {/each}
    </div>
  </nav>
</div>

<EditorSheet />
<FactorSheet />
<RangeSheet />
<SettingsSheet />
<MedListSheet />
<DrinkListSheet />
<VersionsSheet />
<InfoPopover />
<Toasts />
<Celebration />
