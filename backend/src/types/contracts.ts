export type UUID = string;

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

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
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  [key: string]: unknown;
}

export interface NercReportingCycle {
  id: UUID;
  project_id: UUID;
  status: string;
  due_date?: string | null;
  [key: string]: unknown;
}
