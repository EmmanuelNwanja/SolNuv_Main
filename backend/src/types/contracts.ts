export type UUID = string;

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type NercMiniGridType = "isolated" | "interconnected";
export type NercRegulatoryPathway = "registration" | "permit_required";
export type NercApplicationStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "rejected";
export type NercReportingCadence = "annual" | "quarterly";
export type NercSubmissionStatus = "submitted" | "accepted" | "rejected";
export type NercReportingCycleStatus = "pending" | "submitted" | "overdue";
export type NercAdminDecisionAction =
  | "start_review"
  | "changes_requested"
  | "approve"
  | "reject";

export interface UserProfile {
  id: UUID;
  company_id?: UUID | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  verification_status?: string | null;
}

export interface CompanyProfile {
  id: UUID;
  name?: string | null;
  subscription_plan?: string | null;
  subscription_expires_at?: string | null;
  verified_at?: string | null;
}

export interface ProjectEquipment {
  id: UUID;
  project_id: UUID;
  equipment_type: "panel" | "battery" | string;
  quantity: number;
  condition?: string | null;
  brand?: string | null;
  model?: string | null;
  size_watts?: number | null;
  capacity_kwh?: number | null;
  panel_technology?: string | null;
  battery_chemistry?: string | null;
}

export interface ProjectRecord {
  id: UUID;
  company_id?: UUID;
  name: string;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  capacity_kw?: number | null;
  installation_date?: string | null;
  estimated_decommission_date?: string | null;
  equipment?: ProjectEquipment[];
  [key: string]: unknown;
}

export interface NercApplication {
  id: UUID;
  project_id: UUID;
  regulatory_profile_id?: UUID | null;
  application_type: NercRegulatoryPathway;
  status: NercApplicationStatus;
  title: string;
  application_payload?: Record<string, unknown>;
  checklist_payload?: unknown[];
  regulator_reference?: string | null;
  regulator_decision_note?: string | null;
  submitted_at?: string | null;
  review_started_at?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  sla_due_at?: string | null;
  sla_breached?: boolean;
  submitted_by?: UUID | null;
  reviewed_by?: UUID | null;
  created_at?: string;
  updated_at?: string;
}

export interface NercReportingCycle {
  id: UUID;
  project_id: UUID;
  regulatory_profile_id?: UUID | null;
  cadence: NercReportingCadence;
  period_start: string;
  period_end: string;
  status: NercReportingCycleStatus;
  due_date?: string | null;
  report_payload?: Record<string, unknown>;
  created_by_scheduler?: boolean;
  submitted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NercSubmissionEvent {
  id: UUID;
  reporting_cycle_id: UUID;
  project_id: UUID;
  submission_status: NercSubmissionStatus;
  submission_payload?: Record<string, unknown>;
  regulator_reference?: string | null;
  regulator_message?: string | null;
  submitted_by?: UUID | null;
  submitted_at: string;
  created_at?: string;
}

export interface ProjectRegulatoryProfile {
  id: UUID;
  project_id: UUID;
  mini_grid_type: NercMiniGridType;
  declared_capacity_kw: number;
  regulatory_pathway: NercRegulatoryPathway;
  permit_required: boolean;
  requires_nerc_reporting: boolean;
  reporting_cadence: NercReportingCadence;
  permit_threshold_kw: number;
  annual_reporting_threshold_kw: number;
  regulation_version: string;
  is_active: boolean;
  notes?: string | null;
  created_by?: UUID | null;
  created_at: string;
  updated_at: string;
}
