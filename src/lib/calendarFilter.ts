/**
 * The calendar's medication marks after ticking or unticking one medication: whether medication shows at all, and
 * which medications are left out. With every medication shown, nothing is left out.
 */
export function withMedShown(allIds: number[], shownIds: number[], id: number, shown: boolean): { medication: boolean; hidden: number[] } {
  const next = new Set(shownIds);
  if (shown) next.add(id);
  else next.delete(id);
  return { medication: next.size > 0, hidden: next.size ? allIds.filter((x) => !next.has(x)) : [] };
}
