import { describe, expect, it } from 'vitest';
import { swipeStep } from './swipe';

describe('swipeStep', () => {
  it.each([
    { dx: -120, dy: 0, step: 1, why: 'left swipe goes to the next item' },
    { dx: 120, dy: 0, step: -1, why: 'right swipe goes to the previous item' },
    { dx: -80, dy: 40, step: 1, why: 'mostly horizontal with some drift' },
    { dx: 50, dy: 0, step: 0, why: 'exactly the minimum travel is too short' },
    { dx: 51, dy: 0, step: -1, why: 'just over the minimum travel' },
    { dx: -30, dy: 0, step: 0, why: 'short horizontal move' },
    { dx: 0, dy: 200, step: 0, why: 'vertical scroll' },
    { dx: -90, dy: 60, step: 0, why: 'exactly 1.5 times the vertical travel' },
    { dx: -90, dy: -59, step: 1, why: 'just above 1.5 times an upward travel' },
    { dx: 100, dy: -100, step: 0, why: 'diagonal' },
    { dx: 0, dy: 0, step: 0, why: 'a tap' }
  ])('$why: ($dx, $dy) → $step', ({ dx, dy, step }) => {
    expect(swipeStep(dx, dy)).toBe(step);
  });
});
