-- =====================================================================
--  Aegis RLS test suite — proves the access matrix at the database level
-- ---------------------------------------------------------------------
--  Runs entirely inside one transaction and ROLLS BACK at the end, so it
--  never leaves data behind. It seeds its own fixture (two operators,
--  fake auth users, runs, children) with fixed UUIDs, then impersonates
--  each role the same way PostgREST does: set the `request.jwt.claims`
--  GUC (so auth.uid() resolves) and switch to the `authenticated` role
--  (so RLS and grants actually apply — superuser would bypass them).
--
--  HOW TO RUN (local stack):
--    1. supabase start
--    2. supabase db reset          # loads the schema (+ seed)
--    3. psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--         -v ON_ERROR_STOP=1 -f supabase/tests/rls_tests.sql
--
--  Every check RAISES EXCEPTION with a clear message on failure and a
--  NOTICE on success. If the script reaches "ALL RLS TESTS PASSED",
--  the matrix holds.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  Impersonation helper. `true` = transaction-local, so everything is
--  undone by the final rollback. Call it as postgres, then run queries;
--  they execute exactly as that signed-in user would through the API.
-- ---------------------------------------------------------------------
create function tests_impersonate(uid uuid) returns void
language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end
$fn$;

-- ---------------------------------------------------------------------
--  Fixture. Inserted as postgres (table owner), so RLS does not apply.
--  Inserting bare ids into auth.users works on a local stack and is
--  enough to satisfy the profiles foreign key.
-- ---------------------------------------------------------------------
insert into operators (id, name) values
  ('11111111-1111-1111-1111-111111111101', 'Test Operator One'),
  ('11111111-1111-1111-1111-111111111102', 'Test Operator Two');

insert into staff (id, operator_id, full_name, role) values
  ('11111111-1111-1111-1111-111111111201', '11111111-1111-1111-1111-111111111101', 'Test Driver', 'driver'),
  ('11111111-1111-1111-1111-111111111202', '11111111-1111-1111-1111-111111111101', 'Test PA',     'pa');

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111301'),   -- manager, operator 1
  ('11111111-1111-1111-1111-111111111302'),   -- director, operator 1
  ('11111111-1111-1111-1111-111111111303'),   -- driver,  operator 1, run 1
  ('11111111-1111-1111-1111-111111111304'),   -- pa,      operator 1, run 1
  ('11111111-1111-1111-1111-111111111305');   -- manager, operator 2

insert into profiles (id, operator_id, staff_id, role, full_name) values
  ('11111111-1111-1111-1111-111111111301', '11111111-1111-1111-1111-111111111101', null, 'manager',  'Test Manager'),
  ('11111111-1111-1111-1111-111111111302', '11111111-1111-1111-1111-111111111101', null, 'director', 'Test Director'),
  ('11111111-1111-1111-1111-111111111303', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111201', 'driver', 'Test Driver'),
  ('11111111-1111-1111-1111-111111111304', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111202', 'pa',     'Test PA'),
  ('11111111-1111-1111-1111-111111111305', '11111111-1111-1111-1111-111111111102', null, 'manager',  'Rival Manager');

-- Run 1 is crewed by the test driver + PA; run 2 has no assigned staff.
insert into runs (id, operator_id, name, school, council, daily_rate, driver_staff_id, pa_staff_id) values
  ('11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111101', 'Test Run 1', 'Test School', 'Test MBC', 100.00,
   '11111111-1111-1111-1111-111111111201', '11111111-1111-1111-1111-111111111202'),
  ('11111111-1111-1111-1111-111111111402', '11111111-1111-1111-1111-111111111101', 'Test Run 2', 'Other School', 'Test MBC', 90.00,
   null, null);

insert into children (id, operator_id, run_id, display_name) values
  ('11111111-1111-1111-1111-111111111501', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', 'Child A.'),
  ('11111111-1111-1111-1111-111111111502', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111402', 'Child B.');

insert into children_pii (child_id, operator_id, full_name, home_address) values
  ('11111111-1111-1111-1111-111111111501', '11111111-1111-1111-1111-111111111101', 'Child Alpha', '1 Test Street'),
  ('11111111-1111-1111-1111-111111111502', '11111111-1111-1111-1111-111111111101', 'Child Beta',  '2 Test Street');

insert into care_plans (child_id, operator_id, summary) values
  ('11111111-1111-1111-1111-111111111501', '11111111-1111-1111-1111-111111111101', 'Test care plan');

insert into credentials (operator_id, staff_id, kind, expiry_date) values
  ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111201', 'Enhanced DBS', current_date + 100);

insert into boardings (id, operator_id, run_id, child_id, service_date, state) values
  ('11111111-1111-1111-1111-111111111601', '11111111-1111-1111-1111-111111111101',
   '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111501', current_date - 10, 'dropped');

-- =====================================================================
--  (a) PA must NOT read children_pii — not even for their own run
-- =====================================================================
do $$
declare n int;
begin
  perform tests_impersonate('11111111-1111-1111-1111-111111111304');
  select count(*) into n from children_pii
   where child_id = '11111111-1111-1111-1111-111111111501';
  if n <> 0 then
    raise exception 'FAIL (a): PA can read children_pii for own-run child (% rows)', n;
  end if;
  raise notice 'PASS (a): PA sees 0 children_pii rows';
end $$;
reset role;

-- =====================================================================
--  (b) Driver CAN read children_pii for a child on their own run
--      (they need the address to navigate) — but not for other runs
-- =====================================================================
do $$
declare own int; other int;
begin
  perform tests_impersonate('11111111-1111-1111-1111-111111111303');
  select count(*) into own from children_pii
   where child_id = '11111111-1111-1111-1111-111111111501';
  select count(*) into other from children_pii
   where child_id = '11111111-1111-1111-1111-111111111502';
  if own <> 1 then
    raise exception 'FAIL (b): driver should see own-run children_pii (got % rows)', own;
  end if;
  if other <> 0 then
    raise exception 'FAIL (b): driver can see children_pii off their run (% rows)', other;
  end if;
  raise notice 'PASS (b): driver sees own-run PII only';
end $$;
reset role;

-- =====================================================================
--  (c) Director: commercial only — NO child data, care plans,
--      boardings or staff compliance records
-- =====================================================================
do $$
declare n int;
begin
  perform tests_impersonate('11111111-1111-1111-1111-111111111302');
  select count(*) into n from care_plans;
  if n <> 0 then raise exception 'FAIL (c): director sees care_plans (% rows)', n; end if;
  select count(*) into n from children;
  if n <> 0 then raise exception 'FAIL (c): director sees children (% rows)', n; end if;
  select count(*) into n from boardings;
  if n <> 0 then raise exception 'FAIL (c): director sees boardings (% rows)', n; end if;
  select count(*) into n from credentials;
  if n <> 0 then raise exception 'FAIL (c): director sees credentials (% rows)', n; end if;
  raise notice 'PASS (c): director sees no operational or child data';
end $$;
reset role;

-- =====================================================================
--  (d) Driver: boarding register is READ ONLY — insert errors,
--      update silently matches no rows
-- =====================================================================
do $$
declare n int;
begin
  perform tests_impersonate('11111111-1111-1111-1111-111111111303');
  begin
    insert into boardings (operator_id, run_id, child_id, service_date)
    values ('11111111-1111-1111-1111-111111111101',
            '11111111-1111-1111-1111-111111111401',
            '11111111-1111-1111-1111-111111111501', current_date);
    raise exception 'FAIL (d): driver inserted a boarding row';
  exception when sqlstate '42501' then
    null; -- expected: no insert policy matches the driver
  end;
  update boardings set state = 'onboard'
   where id = '11111111-1111-1111-1111-111111111601';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL (d): driver updated % boarding row(s)', n;
  end if;
  raise notice 'PASS (d): driver cannot write boardings';
end $$;
reset role;

-- =====================================================================
--  (e) PA: may write boardings on their OWN run only
-- =====================================================================
do $$
begin
  perform tests_impersonate('11111111-1111-1111-1111-111111111304');
  -- own run: allowed
  insert into boardings (operator_id, run_id, child_id, service_date, state, recorded_by)
  values ('11111111-1111-1111-1111-111111111101',
          '11111111-1111-1111-1111-111111111401',
          '11111111-1111-1111-1111-111111111501', current_date, 'onboard',
          '11111111-1111-1111-1111-111111111304');
  -- another run: refused by the with-check clause
  begin
    insert into boardings (operator_id, run_id, child_id, service_date)
    values ('11111111-1111-1111-1111-111111111101',
            '11111111-1111-1111-1111-111111111402',
            '11111111-1111-1111-1111-111111111502', current_date);
    raise exception 'FAIL (e): PA inserted a boarding for a run they are not on';
  exception when sqlstate '42501' then
    null; -- expected
  end;
  raise notice 'PASS (e): PA writes own-run boardings only';
end $$;
reset role;

-- =====================================================================
--  (f) Runs: manager sees every run; PA sees only their assigned run
-- =====================================================================
do $$
declare n int; rid uuid;
begin
  perform tests_impersonate('11111111-1111-1111-1111-111111111301');
  select count(*) into n from runs;
  if n <> 2 then raise exception 'FAIL (f): manager should see 2 runs, saw %', n; end if;
  perform tests_impersonate('11111111-1111-1111-1111-111111111304');
  select count(*) into n from runs;
  if n <> 1 then raise exception 'FAIL (f): PA should see 1 run, saw %', n; end if;
  select id into rid from runs;
  if rid <> '11111111-1111-1111-1111-111111111401' then
    raise exception 'FAIL (f): PA sees the wrong run (%)', rid;
  end if;
  raise notice 'PASS (f): run visibility matches assignment';
end $$;
reset role;

-- =====================================================================
--  (g) Multi-tenant isolation: the second operator's manager sees NOTHING of
--      operator 1 — not staff, runs or children
-- =====================================================================
do $$
declare n int;
begin
  perform tests_impersonate('11111111-1111-1111-1111-111111111305');
  select count(*) into n from staff;    -- all fixture staff belong to op 1
  if n <> 0 then raise exception 'FAIL (g): rival manager sees % staff row(s)', n; end if;
  select count(*) into n from runs;
  if n <> 0 then raise exception 'FAIL (g): rival manager sees % run(s)', n; end if;
  select count(*) into n from children;
  if n <> 0 then raise exception 'FAIL (g): rival manager sees % child(ren)', n; end if;
  raise notice 'PASS (g): cross-operator isolation holds';
end $$;
reset role;

-- =====================================================================
--  (h) Audit log: append-only. Any role inserts; PA cannot read;
--      nobody — not even the manager — updates or deletes
-- =====================================================================
do $$
declare n int;
begin
  -- PA can insert but not read back
  perform tests_impersonate('11111111-1111-1111-1111-111111111304');
  insert into audit_log (operator_id, actor_id, actor_role, actor_name, action)
  values ('11111111-1111-1111-1111-111111111101',
          '11111111-1111-1111-1111-111111111304', 'pa', 'Test PA', 'rls-test entry');
  select count(*) into n from audit_log;
  if n <> 0 then raise exception 'FAIL (h): PA can read the audit log (% rows)', n; end if;

  -- manager can read, but update/delete are refused outright
  perform tests_impersonate('11111111-1111-1111-1111-111111111301');
  select count(*) into n from audit_log where action = 'rls-test entry';
  if n <> 1 then raise exception 'FAIL (h): manager cannot see the audit entry'; end if;
  begin
    update audit_log set action = 'tampered' where action = 'rls-test entry';
    raise exception 'FAIL (h): audit_log row was updated';
  exception when sqlstate '42501' then
    null; -- expected: update privilege revoked
  end;
  begin
    delete from audit_log where action = 'rls-test entry';
    raise exception 'FAIL (h): audit_log row was deleted';
  exception when sqlstate '42501' then
    null; -- expected: delete privilege revoked
  end;
  raise notice 'PASS (h): audit log is append-only';
end $$;
reset role;

do $$ begin raise notice '=== ALL RLS TESTS PASSED ==='; end $$;

-- Leave no trace: fixture, helper function and GUCs all vanish here.
rollback;
