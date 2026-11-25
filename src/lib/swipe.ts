/** Shortest horizontal travel, in px, that counts as a swipe. */
export const SWIPE_MIN_PX = 50;
/** How many times longer the horizontal travel must be than the vertical one, so scrolling never counts. */
export const SWIPE_RATIO = 1.5;

/**
 * The step a finished touch gesture asks for, from its travel `dx`, `dy` in px: 1 for the next item
 * (finger moved left), -1 for the previous one (finger moved right), 0 when it was not clearly horizontal.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) <= SWIPE_MIN_PX || Math.abs(dx) <= SWIPE_RATIO * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
