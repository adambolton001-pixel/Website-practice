// Hand-written to match aegis-backend-schema.sql. When you have a live
// project, regenerate with: npx supabase gen types typescript --linked

import type { BoardState, IncidentSeverity, Role } from '../../lib/types';

type Tbl<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export interface ProfileRow {
  id: string;
  operator_id: string;
  staff_id: string | null;
  role: Role;
  full_name: string;
}
export interface StaffRow {
  id: string;
  operator_id: string;
  full_name: string;
  role: Role;
}
export interface CredentialRow {
  id: string;
  operator_id: string;
  staff_id: string;
  kind: string;
  reference: string | null;
  expiry_date: string;
  last_checked: string | null;
  verified_by: string | null;
  document_path: string | null;
}
export interface VehicleRow {
  id: string;
  operator_id: string;
  reg: string;
  description: string | null;
}
export interface VehicleCheckRow {
  id: string;
  operator_id: string;
  vehicle_id: string;
  kind: string;
  reference: string | null;
  expiry_date: string;
  last_checked: string | null;
  document_path: string | null;
}
export interface RunRow {
  id: string;
  operator_id: string;
  name: string;
  school: string | null;
  council: string | null;
  window_text: string | null;
  driver_staff_id: string | null;
  pa_staff_id: string | null;
  vehicle_id: string | null;
  daily_rate: number | null;
}
export interface ChildRow {
  id: string;
  operator_id: string;
  run_id: string;
  display_name: string;
  tag: string | null;
  pickup_area: string | null;
  scheduled_pickup: string | null;
}
export interface ChildPiiRow {
  child_id: string;
  operator_id: string;
  full_name: string | null;
  home_address: string | null;
}
export interface CarePlanRow {
  child_id: string;
  operator_id: string;
  summary: string | null;
  communication: string | null;
  medical: string | null;
  behaviour: string | null;
  contacts: string | null;
}
export interface BoardingRow {
  id: string;
  operator_id: string;
  run_id: string;
  child_id: string;
  service_date: string;
  state: BoardState;
  boarded_at: string | null;
  boarded_loc: string | null;
  dropped_at: string | null;
  dropped_loc: string | null;
  recorded_by: string | null;
}
export interface IncidentRow {
  id: string;
  operator_id: string;
  run_id: string;
  child_id: string | null;
  kind: string;
  severity: IncidentSeverity;
  description: string;
  photo_path: string | null;
  raised_by: string | null;
  raised_by_name: string | null;
  status: string;
  created_at: string;
}
export interface ParentContactRow {
  id: string;
  operator_id: string;
  child_id: string;
  name: string | null;
  phone: string | null;
  push_token: string | null;
  consent_app: boolean;
  consent_sms: boolean;
}
export interface ParentUpdateRow {
  id: string;
  operator_id: string;
  child_id: string;
  run_id: string;
  kind: string;
  channels: string;
  message: string;
  sent_at: string;
  sent_by_name: string | null;
}
export interface InvoiceRow {
  id: string;
  operator_id: string;
  council: string | null;
  run_label: string | null;
  period: string | null;
  amount: number | null;
  status: string;
}
export interface TenderRow {
  id: string;
  operator_id: string;
  reference: string | null;
  council: string | null;
  kind: string | null;
  close_date: string | null;
  value_text: string | null;
  status: string;
}
export interface AuditRow {
  id: number;
  operator_id: string;
  actor_id: string | null;
  actor_role: Role | null;
  actor_name: string | null;
  action: string;
  entity: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: Tbl<ProfileRow>;
      staff: Tbl<StaffRow>;
      credentials: Tbl<CredentialRow>;
      vehicles: Tbl<VehicleRow>;
      vehicle_checks: Tbl<VehicleCheckRow>;
      runs: Tbl<RunRow>;
      children: Tbl<ChildRow>;
      children_pii: Tbl<ChildPiiRow>;
      care_plans: Tbl<CarePlanRow>;
      boardings: Tbl<BoardingRow>;
      incidents: Tbl<IncidentRow>;
      parent_contacts: Tbl<ParentContactRow>;
      parent_updates: Tbl<ParentUpdateRow>;
      invoices: Tbl<InvoiceRow>;
      tenders: Tbl<TenderRow>;
      audit_log: Tbl<AuditRow>;
    };
    Views: Record<string, never>;
    Functions: {
      delivered_days: {
        Args: { p_period: string };
        Returns: {
          run_id: string;
          run_name: string;
          council: string | null;
          days: number;
          daily_rate: number | null;
        }[];
      };
    };
    Enums: {
      app_role: Role;
      board_state: BoardState;
      incident_sev: IncidentSeverity;
    };
    CompositeTypes: Record<string, never>;
  };
}
