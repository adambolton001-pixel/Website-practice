/** Shared display formatting (used across features — keep one copy). */

export const gbp = (n: number | null): string =>
  n === null ? '—' : n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

/** Current billing period as YYYY-MM. */
export const thisPeriod = (): string => new Date().toISOString().slice(0, 7);

export const periodLabel = (period: string): string =>
  new Date(period + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export const initials = (name: string): string =>
  name
    .split(' ')
    .map((x) => x[0] ?? '')
    .slice(0, 2)
    .join('');
