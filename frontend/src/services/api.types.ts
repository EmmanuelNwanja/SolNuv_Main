import type {
  ApiEnvelope,
  CalculationRecord,
  NercApplication,
  NercApplicationWithProject,
  NercProjectTriage,
  ProjectRegulatoryProfile,
  NercReportingCycle,
  NercReportingCycleWithProject,
  ProjectRecord,
  UserProfile,
} from "../types/contracts";

export type ProjectResponse = ApiEnvelope<ProjectRecord>;
export type ProjectListResponse = ApiEnvelope<ProjectRecord[]>;
export type UserResponse = ApiEnvelope<UserProfile>;
export type CalculationListResponse = ApiEnvelope<{ active: CalculationRecord[] }>;
export type NercApplicationListResponse = ApiEnvelope<NercApplication[]>;
export type NercReportingCycleListResponse = ApiEnvelope<NercReportingCycle[]>;
export type NercProfileResponse = ApiEnvelope<ProjectRegulatoryProfile>;
export type NercTriageResponse = ApiEnvelope<NercProjectTriage>;
export type NercAdminApplicationsResponse = ApiEnvelope<{
  applications: NercApplicationWithProject[];
  total: number;
  page: number;
  limit: number;
}>;
export type NercAdminReportingCyclesResponse = ApiEnvelope<{
  cycles: NercReportingCycleWithProject[];
  total: number;
  page: number;
  limit: number;
}>;
export type NercAdminSlaOverviewResponse = ApiEnvelope<{
  total: number;
  pending_review: number;
  sla_breached: number;
  due_in_5_days: number;
}>;

export interface PaginationParams {
  page?: number;
  limit?: number;
  query?: string;
  [key: string]: string | number | boolean | undefined;
}
