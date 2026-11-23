import { describe, expect, it } from 'vitest';
import { withMedShown } from './calendarFilter';

describe('withMedShown', () => {
  it.each([
    ['hides one of three', [1, 2, 3], 2, false, { medication: true, hidden: [2] }],
    ['shows all again', [1, 3], 2, true, { medication: true, hidden: [] }],
    ['turns medication off with the last one', [2], 2, false, { medication: false, hidden: [] }]
  ])('%s', (_, shown, id, value, result) => {
    expect(withMedShown([1, 2, 3], shown, id, value)).toEqual(result);
  });
});
