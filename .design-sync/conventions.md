# Aegis design system — how to build with it

Aegis is safeguarding software for SEND school transport. The look is calm and
trustworthy: deep forest surfaces, warm paper background, ONE lime accent used
sparingly. Never introduce purple, gradients on text, or glassmorphism.

## Setup
No provider or wrapper is required — every component works standalone. All
styling comes from the stylesheet closure (`styles.css` → `_ds_bundle.css`),
which defines the tokens, fonts (self-hosted Space Grotesk / Instrument Sans /
Spline Sans Mono) and every class named below. Set page background to
`var(--paper)` and body font to `var(--body)`.

## Styling idiom: CSS custom properties + a small fixed class vocabulary
Style layout glue with these real tokens (from `_ds_bundle.css`):
`--paper --paper-deep --card --line --line-strong` (surfaces/borders),
`--ink --ink-soft --ink-faint` (text), `--forest --forest-2 --pine --pine-wash`
(brand greens), `--lime --lime-soft --lime-ink` (the single accent),
`--green/--green-wash --amber/--amber-wash --red/--red-wash` (status only),
`--display --body --mono` (fonts), `--radius --radius-sm --pill` (radii),
`--shadow-1 --shadow-2 --shadow-3`.

Reusable page classes that exist in the shipped CSS — use these instead of
inventing your own: `page-head` (with `h1` + `p`), `role-note` (uppercase
eyebrow), `section-title`, `head-actions`, `grid cols-2|cols-3`, `stat`
(+`num`,`cap`; tones `red|amber|green`), `fin-card` (+`fin-cap`,`fin-num`,
`fin-sub` — dark finance tile), `row-x` (+`row-name`,`row-sub`,`role-tag`),
`att-row` (+`att-who`,`att-what`,`att-meta`,`att-date`), `child` (+`avatar`,
`child-info`,`child-name`,`child-need`,`child-stamp`), `run-meta` (+`k`,`v`,
`progress-wrap`,`pct` — dark run panel), `run-tabs`/`run-tab`, `table`
(+`num`,`mono` cells), `audit-row`, `mini-btn`, `linklike`, `need-tag`,
`board-btn waiting|onboard|done`, `demo-note`.

Charts: use `HBar`/`Spark` with mark `#2F9E68` on light surfaces and `#6AA337`
on dark (`dark` prop) — these are contrast-validated. Lime is never a data mark.

## Where the truth lives
Read `styles.css` and its import `_ds_bundle.css` before styling anything —
every token and class above is defined there. Each component's API is its
`<Name>.d.ts`; usage patterns are in `<Name>.prompt.md`.

## Idiomatic example
```jsx
const { Card, Chip, Button, Empty } = window.Aegis;
<div style={{ background: 'var(--paper)', fontFamily: 'var(--body)', padding: 32 }}>
  <div className="page-head">
    <span className="role-note">Manager · operations</span>
    <h1>Compliance vault</h1>
    <p>Records that need action sort to the top.</p>
  </div>
  <div className="head-actions"><Button variant="ghost">Export records (CSV)</Button></div>
  <Card>
    <div className="row-x">
      <div>
        <div className="row-name">Darren Whitlock <span className="role-tag">driver</span></div>
        <div className="row-sub">3 records · tap to view</div>
      </div>
      <Chip tone="red">1 expired</Chip>
    </div>
    <Empty big="All records valid">Nothing expiring in the next 30 days.</Empty>
  </Card>
</div>
```
