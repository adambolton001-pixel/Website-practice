-- =====================================================================
--  AEGIS — SEND transport operations
--  GDPR-safe backend foundation for Supabase (PostgreSQL)
-- ---------------------------------------------------------------------
--  This turns the demo's "roles" into REAL, server-enforced access.
--  In the prototype the role switch only hides UI. That is NOT GDPR-safe.
--  Here, the database itself refuses to return data a role shouldn't see,
--  even if someone bypasses the app and calls the API directly.
--
--  GDPR principles baked in:
--   * Multi-tenant isolation  — operators can never see each other's data
--   * Role-based access (RBAC) — director / manager / driver / PA
--   * Data minimisation       — child PII (name, address) and special-
--                                category care plans live in separate
--                                tables with stricter access than the
--                                operational child record
--   * Accountability          — append-only audit log (no update/delete)
--   * Storage                 — certificates & incident photos in a
--                                private bucket, served via short-lived
--                                signed URLs only
--
--  Run order matters. Review with a data-protection specialist before
--  putting real children's data in. Set your Supabase project region to
--  London/EU so data never leaves the UK/EU (adequacy + council comfort).
-- =====================================================================

-- gen_random_uuid() is built into PostgreSQL 13+, but pgcrypto keeps this
-- script portable to older instances. Harmless if already present.
create extension if not exists pgcrypto;

-- The helper functions in section 2 mention tables created later in the
-- file; defer body validation so the script also runs cleanly via psql.
set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 0.  ENUMS
-- ---------------------------------------------------------------------
create type app_role     as enum ('director','manager','driver','pa');
create type board_state  as enum ('waiting','onboard','dropped');
create type incident_sev as enum ('low','med','high');

-- ---------------------------------------------------------------------
-- 1.  TENANCY + IDENTITY
--     Every row belongs to one operator. A profile links a Supabase
--     auth user to an operator and a role. Drivers/PAs also link to a
--     staff record (so we can scope them to their assigned run).
-- ---------------------------------------------------------------------
create table operators (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table staff (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  full_name   text not null,
  role        app_role not null,
  created_at  timestamptz not null default now()
);

-- profiles.id == auth.users.id  (1:1 with the logged-in user)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  operator_id uuid not null references operators(id) on delete cascade,
  staff_id    uuid references staff(id),          -- set for drivers/PAs
  role        app_role not null,
  full_name   text not null
);

-- ---------------------------------------------------------------------
-- 2.  HELPER FUNCTIONS  (read the caller's profile, used by every policy)
--     SECURITY DEFINER so policies can call them without recursion.
-- ---------------------------------------------------------------------
create or replace function current_operator() returns uuid
  language sql stable security definer set search_path = public as
$$ select operator_id from profiles where id = auth.uid() $$;

create or replace function current_role_aegis() returns app_role
  language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function current_staff_id() returns uuid
  language sql stable security definer set search_path = public as
$$ select staff_id from profiles where id = auth.uid() $$;

-- run ids the caller is assigned to (driver OR pa on that run)
create or replace function my_run_ids() returns setof uuid
  language sql stable security definer set search_path = public as
$$ select id from runs
   where driver_staff_id = current_staff_id()
      or pa_staff_id     = current_staff_id() $$;

-- ---------------------------------------------------------------------
-- 3.  COMPLIANCE  (staff credentials + vehicles + vehicle checks)
-- ---------------------------------------------------------------------
create table credentials (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references operators(id) on delete cascade,
  staff_id      uuid not null references staff(id) on delete cascade,
  kind          text not null,                 -- 'Enhanced DBS', 'PATS', ...
  reference     text,
  expiry_date   date not null,
  last_checked  date,                          -- when office verified original
  verified_by   text,
  document_path text                           -- key in private storage bucket
);

create table vehicles (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  reg         text not null,
  description text
);

create table vehicle_checks (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references operators(id) on delete cascade,
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  kind          text not null,                 -- 'MOT','Insurance','Road tax'...
  reference     text,
  expiry_date   date not null,
  last_checked  date,
  document_path text
);

-- ---------------------------------------------------------------------
-- 4.  RUNS + CHILDREN  (data minimisation by table split)
--     children        = operational, low-sensitivity (initials, area)
--     children_pii    = name + full address  (driver needs it, PA does not)
--     care_plans      = SPECIAL CATEGORY (health/disability) — need-to-know
-- ---------------------------------------------------------------------
create table runs (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null references operators(id) on delete cascade,
  name            text not null,
  school          text,
  council         text,
  window_text     text,
  driver_staff_id uuid references staff(id),
  pa_staff_id     uuid references staff(id),
  vehicle_id      uuid references vehicles(id),
  daily_rate      numeric(8,2)                  -- what the council pays per delivered day
);

create table children (
  id               uuid primary key default gen_random_uuid(),
  operator_id      uuid not null references operators(id) on delete cascade,
  run_id           uuid not null references runs(id) on delete cascade,
  display_name     text not null,              -- 'Jamie B.'  (minimised)
  tag              text,                        -- 'WAV','Sensory',...
  pickup_area      text,                        -- 'Hurst Ln, Tipton' (no number)
  scheduled_pickup time
);

create table children_pii (
  child_id     uuid primary key references children(id) on delete cascade,
  operator_id  uuid not null references operators(id) on delete cascade,
  full_name    text,
  home_address text                             -- full address (driver + mgr)
);

create table care_plans (
  child_id      uuid primary key references children(id) on delete cascade,
  operator_id   uuid not null references operators(id) on delete cascade,
  summary       text,
  communication text,
  medical       text,                           -- special category data
  behaviour     text,
  contacts      text
);

-- ---------------------------------------------------------------------
-- 5.  OPERATIONS  (boardings, incidents, parent contacts + updates)
-- ---------------------------------------------------------------------
create table boardings (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references operators(id) on delete cascade,
  run_id       uuid not null references runs(id) on delete cascade,
  child_id     uuid not null references children(id) on delete cascade,
  service_date date not null default current_date,
  state        board_state not null default 'waiting',
  boarded_at   timestamptz,
  boarded_loc  text,
  dropped_at   timestamptz,
  dropped_loc  text,
  recorded_by  uuid references profiles(id)
);

create table incidents (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid not null references operators(id) on delete cascade,
  run_id         uuid not null references runs(id) on delete cascade,
  child_id       uuid references children(id),
  kind           text not null,
  severity       incident_sev not null,
  description    text not null,
  photo_path     text,                          -- private bucket key
  raised_by      uuid references profiles(id),
  raised_by_name text,                          -- denormalised for display/export
  status         text not null default 'logged',
  created_at     timestamptz not null default now()
);

create table parent_contacts (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references operators(id) on delete cascade,
  child_id     uuid not null references children(id) on delete cascade,
  name         text,
  push_token   text,                            -- app push (Expo/FCM)
  phone        text,                            -- SMS fallback
  consent_app  boolean not null default false,  -- opt-in per channel
  consent_sms  boolean not null default false
);

-- what was actually sent to parents (the manager's "Parent updates" feed).
-- Written mainly by the `notify` Edge Function (service role); the message
-- text is deliberately minimised — display name + school, never address.
create table parent_updates (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references operators(id) on delete cascade,
  child_id     uuid not null references children(id) on delete cascade,
  run_id       uuid not null references runs(id) on delete cascade,
  kind         text not null,                   -- 'onboard' | 'arrived' | 'eta'
  channels     text not null,                   -- 'app + sms', 'app', 'sms', 'not sent — no consent'
  message      text not null,
  sent_at      timestamptz not null default now(),
  sent_by_name text
);

-- ---------------------------------------------------------------------
-- 6.  COMMERCIAL  (director only)
-- ---------------------------------------------------------------------
create table invoices (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references operators(id) on delete cascade,
  council      text,
  run_label    text,
  period       text,
  amount       numeric(10,2),
  status       text not null default 'draft'
);

create table tenders (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references operators(id) on delete cascade,
  reference    text,
  council      text,
  kind         text,
  close_date   date,
  value_text   text,
  status       text not null default 'open'
);

-- delivered_days: the billing bridge. The director may NEVER read boardings
-- or child rows (see the matrix), yet invoices are "days delivered × daily
-- rate". This SECURITY DEFINER function counts distinct completed service
-- dates per run for the caller's operator and returns only run-level,
-- non-personal figures — the director bills without touching child data.
create or replace function delivered_days(p_period text)  -- 'YYYY-MM'
returns table(run_id uuid, run_name text, council text, days integer, daily_rate numeric)
language plpgsql stable security definer set search_path = public as
$$
begin
  if current_role_aegis() is null
     or current_role_aegis() not in ('director','manager') then
    raise exception 'delivered_days: only directors and managers may call this';
  end if;
  return query
    select r.id,
           r.name,
           r.council,
           count(distinct b.service_date)::integer,
           r.daily_rate
    from runs r
    join boardings b
      on b.run_id = r.id
     and b.state  = 'dropped'
     and to_char(b.service_date, 'YYYY-MM') = p_period
    where r.operator_id = current_operator()
    group by r.id, r.name, r.council, r.daily_rate;
end;
$$;

-- ---------------------------------------------------------------------
-- 7.  AUDIT LOG  (append-only — the accountability backbone)
-- ---------------------------------------------------------------------
create table audit_log (
  id          bigint generated always as identity primary key,
  operator_id uuid not null references operators(id) on delete cascade,
  actor_id    uuid references profiles(id),
  actor_role  app_role,
  actor_name  text,                             -- denormalised so the log reads even if the profile goes
  action      text not null,
  entity      text,
  created_at  timestamptz not null default now()
);

-- =====================================================================
--  8.  ROW-LEVEL SECURITY
--      Enable on every table, then write policies. Default-deny:
--      with RLS on and no matching policy, the row is invisible.
-- =====================================================================
alter table operators      enable row level security;
alter table staff          enable row level security;
alter table profiles       enable row level security;
alter table credentials    enable row level security;
alter table vehicles       enable row level security;
alter table vehicle_checks enable row level security;
alter table runs           enable row level security;
alter table children       enable row level security;
alter table children_pii   enable row level security;
alter table care_plans     enable row level security;
alter table boardings      enable row level security;
alter table incidents      enable row level security;
alter table parent_contacts enable row level security;
alter table parent_updates enable row level security;
alter table invoices       enable row level security;
alter table tenders        enable row level security;
alter table audit_log      enable row level security;

-- ---- everyone may read their own profile ----------------------------
create policy profiles_self on profiles
  for select using (id = auth.uid());

-- ---- STAFF: manager reads all (compliance vault); staff see own row -
create policy staff_manager on staff
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');
create policy staff_own on staff
  for select using (operator_id = current_operator() and id = current_staff_id());

-- ---- COMPLIANCE: manager full; director none; driver/PA own only ----
create policy creds_manager on credentials
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');

create policy creds_own on credentials
  for select using (operator_id = current_operator() and staff_id = current_staff_id());

create policy vehicles_ops on vehicles
  for select using (operator_id = current_operator()
                    and current_role_aegis() in ('manager','driver'));
create policy vehicles_manager_write on vehicles
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');

create policy vchecks_ops on vehicle_checks
  for select using (operator_id = current_operator()
                    and current_role_aegis() in ('manager','driver'));
create policy vchecks_manager_write on vehicle_checks
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');

-- ---- RUNS: manager all; driver/PA only their assigned run ----------
create policy runs_manager on runs
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');
create policy runs_assigned on runs
  for select using (operator_id = current_operator() and id in (select my_run_ids()));

-- ---- CHILDREN (operational, low sensitivity) -----------------------
create policy children_manager on children
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');
create policy children_run_staff on children
  for select using (operator_id = current_operator()
                    and run_id in (select my_run_ids()));   -- driver + PA

-- ---- CHILDREN_PII (name + address): manager + DRIVER only, never PA -
create policy pii_manager on children_pii
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');
create policy pii_driver on children_pii
  for select using (
    operator_id = current_operator()
    and current_role_aegis() = 'driver'
    and child_id in (select id from children where run_id in (select my_run_ids()))
  );
-- (no PA policy: a passenger assistant cannot read full name/address)

-- ---- CARE PLANS (special category): manager + run staff, never director
create policy care_manager on care_plans
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');
create policy care_run_staff on care_plans
  for select using (
    operator_id = current_operator()
    and current_role_aegis() in ('driver','pa')
    and child_id in (select id from children where run_id in (select my_run_ids()))
  );

-- ---- BOARDINGS: manager read all; PA read+write own run; driver read own
create policy board_manager on boardings
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');
create policy board_pa_rw on boardings
  for all using (operator_id = current_operator() and current_role_aegis() = 'pa'
                 and run_id in (select my_run_ids()))
  with check (operator_id = current_operator() and current_role_aegis() = 'pa'
                 and run_id in (select my_run_ids()));
create policy board_driver_read on boardings
  for select using (operator_id = current_operator() and current_role_aegis() = 'driver'
                    and run_id in (select my_run_ids()));

-- ---- INCIDENTS: manager all; run staff create + read own run -------
create policy inc_manager on incidents
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');
create policy inc_run_staff_read on incidents
  for select using (operator_id = current_operator()
                    and current_role_aegis() in ('driver','pa')
                    and run_id in (select my_run_ids()));
create policy inc_run_staff_create on incidents
  for insert with check (operator_id = current_operator()
                    and current_role_aegis() in ('driver','pa')
                    and run_id in (select my_run_ids()));

-- ---- PARENT CONTACTS: manager only (PII) ---------------------------
create policy parents_manager on parent_contacts
  for all using (operator_id = current_operator() and current_role_aegis() = 'manager')
  with check (operator_id = current_operator() and current_role_aegis() = 'manager');

-- ---- PARENT UPDATES: manager reads the feed; manager + own-run staff
--      may insert (the notify Edge Function inserts with the service role
--      anyway, so this mainly covers direct/offline writes). No update or
--      delete policy — like the audit log, the feed is append-only.
create policy pupdates_manager_read on parent_updates
  for select using (operator_id = current_operator() and current_role_aegis() = 'manager');
create policy pupdates_insert on parent_updates
  for insert with check (
    operator_id = current_operator()
    and (current_role_aegis() = 'manager'
         or (current_role_aegis() in ('driver','pa')
             and run_id in (select my_run_ids())))
  );

-- ---- COMMERCIAL: director only -------------------------------------
create policy inv_director on invoices
  for all using (operator_id = current_operator() and current_role_aegis() = 'director')
  with check (operator_id = current_operator() and current_role_aegis() = 'director');
create policy tenders_director on tenders
  for all using (operator_id = current_operator() and current_role_aegis() = 'director')
  with check (operator_id = current_operator() and current_role_aegis() = 'director');

-- ---- AUDIT LOG: managers read; everyone inserts; NO ONE updates/deletes
create policy audit_read on audit_log
  for select using (operator_id = current_operator()
                    and current_role_aegis() in ('manager','director'));
create policy audit_insert on audit_log
  for insert with check (operator_id = current_operator());
-- deliberately NO update/delete policy -> the log is append-only.
revoke update, delete on audit_log from authenticated;

-- =====================================================================
--  9.  STORAGE (certificates + incident photos)
--      Create a PRIVATE bucket 'records'. Files are NEVER public.
--      The app requests a signed URL (e.g. 60s) when a record is opened.
--      Path convention: <operator_id>/<entity>/<file>  so the policy can
--      check the caller belongs to that operator.
-- =====================================================================
insert into storage.buckets (id, name, public) values ('records','records', false)
  on conflict (id) do nothing;

create policy records_same_operator on storage.objects
  for select using (
    bucket_id = 'records'
    and (storage.foldername(name))[1] = current_operator()::text
    and current_role_aegis() in ('manager','director')
  );

-- Anyone in the operator may UPLOAD into their own operator's folder —
-- drivers and PAs attach incident photos from the vehicle. The folder
-- prefix check stops uploads landing in another tenant's tree.
create policy records_upload_same_operator on storage.objects
  for insert with check (
    bucket_id = 'records'
    and (storage.foldername(name))[1] = current_operator()::text
  );

-- Drivers/PAs may read back an object THEY uploaded (e.g. to preview the
-- incident photo they just attached) — but nobody else's files.
create policy records_read_own_upload on storage.objects
  for select using (
    bucket_id = 'records'
    and owner = auth.uid()
  );

-- =====================================================================
-- 10.  RETENTION  (data minimisation over time)
--      Don't hoard. Purge old boarding rows automatically. Requires the
--      pg_cron extension (enable it in the Supabase dashboard first).
--      Tune the interval to your DPIA-agreed retention period.
-- =====================================================================
-- select cron.schedule(
--   'purge-old-boardings', '0 3 * * *',
--   $$ delete from boardings
--      where service_date < current_date - interval '180 days'
--        and id not in (select b.id from boardings b
--                       join incidents i on i.run_id = b.run_id
--                       and i.child_id = b.child_id) $$
-- );

-- =====================================================================
--  NEXT STEPS (outside SQL)
--  * Set project region to London/EU.
--  * Front end: call supabase-js; the same queries return different rows
--    per role automatically — you delete most of the UI gating code.
--  * Sign-up: create the auth user, then insert their profiles row with
--    operator_id + role (do this server-side / via an invite flow, never
--    let a user set their own role).
--  * Deploy the `notify` Edge Function with TWILIO_* secrets set via
--    `supabase secrets set` — provider keys never reach the client.
--  * Write every state change to audit_log from an Edge Function or
--    a trigger so it can't be skipped.
--  * Get a data-protection specialist to review before real data goes in.
-- =====================================================================
