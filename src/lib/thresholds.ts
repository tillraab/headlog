/** Thresholds for the factors that may favour a headache, shared by the forecast and the report. */

/** Below this share of the hydration goal, or of today's pace, hydration counts as unfavourable. */
export const LOW_HYDRATION = 0.75;
/** A night under this many hours counts as short. */
export const SHORT_SLEEP_HOURS = 6;
/** Caffeine under this share of the usual amount counts as a drop. */
export const CAFFEINE_DROP = 0.5;
/** Below this usual daily caffeine, a drop is not judged. */
export const MIN_USUAL_CAFFEINE = 100;
/** Today is only judged once the usual amount by this time of day reaches this, i.e. after the usual first coffee. */
export const MIN_USUAL_CAFFEINE_BY_NOW = 50;
/** The usual caffeine amount needs at least this many logged days. */
export const MIN_CAFFEINE_DAYS = 7;
