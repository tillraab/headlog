<script lang="ts">
  import { hydrationMl } from '$lib/drinks';
  import { App } from '@capacitor/app';
  import { Capacitor } from '@capacitor/core';
  import { CalendarDays, ChartColumn, House, Pill, Settings } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import CalendarTab from '$lib/components/CalendarTab.svelte';
  import DrinkListSheet from '$lib/components/DrinkListSheet.svelte';
  import MedListSheet from '$lib/components/MedListSheet.svelte';
  import Celebration from '$lib/components/Celebration.svelte';
  import EditorSheet from '$lib/components/EditorSheet.svelte';
  import InsightsTab from '$lib/components/InsightsTab.svelte';
  import MedsTab from '$lib/components/MedsTab.svelte';
  import SettingsSheet from '$lib/components/SettingsSheet.svelte';
  import TodayTab from '$lib/components/TodayTab.svelte';
  import VersionsSheet from '$lib/components/VersionsSheet.svelte';
  import Toasts from '$lib/components/Toasts.svelte';
  import { i18n, t } from '$lib/i18n.svelte';
  import { confirmNight, data, endEpisode, load, ongoingEpisode, openNight, setRelief, startClock, updateSleep, updateWeather } from '$lib/store.svelte';
  import { applyDrinkReminders, applyHeadacheChecks, applyReminders, applyRiskAlert, applySleepChecks, onNotificationAction, planDrinkReminders, planHeadacheChecks, planReminders, planRiskAlert, planSleepChecks } from '$lib/reminders';
  import { tomorrowRisk } from '$lib/prognosis';
  import { syncQuietly } from '$lib/sync.svelte';
  import { applyTheme, closeAllSheets, closeTopSheet, openSheet, tap } from '$lib/ui.svelte';
  import { DAY } from '$lib/days';

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

  /** Reschedules reminders after every change and on return to the app. */
  function reschedule() {
    if (!data.ready) return;
    const now = Date.now();
    const start = new Date(now).setHours(0, 0, 0, 0);
    const todayMl = data.drinks.filter((d) => d.time >= start).reduce((s, d) => s + hydrationMl(d), 0);
    void applyReminders(planReminders(now, data.settings.reminders, data.settings.waterGoalMl, todayMl)).catch(() => {});
    void applyHeadacheChecks(planHeadacheChecks(ongoingEpisode(), now, data.settings.headacheCheckHours)).catch(() => {});
    const recent = data.drinks.filter((d) => d.time >= start - 7 * DAY);
    void applyDrinkReminders(planDrinkReminders(now, data.settings.drinkReminder, recent)).catch(() => {});
    const forecastAt = (time: number) =>
      tomorrowRisk({ drinks: data.drinks, sleep: data.sleep, weather: data.weather, goalMl: data.settings.waterGoalMl }, time);
    void applyRiskAlert(planRiskAlert(now, data.settings.riskAlert, forecastAt)).catch(() => {});
    const sleepCheck = { ...data.settings.sleepCheck, enabled: data.settings.sleep.enabled && data.settings.sleepCheck.enabled };
    void applySleepChecks(planSleepChecks(now, sleepCheck, data.sleep)).catch(() => {});
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
    const onHide = () => {
      if (document.visibilityState === 'hidden') return syncQuietly();
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
      relief: (id, relief) => void setRelief(id, relief),
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
<MedListSheet />
<DrinkListSheet />
<VersionsSheet />
<Toasts />
<Celebration />
