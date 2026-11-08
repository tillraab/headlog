import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  compareDays,
  dayFactors,
  headacheDays,
  intakeDays,
  medicationEffect,
  monthlyCounts,
  periodStats,
  rollingDays,
  ruleStatus,
  tenTwenty,
  type Comparison,
  type ComparisonKey,
  type DayFactors,
  type MedicationEffect,
  type PeriodStats,
  type TenTwenty
} from './analysis';
import type { Drink, Episode, Intake, Medication, Night, Relief, WeatherDay } from './db';
import { formatComparison } from './format';
import { MONTHLY_LIMITS, type MedCategory } from './medication';
import { dayKey, dayRange, formatDuration, formatLiters, hm, HOUR, keyToDate } from './days';
import { fmt, num, reliefLabels, t, tagLabel } from './i18n.svelte';
import { PRESSURE_DROP_HPA } from './weather';

type Rgb = [number, number, number];

const INK: Rgb = [29, 26, 43];
const MUTED: Rgb = [108, 104, 128];
const LINE: Rgb = [227, 224, 238];
const SOFT: Rgb = [247, 246, 251];
const PRIMARY: Rgb = [91, 75, 214];
const NIGHT: Rgb = [28, 23, 56];
const ON_NIGHT: Rgb = [199, 192, 255];
const WHITE: Rgb = [255, 255, 255];
const PAIN: Rgb = [226, 70, 107];
const MED: Rgb = [230, 149, 18];
const WATER: Rgb = [31, 143, 224];
const OK: Rgb = [22, 162, 107];
const CAUTION: Rgb = [217, 138, 4];
const OVER: Rgb = [220, 58, 58];
const EMPTY: Rgb = [240, 239, 246];

const STATUS_COLOR = { ok: OK, caution: CAUTION, over: OVER };

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
  sleep: Map<string, Night>;
  weather: Map<string, WeatherDay>;
  limit: number;
  waterGoalMl: number;
  name: string;
  version: string;
  /** App icon as a PNG data URL, drawn in the header when given. */
  logo?: string;
}

/** The factors of a day as short text, e.g. "pressure drop 8 hPa · 0.6 l the day before". */
function factorText(f: DayFactors): string[] {
  const parts: string[] = [];
  if (f.pressure !== undefined) parts.push(t('pdf.f.pressure', { n: Math.round(f.pressure) }));
  if (f.hydration !== undefined) parts.push(t('pdf.f.hydration', { ml: formatLiters(f.hydration) }));
  if (f.sleep !== undefined)
    parts.push(
      f.sleepEfficiency !== undefined
        ? t('pdf.f.sleepFragmented', { d: formatDuration(f.sleep * HOUR), pct: Math.round(f.sleepEfficiency * 100) })
        : t('pdf.f.sleep', { d: formatDuration(f.sleep * HOUR) })
    );
  if (f.alcohol) parts.push(t('pdf.f.alcohol'));
  if (f.caffeine !== undefined) parts.push(t('pdf.f.caffeine', { mg: Math.round(f.caffeine) }));
  return parts;
}

/** An intake up to this long before a headache started belongs to that headache. */
const INTAKE_BEFORE_EPISODE_MS = 3 * HOUR;

/**
 * Each headache with the intakes that belong to it: taken from 3 hours before it started until it
 * ended (or `now`). An intake can belong to two headaches close together. `unmatched` are the
 * intakes that belong to none.
 */
function matchIntakes(episodes: Episode[], intakes: Intake[], now: number): { matched: { episode: Episode; intakes: Intake[] }[]; unmatched: Intake[] } {
  const used = new Set<number>();
  const matched = episodes.map((episode) => {
    const own = intakes.filter((i) => i.time >= episode.start - INTAKE_BEFORE_EPISODE_MS && i.time <= (episode.end ?? now));
    own.forEach((i) => used.add(i.id));
    return { episode, intakes: own };
  });
  return { matched, unmatched: intakes.filter((i) => !used.has(i.id)) };
}

/** One row of the table of entries: a headache with its intakes, or an intake without a headache. */
export interface EntryRow {
  time: number;
  episode?: Episode;
  intakes: Intake[];
  factors: DayFactors;
}

/** One row of the possible triggers: how a factor compares, and with how many headaches it came. */
export interface TriggerRow {
  key: ComparisonKey;
  comparison?: Comparison;
  /** Headaches in the period that came with this factor. */
  withFactor: number;
}

export interface ReportData {
  /** First day of the period: the start of the first month. */
  from: Date;
  /** Days in the period, today included. */
  span: number;
  stats: PeriodStats;
  /** The 10/20 rule as it stands at `now`. */
  rule: TenTwenty;
  /** Peak intensity per headache day, and the days with acute medication, over all data. */
  headacheDays: Map<string, number>;
  medDays: Set<string>;
  monthly: { month: Date; headache: number; med: number }[];
  /** Medication used in the period, grouped by name and dose, with its list entry for the personal limit. */
  medications: (MedicationEffect & { med?: Medication })[];
  triggers: TriggerRow[];
  /** Headaches that started in the period. */
  episodes: number;
  entries: EntryRow[];
}

/** The trigger rows in the order the report lists them; the comparison and the day factor share their key. */
const TRIGGERS: (ComparisonKey & keyof DayFactors)[] = ['pressure', 'hydration', 'sleep', 'alcohol', 'caffeine'];

/** Everything the doctor report shows, without the drawing. Covers the `months` calendar months up to `now`. */
export function reportData(input: ReportInput, now: number, months: number): ReportData {
  const from = startOfMonth(addMonths(now, -(months - 1)));
  const fromMs = from.getTime();
  const span = dayRange(from, now).length;
  const intakes = input.intakes.filter((i) => i.time >= fromMs && i.time <= now);
  const medDays = new Set(intakeDays(input.intakes).keys());
  const episodes = input.episodes.filter((e) => e.start >= fromMs && e.start <= now).sort((a, b) => a.start - b.start);
  const factorsOn = (time: number) => dayFactors(input, dayKey(time), input.waterGoalMl);
  const factors = new Map(episodes.map((e) => [e.id, factorsOn(e.start)]));
  const comparisons = new Map(compareDays(input, dayRange(from, now), now).map((c) => [c.key, c]));
  const { matched, unmatched } = matchIntakes(episodes, intakes, now);

  return {
    from,
    span,
    stats: periodStats(input, now, span),
    rule: tenTwenty(medDays, now, input.limit),
    headacheDays: headacheDays(input.episodes, now),
    medDays,
    monthly: monthlyCounts(input, now, months),
    medications: medicationEffect(intakes, fromMs, now, (i) => `${i.name} ${i.dose}`.trim()).map((m) => ({
      ...m,
      med: input.medications.find((x) => x.id === m.medId)
    })),
    triggers: TRIGGERS.map((key) => ({
      key,
      comparison: comparisons.get(key),
      withFactor: [...factors.values()].filter((f) => f[key] !== undefined).length
    })),
    episodes: episodes.length,
    entries: [
      ...matched.map(({ episode, intakes: own }) => ({ time: episode.start, episode, intakes: own, factors: factors.get(episode.id)! })),
      ...unmatched.map((i) => ({ time: i.time, intakes: [i], factors: factorsOn(i.time) }))
    ].sort((a, b) => a.time - b.time)
  };
}

/** Doctor report: an overview page, then possible triggers and a table of every headache and intake. Covers the `months` calendar months up to and including the one with `now`. */
export function doctorReport(input: ReportInput, now: number, months: number): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const inner = W - 2 * M;
  const footerY = H - 12;

  const report = reportData(input, now, months);
  const { from, span, stats, rule, headacheDays: hDays, medDays: medDaySet } = report;

  const text = (s: string | string[], x: number, y: number, size: number, color: Rgb = INK, bold = false, align: 'left' | 'right' | 'center' = 'left') => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(s, x, y, { align });
  };
  const heading = (s: string, x: number, y: number) => text(s.toUpperCase(), x, y, 7.5, MUTED, true);
  const panel = (x: number, y: number, w: number, h: number) => {
    doc.setDrawColor(...LINE);
    doc.setFillColor(...WHITE);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
  };

  // Header band
  doc.setFillColor(...NIGHT);
  doc.rect(0, 0, W, 30, 'F');
  if (input.logo) doc.addImage(input.logo, 'PNG', M, 6, 18, 18);
  const titleX = input.logo ? M + 23 : M;
  text(t('pdf.title'), titleX, 14, 18, WHITE, true);
  text(`${fmt(from, 'd. MMMM yyyy')} – ${fmt(now, 'd. MMMM yyyy')}`, titleX, 21, 9.5, ON_NIGHT);
  if (input.name) text(input.name, W - M, 14, 11, WHITE, true, 'right');
  text(t('pdf.created', { date: fmt(now, 'd. MMM yyyy') }), W - M, 21, 8, ON_NIGHT, false, 'right');

  // Key figures
  let y = 36;
  const perMonth = (n: number) => num((n / span) * 30, 1);
  const tiles: { value: string; label: string; sub?: string; color: Rgb }[] = [
    { value: String(stats.headacheDays), label: t('ins.headacheDays'), sub: t('pdf.perMonth', { n: perMonth(stats.headacheDays) }), color: PAIN },
    { value: stats.avgIntensity === null ? '–' : num(stats.avgIntensity, 1), label: t('ins.avgIntensity'), sub: '1–10', color: INK },
    { value: stats.avgDurationMs === null ? '–' : formatDuration(stats.avgDurationMs), label: t('ins.avgDuration'), color: INK },
    { value: String(stats.medDays), label: t('ins.medDays'), sub: t('pdf.perMonth', { n: perMonth(stats.medDays) }), color: MED },
    { value: `${rule.count}/${rule.limit}`, label: t('pdf.ruleNow'), sub: t(`tenTwenty.${rule.status}`), color: STATUS_COLOR[rule.status] },
    {
      value: stats.avgWaterMl === null ? '–' : formatLiters(stats.avgWaterMl),
      label: t('ins.avgWater'),
      sub: t('today.goal', { goal: formatLiters(input.waterGoalMl) }),
      color: WATER
    }
  ];
  const gap = 3;
  const tileW = (inner - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach((tile, i) => {
    const x = M + i * (tileW + gap);
    panel(x, y, tileW, 21);
    doc.setFillColor(...tile.color);
    doc.rect(x + 0.6, y + 3, 1.2, 15, 'F');
    text(tile.value, x + 4, y + 8.5, 13, tile.color, true);
    text(tile.label, x + 4, y + 13.5, 6.8, MUTED);
    if (tile.sub) text(tile.sub, x + 4, y + 17.5, 6.5, MUTED);
  });
  y += 26;

  y = calendar(y) + 4;

  const chartH = 50;
  const colW = (inner - 4) / 2;
  monthlyChart(M, y, colW, chartH);
  ruleChart(M + colW + 4, y, colW, chartH);
  y += chartH + 4;

  const medW = inner * 0.64;
  medicationPanel(y, medW, footerY - 3 - y);
  triggerPanel(M + medW + 4, y, inner - medW - 4, footerY - 3 - y);

  reasonsAndEntries();

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.line(M, footerY, W - M, footerY);
    text(`HeadLog ${input.version} · ${t('tenTwenty.disclaimer')}`, M, footerY + 4.5, 6.5, MUTED);
    text(`${page} / ${pages}`, W - M, footerY + 4.5, 6.5, MUTED, false, 'right');
  }

  return new Uint8Array(doc.output('arraybuffer'));

  /**
   * Pages after the overview: possible triggers (headache days against other days, and how many
   * headaches each factor came with), then one row per headache and per intake without a headache.
   */
  function reasonsAndEntries() {
    doc.addPage();
    let top = 16;
    text(t('pdf.reasons'), M, top, 14, INK, true);
    top += 5;
    doc.setFontSize(7.5);
    text(doc.splitTextToSize(t('pdf.reasonsHint'), inner) as string[], M, top, 7.5, MUTED);
    top += 9;

    let tableEnd = top;
    autoTable(doc, {
      startY: top,
      margin: { left: M, right: M },
      didDrawPage: (d) => {
        tableEnd = d.cursor?.y ?? tableEnd;
      },
      head: [[t('pdf.factor'), t('pdf.onHeadacheDays'), t('pdf.onOtherDays'), t('pdf.withFactor')]],
      body: report.triggers.map(({ key, comparison: c, withFactor }) => [
        t(`pdf.factor.${key}`, { n: PRESSURE_DROP_HPA }),
        c ? `${formatComparison(key, c.headache)} (${c.nHeadache})` : '–',
        c ? `${formatComparison(key, c.clear)} (${c.nClear})` : '–',
        report.episodes ? t('pdf.ofHeadaches', { n: withFactor, total: report.episodes }) : '–'
      ]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 }, textColor: INK },
      headStyles: { fontSize: 7, textColor: MUTED, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: SOFT },
      columnStyles: { 0: { cellWidth: 70 } }
    });
    const tags = stats.tags.slice(0, 8).map((x) => `${tagLabel(x.tag)} ${x.count}×`).join(' · ');
    let entriesTop = tableEnd + 6;
    if (tags) {
      doc.setFontSize(7.5);
      const lines = doc.splitTextToSize(`${t('ins.tags')}: ${tags}`, inner) as string[];
      text(lines, M, entriesTop, 7.5, MUTED);
      entriesTop += lines.length * 3.5 + 2;
    }
    text(t('pdf.entries'), M, entriesTop + 3, 11, INK, true);

    autoTable(doc, {
      startY: entriesTop + 6,
      head: [[t('pdf.date'), t('pdf.time'), t('pdf.intensity'), t('pdf.medication'), t('pdf.possible'), t('edit.note')]],
      body: report.entries.map(entryCells),
      margin: { left: M, right: M, bottom: 18 },
      rowPageBreak: 'avoid',
      theme: 'striped',
      styles: { fontSize: 7.3, cellPadding: 1.4, textColor: INK, valign: 'top' },
      headStyles: { fillColor: painColor(8), textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: SOFT },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 22 }, 2: { cellWidth: 11, halign: 'center' }, 3: { cellWidth: 42 }, 4: { cellWidth: 48 } }
    });
  }

  /** The cells of one row of the table of entries. */
  function entryCells(row: EntryRow): string[] {
    const reliefText = (r: Relief | null) => (r === null ? '' : ` (${reliefLabels()[r].toLowerCase()})`);
    const medLine = (i: Intake) => `${hm(i.time)} ${i.name} ${i.dose}`.trim() + reliefText(i.relief);
    const e = row.episode;
    if (!e) return [fmt(row.time, 'EEE d. MMM'), t('pdf.noHeadache'), '–', medLine(row.intakes[0]), factorText(row.factors).join('\n') || '–', ''];
    const reasons = [...factorText(row.factors), ...e.tags.map(tagLabel)];
    return [
      fmt(e.start, 'EEE d. MMM'),
      `${hm(e.start)}–${e.end ? hm(e.end) : '…'}\n${formatDuration((e.end ?? now) - e.start)}`,
      String(e.intensity),
      row.intakes.map(medLine).join('\n') || '–',
      reasons.join('\n') || '–',
      e.note
    ];
  }

  /** One row per month, one cell per day, shaded by headache intensity, with a dot on medication days. Returns the bottom. */
  function calendar(top: number): number {
    const labelW = 15;
    const cell = Math.min(5.6, (inner - 8 - labelW) / 31);
    const height = 15 + months * cell;
    panel(M, top, inner, height);
    heading(t('pdf.calendar'), M + 4, top + 6);

    let lx = M + inner - 4;
    const legend: [Rgb, string, boolean][] = [
      [MED, t('pdf.legendMed'), true],
      [painColor(10), t('pdf.legendSevere'), false],
      [painColor(6), t('pdf.legendModerate'), false],
      [painColor(2), t('pdf.legendMild'), false]
    ];
    for (const [color, label, dot] of legend) {
      doc.setFontSize(6.5);
      lx -= doc.getTextWidth(label);
      text(label, lx, top + 6, 6.5, MUTED);
      doc.setFillColor(...color);
      if (dot) doc.circle(lx - 2, top + 5.1, 0.9, 'F');
      else doc.roundedRect(lx - 3.4, top + 3.7, 2.6, 2.6, 0.5, 0.5, 'F');
      lx -= 8;
    }

    const gx = M + 4 + labelW;
    for (let d = 1; d <= 31; d++) text(String(d), gx + (d - 0.5) * cell, top + 10.5, 5.5, MUTED, false, 'center');
    let cy = top + 12;
    const today = dayKey(now);
    for (let i = 0; i < months; i++) {
      const m = addMonths(from, i);
      text(fmt(m, 'MMM yy'), M + 4, cy + cell * 0.72, 7, MUTED);
      for (const key of dayRange(m, endOfMonth(m))) {
        const x = gx + (keyToDate(key).getDate() - 1) * cell;
        const intensity = hDays.get(key);
        doc.setFillColor(...(intensity ? painColor(intensity) : key > today ? ([250, 250, 253] as Rgb) : EMPTY));
        doc.roundedRect(x + 0.35, cy + 0.35, cell - 0.7, cell - 0.7, 0.6, 0.6, 'F');
        if (intensity && intensity >= 4) text(String(intensity), x + cell / 2, cy + cell * 0.62, 5, WHITE, true, 'center');
        if (medDaySet.has(key)) {
          doc.setFillColor(...MED);
          doc.circle(x + cell - 1.1, cy + 1.1, 0.75, 'F');
        }
      }
      cy += cell;
    }
    return top + height;
  }

  /** Headache days and medication days per calendar month, as paired bars. */
  function monthlyChart(x: number, top: number, w: number, h: number) {
    panel(x, top, w, h);
    heading(t('ins.monthly'), x + 4, top + 6);
    let lx = x + w - 4;
    for (const [color, label] of [
      [MED, t('cal.medDays')],
      [PAIN, t('cal.headacheDays')]
    ] as [Rgb, string][]) {
      doc.setFontSize(6.3);
      lx -= doc.getTextWidth(label);
      text(label, lx, top + 6, 6.3, MUTED);
      doc.setFillColor(...color);
      doc.roundedRect(lx - 3.2, top + 3.9, 2.4, 2.4, 0.4, 0.4, 'F');
      lx -= 7;
    }
    const data = report.monthly.map((m) => ({ label: fmt(m.month, 'MMM'), headache: m.headache, med: m.med }));
    const box = { top: top + 12, bottom: top + h - 8, left: x + 9, right: x + w - 4 };
    const max = Math.max(5, ...data.map((d) => Math.max(d.headache, d.med)));
    axis(box, max);
    const slot = (box.right - box.left) / data.length;
    const bw = Math.min(5, slot * 0.32);
    data.forEach((d, i) => {
      const cx = box.left + slot * (i + 0.5);
      bar(cx - bw - 0.3, d.headache, PAIN);
      bar(cx + 0.3, d.med, MED);
      text(d.label, cx, box.bottom + 4, 6.3, MUTED, false, 'center');
    });

    function bar(bx: number, value: number, color: Rgb) {
      if (!value) return;
      const bh = ((box.bottom - box.top) * value) / max;
      doc.setFillColor(...color);
      doc.roundedRect(bx, box.bottom - bh, bw, bh, 0.6, 0.6, 'F');
      if (bw >= 2.5) text(String(value), bx + bw / 2, box.bottom - bh - 1, 5.5, MUTED, false, 'center');
    }
  }

  /** Medication days in the 30 days up to each day, against the 10/20 limit. */
  function ruleChart(x: number, top: number, w: number, h: number) {
    panel(x, top, w, h);
    heading(t('pdf.ruleChart', { limit: input.limit }), x + 4, top + 6);
    const rolling = rollingDays(medDaySet, now, span);
    const box = { top: top + 12, bottom: top + h - 8, left: x + 9, right: x + w - 4 };
    const max = Math.max(input.limit + 4, ...rolling.map((r) => r.count));
    axis(box, max);
    const step = (box.right - box.left) / rolling.length;
    rolling.forEach((r, i) => {
      if (!r.count) return;
      const bh = ((box.bottom - box.top) * r.count) / max;
      doc.setFillColor(...STATUS_COLOR[ruleStatus(r.count, input.limit - 1)]);
      doc.rect(box.left + i * step, box.bottom - bh, Math.max(0.15, step * 0.85), bh, 'F');
    });
    const ly = box.bottom - ((box.bottom - box.top) * input.limit) / max;
    doc.setDrawColor(...OVER);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.2, 0.8], 0);
    doc.line(box.left, ly, box.right, ly);
    doc.setLineDashPattern([], 0);
    doc.setLineWidth(0.2);
    text(String(input.limit), box.right, ly - 1, 6, OVER, true, 'right');
    text(fmt(from, 'd. MMM'), box.left, box.bottom + 4, 6.3, MUTED);
    text(fmt(now, 'd. MMM'), box.right, box.bottom + 4, 6.3, MUTED, false, 'right');
  }

  /** Light grid lines with their values on the left. */
  function axis(box: { top: number; bottom: number; left: number; right: number }, max: number) {
    const stepValue = max > 20 ? 10 : 5;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    for (let v = 0; v <= max; v += stepValue) {
      const gy = box.bottom - ((box.bottom - box.top) * v) / max;
      doc.line(box.left, gy, box.right, gy);
      text(String(v), box.left - 1.5, gy + 1, 5.5, MUTED, false, 'right');
    }
    doc.setLineWidth(0.2);
  }

  /** Medication used in the period with days, intakes, how often it helped and the personal limit. */
  function medicationPanel(top: number, w: number, h: number) {
    const rows = report.medications;
    const shown = rows.slice(0, 7);
    const helped = (m: MedicationEffect) => (m.rated ? `${Math.round((m.relief[2] / m.rated) * 100)} %` : '–');

    panel(M, top, w, h);
    heading(t('pdf.medication'), M + 4, top + 6);
    autoTable(doc, {
      startY: top + 8,
      margin: { left: M + 3, right: W - M - w + 3 },
      tableWidth: w - 6,
      head: [[t('pdf.medication'), t('set.category'), t('pdf.days'), t('pdf.intakes'), t('pdf.helped'), t('set.limitDays')]],
      body: shown.length
        ? shown.map((m) => [
            `${m.name} ${m.dose}`.trim(),
            t(`cat.${m.category}`),
            String(m.days),
            String(m.intakes),
            helped(m),
            m.med?.limitDays ? `${m.med.limitDays}/${m.med.limitWindow ?? 30}` : '–'
          ])
        : [[{ content: t('pdf.none'), colSpan: 6 }]],
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: { top: 1.4, bottom: 1.4, left: 1.5, right: 1.5 }, textColor: INK },
      headStyles: { fontSize: 6.5, textColor: MUTED, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: SOFT },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
    });
    const limits = (Object.keys(MONTHLY_LIMITS) as MedCategory[]).map((c) => `${t(`cat.${c}`)} ${MONTHLY_LIMITS[c]}`).join(', ');
    const note = [rows.length > shown.length ? t('pdf.moreMeds', { n: rows.length - shown.length }) : '', t('pdf.ruleNote', { limits })]
      .filter(Boolean)
      .join(' ');
    doc.setFontSize(6.3);
    text(doc.splitTextToSize(note, w - 8) as string[], M + 4, top + h - 8, 6.3, MUTED);
  }

  /** The most common symptoms and triggers as small bars. */
  function triggerPanel(x: number, top: number, w: number, h: number) {
    panel(x, top, w, h);
    heading(t('ins.tags'), x + 4, top + 6);
    const tags = stats.tags.slice(0, 7);
    const max = Math.max(1, ...tags.map((tag) => tag.count));
    if (!tags.length) text(t('pdf.noTags'), x + 4, top + 13, 7.5, MUTED);
    tags.forEach((tag, i) => {
      const ty = top + 12 + i * 7.2;
      text(tagLabel(tag.tag), x + 4, ty + 2, 7.5, INK);
      text(String(tag.count), x + w - 4, ty + 2, 7.5, MUTED, false, 'right');
      doc.setFillColor(...EMPTY);
      doc.roundedRect(x + 4, ty + 3.4, w - 8, 1.6, 0.8, 0.8, 'F');
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(x + 4, ty + 3.4, Math.max(1.6, ((w - 8) * tag.count) / max), 1.6, 0.8, 0.8, 'F');
    });
  }
}
