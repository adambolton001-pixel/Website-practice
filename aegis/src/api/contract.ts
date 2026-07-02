import type {
  AuditEntry,
  Boarding,
  BoardState,
  CarePlan,
  ChildPII,
  DeliveredRun,
  Incident,
  IncidentSeverity,
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
} from '../lib/types';

export interface SignInResult {
  error: string | null;
}

export interface BoardingWrite {
  runId: string;
  childId: string;
  serviceDate: string;
  state: BoardState;
  boardedAt?: string | null;
  boardedLoc?: string | null;
  droppedAt?: string | null;
  droppedLoc?: string | null;
}

export interface IncidentWrite {
  runId: string;
  childId: string | null;
  kind: string;
  severity: IncidentSeverity;
  description: string;
  photo?: File | null;
}

export interface ParentContactWrite {
  id?: string;
  childId: string;
  name: string;
  phone: string;
  consentApp: boolean;
  consentSms: boolean;
}

export interface InvoiceWrite {
  council: string;
  runLabel: string;
  period: string;
  amount: number;
}

export interface TenderWrite {
  reference: string;
  council: string;
  kind: string;
  closeDate: string;
  valueText: string;
}

/**
 * The single data-access contract. Two implementations:
 *  - demo: in-browser store enforcing the same access matrix as the RLS policies
 *  - live: thin typed wrapper over supabase-js (RLS does the enforcement)
 * Every method is written for the *current signed-in profile*; scoping is
 * always done by the backend, never by the UI.
 */
export interface AegisApi {
  // -- auth ------------------------------------------------------------
  getSessionUserId(): Promise<string | null>;
  onAuthChange(cb: (userId: string | null) => void): () => void;
  signIn(email: string, password: string): Promise<SignInResult>;
  /** demo-mode only: sign in as one of the seeded personas */
  signInDemo(profileId: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  getProfile(userId: string): Promise<Profile | null>;
  /** demo-mode only: the personas offered on the login screen */
  listDemoPersonas(): Promise<Profile[]>;

  // -- compliance ------------------------------------------------------
  listStaffWithCredentials(): Promise<StaffMember[]>;
  listVehiclesWithChecks(): Promise<Vehicle[]>;
  /** short-lived signed URL for a private document (or a demo placeholder) */
  getDocumentUrl(path: string): Promise<string | null>;

  // -- runs, boarding, care plans --------------------------------------
  listRuns(): Promise<Run[]>;
  listBoardings(serviceDate: string): Promise<Boarding[]>;
  /** children safely dropped per service date, most recent `days` days (counts only) */
  listBoardingSeries(days: number): Promise<{ date: string; dropped: number }[]>;
  saveBoarding(write: BoardingWrite): Promise<Boarding>;
  getCarePlan(childId: string): Promise<CarePlan | null>;
  getChildPII(childId: string): Promise<ChildPII | null>;
  /** batched PII fetch (one request for a whole run sheet); same access rules */
  listChildrenPII(childIds: string[]): Promise<ChildPII[]>;

  // -- incidents ---------------------------------------------------------
  listIncidents(): Promise<Incident[]>;
  createIncident(write: IncidentWrite): Promise<void>;
  setIncidentStatus(id: string, status: Incident['status']): Promise<void>;

  // -- parents -----------------------------------------------------------
  listParentContacts(): Promise<ParentContact[]>;
  saveParentContact(write: ParentContactWrite): Promise<void>;
  listParentUpdates(): Promise<ParentUpdate[]>;
  sendParentUpdate(childId: string, runId: string, kind: UpdateKind): Promise<void>;

  // -- commercial (director) ----------------------------------------------
  listInvoices(): Promise<Invoice[]>;
  createInvoice(write: InvoiceWrite): Promise<void>;
  setInvoiceStatus(id: string, status: InvoiceStatus): Promise<void>;
  listTenders(): Promise<Tender[]>;
  createTender(write: TenderWrite): Promise<void>;
  setTenderStatus(id: string, status: TenderStatus): Promise<void>;
  /** aggregate day-counts for billing — exposes no child data */
  listDeliveredRuns(period: string): Promise<DeliveredRun[]>;

  // -- audit ---------------------------------------------------------------
  listAudit(page: number, pageSize: number): Promise<{ rows: AuditEntry[]; total: number }>;
  logAudit(action: string, entity?: string | null): Promise<void>;
}
