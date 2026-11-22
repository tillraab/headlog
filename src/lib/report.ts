import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { GState, jsPDF } from 'jspdf';
import { autoTable, type CellHookData } from 'jspdf-autotable';
import {
  average,
  compareDays,
  dayFactors,
  durationBuckets,
  firstEntryDay,
  headacheDays,
  intakeDays,
  medicationEffect,
  medicationLimits,
  monthlyCategoryDays,
  monthlyCounts,
  overuseRows,
  periodStats,
  rollingDays,
  ruleStatus,
  severityDays,
  TEN_TWENTY_LIMIT,
  tenTwenty,
  type Comparison,
  type ComparisonKey,
  type DayFactors,
  type MedicationEffect,
  type PeriodStats,
  type RuleStatus,
  type TenTwenty
} from './analysis';
import type { Drink, Episode, Intake, Medication, Night, Relief, WeatherDay } from './db';
import { formatComparison } from './format';
import { dayKey, dayRange, formatDuration, formatLiters, hm, HOUR, keyToDate } from './days';
import { fmt, num, reliefLabels, t, weekdayShort } from './i18n.svelte';
import { PRESSURE_DROP_HPA } from './weather';

type Rgb = [number, number, number];

/** The light theme tokens of app.css. */
const FG: Rgb = [26, 26, 25];
const MUTED: Rgb = [105, 105, 103];
const LINE: Rgb = [225, 225, 223];
const SURFACE_2: Rgb = [235, 235, 234];
const PANEL: Rgb = [245, 245, 244];
const WHITE: Rgb = [255, 255, 255];
const PRIMARY: Rgb = [91, 75, 214];
const PAIN: Rgb = [226, 70, 107];
const MED: Rgb = [230, 149, 18];
const OK: Rgb = [18, 135, 90];
const CAUTION: Rgb = [168, 106, 0];
const OVER: Rgb = [201, 47, 47];

/** Headache days as mild (1–3), moderate (4–7) and severe (8–10): light to dark, so they stay apart in black and white. */
const SEVERITY: Rgb[] = [[245, 170, 188], PAIN, [146, 22, 54]];
const STATUS_COLOR: Record<RuleStatus, Rgb> = { ok: OK, caution: CAUTION, over: OVER };
/** Medication-day bars: in the medication colour while within the limit. */
const RULE_COLOR: Record<RuleStatus, Rgb> = { ok: MED, caution: CAUTION, over: OVER };
/** Relief ratings, indexed by `Relief`, then the unrated intakes. */
const RELIEF_COLOR: Rgb[] = [OVER, CAUTION, OK, SURFACE_2];

/** Type sizes in pt. */
const SIZE = { hero: 24, page: 16, section: 10.5, body: 8.5, small: 7.5, axis: 7 };

/** The chronic-headache frequency of ICHD-3 1.3 and 2.3: headache on 15 or more days a month. */
const CHRONIC_DAYS = 15;

/** Intensity 1 to 10 as mild, moderate or severe: 0, 1 or 2. */
function severity(intensity: number): number {
  return intensity >= 8 ? 2 : intensity >= 4 ? 1 : 0;
}

export interface ReportInput {
  episodes: Episode[];
  intakes: Intake[];
  drinks: Drink[];
  medications: Medication[];
  sleep: Map<string, Night>;
  weather: Map<string, WeatherDay>;
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
        ? t('pdf.f.sleepFragmented', { d: formatDuration(f.sleep * HOUR), pct: Math.floor(f.sleepEfficiency * 100) })
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

/** One calendar month of the period. */
export interface MonthRow {
  month: Date;
  headache: number;
  med: number;
  /** Headache days as mild, moderate and severe. */
  severity: [number, number, number];
  /** Mean intensity of the headaches that started in the month, or null without any. */
  intensity: number | null;
  /** Whether the month is over by `now`. */
  complete: boolean;
  /** Whether the diary was in use in the month: it ends on or after the first entry. */
  logged: boolean;
}

/** A day limit as the Meds tab shows it: the 10/20 rule, an ICHD-3 class limit or a personal limit. */
export interface LimitRow {
  kind: 'rule' | 'class' | 'personal';
  title: string;
  count: number;
  limit: number;
  status: RuleStatus;
  /** Months of the period in which the limit was reached; null for a personal limit, whose window can differ from a month. */
  monthsAtLimit: number | null;
}

/** The rates of the period of the same length before the report's period. */
export interface PreviousPeriod {
  from: Date;
  to: Date;
  /** Headache and acute medication days per 30 days. */
  headache: number;
  med: number;
  intensity: number | null;
}

export interface ReportData {
  /** First day of the period: the start of the first month. */
  from: Date;
  /** Days in the period, today included. */
  span: number;
  /** Days of the period from the first diary entry on; the rates per month count these. */
  covered: number;
  stats: PeriodStats;
  /** The 10/20 rule as it stands at `now`. */
  rule: TenTwenty;
  /** Peak intensity per headache day, and the days with acute medication, over all data. */
  headacheDays: Map<string, number>;
  medDays: Set<string>;
  monthly: MonthRow[];
  /** The period before, or null when the diary does not reach back into it. */
  previous: PreviousPeriod | null;
  /** The 10/20 rule, each ICHD-3 class used in the last 30 days and each personal limit. */
  limits: LimitRow[];
  /** Headache days and acute medication days in the 30 days up to each day of the period. */
  rollingHeadache: { key: string; count: number }[];
  rollingMed: { key: string; count: number }[];
  /** Headaches of the period by duration: under 4 h, 4 to 24 h, 24 to 72 h, over 72 h. */
  durations: number[];
  /** Medication used in the period, grouped by name and dose, with its list entry for the personal limit. */
  medications: (MedicationEffect & { med?: Medication })[];
  triggers: TriggerRow[];
  /** Headaches that started in the period. */
  episodes: number;
  entries: EntryRow[];
}

/** The trigger rows in the order the report lists them; the comparison and the day factor share their key. */
const TRIGGERS: (ComparisonKey & keyof DayFactors)[] = ['pressure', 'hydration', 'sleep', 'alcohol', 'caffeine'];

/**
 * Headache days and acute medication days per 30 days and the mean intensity from `from` to `to`,
 * counted from the first diary entry when that is later. Null when the diary starts after `to`.
 */
function previousPeriod(input: ReportInput, from: Date, to: number): PreviousPeriod | null {
  const first = firstEntryDay(input);
  if (first === null || first > dayKey(to)) return null;
  const start = first > dayKey(from) ? keyToDate(first) : from;
  const span = dayRange(start, to).length;
  const stats = periodStats(input, to, span);
  return { from, to: new Date(to), headache: (stats.headacheDays / span) * 30, med: (stats.medDays / span) * 30, intensity: stats.avgIntensity };
}

/** Everything the doctor report shows, without the drawing. Covers the `months` calendar months up to `now`. */
export function reportData(input: ReportInput, now: number, months: number): ReportData {
  const from = startOfMonth(addMonths(now, -(months - 1)));
  const fromMs = from.getTime();
  const span = dayRange(from, now).length;
  const intakes = input.intakes.filter((i) => i.time >= fromMs && i.time <= now);
  const medDays = new Set(intakeDays(input.intakes).keys());
  const hDays = headacheDays(input.episodes, now);
  const episodes = input.episodes.filter((e) => e.start >= fromMs && e.start <= now).sort((a, b) => a.start - b.start);
  const factorsOn = (time: number) => dayFactors(input, dayKey(time), input.waterGoalMl);
  const factors = new Map(episodes.map((e) => [e.id, factorsOn(e.start)]));
  const comparisons = new Map(compareDays(input, dayRange(from, now), now).map((c) => [c.key, c]));
  const { matched, unmatched } = matchIntakes(episodes, intakes, now);
  const first = firstEntryDay(input);

  const monthly = monthlyCounts(input, now, months).map((m) => {
    const end = endOfMonth(m.month);
    const started = episodes.filter((e) => e.start >= m.month.getTime() && e.start <= end.getTime());
    return {
      ...m,
      severity: severityDays(hDays, dayRange(m.month, Math.min(end.getTime(), now))),
      intensity: average(started.map((e) => e.intensity)),
      complete: dayKey(end) <= dayKey(now),
      logged: first !== null && dayKey(end) >= first
    };
  });
  const categoryMonths = monthlyCategoryDays(input.intakes, now, months);
  const rule = tenTwenty(medDays, now);
  const limits: LimitRow[] = [
    { kind: 'rule', title: t('tenTwenty.title'), count: rule.count, limit: rule.limit, status: rule.status, monthsAtLimit: monthly.filter((m) => m.med >= TEN_TWENTY_LIMIT).length },
    ...overuseRows(input.intakes, now).map((row) => ({
      kind: 'class' as const,
      title: t(`cat.${row.key}`),
      count: row.days,
      limit: row.limit,
      status: row.status,
      monthsAtLimit: categoryMonths.filter((m) => (m.days.get(row.key) ?? 0) >= row.limit).length
    })),
    ...medicationLimits(input.intakes, input.medications, now).map(({ med, rule: r }) => ({
      kind: 'personal' as const,
      title: `${med.name} ${med.dose}`.trim(),
      count: r.count,
      limit: r.limit,
      status: r.status,
      monthsAtLimit: null
    }))
  ];

  return {
    from,
    span,
    covered: first !== null && first > dayKey(from) ? dayRange(keyToDate(first), now).length : span,
    stats: periodStats(input, now, span),
    rule,
    headacheDays: hDays,
    medDays,
    monthly,
    previous: previousPeriod(input, startOfMonth(addMonths(from, -months)), fromMs - 1),
    limits,
    rollingHeadache: rollingDays(new Set(hDays.keys()), now, span),
    rollingMed: rollingDays(medDays, now, span),
    durations: durationBuckets(episodes),
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

/** A point worth discussing, with the status its dot shows; `info` is a pattern rather than a limit. */
export interface Finding {
  status: RuleStatus | 'info';
  text: string;
}

/** Factors whose value is a share of days, where more before headache days is the pattern; for the others less is. */
const SHARE_FACTORS: ComparisonKey[] = ['pressure', 'alcohol'];

/** How much worse a factor was before headache days than before other days, as a ratio; 1 is no difference. */
function factorStrength({ key, headache, clear }: Comparison): number {
  if (SHARE_FACTORS.includes(key)) return headache - clear >= 0.1 ? headache / Math.max(clear, 0.05) : 1;
  return clear > 0 && (clear - headache) / clear >= 0.1 ? clear / Math.max(headache, 0.01) : 1;
}

/**
 * Up to four points for the doctor, most important first: headache frequency against the chronic
 * criterion or its trend over the complete months, limits reached or close, a medication that rarely
 * helps, and the factor that differs most between headache days and other days.
 */
export function findings(report: ReportData): Finding[] {
  const result: Finding[] = [];
  const month = (m: MonthRow) => fmt(m.month, 'MMMM');

  const chronic = report.monthly.filter((m) => m.headache >= CHRONIC_DAYS).length;
  if (chronic) result.push({ status: 'over', text: t('pdf.find.chronic', { n: chronic, m: report.monthly.filter((m) => m.logged).length }) });
  const complete = report.monthly.filter((m) => m.complete && m.logged);
  if (complete.length >= 2) {
    const first = complete[0];
    const last = complete[complete.length - 1];
    const params = { a: first.headache, from: month(first), b: last.headache, to: month(last) };
    if (last.headache - first.headache >= 3 && last.headache >= first.headache * 1.3) result.push({ status: 'caution', text: t('pdf.find.rising', params) });
    else if (first.headache - last.headache >= 3 && first.headache >= last.headache * 1.3) result.push({ status: 'ok', text: t('pdf.find.falling', params) });
    else if (!chronic) {
      const counts = complete.map((m) => m.headache);
      result.push({ status: 'ok', text: t('pdf.find.stable', { min: Math.min(...counts), max: Math.max(...counts) }) });
    }
  }

  const reached = report.limits.filter((l) => l.status !== 'ok').sort((a, b) => Number(b.status === 'over') - Number(a.status === 'over'));
  for (const l of reached.slice(0, 2)) {
    const key = l.status === 'over' ? 'pdf.find.limitOver' : 'pdf.find.limitCaution';
    result.push({ status: l.status, text: t(key, { name: l.title, count: l.count, limit: l.limit }) });
  }
  if (!reached.length) result.push({ status: 'ok', text: t('pdf.find.limitsOk', { count: report.rule.count, limit: report.rule.limit }) });

  const helped = (m: MedicationEffect) => m.relief[2] / m.rated;
  const weak = report.medications.filter((m) => m.category !== 'preventive' && m.rated >= 3 && helped(m) < 0.34).sort((a, b) => helped(a) - helped(b))[0];
  if (weak) result.push({ status: 'caution', text: t('pdf.find.weakRelief', { name: `${weak.name} ${weak.dose}`.trim(), well: weak.relief[2], rated: weak.rated }) });

  const strongest = report.triggers
    .map((r) => r.comparison)
    .filter((c): c is Comparison => c !== undefined && factorStrength(c) > 1)
    .sort((a, b) => factorStrength(b) - factorStrength(a))[0];
  if (strongest)
    result.push({
      status: 'info',
      text: t('pdf.find.factor', { factor: t(`pdf.short.${strongest.key}`), a: formatComparison(strongest.key, strongest.headache), b: formatComparison(strongest.key, strongest.clear) })
    });

  return result.slice(0, 4);
}

/** Columns of the diary table that the cell hooks draw differently. */
const INTENSITY_COLUMN = 3;
const MEDICATION_COLUMN = 4;

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Doctor report in three parts: page 1 answers how often, how much medication and whether it helps;
 * page 2 shows the charts behind it; the pages after it list every headache and intake. Covers the
 * `months` calendar months up to and including the one with `now`.
 */
export function doctorReport(input: ReportInput, now: number, months: number): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const inner = W - 2 * M;
  const contentTop = 34;
  const footerY = H - 13;
  const contentBottom = footerY - 5;

  const report = reportData(input, now, months);
  const { from, stats } = report;
  const points = findings(report);
  const period = `${fmt(from, 'd. MMM yyyy')} – ${fmt(now, 'd. MMM yyyy')}`;

  const font = (size: number, color: Rgb = FG, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const text = (s: string | string[], x: number, y: number, size: number, color: Rgb = FG, bold = false, align: 'left' | 'right' | 'center' = 'left') => {
    font(size, color, bold);
    doc.text(s, x, y, { align });
  };
  const width = (s: string, size: number, bold = false) => {
    font(size, FG, bold);
    return doc.getTextWidth(s);
  };
  /** `s` wrapped to `w` at `size`. */
  const wrap = (s: string, w: number, size: number) => {
    font(size);
    return doc.splitTextToSize(s, w) as string[];
  };
  const lineHeight = (size: number) => size * 0.42;
  const fill = (color: Rgb) => doc.setFillColor(...color);
  const panel = (x: number, y: number, w: number, h: number) => {
    fill(PANEL);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F');
  };
  const dashed = (x1: number, y1: number, x2: number, y2: number, color: Rgb) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.2, 0.9], 0);
    doc.line(x1, y1, x2, y2);
    doc.setLineDashPattern([], 0);
  };
  const opacity = (value: number) => doc.setGState(new GState({ opacity: value, 'stroke-opacity': value }));
  /** A section title with an optional hint below it. Returns where the content starts. */
  const section = (title: string, x: number, y: number, w: number, hint?: string) => {
    text(title, x, y, SIZE.section, FG, true);
    if (!hint) return y + 4;
    const lines = wrap(hint, w, SIZE.small);
    text(lines, x, y + 4.5, SIZE.small, MUTED);
    return y + 4.5 + lines.length * lineHeight(SIZE.small) + 1.5;
  };
  /** Small squares with labels in a row from `x`. */
  const legend = (items: [Rgb, string][], x: number, y: number) => {
    for (const [color, label] of items) {
      fill(color);
      doc.roundedRect(x, y - 2.3, 2.6, 2.6, 0.5, 0.5, 'F');
      text(label, x + 3.6, y, SIZE.small, MUTED);
      x += 3.6 + width(label, SIZE.small) + 4;
    }
  };
  const legendWidth = (labels: string[]) => labels.reduce((sum, label) => sum + 7.6 + width(label, SIZE.small), -4);
  const pageTitle = (title: string) => text(title, M, 28, SIZE.page, FG, true);

  glancePage();
  doc.addPage();
  detailsPage();
  doc.addPage();
  diaryPages();

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    runningHeader();
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, footerY, W - M, footerY);
    text(`HeadLog ${input.version} · ${t('tenTwenty.disclaimer')}`, M, footerY + 4.5, SIZE.axis, MUTED);
    text(t('pdf.page', { n: page, total: pages }), W - M, footerY + 4.5, SIZE.axis, MUTED, false, 'right');
  }

  return new Uint8Array(doc.output('arraybuffer'));

  /** Logo, title and name on the left, period and creation date on the right, over a line in the primary colour. */
  function runningHeader() {
    let x = M;
    if (input.logo) {
      doc.addImage(input.logo, 'PNG', M, 8.6, 6.5, 6.5);
      x += 8.5;
    }
    text(t('pdf.title'), x, 13, 10, FG, true);
    if (input.name) text(input.name, x + width(t('pdf.title'), 10, true) + 3, 13, 10, MUTED);
    text(period, W - M, 13, 8.5, FG, false, 'right');
    text(t('pdf.created', { date: fmt(now, 'd. MMM yyyy') }), W - M, 16.6, SIZE.axis, MUTED, false, 'right');
    fill(PRIMARY);
    doc.rect(M, 18.8, inner, 0.6, 'F');
  }

  /** Page 1: three numbers with their trend, the limits, how well each medication helps and what is worth discussing. */
  function glancePage() {
    pageTitle(t('pdf.pageGlance'));
    const parts: [number, (y: number) => void][] = [
      [48, heroes],
      [discussHeight(), discuss],
      [56, limits],
      [reliefHeight(), relief]
    ];
    const total = parts.reduce((sum, [h]) => sum + h, 0);
    const gap = Math.min(14, (contentBottom - contentTop - total) / (parts.length - 1));
    let y = contentTop;
    for (const [h, draw] of parts) {
      draw(y);
      y += h + gap;
    }
  }

  /** Headache days and acute medication days per month and the mean intensity, each with its trend and its months. */
  function heroes(top: number) {
    const gap = 4;
    const w = (inner - 2 * gap) / 3;
    const perMonth = (n: number) => (n / report.covered) * 30;
    const logged = <T>(value: (m: MonthRow) => T) => report.monthly.map((m) => (m.logged ? value(m) : null));
    const prev = report.previous;
    const cards = [
      { label: t('pdf.heroHeadache'), value: perMonth(stats.headacheDays), previous: prev?.headache, color: PAIN, months: logged((m) => m.headache), digits: 0 },
      { label: t('pdf.heroMed'), value: perMonth(stats.medDays), previous: prev?.med, color: MED, months: logged((m) => m.med), digits: 0 },
      {
        label: t('pdf.heroIntensity'),
        value: stats.avgIntensity,
        previous: prev?.intensity ?? undefined,
        color: FG,
        unit: t('pdf.ofTen'),
        months: logged((m) => m.intensity),
        digits: 1
      }
    ];
    cards.forEach((card, i) => {
      const x = M + i * (w + gap);
      panel(x, top, w, 48);
      text(card.label, x + 4, top + 6.5, SIZE.body, MUTED);
      const value = card.value === null ? '–' : num(card.value, 1);
      text(value, x + 4, top + 17.5, SIZE.hero, card.color, true);
      if (card.unit) text(card.unit, x + 5.5 + width(value, SIZE.hero, true), top + 17.5, SIZE.body, MUTED);
      trend(x + 4, top + 24, w - 8, card.value, card.previous);
      sparkline({ left: x + 4, right: x + w - 4, top: top + 30, bottom: top + 41.5 }, card.months, card.color, card.digits);
    });
  }

  /** A triangle up or down with the change against the previous period, or why there is none. */
  function trend(x: number, y: number, w: number, value: number | null, previous: number | undefined) {
    const prev = report.previous;
    if (!prev || previous === undefined || value === null) {
      text(wrap(t('pdf.noPrevious'), w, SIZE.small)[0], x, y, SIZE.small, MUTED);
      return;
    }
    const delta = value - previous;
    const flat = Math.abs(delta) < 0.05;
    fill(flat ? MUTED : delta > 0 ? OVER : OK);
    if (flat) doc.rect(x, y - 1.6, 2.8, 0.8, 'F');
    else if (delta > 0) doc.triangle(x, y - 0.2, x + 2.8, y - 0.2, x + 1.4, y - 2.6, 'F');
    else doc.triangle(x, y - 2.6, x + 2.8, y - 2.6, x + 1.4, y - 0.2, 'F');
    const sign = flat ? '±' : delta > 0 ? '+' : '–';
    const span = months === 1 ? fmt(prev.from, 'MMM yyyy') : `${fmt(prev.from, 'MMM')} – ${fmt(prev.to, 'MMM yyyy')}`;
    text(t('pdf.vsPrevious', { delta: `${sign}${num(Math.abs(delta), 1)}`, period: span }), x + 4.2, y, SIZE.small, MUTED);
  }

  /** One small bar per month with its value above and the month below. */
  function sparkline(box: Box, values: (number | null)[], color: Rgb, digits: number) {
    const slot = (box.right - box.left) / values.length;
    const bw = Math.min(7, slot * 0.6);
    const max = Math.max(1, ...values.map((v) => v ?? 0));
    values.forEach((v, i) => {
      const cx = box.left + slot * (i + 0.5);
      text(fmt(addMonths(from, i), values.length > 6 ? 'MMMMM' : 'MMM'), cx, box.bottom + 3.4, SIZE.axis, MUTED, false, 'center');
      fill(LINE);
      doc.rect(cx - bw / 2, box.bottom - 0.3, bw, 0.3, 'F');
      if (v === null) return;
      const bh = Math.max(0.3, ((box.bottom - box.top - 3) * v) / max);
      fill(color);
      doc.rect(cx - bw / 2, box.bottom - bh, bw, bh, 'F');
      const label = num(v, digits);
      if (width(label, SIZE.axis) < slot - 1.2) text(label, cx, box.bottom - bh - 0.9, SIZE.axis, FG, false, 'center');
    });
  }

  /** One ring per limit, like the Meds tab: the 10/20 rule, the ICHD-3 classes used and the personal limits. */
  function limits(top: number) {
    const y = section(t('pdf.limits'), M, top + 3, inner, t('pdf.limitsHint'));
    const rows = report.limits.slice(0, 6);
    const loggedMonths = report.monthly.filter((m) => m.logged).length;
    const gap = 4;
    const w = Math.min(44, (inner - gap * (rows.length - 1)) / rows.length);
    rows.forEach((row, i) => {
      const x = M + i * (w + gap);
      panel(x, y, w, 44);
      ring(x + w / 2, y + 14.5, 9.5, row);
      text(wrap(row.title, w - 4, SIZE.body)[0], x + w / 2, y + 30.5, SIZE.body, FG, true, 'center');
      const source = row.kind === 'rule' ? t('pdf.ruleSource') : row.kind === 'class' ? t('pdf.classLimit') : t('pdf.personalLimit');
      text(source, x + w / 2, y + 34.6, SIZE.axis, MUTED, false, 'center');
      if (row.monthsAtLimit !== null) {
        const note = wrap(t('pdf.monthsAtLimit', { n: row.monthsAtLimit, m: loggedMonths }), w - 4, SIZE.axis);
        text(note, x + w / 2, y + 38.2, SIZE.axis, row.monthsAtLimit ? OVER : MUTED, false, 'center');
      }
    });
  }

  /** A three-quarter ring with the count against the limit in its centre and the part past the limit shaded. */
  function ring(cx: number, cy: number, r: number, row: LimitRow) {
    const start = 135;
    const sweep = 270;
    doc.setLineWidth(2.4);
    doc.setLineCap('round');
    arc(cx, cy, r, start, start + sweep, LINE);
    doc.setLineCap('butt');
    opacity(0.3);
    arc(cx, cy, r, start + sweep / 1.25, start + sweep, OVER);
    opacity(1);
    doc.setLineCap('round');
    if (row.count) arc(cx, cy, r, start, start + sweep * Math.min(1, row.count / (row.limit * 1.25)), STATUS_COLOR[row.status]);
    doc.setLineCap('butt');
    doc.setLineWidth(0.2);
    const count = String(row.count);
    const limit = `/${row.limit}`;
    const left = cx - (width(count, 15, true) + width(limit, SIZE.body)) / 2;
    text(count, left, cy + 2.2, 15, STATUS_COLOR[row.status], true);
    text(limit, left + width(count, 15, true), cy + 2.2, SIZE.body, MUTED);
  }

  /** A circular arc from angle `a0` to `a1` in degrees, clockwise from three o'clock, as bezier curves. */
  function arc(cx: number, cy: number, r: number, a0: number, a1: number, color: Rgb) {
    const rad = Math.PI / 180;
    const parts = Math.ceil((a1 - a0) / 90);
    const step = ((a1 - a0) / parts) * rad;
    const k = (4 / 3) * Math.tan(step / 4) * r;
    const segments: number[][] = [];
    for (let i = 0, a = a0 * rad; i < parts; i++, a += step) {
      const b = a + step;
      const dx = r * (Math.cos(b) - Math.cos(a));
      const dy = r * (Math.sin(b) - Math.sin(a));
      segments.push([-k * Math.sin(a), k * Math.cos(a), dx + k * Math.sin(b), dy - k * Math.cos(b), dx, dy]);
    }
    doc.setDrawColor(...color);
    doc.lines(segments, cx + r * Math.cos(a0 * rad), cy + r * Math.sin(a0 * rad), [1, 1], 'S', false);
  }

  /** Medication rated for relief: everything but preventive medication, at most seven. */
  function acuteMedications() {
    return report.medications.filter((m) => m.category !== 'preventive').slice(0, 7);
  }

  function reliefHeight() {
    return 12 + Math.max(1, acuteMedications().length) * 9.5 + 8;
  }

  /** Per medication and dose a bar of its intakes split by rated effect, then the preventive medication as chips. */
  function relief(top: number) {
    const y = section(t('pdf.helps'), M, top + 3, inner, t('pdf.helpsHint'));
    const labels = [t('pdf.reliefNone'), t('pdf.reliefSome'), t('pdf.reliefWell'), t('pdf.reliefUnrated')];
    /** Helped first, then a bit, not, and unrated last. */
    const order = [2, 1, 0, 3];
    legend(
      order.map((i) => [RELIEF_COLOR[i], labels[i]]),
      W - M - legendWidth(order.map((i) => labels[i])),
      top + 3
    );
    const rows = acuteMedications();
    if (!rows.length) text(t('pdf.none'), M, y + 4, SIZE.body, MUTED);
    const nameW = 54;
    const barL = M + nameW;
    const barW = inner - nameW - 40;
    rows.forEach((m, i) => {
      const ry = y + i * 9.5;
      text(`${m.name} ${m.dose}`.trim(), M, ry + 3.4, SIZE.body, FG, true);
      text(t(`cat.${m.category}`), M, ry + 7, SIZE.axis, MUTED);
      const counts = [m.relief[2], m.relief[1], m.relief[0], m.intakes - m.rated];
      let x = barL;
      counts.forEach((n, j) => {
        if (!n) return;
        const sw = (barW * n) / m.intakes;
        fill(RELIEF_COLOR[order[j]]);
        doc.rect(x, ry + 1, sw, 5, 'F');
        if (sw >= 4) text(String(n), x + sw / 2, ry + 4.6, SIZE.small, order[j] === 3 ? FG : WHITE, true, 'center');
        x += sw;
      });
      text(t('pdf.intakesOnDays', { n: m.intakes, d: m.days }), W - M, ry + 4.6, SIZE.small, MUTED, false, 'right');
    });

    const chipY = y + Math.max(1, rows.length) * 9.5 + 1.5;
    const label = `${t('pdf.preventive')}:`;
    text(label, M, chipY + 3, SIZE.small, MUTED, true);
    const preventive = report.medications.filter((m) => m.category === 'preventive');
    let x = M + width(label, SIZE.small, true) + 3;
    if (!preventive.length) text(t('pdf.noPreventive'), x, chipY + 3, SIZE.small, MUTED);
    for (const m of preventive) {
      const chip = `${m.name} ${m.dose} · ${t('pdf.intakesOnDays', { n: m.intakes, d: m.days })}`;
      const cw = width(chip, SIZE.small) + 5;
      if (x + cw > W - M) break;
      fill(SURFACE_2);
      doc.roundedRect(x, chipY - 0.4, cw, 4.8, 2.4, 2.4, 'F');
      text(chip, x + 2.5, chipY + 3, SIZE.small, FG);
      x += cw + 2;
    }
  }

  /** The findings wrapped to the panel, with the height each takes. */
  function findingLines() {
    return points.map((f) => {
      const lines = wrap(f.text, inner - 16, SIZE.body);
      return { ...f, lines, height: lines.length * lineHeight(SIZE.body) * 1.15 + 2.8 };
    });
  }

  function discussHeight() {
    return 14 + findingLines().reduce((sum, f) => sum + f.height, 0);
  }

  /** The points worth discussing in a panel, each with a dot in its status colour. */
  function discuss(top: number) {
    panel(M, top, inner, discussHeight());
    text(t('pdf.discuss'), M + 5, top + 8, SIZE.section, FG, true);
    let y = top + 15;
    for (const f of findingLines()) {
      fill(f.status === 'info' ? PRIMARY : STATUS_COLOR[f.status]);
      doc.circle(M + 7, y - 1.1, 1.2, 'F');
      font(SIZE.body);
      doc.text(f.lines, M + 11, y, { lineHeightFactor: 1.15 });
      y += f.height;
    }
  }

  /** Page 2: days per month, the 30-day counts, the attack profile and the possible triggers. */
  function detailsPage() {
    pageTitle(t('pdf.pageDetails'));
    const gap = 8;
    const leftW = 62;
    monthlyChart(M, contentTop + 3, leftW, 78);
    rollingChart(M + leftW + gap, contentTop + 3, inner - leftW - gap, 78);
    profile(contentTop + 92);
    triggers(contentTop + 152);
  }

  /** Stacked headache days by severity next to acute medication days per month, against the chronic line at 15. */
  function monthlyChart(x: number, top: number, w: number, h: number) {
    text(t('pdf.monthly'), x, top, SIZE.section, FG, true);
    const items: [Rgb, string][] = [
      [SEVERITY[0], t('pdf.legendMild')],
      [SEVERITY[1], t('pdf.legendModerate')],
      [SEVERITY[2], t('pdf.legendSevere')],
      [MED, t('pdf.legendMed')]
    ];
    items.forEach((item, i) => legend([item], x + (i % 2) * (w / 2), top + 5.5 + Math.floor(i / 2) * 4));
    const box = { top: top + 17, bottom: top + h - 5, left: x + 6, right: x + w };
    const max = Math.max(CHRONIC_DAYS + 5, ...report.monthly.map((m) => Math.max(m.headache, m.med)));
    axis(box, max);
    const slot = (box.right - box.left) / report.monthly.length;
    const bw = Math.min(7, slot * 0.34);
    const scale = (v: number) => ((box.bottom - box.top) * v) / max;
    const ly = box.bottom - scale(CHRONIC_DAYS);
    dashed(box.left, ly, box.right, ly, OVER);
    text(t('pdf.chronicLine'), box.right, ly - 1.2, SIZE.axis, OVER, false, 'right');
    report.monthly.forEach((m, i) => {
      const cx = box.left + slot * (i + 0.5);
      let y = box.bottom;
      m.severity.forEach((n, s) => {
        if (!n) return;
        fill(SEVERITY[s]);
        doc.rect(cx - bw - 0.4, y - scale(n), bw, scale(n), 'F');
        y -= scale(n);
      });
      if (m.headache) text(String(m.headache), cx - bw / 2 - 0.4, y - 1, SIZE.axis, FG, true, 'center');
      if (m.med) {
        fill(MED);
        doc.rect(cx + 0.4, box.bottom - scale(m.med), bw, scale(m.med), 'F');
        text(String(m.med), cx + bw / 2 + 0.4, box.bottom - scale(m.med) - 1, SIZE.axis, FG, false, 'center');
      }
      text(fmt(m.month, report.monthly.length > 6 ? 'MMMMM' : 'MMM'), cx, box.bottom + 3.6, SIZE.axis, MUTED, false, 'center');
    });
  }

  /** Grid lines with their values on the left. */
  function axis(box: Box, max: number) {
    const step = max > 20 ? 10 : 5;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    for (let v = 0; v <= max; v += step) {
      const gy = box.bottom - ((box.bottom - box.top) * v) / max;
      doc.line(box.left, gy, box.right, gy);
      text(String(v), box.left - 1.5, gy + 1, SIZE.axis, MUTED, false, 'right');
    }
    doc.setLineWidth(0.2);
  }

  /** Headache days in 30 as a band over acute medication days in 30 as bars, on one time axis. */
  function rollingChart(x: number, top: number, w: number, h: number) {
    text(t('pdf.rolling'), x, top, SIZE.section, FG, true);
    const left = x + 6;
    const right = x + w;
    const step = (right - left) / report.rollingHeadache.length;
    const plotH = (h - 30) / 2;

    const pain = { top: top + 12, bottom: top + 12 + plotH, left, right };
    const painMax = Math.max(CHRONIC_DAYS + 5, ...report.rollingHeadache.map((r) => r.count));
    plotLabel(t('pdf.rollingHeadache'), pain, report.rollingHeadache, PAIN);
    axis(pain, painMax);
    const py = (v: number) => pain.bottom - ((pain.bottom - pain.top) * v) / painMax;
    const steps: [number, number][] = report.rollingHeadache.flatMap((r, i) => [
      [left + i * step, py(r.count)],
      [left + (i + 1) * step, py(r.count)]
    ]);
    opacity(0.2);
    fill(PAIN);
    polyline([[left, pain.bottom], ...steps, [right, pain.bottom]], 'F');
    opacity(1);
    doc.setDrawColor(...PAIN);
    doc.setLineWidth(0.5);
    polyline(steps, 'S');
    dashed(left, py(CHRONIC_DAYS), right, py(CHRONIC_DAYS), OVER);
    text(t('pdf.chronicLine'), right, py(CHRONIC_DAYS) - 1.2, SIZE.axis, OVER, false, 'right');

    const med = { top: pain.bottom + 12, bottom: pain.bottom + 12 + plotH, left, right };
    const medMax = Math.max(TEN_TWENTY_LIMIT + 5, ...report.rollingMed.map((r) => r.count));
    plotLabel(t('pdf.rollingMed'), med, report.rollingMed, MED);
    axis(med, medMax);
    report.rollingMed.forEach((r, i) => {
      if (!r.count) return;
      const bh = ((med.bottom - med.top) * r.count) / medMax;
      fill(RULE_COLOR[ruleStatus(r.count, TEN_TWENTY_LIMIT - 1)]);
      doc.rect(left + i * step + step * 0.1, med.bottom - bh, Math.max(0.15, step * 0.8), bh, 'F');
    });
    const ly = med.bottom - ((med.bottom - med.top) * TEN_TWENTY_LIMIT) / medMax;
    dashed(left, ly, right, ly, OVER);
    text(t('pdf.limitLine'), right, ly - 1.2, SIZE.axis, OVER, false, 'right');

    for (let i = 0; i < months; i++) {
      const index = report.rollingMed.findIndex((r) => r.key === dayKey(addMonths(from, i)));
      if (index < 0) continue;
      const mx = left + index * step;
      doc.setDrawColor(...MUTED);
      doc.setLineWidth(0.2);
      doc.line(mx, med.bottom, mx, med.bottom + 1.5);
      text(fmt(addMonths(from, i), months > 6 ? 'MMM' : 'd. MMM'), mx + 0.8, med.bottom + 4.2, SIZE.axis, MUTED);
    }
  }

  /** The name of a 30-day plot on the left and today's count on the right, above it. */
  function plotLabel(label: string, box: Box, values: { count: number }[], color: Rgb) {
    fill(color);
    doc.roundedRect(box.left, box.top - 5.6, 2.6, 2.6, 0.5, 0.5, 'F');
    text(label, box.left + 3.6, box.top - 3.3, SIZE.small, FG, true);
    text(t('pdf.today', { n: values[values.length - 1]?.count ?? 0 }), box.right, box.top - 3.3, SIZE.small, MUTED, false, 'right');
  }

  /** A path through `points` in page coordinates, filled and closed with 'F', stroked with 'S'. */
  function polyline(path: [number, number][], style: 'F' | 'S') {
    const segments = path.slice(1).map(([px, py], i) => [px - path[i][0], py - path[i][1]]);
    doc.lines(segments, path[0][0], path[0][1], [1, 1], style, style === 'F');
  }

  /** Three small bar charts: duration, time of day and weekday of onset. */
  function profile(top: number) {
    const y = section(t('pdf.profile'), M, top, inner, t('pdf.profileHint', { n: report.episodes }));
    const gap = 4;
    const w = (inner - 2 * gap) / 3;
    const charts: [string, number[], string[]][] = [
      [t('pdf.duration'), report.durations, ['< 4 h', '4–24 h', '24–72 h', '> 72 h']],
      [t('pdf.onset'), stats.timeOfDay, stats.timeOfDay.map((_, i) => `${i * 3}`)],
      [t('pdf.onsetWeekday'), stats.weekday, weekdayShort()]
    ];
    charts.forEach(([title, values, labels], i) => {
      const x = M + i * (w + gap);
      panel(x, y, w, 40);
      text(title, x + 4, y + 6, SIZE.small, FG, true);
      columns({ left: x + 4, right: x + w - 4, top: y + 12, bottom: y + 34 }, values, labels);
    });
  }

  /** Vertical bars with their values above and labels below. */
  function columns(box: Box, values: number[], labels: string[]) {
    const max = Math.max(1, ...values);
    const slot = (box.right - box.left) / values.length;
    const bw = Math.min(8, slot * 0.62);
    values.forEach((v, i) => {
      const cx = box.left + slot * (i + 0.5);
      fill(LINE);
      doc.rect(cx - bw / 2, box.bottom - 0.3, bw, 0.3, 'F');
      if (v) {
        const bh = ((box.bottom - box.top) * v) / max;
        fill(PAIN);
        doc.rect(cx - bw / 2, box.bottom - bh, bw, bh, 'F');
        text(String(v), cx, box.bottom - bh - 1, SIZE.axis, FG, false, 'center');
      }
      text(labels[i], cx, box.bottom + 3.6, SIZE.axis, MUTED, false, 'center');
    });
  }

  /** Each factor as a pair of bars, headache-start days against other days, next to the symptom and trigger tags. */
  function triggers(top: number) {
    const tagsW = 56;
    const pairsW = inner - tagsW - 10;
    const y = section(t('pdf.reasons'), M, top, pairsW);
    legend(
      [
        [PAIN, t('pdf.onHeadacheDays')],
        [LINE, t('pdf.onOtherDays')]
      ],
      M,
      y + 1.5
    );
    const rows = report.triggers.filter((r) => r.comparison);
    const valueW = 30;
    rows.forEach(({ key, comparison, withFactor }, i) => {
      const c = comparison!;
      const ry = y + 6 + i * 13;
      text(t(`pdf.factor.${key}`, { n: PRESSURE_DROP_HPA }), M, ry + 2.5, SIZE.body, FG, true);
      if (report.episodes) text(t('pdf.ofHeadaches', { n: withFactor, total: report.episodes }), M + pairsW, ry + 2.5, SIZE.axis, MUTED, false, 'right');
      const max = Math.max(c.headache, c.clear, 0.0001);
      const bars: [number, number, Rgb][] = [
        [c.headache, c.nHeadache, PAIN],
        [c.clear, c.nClear, LINE]
      ];
      bars.forEach(([value, n, color], j) => {
        const by = ry + 4.3 + j * 3.6;
        fill(color);
        doc.rect(M, by, Math.max(0.4, ((pairsW - valueW) * value) / max), 2.6, 'F');
        text(`${formatComparison(key, value)} · ${t('pdf.daysN', { n })}`, M + pairsW, by + 2.2, SIZE.axis, FG, false, 'right');
      });
    });
    const hintY = y + 6 + Math.max(1, rows.length) * 13 + 2;
    text(wrap(t('pdf.reasonsHint'), inner, SIZE.axis), M, hintY, SIZE.axis, MUTED);
    tags(M + pairsW + 10, top, tagsW);
  }

  /** The most common symptom and trigger tags as bars. */
  function tags(x: number, top: number, w: number) {
    const y = section(t('ins.tags'), x, top, w, t('pdf.tagsHint'));
    const list = stats.tags.slice(0, 8);
    const max = Math.max(1, ...list.map((tag) => tag.count));
    if (!list.length) text(t('pdf.noTags'), x, y + 4, SIZE.body, MUTED);
    list.forEach((tag, i) => {
      const ty = y + 3.5 + i * 7.4;
      text(tag.tag, x, ty, SIZE.body, FG);
      text(String(tag.count), x + w, ty, SIZE.body, MUTED, false, 'right');
      fill(SURFACE_2);
      doc.rect(x, ty + 1.4, w, 1.8, 'F');
      fill(PRIMARY);
      doc.rect(x, ty + 1.4, (w * tag.count) / max, 1.8, 'F');
    });
  }

  /** Pages 3 and on: every headache and every intake without a headache, grouped by month. */
  function diaryPages() {
    pageTitle(t('pdf.pageDiary'));
    const hint = wrap(t('pdf.diaryHint'), inner, SIZE.small);
    text(hint, M, contentTop, SIZE.small, MUTED);
    const firstPage = doc.getNumberOfPages();

    const rows: { cells: string[]; intensity?: number; month?: true }[] = [];
    for (const m of report.monthly) {
      const own = report.entries.filter((e) => e.time >= m.month.getTime() && e.time <= endOfMonth(m.month).getTime());
      if (!own.length) continue;
      rows.push({ cells: [t('pdf.monthRow', { month: fmt(m.month, 'MMMM yyyy'), h: m.headache, m: m.med })], month: true });
      for (const entry of own) rows.push({ cells: entryCells(entry), intensity: entry.episode?.intensity });
    }

    autoTable(doc, {
      startY: contentTop + hint.length * lineHeight(SIZE.small) + 2,
      head: [[t('pdf.date'), t('pdf.time'), t('pdf.duration'), t('pdf.intensity'), t('pdf.medication'), t('pdf.notes')]],
      body: rows.map((r) => (r.month ? [{ content: r.cells[0], colSpan: 6 }] : r.cells)),
      margin: { left: M, right: M, top: contentTop, bottom: H - contentBottom + 2 },
      rowPageBreak: 'avoid',
      theme: 'plain',
      styles: { fontSize: 7.8, cellPadding: { top: 1.5, bottom: 1.5, left: 1.6, right: 1.6 }, textColor: FG, valign: 'top', lineColor: LINE, lineWidth: { bottom: 0.15 } },
      headStyles: { fontSize: SIZE.axis, textColor: MUTED, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: FG },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 21 }, 2: { cellWidth: 15 }, 3: { cellWidth: 12, halign: 'center' }, 4: { cellWidth: 50 } },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const row = rows[data.row.index];
        if (row.month) Object.assign(data.cell.styles, { fontStyle: 'bold', fontSize: SIZE.body, fillColor: PANEL, cellPadding: { top: 2.2, bottom: 2.2, left: 1.6, right: 1.6 } });
        else if (data.column.index === INTENSITY_COLUMN && row.intensity) data.cell.text = [''];
        else if (!row.intensity && data.column.index !== MEDICATION_COLUMN) data.cell.styles.textColor = MUTED;
      },
      didDrawCell: (data: CellHookData) => {
        const intensity = rows[data.row.index]?.intensity;
        if (data.section !== 'body' || data.column.index !== INTENSITY_COLUMN || !intensity) return;
        const s = severity(intensity);
        const cx = data.cell.x + data.cell.width / 2;
        fill(SEVERITY[s]);
        doc.roundedRect(cx - 3.2, data.cell.y + 0.9, 6.4, 4, 1.2, 1.2, 'F');
        text(String(intensity), cx, data.cell.y + 3.9, SIZE.small, s === 0 ? FG : WHITE, true, 'center');
      },
      didDrawPage: () => {
        if (doc.getNumberOfPages() > firstPage) pageTitle(t('pdf.pageDiary'));
      }
    });
  }

  /** The cells of one row of the diary: date, time, duration, intensity, medication, and factors with tags and note. */
  function entryCells(row: EntryRow): string[] {
    const reliefText = (r: Relief | null) => (r === null ? '' : ` (${reliefLabels()[r].toLowerCase()})`);
    const medLine = (i: Intake) => `${hm(i.time)} ${i.name} ${i.dose}`.trim() + reliefText(i.relief);
    const e = row.episode;
    if (!e) return [fmt(row.time, 'EEE d. MMM'), '–', '', '–', medLine(row.intakes[0]), [t('pdf.noHeadache'), ...factorText(row.factors)].join('; ')];
    const notes = [...factorText(row.factors), ...e.tags, e.note ? `“${e.note}”` : ''].filter(Boolean);
    return [
      fmt(e.start, 'EEE d. MMM'),
      `${hm(e.start)}–${e.end ? hm(e.end) : '…'}`,
      formatDuration((e.end ?? now) - e.start),
      String(e.intensity),
      row.intakes.map(medLine).join('\n') || '–',
      notes.join('; ') || '–'
    ];
  }
}
