import type {
  AegisApi,
  BoardingWrite,
  IncidentWrite,
  InvoiceWrite,
  ParentContactWrite,
  TenderWrite,
} from '../contract';
import type {
  AuditEntry,
  Boarding,
  CarePlan,
  ChildPII,
  DeliveredRun,
  Incident,
  IncidentStatus,
  Invoice,
  InvoiceStatus,
  ParentContact,
  ParentUpdate,
  Profile,
  Run,
  StaffMember,
  Tender,
  TenderStatus,
  UpdateKind,
  Vehicle,
} from '../../lib/types';
import { PermissionError } from '../../lib/errors';
import type { DemoData } from './seed';
import { getData, getFile, getSessionUserId, mutate, saveFile, setSessionUserId, uid } from './store';

// ---------------------------------------------------------------------------
// The demo backend enforces the SAME access matrix as the RLS policies in
// aegis-backend-schema.sql. Reads a role isn't entitled to return empty/null
// (like RLS row filtering); writes a role isn't entitled to throw a
// PermissionError (like a policy violation). The UI never does the gating.
// ---------------------------------------------------------------------------

const listeners = new Set<(userId: string | null) => void>();

function me(): Profile | null {
  const id = getSessionUserId();
  if (!id) return null;
  return getData().profiles.find((p) => p.id === id) ?? null;
}

function requireMe(): Profile {
  const p = me();
  if (!p) throw new Error('Not signed in.');
  return p;
}

function myRunIds(p: Profile): string[] {
  if (!p.staffId) return [];
  return getData()
    .runs.filter((r) => r.driverStaffId === p.staffId || r.paStaffId === p.staffId)
    .map((r) => r.id);
}

/** Vehicles on the caller's assigned runs (matrix: crew see own vehicle only). */
function myVehicleIds(p: Profile): string[] {
  if (!p.staffId) return [];
  return getData()
    .runs.filter((r) => r.driverStaffId === p.staffId || r.paStaffId === p.staffId)
    .map((r) => r.vehicleId)
    .filter((v): v is string => Boolean(v));
}

// Internal writers take the store so several can share ONE mutate/persist.
function appendAuditIn(d: DemoData, p: Profile, action: string, entity: string | null = null): void {
  const nextId = d.auditLog.reduce((m, e) => Math.max(m, Number(e.id)), 0) + 1;
  d.auditLog.push({
    id: nextId,
    actorRole: p.role,
    actorName: p.fullName,
    action,
    entity,
    createdAt: new Date().toISOString(),
  });
}

function appendAudit(p: Profile, action: string, entity: string | null = null): void {
  mutate((d) => appendAuditIn(d, p, action, entity));
}

function childName(childId: string): string {
  return getData().children.find((c) => c.id === childId)?.displayName ?? 'Child';
}

// Automatic parent notification — in production this runs in the `notify`
// Edge Function with the service role (so a PA never reads contact PII).
function dispatchParentUpdateIn(
  d: DemoData,
  actor: Profile,
  childId: string,
  runId: string,
  kind: UpdateKind,
): void {
  const child = d.children.find((c) => c.id === childId);
  const run = d.runs.find((r) => r.id === runId);
  if (!child || !run) return;
  const contact = d.parentContacts.find((pc) => pc.childId === childId);
  const channels = contact
    ? contact.consentApp && contact.consentSms
      ? 'app + sms'
      : contact.consentApp
        ? 'app'
        : contact.consentSms
          ? 'sms'
          : 'not sent — no consent'
    : 'not sent — no contact on file';
  const message =
    kind === 'onboard'
      ? `${child.displayName} is on board and on the way to ${run.school ?? 'school'}.`
      : kind === 'arrived'
        ? `${child.displayName} has arrived safely at ${run.school ?? 'school'}.`
        : `The bus is about 5 minutes away from picking up ${child.displayName}.`;
  d.parentUpdates.push({
    id: uid(),
    childId,
    runId,
    kind,
    channels,
    message,
    sentAt: new Date().toISOString(),
    sentByName: actor.fullName,
  });
}

// A stand-in for the short-lived signed URL a private bucket would return.
function placeholderDocument(path: string): string {
  const label = path.split('/').pop() ?? 'document';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440">
    <rect width="640" height="440" fill="#F4F1EA"/>
    <rect x="24" y="24" width="592" height="392" rx="14" fill="#fff" stroke="#D2CCBE"/>
    <rect x="48" y="52" width="44" height="44" rx="10" fill="#D98A2B"/>
    <text x="70" y="83" font-family="Georgia" font-size="26" font-weight="bold" fill="#1c1305" text-anchor="middle">A</text>
    <text x="108" y="72" font-family="Georgia" font-size="22" font-weight="bold" fill="#16282B">Stored certificate</text>
    <text x="108" y="94" font-family="sans-serif" font-size="13" fill="#7C8B8C">${label}</text>
    <text x="48" y="150" font-family="sans-serif" font-size="14" fill="#4A5C5E">Demo placeholder. In the live app this is the real scanned document,</text>
    <text x="48" y="172" font-family="sans-serif" font-size="14" fill="#4A5C5E">held in a private Supabase Storage bucket and opened via a</text>
    <text x="48" y="194" font-family="sans-serif" font-size="14" fill="#4A5C5E">short-lived signed URL. It is never publicly reachable.</text>
    <rect x="48" y="230" width="544" height="1" fill="#E4DFD4"/>
    <text x="48" y="262" font-family="monospace" font-size="12" fill="#7C8B8C">path: ${path}</text>
    <text x="48" y="284" font-family="monospace" font-size="12" fill="#7C8B8C">access: signed URL · 60s · operator-scoped</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Can this profile see the given storage path? Mirrors the storage policies:
 * manager/director anywhere in their operator; crew for their own credential
 * documents and for photos on incidents they can read.
 */
function canSeeDocument(p: Profile, path: string): boolean {
  if (p.role === 'manager' || p.role === 'director') return true;
  const d = getData();
  const runIds = myRunIds(p);
  const cred = d.credentials.find((c) => c.documentPath === path);
  if (cred) return cred.staffId === p.staffId;
  const inc = d.incidents.find((i) => i.photoPath === path);
  if (inc) return runIds.includes(inc.runId);
  return false;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the photo.'));
    reader.readAsDataURL(file);
  });
}

export const demoApi: AegisApi = {
  // -- auth ------------------------------------------------------------
  async getSessionUserId() {
    return getSessionUserId();
  },
  onAuthChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  async signIn() {
    return {
      error:
        'This build is running in demo mode (no Supabase project connected) — pick a demo role below instead.',
    };
  },
  async signInDemo(profileId) {
    const p = getData().profiles.find((pr) => pr.id === profileId);
    if (!p) return { error: 'Unknown demo persona.' };
    setSessionUserId(p.id);
    appendAudit(p, 'Signed in');
    listeners.forEach((cb) => cb(p.id));
    return { error: null };
  },
  async signOut() {
    setSessionUserId(null);
    listeners.forEach((cb) => cb(null));
  },
  async getProfile(userId) {
    return getData().profiles.find((p) => p.id === userId) ?? null;
  },
  async listDemoPersonas() {
    return getData().profiles;
  },

  // -- compliance ------------------------------------------------------
  async listStaffWithCredentials(): Promise<StaffMember[]> {
    const p = requireMe();
    const d = getData();
    return d.staff
      .filter((s) => {
        if (p.role === 'manager') return true;
        if (p.role === 'driver' || p.role === 'pa') return s.id === p.staffId; // own only
        return false; // director: none
      })
      .map((s) => ({
        ...s,
        credentials: d.credentials.filter((c) => c.staffId === s.id),
      }));
  },

  async listVehiclesWithChecks(): Promise<Vehicle[]> {
    const p = requireMe();
    const d = getData();
    // Matrix: manager all; driver/PA their own run's vehicle only; director none.
    let allowed: (v: { id: string }) => boolean;
    if (p.role === 'manager') {
      allowed = () => true;
    } else if (p.role === 'driver' || p.role === 'pa') {
      const mine = myVehicleIds(p);
      allowed = (v) => mine.includes(v.id);
    } else {
      return [];
    }
    return d.vehicles.filter(allowed).map((v) => ({
      ...v,
      checks: d.vehicleChecks.filter((c) => c.vehicleId === v.id),
    }));
  },

  async getDocumentUrl(path) {
    const p = requireMe();
    if (!canSeeDocument(p, path)) return null;
    appendAudit(p, `Opened stored document`, `doc:${path}`);
    return getFile(path) ?? placeholderDocument(path);
  },

  // -- runs, boarding, care plans --------------------------------------
  async listRuns(): Promise<Run[]> {
    const p = requireMe();
    const d = getData();
    const allowed =
      p.role === 'manager' ? d.runs : d.runs.filter((r) => myRunIds(p).includes(r.id));
    return allowed.map((r) => ({
      ...r,
      children: d.children
        .filter((c) => c.runId === r.id)
        .sort((a, b) => (a.scheduledPickup ?? '').localeCompare(b.scheduledPickup ?? '')),
    }));
  },

  async listBoardings(serviceDate): Promise<Boarding[]> {
    const p = requireMe();
    const d = getData();
    if (p.role === 'manager') return d.boardings.filter((b) => b.serviceDate === serviceDate);
    if (p.role === 'driver' || p.role === 'pa') {
      const runIds = myRunIds(p);
      return d.boardings.filter((b) => b.serviceDate === serviceDate && runIds.includes(b.runId));
    }
    return []; // director: none
  },

  async listBoardingSeries(days): Promise<{ date: string; dropped: number }[]> {
    const p = requireMe();
    const d = getData();
    const scope =
      p.role === 'manager'
        ? () => true
        : p.role === 'driver' || p.role === 'pa'
          ? (() => {
              const runIds = myRunIds(p);
              return (b: Boarding) => runIds.includes(b.runId);
            })()
          : () => false;
    const out: { date: string; dropped: number }[] = [];
    for (let off = days - 1; off >= 0; off--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - off);
      const iso = day.toISOString().slice(0, 10);
      out.push({
        date: iso,
        dropped: d.boardings.filter((b) => b.serviceDate === iso && b.state === 'dropped' && scope(b))
          .length,
      });
    }
    return out;
  },

  async saveBoarding(write: BoardingWrite): Promise<Boarding> {
    const p = requireMe();
    const allowed =
      p.role === 'manager' || (p.role === 'pa' && myRunIds(p).includes(write.runId));
    if (!allowed) throw new PermissionError(); // drivers read, never write
    const name = childName(write.childId);
    // One mutate = one persist for the boarding row, the audit entry AND the
    // parent update — a tap serialises the store once, not three times.
    return mutate((d) => {
      let row = d.boardings.find(
        (b) => b.childId === write.childId && b.serviceDate === write.serviceDate,
      );
      if (row) {
        Object.assign(row, write);
      } else {
        row = {
          id: uid(),
          runId: write.runId,
          childId: write.childId,
          serviceDate: write.serviceDate,
          state: write.state,
          boardedAt: write.boardedAt ?? null,
          boardedLoc: write.boardedLoc ?? null,
          droppedAt: write.droppedAt ?? null,
          droppedLoc: write.droppedLoc ?? null,
          recordedBy: p.id,
        };
        d.boardings.push(row);
      }
      if (write.state === 'onboard') {
        appendAuditIn(d, p, `Marked on board: ${name}`, `run:${write.runId}`);
        dispatchParentUpdateIn(d, p, write.childId, write.runId, 'onboard');
      } else if (write.state === 'dropped') {
        appendAuditIn(d, p, `Marked dropped off: ${name}`, `run:${write.runId}`);
        dispatchParentUpdateIn(d, p, write.childId, write.runId, 'arrived');
      }
      return { ...row };
    });
  },

  async getCarePlan(childId): Promise<CarePlan | null> {
    const p = requireMe();
    const d = getData();
    const child = d.children.find((c) => c.id === childId);
    if (!child) return null;
    const allowed =
      p.role === 'manager' ||
      ((p.role === 'driver' || p.role === 'pa') && myRunIds(p).includes(child.runId));
    if (!allowed) return null; // director never sees care plans
    const plan = d.carePlans.find((cp) => cp.childId === childId) ?? null;
    if (plan) appendAudit(p, `Viewed care plan: ${child.displayName}`, `child:${childId}`);
    return plan;
  },

  async getChildPII(childId): Promise<ChildPII | null> {
    const p = requireMe();
    const d = getData();
    const child = d.children.find((c) => c.id === childId);
    if (!child) return null;
    const allowed =
      p.role === 'manager' || (p.role === 'driver' && myRunIds(p).includes(child.runId));
    if (!allowed) return null; // PA and director never see name/address
    const pii = d.childrenPii.find((row) => row.childId === childId) ?? null;
    // Name + home address is the most sensitive read in the app — always logged.
    if (pii) appendAudit(p, `Viewed name & address: ${child.displayName}`, `child:${childId}`);
    return pii;
  },

  async listChildrenPII(childIds): Promise<ChildPII[]> {
    const p = requireMe();
    if (p.role !== 'manager' && p.role !== 'driver') return [];
    const d = getData();
    const runIds = p.role === 'driver' ? myRunIds(p) : null;
    const visible = d.children.filter(
      (c) => childIds.includes(c.id) && (runIds === null || runIds.includes(c.runId)),
    );
    const rows = d.childrenPii.filter((pii) => visible.some((c) => c.id === pii.childId));
    if (rows.length > 0) {
      const label = visible.map((c) => c.displayName).join(', ');
      appendAudit(p, `Viewed names & addresses: ${label}`);
    }
    return rows;
  },

  // -- incidents ---------------------------------------------------------
  async listIncidents(): Promise<Incident[]> {
    const p = requireMe();
    const d = getData();
    let rows: Incident[];
    if (p.role === 'manager') {
      rows = d.incidents;
    } else if (p.role === 'driver' || p.role === 'pa') {
      const runIds = myRunIds(p);
      rows = d.incidents.filter((i) => runIds.includes(i.runId));
    } else {
      rows = []; // director: none
    }
    return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createIncident(write: IncidentWrite): Promise<void> {
    const p = requireMe();
    const allowed =
      p.role === 'manager' ||
      ((p.role === 'driver' || p.role === 'pa') && myRunIds(p).includes(write.runId));
    if (!allowed) throw new PermissionError();
    const id = uid();
    let photoPath: string | null = null;
    if (write.photo) {
      if (write.photo.size > 4 * 1024 * 1024) throw new Error('Photo too large (max 4 MB).');
      const dataUrl = await fileToDataUrl(write.photo);
      photoPath = `${p.operatorId}/incidents/${id}`;
      saveFile(photoPath, dataUrl);
    }
    mutate((d) => {
      d.incidents.push({
        id,
        runId: write.runId,
        childId: write.childId,
        kind: write.kind,
        severity: write.severity,
        description: write.description,
        photoPath,
        raisedBy: p.id,
        raisedByName: p.fullName,
        status: 'logged',
        createdAt: new Date().toISOString(),
      });
      appendAuditIn(d, p, `Raised incident: ${write.kind} (${write.severity})`, `incident:${id}`);
    });
  },

  async setIncidentStatus(id, status: IncidentStatus): Promise<void> {
    const p = requireMe();
    if (p.role !== 'manager') throw new PermissionError();
    const labels: Record<IncidentStatus, string> = {
      logged: 'Reopened incident',
      shared_school: 'Shared incident with school',
      shared_council: 'Shared incident with council',
      closed: 'Closed incident',
    };
    mutate((d) => {
      const row = d.incidents.find((i) => i.id === id);
      if (row) {
        row.status = status;
        appendAuditIn(d, p, labels[status], `incident:${id}`);
      }
    });
  },

  // -- parents -----------------------------------------------------------
  async listParentContacts(): Promise<ParentContact[]> {
    const p = requireMe();
    if (p.role !== 'manager') return []; // contacts are PII — manager only
    return getData().parentContacts;
  },

  async saveParentContact(write: ParentContactWrite): Promise<void> {
    const p = requireMe();
    if (p.role !== 'manager') throw new PermissionError();
    mutate((d) => {
      const existing = write.id ? d.parentContacts.find((c) => c.id === write.id) : undefined;
      if (existing) {
        Object.assign(existing, write);
      } else {
        d.parentContacts.push({
          id: uid(),
          childId: write.childId,
          name: write.name,
          phone: write.phone,
          pushToken: write.consentApp ? 'expo:demo' : null,
          consentApp: write.consentApp,
          consentSms: write.consentSms,
        });
      }
      appendAuditIn(d, p, `Updated parent contact for ${childName(write.childId)}`, `child:${write.childId}`);
    });
  },

  async listParentUpdates(): Promise<ParentUpdate[]> {
    const p = requireMe();
    if (p.role !== 'manager') return [];
    return [...getData().parentUpdates].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  },

  async sendParentUpdate(childId, runId, kind): Promise<void> {
    const p = requireMe();
    const allowed = p.role === 'manager' || (p.role === 'pa' && myRunIds(p).includes(runId));
    if (!allowed) throw new PermissionError();
    mutate((d) => {
      dispatchParentUpdateIn(d, p, childId, runId, kind);
      appendAuditIn(d, p, `Sent "${kind}" update for ${childName(childId)}`, `child:${childId}`);
    });
  },

  // -- commercial (director) ----------------------------------------------
  async listInvoices(): Promise<Invoice[]> {
    const p = requireMe();
    if (p.role !== 'director') return [];
    return getData().invoices;
  },

  async createInvoice(write: InvoiceWrite): Promise<void> {
    const p = requireMe();
    if (p.role !== 'director') throw new PermissionError();
    mutate((d) => {
      d.invoices.push({ id: uid(), ...write, status: 'draft' });
      appendAuditIn(d, p, `Raised invoice: ${write.council} · ${write.period} · £${write.amount.toFixed(2)}`);
    });
  },

  async setInvoiceStatus(id, status: InvoiceStatus): Promise<void> {
    const p = requireMe();
    if (p.role !== 'director') throw new PermissionError();
    mutate((d) => {
      const row = d.invoices.find((i) => i.id === id);
      if (row) {
        row.status = status;
        appendAuditIn(d, p, `Marked invoice ${status}`, `invoice:${id}`);
      }
    });
  },

  async listTenders(): Promise<Tender[]> {
    const p = requireMe();
    if (p.role !== 'director') return [];
    return getData().tenders;
  },

  async createTender(write: TenderWrite): Promise<void> {
    const p = requireMe();
    if (p.role !== 'director') throw new PermissionError();
    mutate((d) => {
      d.tenders.push({ id: uid(), ...write, status: 'open' });
      appendAuditIn(d, p, `Added tender ${write.reference} (${write.council})`);
    });
  },

  async setTenderStatus(id, status: TenderStatus): Promise<void> {
    const p = requireMe();
    if (p.role !== 'director') throw new PermissionError();
    mutate((d) => {
      const row = d.tenders.find((t) => t.id === id);
      if (row) {
        row.status = status;
        appendAuditIn(d, p, `Moved tender to "${status}"`, `tender:${id}`);
      }
    });
  },

  async listDeliveredRuns(period): Promise<DeliveredRun[]> {
    const p = requireMe();
    // Mirrors the delivered_days() SECURITY DEFINER function: day counts only.
    if (p.role !== 'director' && p.role !== 'manager') return [];
    const d = getData();
    return d.runs.map((r) => {
      const days = new Set(
        d.boardings
          .filter((b) => b.runId === r.id && b.state === 'dropped' && b.serviceDate.startsWith(period))
          .map((b) => b.serviceDate),
      ).size;
      return { runId: r.id, runName: r.name, council: r.council, days, dailyRate: r.dailyRate };
    });
  },

  // -- audit ---------------------------------------------------------------
  async listAudit(page, pageSize): Promise<{ rows: AuditEntry[]; total: number }> {
    const p = requireMe();
    if (p.role !== 'manager' && p.role !== 'director') return { rows: [], total: 0 };
    const all = [...getData().auditLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { rows: all.slice(page * pageSize, (page + 1) * pageSize), total: all.length };
  },

  async logAudit(action, entity = null): Promise<void> {
    const p = me();
    if (!p) return;
    appendAudit(p, action, entity);
  },
};
