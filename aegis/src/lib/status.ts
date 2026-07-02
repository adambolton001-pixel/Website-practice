const MS = 86400000;
function today(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export type Rag = 'red' | 'amber' | 'green';

export function daysLeft(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - today().getTime()) / MS);
}

/** RAG from expiry: green > 30 days, amber ≤ 30, red expired. */
export function statusOf(dateStr: string): Rag {
  const d = daysLeft(dateStr);
  return d < 0 ? 'red' : d <= 30 ? 'amber' : 'green';
}

export function expLabel(dateStr: string): string {
  const d = daysLeft(dateStr);
  if (d < 0) return `Expired ${Math.abs(d)}d ago`;
  if (d === 0) return 'Expires today';
  if (d <= 30) return `Expires in ${d}d`;
  return `Valid · ${new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10);
