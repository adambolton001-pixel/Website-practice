import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from '../../lib/config';
import type {
  AegisApi,
  BoardingWrite,
  IncidentWrite,
  InvoiceWrite,
  ParentContactWrite,
  TenderWrite,
} from '../contract';
import type {
  Boarding,
  Incident,
  IncidentStatus,
  InvoiceStatus,
  Profile,
  TenderStatus,
} from '../../lib/types';
import type {
  AuditRow,
  BoardingRow,
  CarePlanRow,
  ChildPiiRow,
  ChildRow,
  CredentialRow,
  IncidentRow,
  InvoiceRow,
  ParentContactRow,
  ParentUpdateRow,
  ProfileRow,
  RunRow,
  StaffRow,
  TenderRow,
  VehicleCheckRow,
  VehicleRow,
} from './database.types';

// Deliberately naive queries: row-level security in Postgres decides what
// each role gets back. The UI never filters for privacy, only for layout.
// The client is untyped; results are cast to the hand-written row shapes in
// database.types.ts (regenerate with supabase gen types when linked).

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rows = <T>(data: unknown): T[] => (data ?? []) as T[];
const one = <T>(data: unknown): T | null => (data ?? null) as T | null;

let cachedProfile: Profile | null = null;

async function myProfile(): Promise<Profile | null> {
  if (cachedProfile) return cachedProfile;
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;
  return liveApi.getProfile(userId);
}

function mapBoarding(b: BoardingRow): Boarding {
  return {
    id: b.id,
    runId: b.run_id,
    childId: b.child_id,
    serviceDate: b.service_date,
    state: b.state,
    boardedAt: b.boarded_at,
    boardedLoc: b.boarded_loc,
    droppedAt: b.dropped_at,
    droppedLoc: b.dropped_loc,
    recordedBy: b.recorded_by,
  };
}

function mapIncident(i: IncidentRow): Incident {
  return {
    id: i.id,
    runId: i.run_id,
    childId: i.child_id,
    kind: i.kind,
    severity: i.severity,
    description: i.description,
    photoPath: i.photo_path,
    raisedBy: i.raised_by,
    raisedByName: i.raised_by_name,
    status: i.status as Incident['status'],
    createdAt: i.created_at,
  };
}

function fail(message: string): never {
  throw new Error(message);
}

export const liveApi: AegisApi = {
  // -- auth ------------------------------------------------------------
  async getSessionUserId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      cachedProfile = null;
      cb(s?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  },
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },
  async signInDemo() {
    return { error: 'Demo personas are only available in demo mode.' };
  },
  async signOut() {
    await supabase.auth.signOut();
    cachedProfile = null;
  },
  async getProfile(userId) {
    const res = await supabase
      .from('profiles')
      .select('id, operator_id, staff_id, role, full_name')
      .eq('id', userId)
      .maybeSingle();
    const data = one<ProfileRow>(res.data);
    if (!data) return null;
    cachedProfile = {
      id: data.id,
      operatorId: data.operator_id,
      staffId: data.staff_id,
      role: data.role,
      fullName: data.full_name,
    };
    return cachedProfile;
  },
  async listDemoPersonas() {
    return [];
  },

  // -- compliance ------------------------------------------------------
  async listStaffWithCredentials() {
    const { data, error } = await supabase
      .from('staff')
      .select(
        'id, full_name, role, credentials(id, staff_id, kind, reference, expiry_date, last_checked, verified_by, document_path)',
      );
    if (error) fail(error.message);
    return rows<StaffRow & { credentials: CredentialRow[] }>(data).map((s) => ({
      id: s.id,
      fullName: s.full_name,
      role: s.role as 'driver' | 'pa',
      credentials: (s.credentials ?? []).map((c) => ({
        id: c.id,
        staffId: c.staff_id,
        kind: c.kind,
        reference: c.reference,
        expiryDate: c.expiry_date,
        lastChecked: c.last_checked,
        verifiedBy: c.verified_by,
        documentPath: c.document_path,
      })),
    }));
  },

  async listVehiclesWithChecks() {
    const { data, error } = await supabase
      .from('vehicles')
      .select(
        'id, reg, description, vehicle_checks(id, vehicle_id, kind, reference, expiry_date, last_checked, document_path)',
      );
    if (error) fail(error.message);
    return rows<VehicleRow & { vehicle_checks: VehicleCheckRow[] }>(data).map((v) => ({
      id: v.id,
      reg: v.reg,
      description: v.description,
      checks: (v.vehicle_checks ?? []).map((c) => ({
        id: c.id,
        vehicleId: c.vehicle_id,
        kind: c.kind,
        reference: c.reference,
        expiryDate: c.expiry_date,
        lastChecked: c.last_checked,
        documentPath: c.document_path,
      })),
    }));
  },

  async getDocumentUrl(path) {
    const { data, error } = await supabase.storage.from('records').createSignedUrl(path, 60);
    if (error) return null;
    void liveApi.logAudit('Opened stored document', `doc:${path}`);
    return data.signedUrl;
  },

  // -- runs, boarding, care plans --------------------------------------
  async listRuns() {
    const { data, error } = await supabase
      .from('runs')
      .select(
        'id, name, school, council, window_text, driver_staff_id, pa_staff_id, vehicle_id, daily_rate, children(id, run_id, display_name, tag, pickup_area, scheduled_pickup)',
      );
    if (error) fail(error.message);
    return rows<RunRow & { children: ChildRow[] }>(data).map((r) => ({
      id: r.id,
      name: r.name,
      school: r.school,
      council: r.council,
      windowText: r.window_text,
      driverStaffId: r.driver_staff_id,
      paStaffId: r.pa_staff_id,
      vehicleId: r.vehicle_id,
      dailyRate: r.daily_rate,
      children: (r.children ?? [])
        .map((c) => ({
          id: c.id,
          runId: c.run_id,
          displayName: c.display_name,
          tag: c.tag,
          pickupArea: c.pickup_area,
          scheduledPickup: c.scheduled_pickup,
        }))
        .sort((a, b) => (a.scheduledPickup ?? '').localeCompare(b.scheduledPickup ?? '')),
    }));
  },

  async listBoardings(serviceDate) {
    const { data, error } = await supabase
      .from('boardings')
      .select('*')
      .eq('service_date', serviceDate);
    if (error) fail(error.message);
    return rows<BoardingRow>(data).map(mapBoarding);
  },

  async saveBoarding(write: BoardingWrite) {
    const profile = await myProfile();
    const existingRes = await supabase
      .from('boardings')
      .select('id')
      .eq('child_id', write.childId)
      .eq('service_date', write.serviceDate)
      .maybeSingle();
    const existing = one<{ id: string }>(existingRes.data);
    const patch = {
      state: write.state,
      boarded_at: write.boardedAt ?? null,
      boarded_loc: write.boardedLoc ?? null,
      dropped_at: write.droppedAt ?? null,
      dropped_loc: write.droppedLoc ?? null,
    };
    let saved: BoardingRow;
    if (existing) {
      const { data, error } = await supabase
        .from('boardings')
        .update(patch)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) fail(error.message);
      saved = data as BoardingRow;
    } else {
      const { data, error } = await supabase
        .from('boardings')
        .insert({
          operator_id: profile?.operatorId,
          run_id: write.runId,
          child_id: write.childId,
          service_date: write.serviceDate,
          recorded_by: profile?.id,
          ...patch,
        })
        .select()
        .single();
      if (error) fail(error.message);
      saved = data as BoardingRow;
    }
    if (write.state === 'onboard' || write.state === 'dropped') {
      void liveApi.logAudit(
        write.state === 'onboard' ? 'Marked on board' : 'Marked dropped off',
        `boarding:${saved.id}`,
      );
      // The notify Edge Function reads consent server-side and fans out
      // push/SMS — contact PII never reaches the on-vehicle client.
      void supabase.functions.invoke('notify', {
        body: {
          child_id: write.childId,
          run_id: write.runId,
          kind: write.state === 'onboard' ? 'onboard' : 'arrived',
        },
      });
    }
    return mapBoarding(saved);
  },

  async getCarePlan(childId) {
    const res = await supabase.from('care_plans').select('*').eq('child_id', childId).maybeSingle();
    const data = one<CarePlanRow>(res.data);
    if (data) void liveApi.logAudit('Viewed care plan', `child:${childId}`);
    return data
      ? {
          childId: data.child_id,
          summary: data.summary,
          communication: data.communication,
          medical: data.medical,
          behaviour: data.behaviour,
          contacts: data.contacts,
        }
      : null;
  },

  async getChildPII(childId) {
    const res = await supabase
      .from('children_pii')
      .select('*')
      .eq('child_id', childId)
      .maybeSingle();
    const data = one<ChildPiiRow>(res.data);
    return data
      ? { childId: data.child_id, fullName: data.full_name, homeAddress: data.home_address }
      : null;
  },

  // -- incidents ---------------------------------------------------------
  async listIncidents() {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) fail(error.message);
    return rows<IncidentRow>(data).map(mapIncident);
  },

  async createIncident(write: IncidentWrite) {
    const profile = await myProfile();
    let photoPath: string | null = null;
    if (write.photo) {
      photoPath = `${profile?.operatorId}/incidents/${crypto.randomUUID()}`;
      const { error } = await supabase.storage
        .from('records')
        .upload(photoPath, write.photo, { contentType: write.photo.type });
      if (error) fail(error.message);
    }
    const { error } = await supabase.from('incidents').insert({
      operator_id: profile?.operatorId,
      run_id: write.runId,
      child_id: write.childId,
      kind: write.kind,
      severity: write.severity,
      description: write.description,
      photo_path: photoPath,
      raised_by: profile?.id,
      raised_by_name: profile?.fullName,
    });
    if (error) fail(error.message);
    void liveApi.logAudit(`Raised incident: ${write.kind} (${write.severity})`);
  },

  async setIncidentStatus(id, status: IncidentStatus) {
    const { error } = await supabase.from('incidents').update({ status }).eq('id', id);
    if (error) fail(error.message);
    void liveApi.logAudit(`Incident status → ${status}`, `incident:${id}`);
  },

  // -- parents -----------------------------------------------------------
  async listParentContacts() {
    const { data, error } = await supabase.from('parent_contacts').select('*');
    if (error) fail(error.message);
    return rows<ParentContactRow>(data).map((c) => ({
      id: c.id,
      childId: c.child_id,
      name: c.name,
      phone: c.phone,
      pushToken: c.push_token,
      consentApp: c.consent_app,
      consentSms: c.consent_sms,
    }));
  },

  async saveParentContact(write: ParentContactWrite) {
    const profile = await myProfile();
    const record = {
      operator_id: profile?.operatorId,
      child_id: write.childId,
      name: write.name,
      phone: write.phone,
      consent_app: write.consentApp,
      consent_sms: write.consentSms,
    };
    const { error } = write.id
      ? await supabase.from('parent_contacts').update(record).eq('id', write.id)
      : await supabase.from('parent_contacts').insert(record);
    if (error) fail(error.message);
    void liveApi.logAudit('Updated parent contact', `child:${write.childId}`);
  },

  async listParentUpdates() {
    const { data, error } = await supabase
      .from('parent_updates')
      .select('*')
      .order('sent_at', { ascending: false });
    if (error) fail(error.message);
    return rows<ParentUpdateRow>(data).map((u) => ({
      id: u.id,
      childId: u.child_id,
      runId: u.run_id,
      kind: u.kind as 'onboard' | 'arrived' | 'eta',
      channels: u.channels,
      message: u.message,
      sentAt: u.sent_at,
      sentByName: u.sent_by_name,
    }));
  },

  async sendParentUpdate(childId, runId, kind) {
    const { error } = await supabase.functions.invoke('notify', {
      body: { child_id: childId, run_id: runId, kind },
    });
    if (error) fail(error.message);
    void liveApi.logAudit(`Sent "${kind}" update`, `child:${childId}`);
  },

  // -- commercial (director) ----------------------------------------------
  async listInvoices() {
    const { data, error } = await supabase.from('invoices').select('*');
    if (error) fail(error.message);
    return rows<InvoiceRow>(data).map((i) => ({
      id: i.id,
      council: i.council,
      runLabel: i.run_label,
      period: i.period,
      amount: i.amount,
      status: i.status as InvoiceStatus,
    }));
  },

  async createInvoice(write: InvoiceWrite) {
    const profile = await myProfile();
    const { error } = await supabase.from('invoices').insert({
      operator_id: profile?.operatorId,
      council: write.council,
      run_label: write.runLabel,
      period: write.period,
      amount: write.amount,
      status: 'draft',
    });
    if (error) fail(error.message);
    void liveApi.logAudit(`Raised invoice: ${write.council} · ${write.period}`);
  },

  async setInvoiceStatus(id, status: InvoiceStatus) {
    const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
    if (error) fail(error.message);
    void liveApi.logAudit(`Marked invoice ${status}`, `invoice:${id}`);
  },

  async listTenders() {
    const { data, error } = await supabase.from('tenders').select('*');
    if (error) fail(error.message);
    return rows<TenderRow>(data).map((t) => ({
      id: t.id,
      reference: t.reference,
      council: t.council,
      kind: t.kind,
      closeDate: t.close_date,
      valueText: t.value_text,
      status: t.status as TenderStatus,
    }));
  },

  async createTender(write: TenderWrite) {
    const profile = await myProfile();
    const { error } = await supabase.from('tenders').insert({
      operator_id: profile?.operatorId,
      reference: write.reference,
      council: write.council,
      kind: write.kind,
      close_date: write.closeDate,
      value_text: write.valueText,
      status: 'open',
    });
    if (error) fail(error.message);
    void liveApi.logAudit(`Added tender ${write.reference}`);
  },

  async setTenderStatus(id, status: TenderStatus) {
    const { error } = await supabase.from('tenders').update({ status }).eq('id', id);
    if (error) fail(error.message);
    void liveApi.logAudit(`Moved tender to "${status}"`, `tender:${id}`);
  },

  async listDeliveredRuns(period) {
    const { data, error } = await supabase.rpc('delivered_days', { p_period: period });
    if (error) fail(error.message);
    return rows<{
      run_id: string;
      run_name: string;
      council: string | null;
      days: number;
      daily_rate: number | null;
    }>(data).map((r) => ({
      runId: r.run_id,
      runName: r.run_name,
      council: r.council,
      days: r.days,
      dailyRate: r.daily_rate,
    }));
  },

  // -- audit ---------------------------------------------------------------
  async listAudit(page, pageSize) {
    const from = page * pageSize;
    const { data, error, count } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) fail(error.message);
    return {
      rows: rows<AuditRow>(data).map((a) => ({
        id: a.id,
        actorRole: a.actor_role,
        actorName: a.actor_name,
        action: a.action,
        entity: a.entity,
        createdAt: a.created_at,
      })),
      total: count ?? 0,
    };
  },

  async logAudit(action, entity = null) {
    const profile = await myProfile();
    if (!profile) return;
    await supabase.from('audit_log').insert({
      operator_id: profile.operatorId,
      actor_id: profile.id,
      actor_role: profile.role,
      actor_name: profile.fullName,
      action,
      entity,
    });
  },
};
