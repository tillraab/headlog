<script lang="ts">
  /**
   * What the calendar marks, as a checklist: headaches, medication with each medication on its own, and the forecast
   * factors, each marking the days it was unfavourable.
   */
  import { intakeColor } from '$lib/colors';
  import { t } from '$lib/i18n.svelte';
  import { FACTOR_ICONS, type FactorKey } from '$lib/prognosis';
  import { data, saveSettings } from '$lib/store.svelte';
  import { tap } from '$lib/ui.svelte';
  import Sheet from './Sheet.svelte';

  const show = $derived(data.settings.calendar);
  const hidden = $derived(data.settings.calendarHiddenMeds);
  const shownMeds = $derived(show.medication ? data.medications.filter((m) => !hidden.includes(m.id)) : []);
  const allMeds = $derived(shownMeds.length === data.medications.length);

  function set(key: 'headache' | FactorKey, value: boolean) {
    tap();
    void saveSettings({ calendar: { ...show, [key]: value } });
  }

  function setAllMeds(value: boolean) {
    tap();
    void saveSettings({ calendar: { ...show, medication: value }, calendarHiddenMeds: [] });
  }

  function setMed(id: number, value: boolean) {
    tap();
    const shown = new Set(shownMeds.map((m) => m.id));
    if (value) shown.add(id);
    else shown.delete(id);
    void saveSettings({ calendar: { ...show, medication: shown.size > 0 }, calendarHiddenMeds: shown.size ? data.medications.filter((m) => !shown.has(m.id)).map((m) => m.id) : [] });
  }
</script>

{#snippet row(label: string, checked: boolean, onchange: (value: boolean) => void, opts: { indent?: boolean; dot?: string; mixed?: boolean } = {})}
  <label class="flex min-h-12 cursor-pointer items-center gap-3 {opts.indent ? 'pl-8' : ''}">
    <input type="checkbox" class="size-6 accent-primary" {checked} indeterminate={opts.mixed} onchange={(e) => onchange(e.currentTarget.checked)} />
    {#if opts.dot}<span class="size-3 rounded-full" style:background-color={opts.dot}></span>{/if}
    <span class="flex-1">{label}</span>
  </label>
{/snippet}

<Sheet id="calendarFilter" title={t('cal.show')}>
  <div class="flex flex-col gap-4">
    <div class="rounded-xl bg-surface-2 px-3">
      {@render row(t('cal.headache'), show.headache, (v) => set('headache', v), { dot: 'var(--color-pain)' })}
    </div>
    <div class="rounded-xl bg-surface-2 px-3">
      {@render row(t('cal.medication'), shownMeds.length > 0, setAllMeds, { mixed: shownMeds.length > 0 && !allMeds })}
      {#each data.medications as med (med.id)}
        {@render row(`${med.name} ${med.dose}`, shownMeds.includes(med), (v) => setMed(med.id, v), {
          indent: true,
          dot: intakeColor({ medId: med.id, name: med.name, category: med.category }, data.medications)
        })}
      {/each}
    </div>
    <div class="flex flex-col gap-1">
      <span class="text-sm text-muted">{t('cal.factorsGroup')}</span>
      <div class="rounded-xl bg-surface-2 px-3">
        {#each FACTOR_ICONS as [key, icon] (key)}
          {@render row(`${icon} ${t(`prog.${key}`)}`, show[key], (v) => set(key, v))}
        {/each}
      </div>
    </div>
  </div>
</Sheet>
