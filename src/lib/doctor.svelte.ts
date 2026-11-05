import { addMonths, startOfMonth } from 'date-fns';
import { createCsv, saveFile } from './backup';
import { doctorReport } from './report';
import { data } from './store.svelte';

/** The app icon rendered to a PNG data URL for the report header. */
async function logo(): Promise<string | undefined> {
  try {
    const img = new Image();
    img.src = 'favicon.svg';
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    canvas.getContext('2d')?.drawImage(img, 0, 0, 256, 256);
    return canvas.toDataURL('image/png');
  } catch {
    return undefined;
  }
}

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
      limit: snapshot.settings.limit,
      waterGoalMl: snapshot.settings.waterGoalMl,
      name: snapshot.settings.reportName,
      version: __APP_VERSION__,
      logo: await logo()
    },
    now,
    months
  );
  await saveFile(`headlog-report-${day}.pdf`, pdf, 'application/pdf');
}
