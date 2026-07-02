# Aegis — Data Protection Impact Assessment (Outline)

**Status:** DRAFT outline for review with a data-protection specialist. Not a completed DPIA.
**Product:** Aegis — compliance, boarding and safeguarding software for SEND home-to-school transport operators (UK).
**Why a DPIA is mandatory:** systematic processing of children's data, including special-category health data, on behalf of local authorities (UK GDPR Art 35; ICO "children" and "vulnerable data subjects" criteria both met). **A DPIA must be signed off before any real child's data enters the system.**

**Roles:** the transport **operator** is the data controller (commissioned by the council; councils may argue joint-controller or controller-in-common status for some data — *confirm with specialist*). The software **vendor** is a processor under an Art 28 DPA. Supabase, Twilio, Expo/FCM/APNs are sub-processors.

---

## 1. Description of processing

### 1.1 Data flows

1. **Council → Operator:** the commissioning council supplies child details (name, home address, school, Transport Care Plan content) to the operator, usually by secure email or council portal. This inbound channel is outside Aegis but in scope for the operator's DPIA.
2. **Operator → Aegis:** the office manager enters children, splitting data across three tables by sensitivity: `children` (display name e.g. "Jamie B.", tag, pickup area — no house number), `children_pii` (full name + home address), `care_plans` (special category: medical, behaviour, communication needs). Parent contacts (phone, push token, per-channel consent) go in `parent_contacts`.
3. **Aegis → Supabase (London/EU region):** all data stored in Postgres hosted in the Supabase London region; encrypted in transit (TLS) and at rest. Certificates and incident photos in a **private** storage bucket, served only via short-lived signed URLs.
4. **On-vehicle capture:** the PA taps children on/off the vehicle; each tap stamps **time + location** into `boardings` and writes to the append-only `audit_log`. The driver reads the run sheet (name + address, for navigation). Care plan views are logged.
5. **Parent notifications:** boarding events trigger a Supabase Edge Function which sends app push (Expo/FCM/APNs) and, where separately consented, SMS via **Twilio**. Message content is minimised ("Jamie is on board" — no address, no health data).
6. **Outputs:** council-ready daily boarding register (CSV/PDF) exported by the manager; incident reports optionally shared with school/council (status change, logged).

### 1.2 Data categories and subjects

| Subjects | Data | Sensitivity |
|---|---|---|
| Children (SEND, vulnerable) | Display name, tag, pickup area; full name + home address; **Transport Care Plan (health/disability)**; boarding times/locations; incident involvement | High; care plans are Art 9 special category |
| Parents/carers | Name, phone, push token, consent flags | Personal data |
| Staff (drivers, PAs, office) | Name, role, credentials (DBS, PATS, licences) incl. certificate scans | Personal data; DBS data engages DPA 2018 criminal-offence rules — *confirm handling with specialist* |

### 1.3 Retention (proposed — confirm in DPIA)

- `boardings`: **180 days**, purged nightly by pg_cron (rows linked to incidents are excluded from the purge — see the commented job in `aegis-backend-schema.sql` §10).
- `incidents`: retained longer for safeguarding (align with council contract and safeguarding guidance — *specialist to advise a defensible period*).
- `audit_log`: long enough to evidence accountability; propose 2 years — *confirm*.
- Child records: deleted when the child leaves the run/contract ends, subject to council instructions.

---

## 2. Necessity and proportionality

- **Purpose:** safe transport of vulnerable children, contractual compliance evidence for councils, and safeguarding. Each data item maps to a concrete operational need (address → navigation; care plan → on-vehicle care; boarding stamp → "child accounted for").
- **Could less data be used?** Yes, and the design does: PAs get care plans but **never** home address; drivers get address but only for their own run; the director sees **no child data at all**; the operational `children` table holds only initials-level display name and street-level pickup area.
- **Location data** is captured only at the moment of a boarding tap (not continuous GPS tracking) — proportionate to proving pickup/drop-off.

### 2.1 Lawful bases — *all to be confirmed with the specialist*

| Processing | Proposed Art 6 basis | Proposed Art 9 condition (special category) |
|---|---|---|
| Core transport operations (child records, boarding, run sheets) | **Art 6(1)(e)** public task, as the operator performs the council's statutory SEND transport function under contract — or **Art 6(1)(f)** legitimate interests if (e) is not available to a private operator. *Specialist to determine which; do not rely on consent for core processing.* | — |
| Transport Care Plans (health/disability) | As above | **Art 9(2)(g)** substantial public interest with **DPA 2018 Sch 1 Part 2 para 18 (safeguarding of children)**; possibly 9(2)(h) health/social care. **An Appropriate Policy Document (APD) is required for Sch 1 conditions — confirm and draft with specialist.** |
| Parent notifications (push/SMS) | **Consent** per family **per channel** (`consent_app`, `consent_sms` flags) — withdrawal honoured immediately | — |
| Staff credentials incl. DBS | Art 6(1)(b)/(c)/(f); DBS data under DPA 2018 Sch 1 (employment / safeguarding) — *confirm* | — |

---

## 3. Risks and mitigations

Likelihood/severity: L = low, M = medium, H = high. Severity assessed for the child, not the business.

| # | Risk | L | S | Mitigations (actual product features) | Residual |
|---|---|:-:|:-:|---|:-:|
| R1 | **Lost/stolen on-vehicle device** exposing child data | M | H | No local database — data lives in Supabase behind auth; short session tokens; signed URLs expire in ~60 s; offline boarding queue holds minimal data (child id + tap); device PIN policy in operator onboarding; manager can revoke the auth user immediately | Low |
| R2 | **Over-retention** of boarding/location history | M | M | pg_cron purge job (180 days, schema §10) — **must be enabled at go-live**; retention schedule in data-protection checklist; audit of row counts quarterly | Low |
| R3 | **Staff misuse / snooping** (e.g. PA looking up a child not on their run; director accessing care plans) | M | H | Postgres RLS denies the query at the database, not the UI: no PA policy on `children_pii`, no director policy on any child table, run-scoping via `my_run_ids()`; every record/care-plan view written to the **append-only** `audit_log`, readable by manager and director; role set server-side only | Low |
| R4 | **Sub-processor breach** (Supabase, Twilio, Expo/FCM/APNs, Vercel) | L | H | Data minimised before it reaches each sub-processor (Twilio sees phone + a minimal message, never health data); London/EU residency for the database; DPAs and transfer mechanisms per the sub-processor table in the data-protection checklist; breach clauses flow down 72-hour notification | Med — *accept or mitigate further with specialist* |
| R5 | **SMS to wrong number** ("on board" message about a child sent to a stranger) | M | M | Per-channel opt-in captured by the manager from the parent directly; message content minimised (first name + status only, no address/school in SMS); number confirmed at consent capture; parent can report and manager corrects; sends logged in the manager feed | Low |
| R6 | **Council data requests / oversharing** (exporting more than the council needs) | M | M | Register export contains only the daily boarding record; incident sharing is an explicit, logged manager action per incident; future council role is read-only compliance, not child data | Low |
| R7 | **Cross-tenant leak** between operators | L | H | `operator_id` on every table; every RLS policy predicates on `current_operator()`; storage paths prefixed by operator id; RLS test script (`supabase/tests/rls_tests.sql`) run before every deploy | Low |
| R8 | **Signed-URL leakage** (certificate/photo link forwarded) | L | M | URLs expire in ~60 seconds; bucket is private, no public objects; view logged | Low |

---

## 4. Consultation

- **Data-protection specialist:** review lawful bases, Sch 1 APD, retention periods, controller/processor allocation. *(Required before go-live.)*
- **Commissioning council DPO:** many councils require sight of the operator's DPIA when personal data is processed under their contract.
- **Parents/carers:** privacy notice at consent capture; views on notification content.
- **ICO prior consultation:** only if a high residual risk cannot be mitigated (Art 36) — not currently expected.

## 5. Residual risk sign-off

| Item | Name | Role | Date | Signature |
|---|---|---|---|---|
| DPIA reviewed and residual risks accepted | | Operator director/owner (controller) | | |
| Specialist review completed | | Data-protection specialist | | |
| Vendor confirms technical measures implemented | | Vendor | | |
| Council DPO consulted (where required by contract) | | | | |

## 6. Gate: before ANY real child's data enters Aegis

- [ ] This DPIA completed, specialist-reviewed and signed off (all rows in §5)
- [ ] Appropriate Policy Document in place for the DPA 2018 Sch 1 safeguarding condition
- [ ] Art 28 DPA signed between vendor and operator; sub-processor list disclosed
- [ ] Operator's ICO registration confirmed (and vendor's)
- [ ] Supabase project verified in **London/EU** region
- [ ] RLS test script passes on the production project (`supabase/tests/rls_tests.sql`)
- [ ] Retention purge job (`purge-old-boardings`) enabled and observed running
- [ ] `records` bucket confirmed private; signed-URL expiry ≤ 60 s
- [ ] MFA enabled for manager and director accounts
- [ ] Privacy notice issued to parents; per-channel consent captured before any notification
- [ ] Breach response process tested (see data-protection checklist)
