# Aegis — Data Protection Operational Checklist

Who does what: the **operator** (transport company) is the data controller; the **vendor** (Aegis) is the processor. Items are tagged **[V]** vendor, **[O]** operator, **[V+O]** both. Work through this alongside `dpia-outline.md`; nothing here replaces the specialist review.

## 1. Registrations and contracts

- [ ] **[O]** ICO registration (data protection fee) current — controllers processing children's data must be registered. Check at ico.org.uk/esdwebpages/search.
- [ ] **[V]** ICO registration for the vendor (processors pay the fee too).
- [ ] **[V+O]** Signed **Data Processing Agreement (UK GDPR Art 28)** between vendor and **each** operator, covering: subject matter and duration; nature/purpose (SEND transport operations); data categories incl. special category children's health data; documented-instructions clause; confidentiality; security measures (RLS, encryption, audit log); sub-processor authorisation and change notice; assistance with SARs and breaches; deletion/return at contract end; audit rights.
- [ ] **[O]** Check the **council contract** for data-handling schedules — councils often impose their own breach-notification and retention terms that must flow into operator practice.
- [ ] **[V+O]** Appropriate Policy Document (APD) for the DPA 2018 Sch 1 safeguarding condition (see DPIA §2.1).

## 2. Sub-processor register (maintain in the DPA annex)

| Sub-processor | Purpose | Data it sees | Location / transfer mechanism |
|---|---|---|---|
| Supabase | Database, auth, storage, Edge Functions | All application data | **London/EU region** — verify at project creation; UK adequacy for EU covers EU-hosted; Supabase Inc. is US — confirm the DPA + UK IDTA/Addendum covers any US support access |
| Twilio | SMS fallback | Parent phone number + minimal message text (child first name + status only) | US company; UK Addendum to EU SCCs in Twilio's DPA — confirm signed |
| Expo / FCM (Google) / APNs (Apple) | App push | Push token + minimal message; no health data, no address | US; rely on each provider's DPA + UK transfer addendum; keep payloads minimal so a push is never a breach of substance |
| Vercel (or Netlify) | Front-end hosting | **No personal data at rest** — static assets only; browser talks directly to Supabase | Confirm no logging of request bodies; DPA on file anyway |

- [ ] **[V]** Publish/attach this list to every operator DPA; give notice before adding or changing a sub-processor.
- [ ] **[V]** Verify each sub-processor DPA is actually executed, not just linked.

## 3. Breach response

- [ ] **[V+O]** Written process agreed and **tested with a tabletop run-through** before go-live:
  1. **Detect and contain** — vendor revokes affected Supabase auth users/keys, rotates secrets, disables signed-URL issuance if storage is implicated.
  2. **Vendor → operator without undue delay** (contractual target: within 24 h) with facts: what data, which children, cause, containment.
  3. **Operator assesses risk**; the **72-hour ICO clock** runs from when the *operator* becomes aware. Children's data breaches will almost always meet the reporting threshold — default to reporting.
  4. **Operator notifies the commissioning council(s)** per contract — usually required regardless of ICO thresholds.
  5. **Parents notified** (Art 34) where high risk — e.g. home addresses or care plans exposed.
  6. **Evidence:** pull relevant `audit_log` rows (append-only, so they are trustworthy); record the incident and decisions even if not reported.
- [ ] **[O]** ICO reporting route and council contact points listed in the operator's runbook, not just someone's head.

## 4. Retention schedule

| Data | Period | Mechanism |
|---|---|---|
| `boardings` (incl. time + location stamps) | **180 days** | pg_cron job `purge-old-boardings` — the commented `cron.schedule` block in `aegis-backend-schema.sql` §10; **must be uncommented/enabled in production** and the interval matched to the DPIA-agreed period. Rows linked to incidents are excluded from the purge. |
| `incidents` | Longer, for safeguarding — set per specialist advice and council contract (safeguarding records commonly warrant multi-year retention) | Manual review annually; do not auto-purge |
| `audit_log` | Proposed 2 years (confirm in DPIA) | Scheduled job or manual annual purge; keep long enough to investigate misuse |
| Child records (`children`, `children_pii`, `care_plans`, `parent_contacts`) | Until the child leaves the run / contract ends, then delete per council instruction | Manager deletes; cascade removes PII and care plan |
| Staff credentials / certificate scans | Employment + period required by council framework | Manager deletes on offboarding review |

- [ ] **[V]** Confirm quarterly that the purge job is running (`select * from cron.job_run_details`).

## 5. Subject access requests (SARs)

- [ ] **[O]** Operator handles SARs (controller); **[V]** vendor assists within 5 working days of a request (DPA clause). One-month statutory deadline.
- [ ] **Parent requesting their child's data:** verify the requester holds parental responsibility; supply the child's records (child row, care plan, boardings within retention, incidents naming the child, notification log). Redact third-party children from shared records (e.g. run manifests).
- [ ] **Child's own rights:** UK GDPR rights belong to the **child**. A competent child (broadly, mature enough to understand — often around 12+) may exercise them directly, and a parent's request should then be honoured only with the child's authority or where clearly in their best interests. Given SEND context, competence is case-by-case — *take specialist advice on a standing policy rather than deciding per request under time pressure*.
- [ ] **Staff SARs:** credentials, audit rows naming them, incident reports they raised.
- [ ] Practical extraction: manager CSV exports + a vendor-run SQL pull for `audit_log` and notification history.

## 6. Staff onboarding / offboarding

**Onboarding [O]:**
- [ ] DBS (Enhanced) verified and recorded in `credentials` **before** first run; PATS/safeguarding training likewise.
- [ ] Vendor/manager creates Supabase auth user, then inserts the `profiles` row (operator_id, role, staff_id) **server-side — users never set their own role**.
- [ ] Confidentiality/acceptable-use agreement signed: no screenshots, no WhatsApp of child data, device PIN required.

**Offboarding [O + V]:**
- [ ] Same day: delete/ban the Supabase auth user (Dashboard → Authentication) — RLS depends on the auth identity, so revoking it cuts all data access instantly.
- [ ] Remove staff from run assignments; review their `audit_log` history if departure was contentious.
- [ ] Keep the `staff`/`credentials` rows per the retention schedule (compliance evidence), but the person can no longer log in.

## 7. Technical measures (verify, not assume)

- [ ] MFA enforced for **manager and director** accounts (Supabase Auth MFA); recommended for all office access to the Supabase dashboard itself.
- [ ] Supabase dashboard access restricted to named vendor staff with MFA; service-role key never in client code or the repo.
- [ ] `records` bucket private; signed URLs ≤ 60 s.
- [ ] RLS test suite (`supabase/tests/rls_tests.sql`) passes on every schema change and before every deploy (see `deploy-checklist.md`).

## 8. Go-live gate

- [ ] **DPIA completed and signed off before any real child's data enters the system** — see the gate checklist in `dpia-outline.md` §6. No pilot with real names, addresses or care plans until every box there is ticked.
