import type {
  AuditEntry,
  Boarding,
  CarePlan,
  ChildPII,
  Credential,
  Incident,
  Invoice,
  ParentContact,
  ParentUpdate,
  Profile,
  Tender,
} from '../../lib/types';

// Flat, schema-shaped demo dataset. Dates are computed relative to "now"
// at seed time so compliance colours and deadlines always show a live mix.

export interface DemoRun {
  id: string;
  name: string;
  school: string | null;
  council: string | null;
  windowText: string | null;
  driverStaffId: string | null;
  paStaffId: string | null;
  vehicleId: string | null;
  dailyRate: number | null;
}

export interface DemoStaff {
  id: string;
  fullName: string;
  role: 'driver' | 'pa';
}

export interface DemoVehicle {
  id: string;
  reg: string;
  description: string | null;
}

export interface DemoChild {
  id: string;
  runId: string;
  displayName: string;
  tag: string | null;
  pickupArea: string | null;
  scheduledPickup: string | null;
}

export interface DemoData {
  version: number;
  operatorId: string;
  operatorName: string;
  profiles: Profile[];
  staff: DemoStaff[];
  vehicles: DemoVehicle[];
  credentials: Credential[];
  vehicleChecks: {
    id: string;
    vehicleId: string;
    kind: string;
    reference: string | null;
    expiryDate: string;
    lastChecked: string | null;
    documentPath: string | null;
  }[];
  runs: DemoRun[];
  children: DemoChild[];
  childrenPii: ChildPII[];
  carePlans: CarePlan[];
  boardings: Boarding[];
  incidents: Incident[];
  parentContacts: ParentContact[];
  parentUpdates: ParentUpdate[];
  invoices: Invoice[];
  tenders: Tender[];
  auditLog: AuditEntry[];
  /** private "bucket": path -> data URL (only used for user uploads) */
  files: Record<string, string>;
}

export const DEMO_VERSION = 3;
const OP = 'op-greenway';

const iso = (offsetDays: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const ts = (offsetDays: number, hh: number, mm: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
};

export function buildSeed(): DemoData {
  const profiles: Profile[] = [
    { id: 'p-director', operatorId: OP, staffId: null, role: 'director', fullName: 'Robert Hale' },
    { id: 'p-manager', operatorId: OP, staffId: null, role: 'manager', fullName: 'Sam Price' },
    { id: 'p-driver', operatorId: OP, staffId: 'a2', role: 'driver', fullName: 'Darren Whitlock' },
    { id: 'p-pa', operatorId: OP, staffId: 'a1', role: 'pa', fullName: 'Maria Okafor' },
  ];

  const staff: DemoStaff[] = [
    { id: 'a1', fullName: 'Maria Okafor', role: 'pa' },
    { id: 'a2', fullName: 'Darren Whitlock', role: 'driver' },
    { id: 'a3', fullName: 'Priya Sharma', role: 'driver' },
    { id: 'a4', fullName: 'Tom Carey', role: 'pa' },
  ];

  const vehicles: DemoVehicle[] = [
    { id: 'b1', reg: 'BV21 PHX', description: '8-seat WAV' },
    { id: 'b2', reg: 'KX68 TRM', description: '16-seat minibus' },
  ];

  const credentials: Credential[] = [
    // Maria (PA)
    { id: 'cr1', staffId: 'a1', kind: 'Enhanced DBS', reference: '001847 2231 0094', expiryDate: iso(212), lastChecked: iso(-20), verifiedBy: 'S. Price', documentPath: 'demo/dbs-maria.pdf' },
    { id: 'cr2', staffId: 'a1', kind: 'PATS certificate', reference: 'PAT-22-7741', expiryDate: iso(18), lastChecked: iso(-20), verifiedBy: 'S. Price', documentPath: null },
    { id: 'cr3', staffId: 'a1', kind: 'Safeguarding (NSPCC)', reference: 'SG-2024-8830', expiryDate: iso(96), lastChecked: iso(-20), verifiedBy: 'S. Price', documentPath: null },
    { id: 'cr4', staffId: 'a1', kind: 'First aid (EFAW)', reference: 'FA-2025-1102', expiryDate: iso(340), lastChecked: iso(-20), verifiedBy: 'S. Price', documentPath: null },
    // Darren (driver)
    { id: 'cr5', staffId: 'a2', kind: 'Enhanced DBS', reference: '001847 9920 1183', expiryDate: iso(330), lastChecked: iso(-15), verifiedBy: 'S. Price', documentPath: 'demo/dbs-darren.pdf' },
    { id: 'cr6', staffId: 'a2', kind: 'Driving licence (D1)', reference: 'WHITL 8 09 23 D', expiryDate: iso(401), lastChecked: iso(-15), verifiedBy: 'S. Price', documentPath: null },
    { id: 'cr7', staffId: 'a2', kind: 'Safeguarding (NSPCC)', reference: 'SG-2024-9001', expiryDate: iso(-6), lastChecked: iso(-40), verifiedBy: 'S. Price', documentPath: null },
    // Priya (driver)
    { id: 'cr8', staffId: 'a3', kind: 'Enhanced DBS', reference: '001901 4417 2210', expiryDate: iso(122), lastChecked: iso(-9), verifiedBy: 'S. Price', documentPath: null },
    { id: 'cr9', staffId: 'a3', kind: 'Driving licence (D1)', reference: 'SHARM 7 02 21 P', expiryDate: iso(760), lastChecked: iso(-9), verifiedBy: 'S. Price', documentPath: null },
    { id: 'cr10', staffId: 'a3', kind: 'Safeguarding (NSPCC)', reference: 'SG-2025-0114', expiryDate: iso(28), lastChecked: iso(-9), verifiedBy: 'S. Price', documentPath: null },
    // Tom (PA)
    { id: 'cr11', staffId: 'a4', kind: 'Enhanced DBS', reference: '001855 3308 5521', expiryDate: iso(64), lastChecked: iso(-31), verifiedBy: 'S. Price', documentPath: null },
    { id: 'cr12', staffId: 'a4', kind: 'PATS certificate', reference: 'PAT-23-0912', expiryDate: iso(190), lastChecked: iso(-31), verifiedBy: 'S. Price', documentPath: null },
    { id: 'cr13', staffId: 'a4', kind: 'Safeguarding (NSPCC)', reference: 'SG-2024-7719', expiryDate: iso(11), lastChecked: iso(-31), verifiedBy: 'S. Price', documentPath: null },
  ];

  const vehicleChecks: DemoData['vehicleChecks'] = [
    { id: 'vc1', vehicleId: 'b1', kind: 'MOT', reference: 'MOT-BV21PHX', expiryDate: iso(25), lastChecked: iso(-30), documentPath: null },
    { id: 'vc2', vehicleId: 'b1', kind: 'Insurance', reference: 'POL-44120-WM', expiryDate: iso(140), lastChecked: iso(-30), documentPath: null },
    { id: 'vc3', vehicleId: 'b1', kind: 'Road tax (VED)', reference: 'VED-BV21PHX', expiryDate: iso(-2), lastChecked: iso(-30), documentPath: null },
    { id: 'vc4', vehicleId: 'b1', kind: 'Private-hire plate', reference: 'SAN-PH-08841', expiryDate: iso(233), lastChecked: iso(-30), documentPath: null },
    { id: 'vc5', vehicleId: 'b2', kind: 'MOT', reference: 'MOT-KX68TRM', expiryDate: iso(301), lastChecked: iso(-12), documentPath: null },
    { id: 'vc6', vehicleId: 'b2', kind: 'Insurance', reference: 'POL-44121-WM', expiryDate: iso(140), lastChecked: iso(-12), documentPath: null },
    { id: 'vc7', vehicleId: 'b2', kind: 'Road tax (VED)', reference: 'VED-KX68TRM', expiryDate: iso(74), lastChecked: iso(-12), documentPath: null },
    { id: 'vc8', vehicleId: 'b2', kind: 'Private-hire plate', reference: 'DUD-PH-02217', expiryDate: iso(17), lastChecked: iso(-12), documentPath: null },
  ];

  const runs: DemoRun[] = [
    { id: 'c1', name: 'AM Run 1', school: 'Oakfield Specialist School', council: 'Sandwell MBC', windowText: '07:50 – 08:45', driverStaffId: 'a2', paStaffId: 'a1', vehicleId: 'b1', dailyRate: 128 },
    { id: 'c2', name: 'AM Run 2', school: 'Rowan Park School', council: 'Dudley MBC', windowText: '07:40 – 08:35', driverStaffId: 'a3', paStaffId: 'a4', vehicleId: 'b2', dailyRate: 116 },
  ];

  const children: DemoChild[] = [
    { id: 'd1', runId: 'c1', displayName: 'Jamie B.', tag: 'WAV', pickupArea: 'Hurst Ln, Tipton', scheduledPickup: '07:55' },
    { id: 'd2', runId: 'c1', displayName: 'Aisha M.', tag: 'Sensory', pickupArea: 'Beech Rd, Tividale', scheduledPickup: '08:02' },
    { id: 'd3', runId: 'c1', displayName: 'Leo H.', tag: 'Care plan', pickupArea: 'Sedgley Rd, Tipton', scheduledPickup: '08:10' },
    { id: 'd4', runId: 'c2', displayName: 'Poppy W.', tag: 'Harness', pickupArea: 'Larch Ave, Dudley', scheduledPickup: '07:48' },
    { id: 'd5', runId: 'c2', displayName: 'Noah C.', tag: 'Sensory', pickupArea: 'Priory Rd, Dudley', scheduledPickup: '07:57' },
    { id: 'd6', runId: 'c2', displayName: 'Zainab K.', tag: 'WAV', pickupArea: 'Milking Bank, Dudley', scheduledPickup: '08:06' },
  ];

  const childrenPii: ChildPII[] = [
    { childId: 'd1', fullName: 'Jamie Booth', homeAddress: '14 Hurst Lane, Tipton DY4 8AB' },
    { childId: 'd2', fullName: 'Aisha Mahmood', homeAddress: '7 Beech Road, Tividale B69 2LR' },
    { childId: 'd3', fullName: 'Leo Hughes', homeAddress: '52 Sedgley Road West, Tipton DY4 8AN' },
    { childId: 'd4', fullName: 'Poppy Walker', homeAddress: '3 Larch Avenue, Dudley DY1 3QT' },
    { childId: 'd5', fullName: 'Noah Clarke', homeAddress: '81 Priory Road, Dudley DY1 4EH' },
    { childId: 'd6', fullName: 'Zainab Khan', homeAddress: '19 Milking Bank, Dudley DY1 2UB' },
  ];

  const carePlans: CarePlan[] = [
    { childId: 'd1', summary: 'Uses a powered wheelchair; needs ramp and four-point securing.', communication: 'Limited verbal; responds to calm voice and visual cues.', medical: 'Epilepsy — emergency plan in glovebox folder.', behaviour: 'Anxious if route changes; reassure calmly.', contacts: 'Mum (Sarah) — primary. School: Mrs Hill.' },
    { childId: 'd2', summary: 'Sensory sensitivity to noise; prefers the same seat each day.', communication: 'Verbal; may not respond when overwhelmed.', medical: 'None on record.', behaviour: 'Ear defenders help on busy roads.', contacts: 'Dad (Imran) — primary. School: Mr Okon.' },
    { childId: 'd3', summary: 'Severe nut allergy — no food or drink on board.', communication: 'Non-verbal; uses a communication card.', medical: 'Carries an EpiPen; staff trained in use.', behaviour: 'Settled traveller.', contacts: 'Mum (Claire) — primary. School: Mrs Adeyemi.' },
    { childId: 'd4', summary: 'Wears a safety harness fitted by the PA.', communication: 'Verbal, chatty; needs clear instructions.', medical: 'Asthma — inhaler in school bag.', behaviour: 'May undo seatbelt; harness check at every stop.', contacts: 'Gran (Pat) — primary. School: Miss Bevan.' },
    { childId: 'd6', summary: 'Powered wheelchair; four-point securing, left side.', communication: 'Verbal; speaks softly.', medical: 'Diabetes (type 1) — hypo kit travels with her.', behaviour: 'Settled traveller.', contacts: 'Mum (Fatima) — primary. School: Mrs Hill.' },
  ];

  // Boarding history: completed runs on past weekdays (fuels invoicing + register history)
  const boardings: Boarding[] = [];
  let bid = 0;
  for (let off = -45; off <= -1; off++) {
    const day = new Date();
    day.setDate(day.getDate() + off);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // weekends: no runs
    for (const ch of children) {
      const run = runs.find((r) => r.id === ch.runId);
      if (!run) continue;
      const [hh = 8, mm = 0] = (ch.scheduledPickup ?? '08:00').split(':').map(Number);
      boardings.push({
        id: `hb${++bid}`,
        runId: ch.runId,
        childId: ch.id,
        serviceDate: iso(off),
        state: 'dropped',
        boardedAt: ts(off, hh, mm + 2),
        boardedLoc: ch.pickupArea,
        droppedAt: ts(off, 8, 41),
        droppedLoc: run.school,
        recordedBy: ch.runId === 'c1' ? 'p-pa' : 'p-pa-tom',
      });
    }
  }

  const incidents: Incident[] = [
    {
      id: 'in1', runId: 'c1', childId: 'd2', kind: 'Distress / behaviour', severity: 'med',
      description: 'Aisha became distressed after a diversion via the A461. Calmed with ear defenders; arrived settled.',
      photoPath: null, raisedBy: 'p-pa', raisedByName: 'Maria Okafor', status: 'shared_school', createdAt: ts(-3, 8, 21),
    },
    {
      id: 'in2', runId: 'c2', childId: null, kind: 'Vehicle defect', severity: 'low',
      description: 'Nearside sliding door sticking on first open. Usable but needs looking at.',
      photoPath: null, raisedBy: 'p-driver-priya', raisedByName: 'Priya Sharma', status: 'logged', createdAt: ts(-1, 7, 44),
    },
  ];

  const parentContacts: ParentContact[] = [
    { id: 'pc1', childId: 'd1', name: 'Sarah Booth', phone: '07700 900101', pushToken: 'expo:demo-1', consentApp: true, consentSms: true },
    { id: 'pc2', childId: 'd2', name: 'Imran Mahmood', phone: '07700 900202', pushToken: 'expo:demo-2', consentApp: true, consentSms: false },
    { id: 'pc3', childId: 'd3', name: 'Claire Hughes', phone: '07700 900303', pushToken: null, consentApp: false, consentSms: true },
    { id: 'pc4', childId: 'd4', name: 'Pat Walker', phone: '07700 900404', pushToken: 'expo:demo-4', consentApp: true, consentSms: false },
    { id: 'pc5', childId: 'd5', name: 'Dan Clarke', phone: '07700 900505', pushToken: null, consentApp: false, consentSms: false },
    { id: 'pc6', childId: 'd6', name: 'Fatima Khan', phone: '07700 900606', pushToken: 'expo:demo-6', consentApp: true, consentSms: true },
  ];

  const parentUpdates: ParentUpdate[] = [
    { id: 'pu1', childId: 'd1', runId: 'c1', kind: 'onboard', channels: 'app + sms', message: 'Jamie B. is on board and on the way to Oakfield Specialist School.', sentAt: ts(-1, 7, 57), sentByName: 'Maria Okafor' },
    { id: 'pu2', childId: 'd1', runId: 'c1', kind: 'arrived', channels: 'app + sms', message: 'Jamie B. has arrived safely at Oakfield Specialist School.', sentAt: ts(-1, 8, 41), sentByName: 'Maria Okafor' },
    { id: 'pu3', childId: 'd2', runId: 'c1', kind: 'onboard', channels: 'app', message: 'Aisha M. is on board and on the way to Oakfield Specialist School.', sentAt: ts(-1, 8, 3), sentByName: 'Maria Okafor' },
  ];

  const invoices: Invoice[] = [
    { id: 'iv1', council: 'Sandwell MBC', runLabel: 'AM/PM Run 1 — Oakfield', period: monthLabel(-1), amount: 2816, status: 'paid' },
    { id: 'iv2', council: 'Dudley MBC', runLabel: 'AM/PM Run 2 — Rowan Park', period: monthLabel(-1), amount: 2552, status: 'sent' },
  ];

  const tenders: Tender[] = [
    { id: 't1', reference: 'DUD-SEN-RT-118', council: 'Dudley MBC', kind: 'Spot route', closeDate: iso(2), valueText: '£18k / yr', status: 'bid' },
    { id: 't2', reference: 'SAN-HTST-2026-04', council: 'Sandwell MBC', kind: 'Framework (DPS)', closeDate: iso(9), valueText: '~£140k / yr', status: 'open' },
    { id: 't3', reference: 'WOL-SEN-2025-11', council: 'Wolverhampton CC', kind: 'Spot route', closeDate: iso(-21), valueText: '£22k / yr', status: 'won' },
    { id: 't4', reference: 'BIR-HTS-0097', council: 'Birmingham CC', kind: 'Framework', closeDate: iso(-40), valueText: '~£300k / yr', status: 'lost' },
  ];

  const auditLog: AuditEntry[] = [
    { id: 1, actorRole: 'manager', actorName: 'Sam Price', action: 'Viewed compliance records for Darren Whitlock', entity: 'staff:a2', createdAt: ts(-1, 9, 12) },
    { id: 2, actorRole: 'pa', actorName: 'Maria Okafor', action: 'Marked on board: Jamie B. (AM Run 1)', entity: 'run:c1', createdAt: ts(-1, 7, 57) },
    { id: 3, actorRole: 'pa', actorName: 'Maria Okafor', action: 'Viewed care plan: Jamie B.', entity: 'child:d1', createdAt: ts(-1, 7, 55) },
  ];

  return {
    version: DEMO_VERSION,
    operatorId: OP,
    operatorName: 'Greenway SEND Transport',
    profiles,
    staff,
    vehicles,
    credentials,
    vehicleChecks,
    runs,
    children,
    childrenPii,
    carePlans,
    boardings,
    incidents,
    parentContacts,
    parentUpdates,
    invoices,
    tenders,
    auditLog,
    files: {},
  };
}

function monthLabel(offsetMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
