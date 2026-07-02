// Dependency-free SVG charts following the dataviz method: thin marks with
// 4px rounded data-ends, 2px surface gaps, direct labels (text in text
// tokens, never the series colour), recessive rails, native hover titles.
// Mark colours are validator-passing: #2F9E68 on light, #6AA337 on dark.

export const MARK_LIGHT = '#2F9E68';
export const MARK_DARK = '#6AA337';

export interface BarDatum {
  label: string;
  value: number;
  display: string; // formatted value for the direct label + tooltip
  sub?: string; // small annotation after the label (e.g. status)
}

/** Horizontal bar chart for magnitude-by-category (single series, ≤ ~8 rows). */
export function HBar({
  data,
  mark,
  dark = false,
  ariaLabel,
}: {
  data: BarDatum[];
  mark: string;
  dark?: boolean;
  ariaLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const rowH = 34;
  const barH = 14;
  const labelW = 148;
  const valueW = 92;
  const width = 520;
  const plotW = width - labelW - valueW;
  const height = data.length * rowH;
  const ink = dark ? '#FFFFFF' : 'var(--ink)';
  const inkSoft = dark ? '#9DB0A4' : 'var(--ink-faint)';
  const rail = dark ? 'rgba(255,255,255,.09)' : 'rgba(18,27,22,.07)';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'block', maxWidth: width }}
    >
      {data.map((d, i) => {
        const y = i * rowH;
        const w = Math.max((d.value / max) * plotW, d.value > 0 ? 6 : 0);
        return (
          <g key={d.label} className="hbar-row">
            <title>{`${d.label}${d.sub ? ` (${d.sub})` : ''}: ${d.display}`}</title>
            <text x={0} y={y + rowH / 2} dominantBaseline="central" fontSize="12.5" fontWeight="600" fill={ink}>
              {d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label}
            </text>
            {d.sub && (
              <text x={0} y={y + rowH / 2 + 13} dominantBaseline="central" fontSize="10" fill={inkSoft}>
                {d.sub}
              </text>
            )}
            {/* recessive rail so zero rows still read */}
            <rect x={labelW} y={y + (rowH - barH) / 2} width={plotW} height={barH} rx={4} fill={rail} />
            {w > 0 && (
              // flat baseline end, 4px rounded data end (clip the left corners)
              <path
                d={`M${labelW},${y + (rowH - barH) / 2} h${Math.max(w - 4, 2)} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h-${Math.max(w - 4, 2)} z`}
                fill={mark}
              />
            )}
            <text
              x={labelW + plotW + 8}
              y={y + rowH / 2}
              dominantBaseline="central"
              fontSize="12"
              fontFamily="var(--mono)"
              fill={ink}
            >
              {d.display}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Single-series sparkline with an endpoint dot and direct last-value label. */
export function Spark({
  values,
  mark,
  dark = false,
  ariaLabel,
  lastLabel,
}: {
  values: number[];
  mark: string;
  dark?: boolean;
  ariaLabel: string;
  lastLabel: string;
}) {
  const width = 220;
  const height = 52;
  const pad = 4;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = (width - pad * 2 - 34) / Math.max(values.length - 1, 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const pts = values.map((v, i) => `${pad + i * step},${y(v).toFixed(1)}`).join(' ');
  const lastX = pad + (values.length - 1) * step;
  const lastY = y(values[values.length - 1] ?? 0);
  const ink = dark ? '#FFFFFF' : 'var(--ink)';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block', maxWidth: width }}>
      <title>{ariaLabel}</title>
      <polyline points={pts} fill="none" stroke={mark} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="4" fill={mark} stroke={dark ? '#0C2B23' : '#fff'} strokeWidth="2" />
      <text x={lastX + 8} y={lastY} dominantBaseline="central" fontSize="12" fontWeight="700" fill={ink} fontFamily="var(--mono)">
        {lastLabel}
      </text>
    </svg>
  );
}
