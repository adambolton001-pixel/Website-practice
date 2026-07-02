/**
 * Access-matrix tests. The demo backend must enforce exactly the rules the
 * RLS policies enforce in production:
 *
 *   Data                     Director  Manager  Driver        PA
 *   compliance records        —        full     own only      own only
 *   runs                      —        all      assigned      assigned
 *   child PII (name+address)  —        yes      assigned run  NO
 *   care plans                NO       yes      assigned run  assigned run
 *   boardings                 —        r/w      read own      r/w own
 *   incidents                 —        all      own run       own run
 *   parent contacts           —        yes      —             —
 *   invoicing/tenders         yes      —        —             —
 *   audit log                 read     read     —             —
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { demoApi } from './demoApi';
import { resetDemoData, setSessionUserId } from './store';
import { todayISO } from '../../lib/status';

const as = (id: 'p-director' | 'p-manager' | 'p-driver' | 'p-pa') => setSessionUserId(id);

// Seeded fixtures: Darren (driver) + Maria (PA) are on run c1; run c2 is
// staffed by others. Child d1 is on c1, child d4 on c2.

beforeEach(() => {
  localStorage.clear();
  resetDemoData();
});

describe('compliance records', () => {
  it('manager sees all staff', async () => {
    as('p-manager');
    expect((await demoApi.listStaffWithCredentials()).length).toBeGreaterThanOrEqual(4);
  });
  it('driver and PA see only their own record', async () => {
    as('p-driver');
    const d = await demoApi.listStaffWithCredentials();
    expect(d.map((s) => s.fullName)).toEqual(['Darren Whitlock']);
    as('p-pa');
    const p = await demoApi.listStaffWithCredentials();
    expect(p.map((s) => s.fullName)).toEqual(['Maria Okafor']);
  });
  it('director sees no compliance data at all', async () => {
    as('p-director');
    expect(await demoApi.listStaffWithCredentials()).toEqual([]);
    expect(await demoApi.listVehiclesWithChecks()).toEqual([]);
  });
  it('crew see only their own run\'s vehicle; manager sees the fleet', async () => {
    as('p-manager');
    expect((await demoApi.listVehiclesWithChecks()).length).toBe(2);
    as('p-driver'); // Darren drives BV21 PHX on run c1
    expect((await demoApi.listVehiclesWithChecks()).map((v) => v.reg)).toEqual(['BV21 PHX']);
    as('p-pa'); // Maria is the PA on the same vehicle
    expect((await demoApi.listVehiclesWithChecks()).map((v) => v.reg)).toEqual(['BV21 PHX']);
  });
});

describe('runs and children', () => {
  it('manager sees all runs, crew see only their assigned run', async () => {
    as('p-manager');
    expect((await demoApi.listRuns()).length).toBe(2);
    as('p-driver');
    const runs = await demoApi.listRuns();
    expect(runs.map((r) => r.id)).toEqual(['c1']);
    as('p-pa');
    expect((await demoApi.listRuns()).map((r) => r.id)).toEqual(['c1']);
  });
  it('director sees no runs (no child data, ever)', async () => {
    as('p-director');
    expect(await demoApi.listRuns()).toEqual([]);
  });
});

describe('child PII — the address split', () => {
  it('driver can read name+address for a child on their run (navigation)', async () => {
    as('p-driver');
    const pii = await demoApi.getChildPII('d1');
    expect(pii?.homeAddress).toBeTruthy();
  });
  it('driver cannot read PII for a child on another run', async () => {
    as('p-driver');
    expect(await demoApi.getChildPII('d4')).toBeNull();
  });
  it('PA NEVER sees name or home address, even on their own run', async () => {
    as('p-pa');
    expect(await demoApi.getChildPII('d1')).toBeNull();
  });
  it('director never sees PII', async () => {
    as('p-director');
    expect(await demoApi.getChildPII('d1')).toBeNull();
  });
  it('manager sees PII', async () => {
    as('p-manager');
    expect((await demoApi.getChildPII('d1'))?.fullName).toBe('Jamie Booth');
  });
  it('batched PII respects the same rules (driver own run, PA nothing)', async () => {
    as('p-driver');
    const mine = await demoApi.listChildrenPII(['d1', 'd2', 'd4']); // d4 is on the other run
    expect(mine.map((r) => r.childId).sort()).toEqual(['d1', 'd2']);
    as('p-pa');
    expect(await demoApi.listChildrenPII(['d1', 'd2'])).toEqual([]);
  });
  it('reading a home address is written to the audit log', async () => {
    as('p-driver');
    await demoApi.getChildPII('d1');
    as('p-manager');
    const { rows } = await demoApi.listAudit(0, 10);
    expect(
      rows.some((r) => r.action.includes('name & address') && r.actorName === 'Darren Whitlock'),
    ).toBe(true);
  });
});

describe('care plans — special category', () => {
  it('run staff can read plans for their run only', async () => {
    as('p-pa');
    expect((await demoApi.getCarePlan('d1'))?.summary).toBeTruthy();
    expect(await demoApi.getCarePlan('d4')).toBeNull();
  });
  it('director can NEVER read a care plan', async () => {
    as('p-director');
    expect(await demoApi.getCarePlan('d1')).toBeNull();
  });
  it('viewing a care plan is written to the audit log', async () => {
    as('p-pa');
    await demoApi.getCarePlan('d1');
    as('p-manager');
    const { rows } = await demoApi.listAudit(0, 10);
    expect(rows.some((r) => r.action.includes('care plan') && r.actorName === 'Maria Okafor')).toBe(
      true,
    );
  });
});

describe('boardings', () => {
  const write = {
    runId: 'c1',
    childId: 'd1',
    serviceDate: todayISO(),
    state: 'onboard' as const,
    boardedAt: new Date().toISOString(),
    boardedLoc: 'Hurst Ln',
  };

  it('PA can record boarding on their own run', async () => {
    as('p-pa');
    const saved = await demoApi.saveBoarding(write);
    expect(saved.state).toBe('onboard');
  });
  it('driver can read but NOT write boardings', async () => {
    as('p-driver');
    expect((await demoApi.listBoardings(todayISO())).length).toBeGreaterThanOrEqual(0);
    await expect(demoApi.saveBoarding(write)).rejects.toThrow(/permission/i);
  });
  it('PA cannot write to another run', async () => {
    as('p-pa');
    await expect(
      demoApi.saveBoarding({ ...write, runId: 'c2', childId: 'd4' }),
    ).rejects.toThrow(/permission/i);
  });
  it('director sees no boardings', async () => {
    as('p-director');
    expect(await demoApi.listBoardings(todayISO())).toEqual([]);
  });
  it('recording a boarding triggers a parent update respecting consent', async () => {
    as('p-pa');
    await demoApi.saveBoarding(write);
    as('p-manager');
    const updates = await demoApi.listParentUpdates();
    const u = updates.find((x) => x.childId === 'd1' && x.kind === 'onboard');
    expect(u).toBeTruthy();
    expect(u?.channels).toBe('app + sms'); // Jamie's contact consented to both
  });
});

describe('incidents', () => {
  it('crew can raise incidents on their run; scoped lists', async () => {
    as('p-pa');
    await demoApi.createIncident({
      runId: 'c1',
      childId: null,
      kind: 'Vehicle defect',
      severity: 'low',
      description: 'Seatbelt clip stiff on row two.',
    });
    const mine = await demoApi.listIncidents();
    expect(mine.every((i) => i.runId === 'c1')).toBe(true);
    as('p-manager');
    expect((await demoApi.listIncidents()).length).toBeGreaterThan(mine.length - 1);
  });
  it('crew cannot raise incidents on other runs', async () => {
    as('p-pa');
    await expect(
      demoApi.createIncident({
        runId: 'c2',
        childId: null,
        kind: 'Other',
        severity: 'low',
        description: 'Should not be allowed at all.',
      }),
    ).rejects.toThrow(/permission/i);
  });
  it('only the manager can change incident status', async () => {
    as('p-manager');
    const inc = (await demoApi.listIncidents())[0]!;
    await demoApi.setIncidentStatus(inc.id, 'shared_school');
    as('p-pa');
    await expect(demoApi.setIncidentStatus(inc.id, 'closed')).rejects.toThrow(/permission/i);
  });
  it('director sees no incidents', async () => {
    as('p-director');
    expect(await demoApi.listIncidents()).toEqual([]);
  });
});

describe('parent contacts (PII) and updates feed', () => {
  it('manager only', async () => {
    as('p-manager');
    expect((await demoApi.listParentContacts()).length).toBeGreaterThan(0);
    for (const who of ['p-director', 'p-driver', 'p-pa'] as const) {
      as(who);
      expect(await demoApi.listParentContacts()).toEqual([]);
      expect(await demoApi.listParentUpdates()).toEqual([]);
    }
  });
  it('no consent means nothing is sent', async () => {
    as('p-manager');
    // Noah C. (d5) has a contact with both channels off
    await demoApi.sendParentUpdate('d5', 'c2', 'eta');
    const u = (await demoApi.listParentUpdates()).find((x) => x.childId === 'd5');
    expect(u?.channels).toContain('no consent');
  });
});

describe('commercial — director only', () => {
  it('director reads invoices and tenders; others get nothing', async () => {
    as('p-director');
    expect((await demoApi.listInvoices()).length).toBeGreaterThan(0);
    expect((await demoApi.listTenders()).length).toBeGreaterThan(0);
    as('p-manager');
    expect(await demoApi.listInvoices()).toEqual([]);
    expect(await demoApi.listTenders()).toEqual([]);
    as('p-pa');
    await expect(
      demoApi.createInvoice({ council: 'X', runLabel: 'Y', period: 'Z', amount: 1 }),
    ).rejects.toThrow(/permission/i);
  });
  it('delivered-days aggregate exposes day counts, never child rows', async () => {
    as('p-director');
    const period = todayISO().slice(0, 7);
    const rows = await demoApi.listDeliveredRuns(period);
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(['council', 'dailyRate', 'days', 'runId', 'runName']);
    }
  });
});

describe('audit log', () => {
  it('append-only feed readable by manager and director only', async () => {
    as('p-manager');
    expect((await demoApi.listAudit(0, 10)).total).toBeGreaterThan(0);
    as('p-director');
    expect((await demoApi.listAudit(0, 10)).total).toBeGreaterThan(0);
    as('p-driver');
    expect(await demoApi.listAudit(0, 10)).toEqual({ rows: [], total: 0 });
    as('p-pa');
    expect(await demoApi.listAudit(0, 10)).toEqual({ rows: [], total: 0 });
  });
});
