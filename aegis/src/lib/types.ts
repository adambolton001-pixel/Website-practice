// Domain types shared by the demo backend and the Supabase adapter.
// Mirrors aegis-backend-schema.sql (camelCased).

export type Role = 'director' | 'manager' | 'driver' | 'pa';
export type BoardState = 'waiting' | 'onboard' | 'dropped';
export type IncidentSeverity = 'low' | 'med' | 'high';
export type IncidentStatus = 'logged' | 'shared_school' | 'shared_council' | 'closed';
export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type TenderStatus = 'open' | 'bid' | 'won' | 'lost';
export type UpdateKind = 'onboard' | 'arrived' | 'eta';

export interface Profile {
  id: string;
  operatorId: string;
  staffId: string | null;
  role: Role;
  fullName: string;
}

export interface Credential {
  id: string;
  staffId: string;
  kind: string;
  reference: string | null;
  expiryDate: string; // ISO date
  lastChecked: string | null;
  verifiedBy: string | null;
  documentPath: string | null;
}

export interface StaffMember {
  id: string;
  fullName: string;
  role: 'driver' | 'pa';
  credentials: Credential[];
}

export interface VehicleCheck {
  id: string;
  vehicleId: string;
  kind: string;
  reference: string | null;
  expiryDate: string;
  lastChecked: string | null;
  documentPath: string | null;
}

export interface Vehicle {
  id: string;
  reg: string;
  description: string | null;
  checks: VehicleCheck[];
}

export interface Child {
  id: string;
  runId: string;
  displayName: string; // minimised, e.g. "Jamie B."
  tag: string | null;
  pickupArea: string | null;
  scheduledPickup: string | null; // "07:55"
}

export interface Run {
  id: string;
  name: string;
  school: string | null;
  council: string | null;
  windowText: string | null;
  driverStaffId: string | null;
  paStaffId: string | null;
  vehicleId: string | null;
  dailyRate: number | null;
  children: Child[];
}

export interface Boarding {
  id: string;
  runId: string;
  childId: string;
  serviceDate: string; // ISO date
  state: BoardState;
  boardedAt: string | null;
  boardedLoc: string | null;
  droppedAt: string | null;
  droppedLoc: string | null;
  recordedBy: string | null;
  /** true while the write is still queued locally (offline outbox) */
  pending?: boolean;
}

export interface CarePlan {
  childId: string;
  summary: string | null;
  communication: string | null;
  medical: string | null;
  behaviour: string | null;
  contacts: string | null;
}

export interface ChildPII {
  childId: string;
  fullName: string | null;
  homeAddress: string | null;
}

export interface Incident {
  id: string;
  runId: string;
  childId: string | null;
  kind: string;
  severity: IncidentSeverity;
  description: string;
  photoPath: string | null;
  raisedBy: string | null;
  raisedByName: string | null;
  status: IncidentStatus;
  createdAt: string;
}

export interface ParentContact {
  id: string;
  childId: string;
  name: string | null;
  phone: string | null;
  pushToken: string | null;
  consentApp: boolean;
  consentSms: boolean;
}

export interface ParentUpdate {
  id: string;
  childId: string;
  runId: string;
  kind: UpdateKind;
  channels: string; // e.g. "app", "app+sms", "none (no consent)"
  message: string;
  sentAt: string;
  sentByName: string | null;
}

export interface Invoice {
  id: string;
  council: string | null;
  runLabel: string | null;
  period: string | null;
  amount: number | null;
  status: InvoiceStatus;
}

export interface Tender {
  id: string;
  reference: string | null;
  council: string | null;
  kind: string | null;
  closeDate: string | null;
  valueText: string | null;
  status: TenderStatus;
}

export interface AuditEntry {
  id: number | string;
  actorRole: Role | null;
  actorName: string | null;
  action: string;
  entity: string | null;
  createdAt: string;
}

/** Aggregate for director invoicing — day counts only, no child data. */
export interface DeliveredRun {
  runId: string;
  runName: string;
  council: string | null;
  days: number;
  dailyRate: number | null;
}
