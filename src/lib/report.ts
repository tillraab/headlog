import { addMonths, endOfMonth, format, startOfDay, startOfMonth } from 'date-fns';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { headacheDays, intakeDays, MONTHLY_LIMITS, periodStats, tenTwenty } from './analysis';
import type { Drink, Episode, Intake, MedCategory, Medication } from './db';
import { dayKey, dayRange, formatDuration, keyToDate } from './days';
import { fmt, t, tagLabel } from './i18n.svelte';

type Rgb = [number, number, number];

const INK: Rgb = [29, 26, 43];
const MUTED: Rgb = [108, 104, 128];
const LINE: Rgb = [227, 224, 238];
const PRIMARY: Rgb = [91, 75, 214];
const MED: Rgb = [230, 149, 18];
const EMPTY: Rgb = [244, 243, 248];

/** Intensity 1 to 10 as a light-to-dark red. */
function painColor(intensity: number): Rgb {
  const light: Rgb = [253, 214, 222];
  const dark: Rgb = [176, 24, 62];
  const f = (intensity - 1) / 9;
  return light.map((c, i) => Math.round(c + (dark[i] - c) * f)) as Rgb;
}

export interface ReportInput {
  episodes: Episode[];
  intakes: Intake[];
  drinks: Drink[];
  medications: Medication[];
  limit: number;
  name: string;
  version: string;
}

/** Doctor report covering the `months` calendar months up to and including the one with `now`. */
export function doctorReport(input: ReportInput, now: number, months: number): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const from = startOfMonth(addMonths(now, -(months - 1)));
  const fromMs = from.getTime();
  const span = dayRange(from, now).length;

  const episodes = input.episodes.filter((e) => (e.end ?? now) >= fromMs && e.start <= now);
  const intakes = input.intakes.filter((i) => i.time >= fromMs && i.time <= now);
  const stats = periodStats({ episodes: input.episodes, intakes: input.intakes, drinks: input.drinks }, now, span);
  const hDays = headacheDays(input.episodes, now);
  const mDays = intakeDays(input.intakes);
  const rule = tenTwenty(new Set(mDays.keys()), now, input.limit);

  const text = (s: string | string[], x: number, y: number, size = 10, color: Rgb = INK, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(s, x, y);
  };

  // Header
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 4, 'F');
  text(t('pdf.title'), M, 18, 20, INK, true);
  text(
    [input.name, `${fmt(from, 'd. MMMM yyyy')} – ${fmt(now, 'd. MMMM yyyy')}`].filter(Boolean).join('  ·  '),
    M,
    25,
    10,
    MUTED
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(t('pdf.created', { date: fmt(now, 'd. MMM yyyy') }), W - M, 18, { align: 'right' });

  // Key figures
  const perMonth = (n: number) => (n / span) * 30;
  const tiles: [string, string, string?][] = [
    [String(stats.headacheDays), t('ins.headacheDays'), t('pdf.perMonth', { n: perMonth(stats.headacheDays).toFixed(1) })],
    [String(stats.episodes), t('ins.episodes')],
    [stats.avgIntensity === null ? '–' : stats.avgIntensity.toFixed(1), t('ins.avgIntensity'), '1–10'],
    [stats.avgDurationMs === null ? '–' : formatDuration(stats.avgDurationMs), t('ins.avgDuration')],
    [String(stats.medDays), t('ins.medDays'), t('pdf.perMonth', { n: perMonth(stats.medDays).toFixed(1) })],
    [`${rule.count}/${rule.limit}`, t('pdf.ruleNow'), t(`tenTwenty.${rule.status}`)]
  ];
  const tileW = (W - 2 * M - 5 * 3) / 6;
  tiles.forEach(([value, label, sub], i) => {
    const x = M + i * (tileW + 3);
    doc.setDrawColor(...LINE);
    doc.setFillColor(250, 249, 253);
    doc.roundedRect(x, 31, tileW, 22, 2, 2, 'FD');
    text(value, x + 3, 40, 14, i === 0 ? painColor(8) : i === 4 ? MED : INK, true);
    doc.setFontSize(7);
    text(doc.splitTextToSize(label, tileW - 6) as string[], x + 3, 45, 7, MUTED);
    if (sub) text(sub, x + 3, 51, 7, MUTED);
  });

  // Headache calendar: one row per month, one cell per day
  let y = 63;
  text(t('pdf.calendar'), M, y, 12, INK, true);
  y += 4;
  const labelW = 16;
  const cell = (W - 2 * M - labelW) / 31;
  doc.setFontSize(6);
  doc.setTextColor(...MUTED);
  for (let d = 1; d <= 31; d++) doc.text(String(d), M + labelW + (d - 0.5) * cell, y + 2, { align: 'center' });
  y += 4;
  for (let i = 0; i < months; i++) {
    const m = addMonths(from, i);
    text(fmt(m, 'MMM yy'), M, y + cell * 0.7, 7, MUTED);
    for (const key of dayRange(m, endOfMonth(m))) {
      const d = keyToDate(key).getDate();
      const x = M + labelW + (d - 1) * cell;
      const intensity = hDays.get(key);
      const future = key > dayKey(now);
      doc.setFillColor(...(intensity ? painColor(intensity) : future ? ([252, 252, 254] as Rgb) : EMPTY));
      doc.rect(x + 0.3, y + 0.3, cell - 0.6, cell - 0.6, 'F');
      if (mDays.has(key)) {
        doc.setFillColor(...MED);
        doc.circle(x + cell / 2, y + cell - 1.4, 0.8, 'F');
      }
      if (intensity && intensity >= 4) {
        doc.setFontSize(5);
        doc.setTextColor(255, 255, 255);
        doc.text(String(intensity), x + cell / 2, y + cell * 0.5, { align: 'center' });
      }
    }
    y += cell;
  }
  y += 4;
  const legend: [Rgb, string][] = [
    [painColor(2), t('pdf.legendMild')],
    [painColor(6), t('pdf.legendModerate')],
    [painColor(10), t('pdf.legendSevere')]
  ];
  let lx = M;
  for (const [color, label] of legend) {
    doc.setFillColor(...color);
    doc.rect(lx, y - 2.5, 3, 3, 'F');
    text(label, lx + 4.5, y, 7, MUTED);
    lx += doc.getTextWidth(label) + 10;
  }
  doc.setFillColor(...MED);
  doc.circle(lx + 1.5, y - 1, 0.9, 'F');
  text(t('pdf.legendMed'), lx + 4.5, y, 7, MUTED);
  y += 8;

  // Per month
  const monthRows = Array.from({ length: months }, (_, i) => {
    const m = addMonths(from, i);
    const prefix = format(m, 'yyyy-MM');
    const monthIntakes = input.intakes.filter((x) => dayKey(x.time).startsWith(prefix));
    const daysOf = (cat: MedCategory) => new Set(monthIntakes.filter((x) => x.category === cat).map((x) => dayKey(x.time))).size;
    const monthEpisodes = input.episodes.filter((e) => dayKey(e.start).startsWith(prefix));
    return [
      fmt(m, 'LLLL yyyy'),
      String([...hDays.keys()].filter((k) => k.startsWith(prefix)).length),
      String(monthEpisodes.length),
      monthEpisodes.length ? (monthEpisodes.reduce((s, e) => s + e.intensity, 0) / monthEpisodes.length).toFixed(1) : '–',
      String([...mDays.keys()].filter((k) => k.startsWith(prefix)).length),
      String(daysOf('analgesic')),
      String(daysOf('triptan'))
    ];
  });
  autoTable(doc, {
    startY: y,
    head: [[t('pdf.month'), t('ins.headacheDays'), t('ins.episodes'), t('ins.avgIntensity'), t('ins.medDays'), t('pdf.analgesicDays'), t('pdf.triptanDays')]],
    body: monthRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: LINE, textColor: INK },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 34 } },
    margin: { left: M, right: M }
  });

  // Medication
  const meds = new Map<string, { category: MedCategory; limit?: number; n: number; days: Set<string>; relief: number[] }>();
  for (const i of intakes) {
    const key = `${i.name} ${i.dose}`.trim();
    const m = meds.get(key) ?? { category: i.category, limit: input.medications.find((x) => x.id === i.medId)?.limitDays, n: 0, days: new Set<string>(), relief: [] };
    m.n++;
    m.days.add(dayKey(i.time));
    if (i.relief !== null) m.relief.push(i.relief);
    meds.set(key, m);
  }
  const reliefText = (r: number[]) => {
    if (!r.length) return '–';
    const labels = [t('edit.reliefNone'), t('edit.reliefSome'), t('edit.reliefGood')];
    return labels.map((l, v) => `${l} ${r.filter((x) => x === v).length}`).join(' / ');
  };
  let afterMeds = 0;
  autoTable(doc, {
    didDrawPage: (d) => {
      afterMeds = d.cursor?.y ?? afterMeds;
    },
    head: [[t('pdf.medication'), t('set.category'), t('pdf.intakes'), t('pdf.days'), t('set.limitDays'), t('pdf.relief')]],
    body: meds.size
      ? [...meds].sort((a, b) => b[1].n - a[1].n).map(([name, m]) => [name, t(`cat.${m.category}`), String(m.n), String(m.days.size), m.limit ? t('set.limitOption', { n: m.limit }) : '–', reliefText(m.relief)])
      : [[{ content: t('pdf.none'), colSpan: 6 }]],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: LINE, textColor: INK },
    headStyles: { fillColor: MED, textColor: 255, fontStyle: 'bold' },
    margin: { left: M, right: M }
  });
  const limitsNote = (Object.keys(MONTHLY_LIMITS) as MedCategory[])
    .map((c) => `${t(`cat.${c}`)} ${MONTHLY_LIMITS[c]}`)
    .join(', ');
  text(doc.splitTextToSize(t('pdf.ruleNote', { limits: limitsNote }), W - 2 * M) as string[], M, afterMeds + 5, 7, MUTED);

  if (stats.tags.length) {
    autoTable(doc, {
      startY: afterMeds + 12,
      head: [[t('ins.tags'), t('ins.episodes')]],
      body: stats.tags.map((x) => [tagLabel(x.tag), String(x.count)]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.6, lineColor: LINE, textColor: INK },
      headStyles: { fillColor: [120, 116, 140], textColor: 255, fontStyle: 'bold' },
      tableWidth: 90,
      margin: { left: M, right: M }
    });
  }

  // All episodes
  doc.addPage();
  text(t('pdf.episodes'), M, 18, 12, INK, true);
  const intakesFor = (e: Episode) => {
    const until = e.end ?? now;
    const dayStart = startOfDay(e.start).getTime();
    return intakes
      .filter((i) => i.time >= Math.min(dayStart, e.start - 3 * 3600000) && i.time <= until)
      .map((i) => `${format(i.time, 'HH:mm')} ${i.name}`)
      .join('\n');
  };
  autoTable(doc, {
    startY: 22,
    head: [[t('pdf.date'), t('edit.start'), t('edit.end'), t('pdf.duration'), t('pdf.intensity'), t('pdf.medication'), t('edit.tags'), t('edit.note')]],
    body: episodes
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((e) => [
        fmt(e.start, 'EEE d. MMM'),
        format(e.start, 'HH:mm'),
        e.end ? (dayKey(e.end) === dayKey(e.start) ? format(e.end, 'HH:mm') : fmt(e.end, 'd. MMM HH:mm')) : '…',
        formatDuration((e.end ?? now) - e.start),
        String(e.intensity),
        intakesFor(e),
        e.tags.map(tagLabel).join(', '),
        e.note
      ]),
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 1.4, textColor: INK, valign: 'top' },
    headStyles: { fillColor: painColor(8), textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 249, 253] },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 13 }, 2: { cellWidth: 15 }, 3: { cellWidth: 15 }, 4: { cellWidth: 11, halign: 'center' }, 5: { cellWidth: 34 } },
    margin: { left: M, right: M }
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const h = doc.internal.pageSize.getHeight();
    text(`HeadLog ${input.version}`, M, h - 8, 7, MUTED);
    doc.text(`${p} / ${pages}`, W - M, h - 8, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
