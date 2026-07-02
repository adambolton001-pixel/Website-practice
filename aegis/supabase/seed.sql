-- =====================================================================
--  Aegis demo seed — run AFTER aegis-backend-schema.sql
--  Paste into the Supabase SQL editor. It runs as the service role, so
--  it bypasses RLS for the initial insert. One operator, four staff,
--  two runs, six children. Dates are relative to "today" so the
--  compliance colours always show a live mix.
-- =====================================================================

insert into operators (id, name) values
  ('00000000-0000-0000-0000-0000000000ff', 'Greenway SEND Transport');

insert into staff (id, operator_id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000ff', 'Maria Okafor',     'pa'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000ff', 'Darren Whitlock',  'driver'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000ff', 'Priya Sharma',     'driver'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000ff', 'Tom Carey',        'pa');

insert into vehicles (id, operator_id, reg, description) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000ff', 'BV21 PHX', '8-seat WAV'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000ff', 'KX68 TRM', '6-seat minibus');

insert into runs (id, operator_id, name, school, council, window_text, driver_staff_id, pa_staff_id, vehicle_id, daily_rate) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000ff',
   'AM Run 1', 'Oakfield Specialist School', 'Sandwell MBC', '07:50 - 08:45',
   '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000b1', 128.00),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000ff',
   'AM Run 2', 'Rowan Park School', 'Dudley MBC', '07:40 - 08:35',
   '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4',
   '00000000-0000-0000-0000-0000000000b2', 116.00);

insert into credentials (operator_id, staff_id, kind, reference, expiry_date, last_checked, verified_by) values
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a1','Enhanced DBS','001847 2231 0094',current_date+212,current_date-20,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a1','PATS certificate','PAT-22-7741',current_date+18,current_date-20,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a1','Safeguarding (NSPCC)','SG-2024-8830',current_date+96,current_date-20,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a2','Enhanced DBS','001847 9920 1183',current_date+330,current_date-15,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a2','Driving licence','WHITL 8 09 23 D',current_date+401,current_date-15,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a2','Safeguarding (NSPCC)','SG-2024-9001',current_date-6,current_date-40,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a3','Enhanced DBS','001847 4415 0272',current_date+265,current_date-12,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a3','Driving licence','SHARM 7 03 24 P',current_date+512,current_date-12,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a3','First aid (EFAW)','FA-2025-1187',current_date+27,current_date-12,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a4','Enhanced DBS','001847 6103 0518',current_date+154,current_date-25,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a4','PATS certificate','PAT-23-2216',current_date+188,current_date-25,'S. Price'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a4','Safeguarding (NSPCC)','SG-2025-0142',current_date+61,current_date-25,'S. Price');

insert into vehicle_checks (operator_id, vehicle_id, kind, reference, expiry_date, last_checked) values
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000b1','MOT','MOT-BV21PHX',current_date+25,current_date-30),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000b1','Insurance','POL-44120-WM',current_date+140,current_date-30),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000b1','Road tax (VED)','VED-BV21PHX',current_date-2,current_date-30),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000b2','MOT','MOT-KX68TRM',current_date+204,current_date-10),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000b2','Insurance','POL-44121-WM',current_date+140,current_date-10),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000b2','Road tax (VED)','VED-KX68TRM',current_date+19,current_date-10);

insert into children (id, operator_id, run_id, display_name, tag, pickup_area, scheduled_pickup) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c1','Jamie B.','WAV','Hurst Ln, Tipton','07:55'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c1','Aisha M.','Sensory','Beech Rd, Tividale','08:02'),
  ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c1','Leo H.','Care plan','Sedgley Rd, Tipton','08:10'),
  ('00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c2','Freya S.','Harness','Priory Rd, Dudley','07:48'),
  ('00000000-0000-0000-0000-0000000000d5','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c2','Omar K.','WAV','Bean Rd, Coseley','07:56'),
  ('00000000-0000-0000-0000-0000000000d6','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c2','Poppy T.','Sensory','Vicarage Rd, Sedgley','08:05');

insert into children_pii (child_id, operator_id, full_name, home_address) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000ff','Jamie Booth','14 Hurst Lane, Tipton DY4 8AB'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000ff','Aisha Mahmood','7 Beech Road, Tividale B69 2LR'),
  ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000ff','Leo Hughes','52 Sedgley Road West, Tipton DY4 8AN'),
  ('00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000ff','Freya Sanders','21 Priory Road, Dudley DY1 4AB'),
  ('00000000-0000-0000-0000-0000000000d5','00000000-0000-0000-0000-0000000000ff','Omar Khan','3 Bean Road, Coseley WV14 9DE'),
  ('00000000-0000-0000-0000-0000000000d6','00000000-0000-0000-0000-0000000000ff','Poppy Turner','18 Vicarage Road, Sedgley DY3 1JN');

insert into care_plans (child_id, operator_id, summary, communication, medical, behaviour, contacts) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000ff','Uses a powered wheelchair; needs ramp and four-point securing.','Limited verbal; responds to calm voice and visual cues.','Epilepsy - emergency plan in glovebox folder.','Anxious if route changes; reassure calmly.','Mum (Sarah) - primary. School: Mrs Hill.'),
  ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000ff','Severe nut allergy - no food or drink on board.','Non-verbal; uses a communication card.','Carries an EpiPen; staff trained in use.','Settled traveller.','Mum (Claire) - primary. School: Mrs Adeyemi.'),
  ('00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000ff','Travels in a five-point harness fitted to the middle row.','Verbal but very quiet; prefers yes/no questions.','Asthma - inhaler in school bag side pocket.','May undo the harness if unsettled; seat next to the PA.','Dad (Mark) - primary. School: Mr Ellis.'),
  ('00000000-0000-0000-0000-0000000000d6','00000000-0000-0000-0000-0000000000ff','Sensory needs; travels with ear defenders on.','Uses Makaton signs for "stop" and "more".','No medication carried.','Distressed by loud radio or sudden braking; keep the cabin quiet.','Gran (Pat) - primary. School: Miss Rowe.');

-- A couple of raised incidents so the manager's list isn't empty. Because
-- profiles don't exist at seed time, raised_by stays null and the
-- denormalised raised_by_name carries the attribution instead.
insert into incidents (operator_id, run_id, child_id, kind, severity, description, raised_by_name, status) values
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d2',
   'Seatbelt / harness','med','Aisha released her seatbelt twice on the Birmingham New Road. Pulled over safely, re-secured, and reassured. Suggest a harness review with school.',
   'Maria Okafor','logged'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c2',null,
   'Vehicle fault','low','Nearside sliding door sticking on first open of the morning. Freed and operated normally afterwards; booked for a workshop check.',
   'Priya Sharma','shared with council');

-- Parent contacts (manager-only PII). Consent is per family, per channel —
-- the notify Edge Function reads these server-side and never sends contact
-- details to the vehicle.
insert into parent_contacts (operator_id, child_id, name, push_token, phone, consent_app, consent_sms) values
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000d1','Sarah Booth','ExponentPushToken[demo-jamie-booth]','+447700900101',true,true),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000d3','Claire Hughes','ExponentPushToken[demo-leo-hughes]',null,true,false),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000d4','Mark Sanders',null,'+447700900104',false,true);

-- A few completed boarding days this month, so the Director's invoicing
-- screen (delivered_days = days x daily_rate) has something to bill.
insert into boardings (operator_id, run_id, child_id, service_date, state, boarded_at, boarded_loc, dropped_at, dropped_loc) values
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1',current_date-1,'dropped',current_date-1+time '07:56','Hurst Ln, Tipton',current_date-1+time '08:41','Oakfield Specialist School'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1',current_date-2,'dropped',current_date-2+time '07:57','Hurst Ln, Tipton',current_date-2+time '08:43','Oakfield Specialist School'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1',current_date-5,'dropped',current_date-5+time '07:55','Hurst Ln, Tipton',current_date-5+time '08:40','Oakfield Specialist School'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d4',current_date-1,'dropped',current_date-1+time '07:49','Priory Rd, Dudley',current_date-1+time '08:33','Rowan Park School'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d4',current_date-2,'dropped',current_date-2+time '07:50','Priory Rd, Dudley',current_date-2+time '08:35','Rowan Park School');

-- What was sent to parents (the manager's "Parent updates" feed).
insert into parent_updates (operator_id, child_id, run_id, kind, channels, message, sent_at, sent_by_name) values
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1',
   'onboard','app + sms','Jamie B. is on board and on the way to Oakfield Specialist School.', now() - interval '25 hours','Maria Okafor'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1',
   'arrived','app + sms','Jamie B. has arrived safely at Oakfield Specialist School.', now() - interval '24 hours 15 minutes','Maria Okafor'),
  ('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000c2',
   'eta','sms','The bus is about 5 minutes away from picking up Freya S.', now() - interval '25 hours 10 minutes','Priya Sharma');

insert into tenders (operator_id, reference, council, kind, close_date, value_text, status) values
  ('00000000-0000-0000-0000-0000000000ff','DUD-SEN-RT-118','Dudley MBC','Spot route',current_date+2,'£18k / yr','bid'),
  ('00000000-0000-0000-0000-0000000000ff','SAN-HTST-2026-04','Sandwell MBC','Framework (DPS)',current_date+9,'~£140k / yr','open');

insert into invoices (operator_id, council, run_label, period, amount, status) values
  ('00000000-0000-0000-0000-0000000000ff','Sandwell MBC','AM/PM Run 1 - Oakfield','May 2026',3198.00,'paid');

-- =====================================================================
--  USERS
--  Auth users can't be seeded with a password from SQL. Create them in
--  the dashboard (Authentication -> Users -> Add user), then link each
--  to a profile here using their auth UID. NEVER let a user pick their
--  own role — set it server-side like this.
--
--  Passenger assistant (linked to staff a1):
--  insert into profiles (id, operator_id, staff_id, role, full_name) values
--    ('<AUTH-UID>','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a1','pa','Maria Okafor');
--
--  Driver (linked to staff a2):
--  insert into profiles (id, operator_id, staff_id, role, full_name) values
--    ('<AUTH-UID>','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a2','driver','Darren Whitlock');
--
--  Second crew (staff a3 / a4), if you want a login per run:
--  insert into profiles (id, operator_id, staff_id, role, full_name) values
--    ('<AUTH-UID>','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a3','driver','Priya Sharma');
--  insert into profiles (id, operator_id, staff_id, role, full_name) values
--    ('<AUTH-UID>','00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-0000000000a4','pa','Tom Carey');
--
--  Manager / Director (no staff link):
--  insert into profiles (id, operator_id, role, full_name) values
--    ('<AUTH-UID>','00000000-0000-0000-0000-0000000000ff','manager','Sam Price');
--  insert into profiles (id, operator_id, role, full_name) values
--    ('<AUTH-UID>','00000000-0000-0000-0000-0000000000ff','director','Owner');
-- =====================================================================
