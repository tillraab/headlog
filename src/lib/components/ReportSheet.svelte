<script lang="ts">
  import { exportForDoctor } from '$lib/doctor.svelte';
  import { t } from '$lib/i18n.svelte';
  import { data, saveSettings } from '$lib/store.svelte';
  import { closeSheet } from '$lib/ui.svelte';
  import Sheet from './Sheet.svelte';

  /** Report options, opened from Insights with the period selected there. */
  let { months = $bindable(3) }: { months?: number } = $props();
  let format = $state<'pdf' | 'csv'>('pdf');
  let busy = $state(false);

  async function share() {
    busy = true;
    try {
      await exportForDoctor(months, format);
      closeSheet('report');
    } finally {
      busy = false;
    }
  }
</script>

<Sheet id="report" title={t('set.doctor')}>
  <div class="flex flex-col gap-3">
    <p class="text-sm text-muted">{t('report.hint')}</p>
    <label class="flex flex-col gap-1 text-xs text-muted">
      {t('pdf.name')}
      <input value={data.settings.reportName} placeholder={t('pdf.namePlaceholder')} onchange={(e) => saveSettings({ reportName: e.currentTarget.value.trim() })} />
    </label>
    <div class="grid grid-cols-2 gap-2">
      <select bind:value={months}>
        {#each [1, 3, 6, 12] as n (n)}<option value={n}>{t('pdf.months', { n })}</option>{/each}
      </select>
      <div class="flex rounded-xl bg-surface-2 p-1 text-sm">
        {#each [['pdf', 'PDF'], ['csv', 'CSV']] as const as [value, name] (value)}
          <button class="press flex-1 rounded-lg py-1.5 {format === value ? 'bg-surface font-semibold shadow-sm' : 'text-muted'}" onclick={() => (format = value)}>
            {name}
          </button>
        {/each}
      </div>
    </div>
    <p class="text-xs text-muted">{format === 'pdf' ? t('report.pdf') : t('report.csv')}</p>
    <button class="press rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-fg disabled:opacity-50" disabled={busy} onclick={share}>
      {t('set.doctorExport')}
    </button>
  </div>
</Sheet>
