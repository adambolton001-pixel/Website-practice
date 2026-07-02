# Aegis — Deploy & Role-Verification Runbook

Order matters. Do not skip the verification matrix — RLS is the product's GDPR promise, and it is only proven against the **live** project. **No real child data at any point in this runbook** (see `dpia-outline.md` §6): the seed data is fictional and stays that way until the DPIA gate is passed.

## 1. Supabase project

- [ ] Create the project at supabase.com → **Region: London (eu-west-2)**. This is not changeable later without a migration — check twice before clicking create. (An EU region is the fallback; never US.)
- [ ] Record project URL and anon key; the **service-role key stays out of the repo and out of the client** — dashboard/CI secrets only.
- [ ] SQL Editor → run `aegis-backend-schema.sql` (whole file, in order). Confirm no errors and that the `records` bucket exists and is **private** (Storage → records → not public).
- [ ] SQL Editor → run `supabase/seed.sql` (demo operator "Greenway SEND Transport", one run, three children — all fictional).
- [ ] Database → Extensions → enable **pg_cron**, then uncomment and run the `purge-old-boardings` block from schema §10. Verify with `select * from cron.job;`.

## 2. Pre-deploy gate: RLS test script

- [ ] Run `supabase/tests/rls_tests.sql` against the project (SQL Editor or `psql`). It impersonates each role and asserts the access matrix (PA blocked from `children_pii`, director blocked from all child tables, cross-operator isolation, append-only audit log). **Every assertion must pass. A single failure stops the deploy.**
- [ ] Re-run this gate after *any* schema or policy change, before redeploying.

## 3. Auth users and profiles

Create four users (Authentication → Add user → email + password, auto-confirm). Then link each to a profile **via SQL as service role** — the role is set server-side only; there is no client path to set or change it.

```sql
-- repeat per user; get <AUTH_UID> from Authentication → Users
insert into profiles (id, operator_id, staff_id, role, full_name) values
  ('<AUTH_UID>', '00000000-0000-0000-0000-0000000000ff', null, 'director', 'Test Director'),
  ('<AUTH_UID>', '00000000-0000-0000-0000-0000000000ff', null, 'manager',  'Test Manager'),
  ('<AUTH_UID>', '00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000a2', 'driver', 'Darren Whitlock'),
  ('<AUTH_UID>', '00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000a1', 'pa',     'Maria Okafor');
```

Driver/PA `staff_id`s must match the seeded staff rows (a2 = driver, a1 = PA) or run-scoping returns nothing.

- [ ] Enable MFA for the manager and director accounts.

## 4. Edge Function (notifications)

- [ ] Set secrets (never in client code): `supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=...`
- [ ] `supabase functions deploy notify`
- [ ] Smoke test with a test phone number you own; confirm the send appears in the Manager "Parent updates" feed and that the SMS body contains **no address or health data**.

## 5. Front end

- [ ] Vercel (or Netlify): import the repo, framework Vite, env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only — it is safe to ship *because* RLS is the enforcement layer).
- [ ] Add the deployed URL to Supabase Auth → URL Configuration (site URL + redirect).
- [ ] Confirm the build serves over HTTPS and the demo-mode flag (if any) is off in production.

## 6. Role verification matrix — run on the live URL

Sign in as each user in a fresh private window. "REST probe" means calling PostgREST directly with that user's access token, bypassing the UI:

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/<table>?select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer <that_users_access_token>"
```

| Role | Spot-check | Expected |
|---|---|---|
| **Director** | URL-hack to `/#/compliance` and `/#/boarding` | Redirected away; no child or compliance data renders |
| Director | REST probe `/rest/v1/care_plans`, `/children`, `/children_pii`, `/boardings` | **`[]` empty array every time** (RLS default-deny, not a 403 from the UI) |
| Director | Open Invoicing, Tenders, Access log | Full access; audit rows visible |
| **Manager** | Compliance vault, all runs, boarding register, care plans, parent contacts | Full access; opening a credential record shows the certificate via a signed URL that **expires (~60 s)** — copy the URL, wait, re-open: it must fail |
| Manager | REST probe `/rest/v1/invoices` | `[]` — invoicing is director-only |
| **Driver** | Run sheet for AM Run 1 | Sees full name + **home address** (navigation), pickup order, live boarding status; can open care plans for children on the run |
| Driver | Boarding register UI and REST probe: `POST /rest/v1/boardings` (or PATCH a row) | UI offers no boarding buttons; REST write returns **`42501` RLS policy violation** — drivers read, never write boardings |
| Driver | REST probe `/rest/v1/credentials` | Only their own credential rows |
| **PA** | Boarding register: tap a child on board, then off | Works; timestamps + location stamped; parent notification fires |
| PA | Open a care plan | Care plan (summary, communication, medical, behaviour, contacts) renders; **home address is absent** — verify in the UI *and* with REST probe `/rest/v1/children_pii` → **`[]`** |
| PA | REST probe `/rest/v1/parent_contacts` | `[]` — parent PII is manager-only |
| **Any role** | Cross-operator probe: REST query any table filtered to a different `operator_id` (or after inserting a second seed operator) | `[]` — tenant isolation holds |
| **Any role** | Tamper probe: `PATCH /rest/v1/profiles?id=eq.<self>` setting `role=manager` | Rejected — no update policy on profiles |
| **Manager/Director** | After the above: open the Access log | `audit_log` rows exist for the record views, care-plan views and boarding taps just performed, with correct actor and role |
| **Anyone** | `PATCH`/`DELETE /rest/v1/audit_log?id=eq.1` as any role | Rejected — append-only |

- [ ] Every row above verified and initialled. A failed check is a **stop-ship**: fix the policy, re-run `supabase/tests/rls_tests.sql`, redeploy, re-verify.

## 7. After verification

- [ ] Remove or change any shared test-user passwords.
- [ ] Confirm the `purge-old-boardings` cron ran overnight (`select * from cron.job_run_details order by start_time desc limit 5;`).
- [ ] Do **not** load real children's data — that is gated on the DPIA sign-off (`dpia-outline.md` §6) and the operator DPA (`data-protection-checklist.md` §1).
