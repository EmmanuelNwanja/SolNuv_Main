import type {
  ApiEnvelope,
  CalculationRecord,
  NercApplication,
  NercReportingCycle,
  ProjectRecord,
  UserProfile,
} from "../types/contracts";

export type ProjectResponse = ApiEnvelope<ProjectRecord>;
export type ProjectListResponse = ApiEnvelope<ProjectRecord[]>;
export type UserResponse = ApiEnvelope<UserProfile>;
export type CalculationListResponse = ApiEnvelope<{ active: CalculationRecord[] }>;
export type NercApplicationListResponse = ApiEnvelope<NercApplication[]>;
export type NercReportingCycleListResponse = ApiEnvelope<NercReportingCycle[]>;

export interface PaginationParams {
  page?: number;
  limit?: number;
  query?: string;
  [key: string]: string | number | boolean | undefined;
}
