export type UUID = string;

export interface ApiEnvelope<T> {
  success?: boolean;
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

export interface ApiListEnvelope<T> {
  success?: boolean;
  message?: string;
  data: {
    items?: T[];
    active?: T[];
    total?: number;
    [key: string]: unknown;
  };
}

export interface UserProfile {
  id: UUID;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  verification_status?: string | null;
  brand_name?: string | null;
  user_type?: string | null;
  business_type?: string | null;
  signature_url?: string | null;
  public_slug?: string | null;
  public_bio?: string | null;
  is_public_profile?: boolean | null;
  notification_preferences?: {
    sms?: boolean;
    whatsapp?: boolean;
    push?: boolean;
    email?: boolean;
  } | null;
  verification_rejection_reason?: string | null;
  verification_requested_at?: string | null;
  verified_at?: string | null;
}

export interface CompanyProfile {
  id: UUID;
  name?: string | null;
  subscription_plan?: string | null;
  subscription_expires_at?: string | null;
  subscription_grace_until?: string | null;
  is_in_grace_period?: boolean;
  nesrea_registration_number?: string | null;
  address?: string | null;
  state?: string | null;
  city?: string | null;
  website?: string | null;
  logo_url?: string | null;
  branding_primary_color?: string | null;
  company_signature_url?: string | null;
  subscription_interval?: string | null;
  max_team_members?: number | null;
  subscription_auto_renew?: boolean | null;
}

/** Merged API + client auth profile (AuthContext). Partial during bootstrap. */
export interface AppUserProfile extends Partial<UserProfile> {
  supabase_uid?: string | null;
  is_onboarded?: boolean;
  companies?: CompanyProfile | null;
  is_platform_admin?: boolean;
  platform_admin_role?: string | null;
  verification_status?: string | null;
  [key: string]: unknown;
}

export interface ProjectEquipment {
  id: UUID;
  equipment_type: "panel" | "battery" | string;
  brand?: string | null;
  model?: string | null;
  quantity: number;
  condition?: string | null;
  size_watts?: number | null;
  capacity_kwh?: number | null;
  estimated_silver_grams?: number | null;
  estimated_silver_value_ngn?: number | null;
  panel_technology?: string | null;
  battery_chemistry?: string | null;
}

export interface RecoveryRequest {
  id: UUID | string;
  status: string;
  preferred_date?: string | null;
  decommission_approved?: boolean;
}

export interface ProjectRecord {
  id: UUID;
  name: string;
  client_name?: string | null;
  description?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  status?: string | null;
  installation_date?: string | null;
  estimated_decommission_date?: string | null;
  capacity_kw?: number | null;
  capacity_category?: string | null;
  qr_code_data?: string | null;
  qr_code_url?: string | null;
  project_photo_url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  equipment?: ProjectEquipment[];
  recovery_requests?: RecoveryRequest[];
  recycle_income?: Record<string, number>;
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

export interface NercApplicationWithProject extends NercApplication {
  projects?: {
    id: UUID;
    name?: string | null;
    company_id?: UUID | null;
    companies?: {
      id?: UUID;
      name?: string | null;
    } | null;
  } | null;
}

export interface NercReportingCycleWithProject extends NercReportingCycle {
  projects?: {
    id: UUID;
    name?: string | null;
    company_id?: UUID | null;
    companies?: {
      id?: UUID;
      name?: string | null;
    } | null;
  } | null;
}

export interface CalculationRecord {
  id: UUID;
  project_id?: UUID;
  calculator_type?: string;
  calculation_data?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}
