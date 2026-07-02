# Aegis — Product Requirements Document (PRD)

**Version:** 1.0  ·  **Owner:** (you)  ·  **Status:** ready to build in Claude Code

This PRD is written to be handed to Claude Code alongside the existing scaffold
(`aegis-app.zip`) and schema (`aegis-backend-schema.sql`). It describes what to build,
for whom, under what rules, and in what order — and ends with copy-paste prompts.

---

## 1. Product description

**One line.** Aegis is compliance, boarding and safeguarding software for SEND (special
educational needs and disability) home-to-school transport operators.

**Short.** Small and medium transport operators win council contracts to take vulnerable
children to school, then run them on spreadsheets, paper registers and WhatsApp. One lapsed
DBS or MOT can pull them off a council framework; a missing boarding record is a safeguarding
gap. Aegis puts the whole operation in one place: it watches every certificate's expiry,
turns the paper boarding register into a time- and location-stamped digital record, keeps
each child's Transport Care Plan on the vehicle, sends parents "on board / arrived safely"
updates, logs incidents, and handles council invoicing and tender deadlines — with every
role seeing only the data it needs, enforced by the database for GDPR.

**Who buys it.** The operator (director/owner or office manager). Sold per vehicle per month.

**Why now.** Council SEND transport spend is rising sharply and under scrutiny; councils
increasingly want operators who can *prove* compliance and reliability, which favours
operators with the right software.

---

## 2. Users & roles

| Role | Who | Primary jobs |
|------|-----|--------------|
| **Director** | Owner / commercial lead | Tenders & bids, invoicing, commercial overview |
| **Manager** | Office / operations | Compliance vault, all runs, incidents, parent updates, audit log |
| **Driver** | Driver | Their run sheet + own checks + their vehicle's checks; raise incidents |
| **Passenger assistant (PA)** | On-vehicle assistant | Boarding register for their run, care plans, raise incidents |
| **Council** (later) | Commissioner | Read-only oversight that their operator is compliant |
| **Parent/carer** (later) | Family | Live updates about their own child only |

---

## 3. Goals & success metrics

- **Zero missed renewals** — no credential lapses go unflagged for a pilot operator.
- **Paperless boarding** — a full week of runs recorded digitally, accepted by the council.
- **Adoption** — drivers and PAs use the on-vehicle screen daily without training.
- **Commercial** — one paying operator within 3 months of pilot; reference secured.
- **Trust** — a completed DPIA and specialist-reviewed data protection setup.

---

## 4. Access-control matrix (this IS the GDPR design — enforce in the DB)

| Data | Director | Manager | Driver | PA |
|------|:--------:|:-------:|:------:|:--:|
| Staff & vehicle compliance | — | full | own only | own only |
| Runs | — | all | assigned only | assigned only |
| Child (initials, area, tag) | — | all | assigned run | assigned run |
| Child full name + **home address** | — | yes | yes (needs to navigate) | **no** |
| Care plan (special category / health) | **no** | yes | assigned run | assigned run |
| Boarding register | — | read all | read own run | **read+write** own run |
| Incidents | — | all + share | own run | own run |
| Parent contacts (PII) | — | yes | — | — |
| Invoicing | yes | — | — | — |
| Tenders & bids | yes | — | — | — |
| Audit log | read | read | — | — |

Rules: multi-tenant isolation (operators never see each other's data); role set server-side,
never by the user; audit log is append-only.

---

## 5. Feature requirements (MVP)

**5.1 Auth & roles.** Email/password sign-in (Supabase Auth). On login, load the user's
`profiles` row (role, operator_id, staff_id). Role drives navigation and every data query.
No role switcher in production — role comes from the account.

**5.2 Compliance vault (Manager).** List staff and vehicles. Each has records (DBS, PATS,
safeguarding, driving licence, first aid; MOT, insurance, road tax, private-hire plate).
Each record shows RAG status from its expiry (green > 30 days, amber ≤ 30, red expired),
plus a last-checked date and verifier. Records with the soonest expiry sort to the top.
View a record's stored certificate (from private storage, via short-lived signed URL);
download a copy; export all records to CSV. Viewing a record is written to the audit log.

**5.3 Boarding register (PA + Manager).** For the assigned run, list children with tag,
scheduled pickup and pickup area. PA taps each child on board (stamps time + location) then
off at school (stamps time + school). Progress counter. Each tap writes to the audit log and
triggers a parent update. "View care plan" opens the child's Transport Care Plan (need-to-know).
"Export today's register" produces the council-ready daily register (CSV/PDF).

**5.4 Run sheet (Driver).** Read-only manifest for the driver's run: pickup order, full
address (for navigation), scheduled time, and live boarding status recorded by the PA. Access
to care plans for children on the run.

**5.5 Transport Care Plans.** Per child: summary, communication, medical, behaviour, home
address, key contacts. Visible to manager and the staff on that child's run; hidden from the
director. Viewing is logged.

**5.6 Parent notifications.** Channels: app push (primary) + SMS fallback, opt-in per family
per channel. Triggers: "5 minutes away" (manual), "child on board" and "arrived safely"
(automatic from boarding). A Manager feed shows what was sent.

**5.7 Incidents.** Report form: run, child (optional), type, severity, description, optional
photo (stored in private bucket). Reports list scoped by role; Manager can share with school
or council (status change, logged). Everything time-stamped and attributed.

**5.8 Invoicing (Director).** Compute what each council owes from delivered runs (days × daily
rate). Raise invoices; track status (draft/sent/paid); export CSV.

**5.9 Tenders & bids (Director).** Track council tenders: reference, council, type, close date
(with countdown), value, status (open → bid → won/lost). Soonest deadline first.

**5.10 Access log.** Append-only record of who did what, when. Readable by Manager and Director.

---

## 6. Data model

Use `aegis-backend-schema.sql` as the source of truth. Key tables: `operators`, `profiles`
(role), `staff`, `credentials`, `vehicles`, `vehicle_checks`, `runs`, `children`,
`children_pii` (name + address, split for minimisation), `care_plans` (special category),
`boardings`, `incidents`, `parent_contacts`, `invoices`, `tenders`, `audit_log`. Row-level
security policies implement the matrix in §4.

---

## 7. Tech stack & architecture

- **Backend:** Supabase (Postgres + Auth + Row-Level Security + Storage + Realtime + Edge Functions). Project region **London/EU**.
- **Web app:** React + Vite (the existing scaffold). Deploy on Vercel or Netlify.
- **Mobile:** Phase 1 = PWA (installable, offline-tolerant boarding). Phase 2 = Expo/React Native sharing the same backend, for app-store presence and reliable push.
- **Notifications:** Expo Push / FCM / APNs for app; Twilio (via Edge Function) for SMS.
- **Storage:** private `records` bucket; documents and incident photos served only via signed URLs.

---

## 8. Non-functional requirements

- **Security:** TLS in transit; encryption at rest (Supabase default); RBAC enforced by RLS, never UI-only; MFA available for office roles.
- **Data protection:** UK/EU residency; data minimisation (see §4); append-only audit; retention job to purge old boarding rows per DPIA; DPA with each customer; ICO registration; DPIA before real data.
- **Accessibility:** keyboard focus visible, reduced-motion respected, mobile-first for on-vehicle screens.
- **Performance:** boarding actions feel instant; screens usable on a mid-range phone on mobile data.
- **Reliability:** boarding writes must not be lost; handle offline gracefully in the PWA.

---

## 9. Build roadmap (phases)

1. **Foundation** — schema + RLS live; auth; role-aware shell. *(done in scaffold)*
2. **Compliance vault** — live records, RAG, record viewer, CSV export. *(started)*
3. **Boarding + care plans** — on/off with time+location, care plan view, register export. *(started)*
4. **Incidents** — form + photo upload to storage; sharing.
5. **Parent notifications** — Edge Function + push + SMS; feed.
6. **Invoicing + tenders** — director screens.
7. **PWA** — manifest + service worker; installable, offline boarding queue.
8. **Deploy** — Vercel + Supabase prod; custom domain.
9. **Expo mobile app** — once a pilot asks for it.
10. **Council oversight view** — read-only compliance for commissioners (upsell).

Ship 1–3 to one operator before building 4+.

---

## 10. Out of scope (for now)

Route optimisation/planning, GPS live vehicle tracking map, payroll, accounting integrations,
multi-country support. Note these as future so they inform data-model decisions but don't get built yet.

---

## 11. Pricing (for context, not a build task)

Per vehicle per month, ~£8–£20, or tiered flat plans (Starter ~£29/mo to 3 vehicles, Growth
~£79/mo to ~10, Pro ~£149/mo to ~25). Justify by risk: a lapsed certificate can cost a route
worth ~£15k/yr. Offer the first operator a free pilot for feedback + a reference.

---

---

# Claude Code build prompts

Run these in order, in the `aegis-app` project folder (unzip `aegis-app.zip` first). Each is
self-contained. Adjust names as you like. Wait for each to build cleanly before moving on.

**Prompt 0 — orient**
> This is a Vite + React + Supabase app for SEND school-transport operators. Read `README.md`,
> `aegis-backend-schema.sql`, and everything under `src/`. Summarise the architecture, the four
> roles, and how row-level security enforces access. Don't change anything yet.

**Prompt 1 — get it running**
> Help me connect Supabase. Walk me through creating the project in the London/EU region,
> running `aegis-backend-schema.sql` then `supabase/seed.sql`, creating a test user for each
> role and linking `profiles` rows, and filling in `.env`. Then run `npm run dev` and confirm
> I can sign in as the manager and see live compliance data.

**Prompt 2 — record viewer + storage**
> Create a private Supabase Storage bucket `records` with an RLS policy restricting objects to
> the caller's operator. In the Compliance vault, add a "View record" action that opens a modal
> showing the credential details and, if a `document_path` exists, the file via a short-lived
> signed URL, plus a "Download copy" button. Log the view to `audit_log`. Add an "Export records
> (CSV)" button.

**Prompt 3 — care plans**
> Add a Care Plan modal opened from the Boarding register and Run sheet. It reads `care_plans`
> for the child and shows summary, communication, medical, behaviour, home address (from
> `children_pii`), and contacts. Enforce that a PA cannot see the home address but a driver can
> (respect the RLS split). Log every care-plan view to `audit_log`.

**Prompt 4 — run sheet (driver)**
> Build the Driver "Run sheet" page: read-only manifest for the driver's assigned run, showing
> pickup order, full address, scheduled time, and live boarding status recorded by the PA. Add
> a "View care plan" action. No boarding buttons — drivers don't record boarding.

**Prompt 5 — incidents**
> Build the Incidents feature end to end: a report form (run, optional child, type, severity,
> description, optional photo uploaded to the `records` bucket), a role-scoped list, and, for
> managers, "Share with school/council" actions that update status. Write every action to
> `audit_log`. Photos must be private, shown via signed URLs.

**Prompt 6 — parent notifications**
> Add `parent_contacts` management for managers (name, phone, push token, per-channel consent).
> Create a Supabase Edge Function `notify` that sends an app push and, if consented, an SMS via
> Twilio. Trigger it on boarding "on board" and "arrived" events and from a manual "5 minutes
> away" button. Add a Manager "Parent updates" feed showing what was sent. Put Twilio keys in
> Edge Function secrets, never the client.

**Prompt 7 — invoicing + tenders (director)**
> Build the Director "Invoicing" page (compute council billing from delivered runs = days ×
> daily rate; raise invoices; status draft/sent/paid; CSV export) and "Tenders & bids" page
> (list from `tenders`, deadline countdown, move status open → bid → won/lost). Add a Director
> "Overview" with active bids, contracts won, and revenue this month.

**Prompt 8 — access log + polish**
> Build the "Access log" page reading `audit_log` (managers + directors only). Then do an
> accessibility and mobile pass across all screens: visible keyboard focus, reduced-motion,
> and make the boarding register comfortable to use one-handed on a phone.

**Prompt 9 — PWA**
> Turn the web app into an installable PWA: add a web manifest and icons, register a service
> worker, and make the boarding register queue writes locally when offline and sync when the
> connection returns, so a PA never loses a boarding tap in a dead spot.

**Prompt 10 — deploy**
> Set up deployment: a `.gitignore`, first git commit, push to a new private GitHub repo, then
> deploy the front end to Vercel with the Supabase env vars, and point the Supabase project to
> production. Give me a checklist to verify each role works on the live URL.

**Prompt 11 — Expo mobile (later)**
> Scaffold an Expo (React Native) app in a `mobile/` folder that reuses the same Supabase
> backend and auth. Start with sign-in, the driver run sheet, and the PA boarding register with
> native camera for incident photos and push notifications. Share types/logic with the web app
> where practical.

**Guardrails to give Claude Code throughout**
> Keep all access control enforced by Supabase RLS, never only in the UI. Keep data in the
> London/EU region. Never put secrets (Twilio, service keys) in client code. Store children's
> documents and photos in the private bucket, served only via short-lived signed URLs. Before
> real children's data goes in, remind me to complete a DPIA and a specialist data-protection review.
