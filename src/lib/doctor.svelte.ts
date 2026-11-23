import { addMonths, startOfMonth } from 'date-fns';
import { createCsv, saveFile } from './backup';
import { doctorReport } from './report';
import { data } from './store.svelte';

/** Shares the doctor report for the last `months` calendar months, as PDF or CSV. */
export async function exportForDoctor(months: number, kind: 'pdf' | 'csv' = 'pdf') {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  if (kind === 'csv') {
    const from = startOfMonth(addMonths(now, -(months - 1))).getTime();
    await saveFile(`headlog-${day}.csv`, await createCsv(undefined, from), 'text/csv');
    return;
  }
  const snapshot = $state.snapshot(data);
  const pdf = doctorReport(
    {
      ...snapshot,
      waterGoalMl: snapshot.settings.waterGoalMl,
      name: snapshot.settings.reportName,
      version: __APP_VERSION__
    },
    now,
    months
  );
  await saveFile(`headlog-report-${day}.pdf`, pdf, 'application/pdf');
}
