# design-sync notes — Aegis

- This is an APP repo (aegis/), not a packaged library: converter runs in
  synth-entry mode from `aegis/src/components`. The DS surface is ui.tsx
  (11 primitives) + charts.tsx (HBar, Spark). Layout and CarePlanModal are
  app screens wired to auth/api context — excluded via componentSrcMap.
- Fonts are Google-hosted (Space Grotesk / Instrument Sans / Spline Sans
  Mono), loaded by the app via <link>. For the sync they come through
  `src/styles/ds-entry.css` (cssEntry), which @imports the Google CSS then
  the token stylesheet — expect [FONT_REMOTE], which is fine.
- Design tokens live as CSS custom properties in src/styles/index.css
  (forest/paper/lime system per repo-root CLAUDE.md).
- Chromium for the render check is preinstalled at /opt/pw-browsers
  (PLAYWRIGHT_BROWSERS_PATH env) as build chromium-1194 — install the
  playwright npm version that pins that build.
- dribbble.com is blocked by the workspace proxy (design references came
  from the user as descriptions).

## Known render warns
- (none outstanding — the early [RENDER_BLANK] on bare inputs and two goto
  timeouts were both resolved by authoring previews and self-hosting fonts.)

## Re-sync risks
- Fonts are self-hosted snapshots (aegis/src/styles/fonts/, fetched from
  Google Fonts 2026-07): if the app's font families change in index.html,
  re-fetch and regenerate ds-fonts.css or [FONT_MISSING] appears.
- The self-link aegis/node_modules/aegis-app -> ../../aegis is required for
  the converter (synth-entry mode) and is NOT committed — recreate it on a
  fresh clone: `ln -sfn ../../aegis aegis/node_modules/aegis-app`.
- cssEntry points at the app stylesheet (src/styles/index.css). New DS-level
  classes/tokens added to the app ship automatically, but conventions.md
  enumerates class names — re-validate it against the fresh build.
- Preview data (SEND-transport sample content) is inlined in
  .design-sync/previews/*.tsx; it doesn't track app seed data by design.
- No projectId is pinned: this was a LOCAL-ONLY run (DesignSync auth is not
  available in claude.ai/code sessions). First upload will need §1 project
  creation from an authorized session, or the user imports ds-bundle/ manually.
