# Aegis — SEND transport operations

Compliance, boarding and safeguarding software for SEND (special educational needs and
disability) home-to-school transport operators. One place for certificate expiry watching,
a digital boarding register with parent updates, care plans on the vehicle, incidents,
council invoicing and tender deadlines — with **every role seeing only the data it needs,
enforced by the database**.

Built to the PRD in [`docs/aegis-PRD.md`](docs/aegis-PRD.md).

## Run it — no setup needed

```bash
npm install
npm run dev
```

With no `.env` the app boots in **demo mode**: a complete in-browser backend seeded with one
sample operator, persisted to `localStorage`. Pick any of the four personas on the sign-in
screen. The demo backend enforces the *same access matrix as the production RLS policies*
(returns empty/null where RLS would filter rows, throws where a policy would reject a write) —
so the demo is an honest preview of the real access control, and the access-rule tests in
`src/api/demo/access.test.ts` pin it down.

| Persona | Role | What they can see |
|---|---|---|
| Robert Hale | Director | Tenders, invoicing, overview, access log — **no child data, ever** |
| Sam Price | Manager | Compliance vault, all runs, incidents, parent updates, access log |
| Darren Whitlock | Driver | Own run sheet with full addresses (navigation), own checks, care plans; **reads** boarding, never writes |
| Maria Okafor | Passenger assistant | Boarding register (read+write) for her run, care plans — **never a home address** |

## Architecture

```
src/
  api/
    contract.ts        ← the single data-access interface every screen uses
    demo/              ← in-browser backend enforcing the access matrix (demo mode)
    live/              ← thin typed supabase-js adapter (RLS does the enforcing)
  auth/                ← AuthProvider (role comes from the account, never the client)
  components/          ← accessible primitives (Button, Card, Chip, Modal, Field…)
  features/            ← one folder per screen: dashboard, compliance, boarding,
                          runsheet, incidents, parents, invoicing, tenders, overview, audit
  lib/                 ← domain types, RAG status, CSV
supabase/
  seed.sql             ← demo operator seed for a real project
  functions/notify/    ← Edge Function: push + Twilio SMS with consent, server-side only
  tests/rls_tests.sql  ← proves each role reads exactly what it should (run pre-deploy)
aegis-backend-schema.sql  ← full schema + row-level security (the GDPR core)
docs/                  ← PRD, DPIA outline, data-protection checklist, deploy runbook
```

Every query in the front end is deliberately naive — it asks for "runs" or "care plan" and
the backend decides what comes back. In live mode that's Postgres RLS; in demo mode the same
matrix is enforced in `src/api/demo/demoApi.ts`. The UI never gates data for privacy, only
for layout, so bypassing the UI gains an attacker nothing.

Other design points:

- **Offline-safe boarding** — every tap lands in a localStorage outbox before it's sent
  (`src/features/boarding/outbox.ts`), retried when the connection returns; the register
  shows a "kept safe offline" flag on pending taps. Installable PWA (manifest + service
  worker) with a cached app shell.
- **Parent updates** — "on board" / "arrived safely" fire automatically from boarding taps,
  "5 minutes away" manually; per-family, per-channel consent is honoured server-side (in
  live mode by the `notify` Edge Function, so contact PII and Twilio secrets never reach
  the on-vehicle client).
- **Invoicing without child data** — the director bills from `delivered_days()`, a
  SECURITY DEFINER aggregate returning day-counts only.
- **Append-only audit log** — record views, care-plan views, boarding taps, exports,
  status changes; no update/delete grants, so nobody (including the manager) can rewrite
  history.

## Quality gates

```bash
npm run typecheck   # TypeScript strict
npm run lint        # ESLint
npm test            # 40 tests: access matrix, route guards, RAG, CSV
npm run build       # production bundle
```

CI (`.github/workflows/aegis-ci.yml`) runs all four on every push.

## Connecting a real backend (live mode)

Follow [`docs/deploy-checklist.md`](docs/deploy-checklist.md) — short version:

1. Create a Supabase project in the **London / EU** region.
2. Run `aegis-backend-schema.sql`, then `supabase/seed.sql` in the SQL editor.
3. Run `supabase/tests/rls_tests.sql` — all checks must pass before go-live.
4. Create auth users and link `profiles` rows (role is set server-side, never by the user).
5. Deploy the `notify` Edge Function and set the Twilio secrets.
6. `cp .env.example .env`, paste your project URL + anon key, restart. The app switches to
   live mode automatically.

> **Before real children's data goes in:** complete the DPIA
> ([`docs/dpia-outline.md`](docs/dpia-outline.md)) and get a specialist data-protection
> review ([`docs/data-protection-checklist.md`](docs/data-protection-checklist.md)).
