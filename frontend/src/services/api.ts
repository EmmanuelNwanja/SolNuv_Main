import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { Session } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabase";
import { isPlanBlockCode, parseApiError } from "../utils/apiErrors";
import type {
  NercAdminApplicationsResponse,
  NercAdminReportingCyclesResponse,
  NercAdminSlaOverviewResponse,
  NercApplicationListResponse,
  NercProfileResponse,
  NercTriageResponse,
  NercReportingCycleListResponse,
} from "./api.types";

/** Generic JSON body for calculator/agent/etc. endpoints. */
export type JsonRecord = Record<string, unknown>;

function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "www.solnuv.com" || host === "solnuv.com") {
      return "https://api.solnuv.com";
    }
  }

  return "http://localhost:5000";
}

const API_URL = resolveApiUrl();

const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSessionSafely(timeoutMs = 1500): Promise<Session | null> {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      wait(timeoutMs).then(() => null),
    ]);
    if (!result || !("data" in result)) return null;
    return result.data?.session ?? null;
  } catch {
    return null;
  }
}

function readAccessTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const key = Object.keys(window.localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    if (!key) return null;

    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      access_token?: string;
      currentSession?: { access_token?: string };
    };
    if (parsed?.access_token) return parsed.access_token;
    if (Array.isArray(parsed) && parsed[0]?.access_token) return parsed[0].access_token;
    if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
    return null;
  } catch {
    return null;
  }
}

let accessTokenCache: string | null = null;
let authListenerBound = false;

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number };
    return typeof payload.exp !== "number" || payload.exp < Date.now() / 1000 + 30;
  } catch {
    return true;
  }
}

function ensureAuthListener(): void {
  if (typeof window === "undefined" || authListenerBound) return;
  authListenerBound = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    accessTokenCache = session?.access_token ?? null;
  });
}

async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  ensureAuthListener();

  if (accessTokenCache && isTokenExpired(accessTokenCache)) {
    accessTokenCache = null;
  }

  if (!accessTokenCache) {
    const fromStorage = readAccessTokenFromStorage();
    if (fromStorage && !isTokenExpired(fromStorage)) {
      accessTokenCache = fromStorage;
    }
  }

  if (!accessTokenCache) {
    const session = await getSessionSafely(1500);
    if (session?.access_token) {
      accessTokenCache = session.access_token;
    }
  }

  return accessTokenCache;
}

function requestSentBearerToken(config: InternalAxiosRequestConfig | undefined): boolean {
  if (!config?.headers) return false;
  const h = AxiosHeaders.from(config.headers);
  const v = h.get("Authorization") ?? h.get("authorization");
  return typeof v === "string" && v.startsWith("Bearer ");
}

/** Clears Supabase session when the API rejects our JWT (any protected route — same root cause app-wide). */
let invalidateSessionAfter401Promise: Promise<void> | null = null;
let lastSessionInvalidationToastAt = 0;

function invalidateSessionAfterRejectedBearer(err: AxiosError): void {
  if (typeof window === "undefined") return;
  const cfg = err.config as InternalAxiosRequestConfig | undefined;
  if (!requestSentBearerToken(cfg)) return;

  if (invalidateSessionAfter401Promise) return;

  invalidateSessionAfter401Promise = (async () => {
    try {
      const session = await getSessionSafely(2000);
      if (!session?.access_token) return;

      const now = Date.now();
      if (now - lastSessionInvalidationToastAt > 4000) {
        lastSessionInvalidationToastAt = now;
        toast.error("Your session is not valid for the app. Please sign in again.");
      }
      accessTokenCache = null;
      await supabase.auth.signOut();
    } finally {
      invalidateSessionAfter401Promise = null;
    }
  })();
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (token) {
    const headers = AxiosHeaders.from(config.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

api.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error: unknown) => {
    const err = error as AxiosError;
    const status = err.response?.status;
    const originalRequest = err.config as (InternalAxiosRequestConfig & { _retryAuth?: boolean }) | undefined;

    if (status === 401 && originalRequest && !originalRequest._retryAuth) {
      originalRequest._retryAuth = true;
      accessTokenCache = null;
      try {
        let session = await getSessionSafely(2000);
        if (!session?.access_token || isTokenExpired(session.access_token)) {
          const refreshResult = await supabase.auth.refreshSession();
          session = refreshResult.data?.session || null;
        }
        const nextToken = session?.access_token || null;
        if (nextToken) {
          accessTokenCache = nextToken;
          const headers = AxiosHeaders.from(originalRequest.headers ?? {});
          headers.set("Authorization", `Bearer ${nextToken}`);
          originalRequest.headers = headers;
          return api(originalRequest);
        }
      } catch {
        // Fall through and emit unauthorized event below.
      }
    }

    if (typeof window !== "undefined") {
      if (status === 401) {
        invalidateSessionAfterRejectedBearer(err);
        window.dispatchEvent(
          new CustomEvent("solnuv:unauthorized", {
            detail: { url: err.config?.url ?? null },
          })
        );
      } else if (status === 402 || status === 403 || status === 429) {
        const parsed = parseApiError(err);
        if (isPlanBlockCode(parsed.code)) {
          window.dispatchEvent(
            new CustomEvent("solnuv:plan-blocked", {
              detail: { parsed, url: err.config?.url ?? null },
            })
          );
        } else if (status === 429) {
          // Plain rate-limit 429 (express-rate-limit). Surface a distinct
          // event so UI can show a throttled toast instead of silent failure.
          const retryAfterHeader = err.response?.headers?.["retry-after"];
          const retryAfter =
            typeof retryAfterHeader === "string" ? Number(retryAfterHeader) : null;
          window.dispatchEvent(
            new CustomEvent("solnuv:rate-limited", {
              detail: {
                url: err.config?.url ?? null,
                retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
                message: parsed.message,
              },
            })
          );
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  wakeBackend: () => api.get("/health", { timeout: 6000 }),
  saveProfile: (data: JsonRecord) => api.post("/auth/profile", data),
  getMe: () => api.get("/auth/me"),
  getMeQuick: () => api.get("/auth/me", { timeout: 10000 }),
  getProfileStatus: () => api.get("/auth/profile-status"),
  requestPhoneVerificationOtp: (data: JsonRecord) => api.post("/auth/phone-verification/request", data),
  verifyPhoneVerificationOtp: (data: JsonRecord) => api.post("/auth/phone-verification/verify", data),
  requestPasswordResetOtp: (data: JsonRecord) => api.post("/auth/password-reset/request", data),
  verifyPasswordResetOtp: (data: JsonRecord) => api.post("/auth/password-reset/verify", data),
  completePasswordReset: (data: JsonRecord) => api.post("/auth/password-reset/complete", data),
  inviteMember: (data: JsonRecord) => api.post("/auth/invite", data),
  acceptInvite: (token: string) => api.post(`/auth/accept-invite/${token}`),
  checkInvite: (token: string) => api.get(`/auth/accept-invite/${token}`),
  getTeam: () => api.get("/auth/team"),
  getNotifications: (markRead = false) =>
    api.get("/auth/notifications", { params: markRead ? { mark_read: "true" } : {} }),
  markNotificationRead: (id: string) => api.patch(`/auth/notifications/${id}/read`),
  signup: (data: JsonRecord) => api.post("/auth/signup", data),
  getVerificationStatus: () => api.get("/auth/verification-status"),
  requestVerification: (data: JsonRecord) => api.post("/auth/verification-request", data),
  cancelVerificationRequest: () => api.delete("/auth/verification-request"),
};

export const projectsAPI = {
  list: (params?: JsonRecord) => api.get("/projects", { params }),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: JsonRecord) => api.post("/projects", data),
  update: (id: string, data: JsonRecord) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  geoVerify: (id: string, data: JsonRecord) => api.post(`/projects/${id}/geo-verify`, data),
  requestRecovery: (id: string, data: JsonRecord) => api.post(`/projects/${id}/recovery`, data),
  exportCSV: () => api.get("/projects/export/csv", { responseType: "blob" }),
  verify: (qrCode: string) => api.get(`/projects/verify/${qrCode}`),
  searchPublic: (params: JsonRecord) => api.get("/projects/public/search", { params }),
  getBatteryLedgerByQr: (qrCode: string) => api.get(`/projects/battery-ledger/${qrCode}`),
  addBatteryLogByQr: (qrCode: string, data: JsonRecord) =>
    api.post(`/projects/battery-ledger/${qrCode}/log`, data),
  addEquipment: (id: string, data: JsonRecord) => api.post(`/projects/${id}/equipment`, data),
  updateEquipment: (id: string, equipmentId: string, data: JsonRecord) =>
    api.put(`/projects/${id}/equipment/${equipmentId}`, data),
  deleteEquipment: (id: string, equipmentId: string) => api.delete(`/projects/${id}/equipment/${equipmentId}`),
  getHistory: (id: string) => api.get(`/projects/${id}/history`),
};

export const dashboardAPI = {
  get: () => api.get("/dashboard"),
  getImpact: () => api.get("/dashboard/impact"),
  getLeaderboard: (params?: JsonRecord) => api.get("/dashboard/leaderboard", { params }),
  getPublicSummary: () => api.get("/dashboard/public/summary"),
  getFeedbackOverview: () => api.get("/dashboard/feedback"),
  createFeedbackLink: (projectId: string) => api.post(`/dashboard/feedback/link/${projectId}`),
  submitPublicFeedback: (token: string, data: JsonRecord) =>
    api.post(`/dashboard/public/feedback/${token}`, data),
  getPublicProfile: (slug: string) => api.get(`/dashboard/public/profile/${slug}`),
};

export const reportsAPI = {
  generateNesrea: (data: JsonRecord) => api.post("/reports/nesrea", data, { responseType: "blob" }),
  sendNesrea: (data: JsonRecord) => api.post("/reports/nesrea", { ...data, action: "send_to_nesrea" }),
  getCertificate: (projectId: string) =>
    api.get(`/reports/certificate/${projectId}`, { responseType: "blob" }),
  getHistory: () => api.get("/reports/history"),
  exportExcel: () => api.get("/reports/excel", { responseType: "blob" }),
};

export const nercAPI = {
  getProjectProfile: (projectId: string) =>
    api.get<NercProfileResponse>(`/nerc/projects/${projectId}/profile`),
  getProjectTriage: (projectId: string) =>
    api.get<NercTriageResponse>(`/nerc/projects/${projectId}/triage`),
  updateProjectProfile: (projectId: string, data: JsonRecord) =>
    api.put<NercProfileResponse>(`/nerc/projects/${projectId}/profile`, data),
  listProjectApplications: (projectId: string) =>
    api.get<NercApplicationListResponse>(`/nerc/projects/${projectId}/applications`),
  createApplication: (projectId: string, data: JsonRecord) =>
    api.post(`/nerc/projects/${projectId}/applications`, data),
  createAssistedRequest: (projectId: string, data: JsonRecord = {}) =>
    api.post(`/nerc/projects/${projectId}/assisted-request`, data),
  confirmPortalSubmission: (projectId: string, data: JsonRecord = {}) =>
    api.post(`/nerc/projects/${projectId}/confirm-portal-submission`, data),
  updateApplication: (applicationId: string, data: JsonRecord) =>
    api.patch(`/nerc/applications/${applicationId}`, data),
  submitApplication: (applicationId: string) => api.post(`/nerc/applications/${applicationId}/submit`),
  exportProject: (projectId: string, format: "csv" | "excel" = "csv") =>
    api.get(`/nerc/projects/${projectId}/export`, {
      params: { format },
      responseType: "blob",
    }),
  exportProjects: (band: "under_100" | "over_100", format: "csv" | "excel" = "csv") =>
    api.get("/nerc/export", {
      params: { band, format },
      responseType: "blob",
    }),
  listMyReportingCycles: (params?: JsonRecord) =>
    api.get<NercReportingCycleListResponse>("/nerc/reporting-cycles", { params }),
  listProjectReportingCycles: (projectId: string) =>
    api.get<NercReportingCycleListResponse>(`/nerc/projects/${projectId}/reporting-cycles`),
  createReportingCycle: (projectId: string, data: JsonRecord) =>
    api.post(`/nerc/projects/${projectId}/reporting-cycles`, data),
  submitReportingCycle: (cycleId: string, data: JsonRecord) =>
    api.post(`/nerc/reporting-cycles/${cycleId}/submissions`, data),
  adminListApplications: (params?: JsonRecord) =>
    api.get<NercAdminApplicationsResponse>("/nerc/admin/applications", { params }),
  adminDecisionApplication: (applicationId: string, data: JsonRecord) =>
    api.patch(`/nerc/admin/applications/${applicationId}/decision`, data),
  adminSlaOverview: () => api.get<NercAdminSlaOverviewResponse>("/nerc/admin/sla-overview"),
  adminListReportingCycles: (params?: JsonRecord) =>
    api.get<NercAdminReportingCyclesResponse>("/nerc/admin/reporting-cycles", { params }),
};

export const calculatorAPI = {
  panel: (data: JsonRecord) => api.post("/calculator/panel", data),
  silver: (data: JsonRecord) => api.post("/calculator/silver", data),
  battery: (data: JsonRecord) => api.post("/calculator/battery", data),
  degradation: (data: JsonRecord) => api.post("/calculator/degradation", data),
  degradationPreview: (data: JsonRecord) => api.post("/calculator/degradation/preview", data),
  roi: (data: JsonRecord) => api.post("/calculator/roi", data),
  batterySoh: (data: JsonRecord) => api.post("/calculator/battery-soh", data),
  cableSize: (data: JsonRecord) => api.post("/calculator/cable-size", data),
  exportRoiPdf: (data: JsonRecord) => api.post("/calculator/roi/pdf", data, { responseType: "blob" }),
  exportCableCertificatePdf: (data: JsonRecord) =>
    api.post("/calculator/cable-size/pdf", data, { responseType: "blob" }),
  getSilverPrice: () => api.get("/calculator/silver-price"),
  getBrands: () => api.get("/calculator/brands"),
  submitBrand: (data: JsonRecord) => api.post("/calculator/brands/submit", data),
  getStates: () => api.get("/calculator/states"),
  getTechnologies: () => api.get("/calculator/technologies"),
  getUsage: () => api.get("/calculator/usage"),
  getMarketPrices: () => api.get("/calculator/market-prices"),
  saveCalculation: (data: JsonRecord) => api.post("/calculator/saved", data),
  getSavedCalculations: (params?: JsonRecord) => api.get("/calculator/saved", { params }),
  getSavedCalculation: (id: string) => api.get(`/calculator/saved/${id}`),
  deleteSavedCalculation: (id: string) => api.delete(`/calculator/saved/${id}`),
  getProjectCalculations: (projectId: string) => api.get(`/calculator/saved/project/${projectId}`),
  exportCalculationPdf: (id: string) => api.post(`/calculator/saved/${id}/export-pdf`),
  calculateCostEstimate: (data: JsonRecord) => api.post("/calculator/cost-estimate", data),
  saveCostEstimate: (data: JsonRecord) => api.post("/calculator/cost-estimate/save", data),
  getSavedCostEstimates: (params?: JsonRecord) => api.get("/calculator/cost-estimates/saved", { params }),
  getProjectCostEstimates: (projectId: string) =>
    api.get(`/calculator/cost-estimates/project/${projectId}`),
  deleteCostEstimate: (id: string) => api.delete(`/calculator/cost-estimates/${id}`),
};

export const engineeringAPI = {
  saveProposalScenario: (projectId: string, data: JsonRecord) =>
    api.post(`/projects/${projectId}/proposal-scenario`, data),
  listBatteryAssets: (projectId: string) => api.get(`/projects/${projectId}/battery-assets`),
  createBatteryAsset: (projectId: string, data: JsonRecord) =>
    api.post(`/projects/${projectId}/battery-assets`, data),
  addBatteryHealthLog: (projectId: string, assetId: string, data: JsonRecord) =>
    api.post(`/projects/${projectId}/battery-assets/${assetId}/logs`, data),
  getBatteryHealthLogs: (projectId: string, assetId: string) =>
    api.get(`/projects/${projectId}/battery-assets/${assetId}/logs`),
  saveCableCompliance: (projectId: string, data: JsonRecord) =>
    api.post(`/projects/${projectId}/cable-compliance`, data),
};

export const paymentsAPI = {
  getPlans: () => api.get("/payments/plans"),
  initialize: (data: JsonRecord) => api.post("/payments/initialize", data),
  verify: (reference: string) => api.get(`/payments/verify/${reference}`),
  validatePromo: (data: JsonRecord) => api.post("/payments/promo/validate", data),
  history: () => api.get("/payments/history"),
  getBankTransferSettings: () => api.get("/payments/bank-transfer/settings"),
  submitBankTransfer: (formData: FormData) =>
    api.post("/payments/bank-transfer/submit", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getMyBankTransferSubmissions: () => api.get("/payments/bank-transfer/my-submissions"),
};

export const adminAPI = {
  getOverview: () => api.get("/admin/overview"),
  listUsers: (params?: JsonRecord) => api.get("/admin/users", { params }),
  updateUserVerification: (data: JsonRecord) => api.patch("/admin/users/verification", data),
  listPaystackPlans: () => api.get("/admin/paystack-plans"),
  upsertPaystackPlan: (data: JsonRecord) => api.post("/admin/paystack-plans", data),
  listPromoCodes: () => api.get("/admin/promo-codes"),
  createPromoCode: (data: JsonRecord) => api.post("/admin/promo-codes", data),
  togglePromoCode: (id: string, active: boolean) =>
    api.patch(`/admin/promo-codes/${id}/toggle`, { active }),
  getFinance: (params?: JsonRecord) => api.get("/admin/finance", { params }),
  sendPushNotification: (data: JsonRecord) => api.post("/admin/push-notifications", data),
  getActivityLogs: () => api.get("/admin/activity-logs"),
  listAdmins: () => api.get("/admin/admins"),
  upsertAdmin: (data: JsonRecord) => api.post("/admin/admins", data),
  getOtps: () => api.get("/admin/otps", { timeout: 20000 }),
  generateOtp: (data: JsonRecord) => api.post("/admin/otps", data, { timeout: 20000 }),
  listVerificationRequests: (params?: JsonRecord) =>
    api.get("/admin/verification-requests", { params }),
  verifyUser: (id: string) => api.patch(`/admin/users/${id}/verify`),
  rejectVerification: (id: string, reason: string) =>
    api.patch(`/admin/users/${id}/reject-verification`, { reason }),
  listAllProjects: (params?: JsonRecord) => api.get("/admin/projects", { params }),
  adminBulkUpdateProjects: (projectIds: string[], update: JsonRecord) =>
    api.patch("/admin/projects/bulk", { project_ids: projectIds, update }),
  adminUpdateProject: (id: string, data: JsonRecord) => api.patch(`/admin/projects/${id}`, data),
  updateUserManagement: (data: JsonRecord) => api.patch("/admin/users/verification", data),
  suspendUser: (id: string, data: JsonRecord) => api.patch(`/admin/users/${id}/suspend`, data),
  deleteUser: (id: string, data: JsonRecord) => api.delete(`/admin/users/${id}`, { data }),
  listRecoveryRequests: (params?: JsonRecord) => api.get("/admin/recovery-requests", { params }),
  approveDecommission: (id: string, data?: JsonRecord) =>
    api.patch(`/admin/recovery-requests/${id}/approve`, data ?? {}),
  listV2Organizations: (params?: JsonRecord) => api.get("/admin/v2-organizations", { params }),
  updateV2OrganizationStatus: (id: string, verification_status: string, reason?: string) =>
    api.patch(`/admin/v2-organizations/${id}/status`, { verification_status, reason: reason || null }),
  assignRecoveryPartner: (id: string, organization_id: string) =>
    api.patch(`/admin/recovery-requests/${id}/assign-partner`, { organization_id }),
  getEnvironmentMode: () => api.get("/admin/settings/environment"),
  toggleEnvironmentMode: (mode: string) => api.patch("/admin/settings/environment", { mode }),
  getDesignOverview: () => api.get("/admin/design/overview"),
  listSimulations: (params?: JsonRecord) => api.get("/admin/design/simulations", { params }),
  listTariffStructures: (params?: JsonRecord) => api.get("/admin/design/tariffs", { params }),
  getTariffDetail: (id: string) => api.get(`/admin/design/tariffs/${id}`),
  createTariffTemplate: (data: JsonRecord) => api.post("/admin/design/tariffs", data),
  updateTariffTemplate: (id: string, data: JsonRecord) =>
    api.patch(`/admin/design/tariffs/${id}`, data),
  deleteTariffTemplate: (id: string) => api.delete(`/admin/design/tariffs/${id}`),
  listReportShares: (params?: JsonRecord) => api.get("/admin/design/report-shares", { params }),
  revokeReportShare: (id: string) => api.patch(`/admin/design/report-shares/${id}/revoke`),
  getDesignAdoption: () => api.get("/admin/design/adoption"),
  getNercSlaOverview: () => api.get("/admin/nerc/sla-overview"),
  listNercApplications: (params?: JsonRecord) => api.get("/admin/nerc/applications", { params }),
  decideNercApplication: (id: string, data: JsonRecord) =>
    api.patch(`/admin/nerc/applications/${id}/decision`, data),
  listNercReportingCycles: (params?: JsonRecord) =>
    api.get("/admin/nerc/reporting-cycles", { params }),
  listNercCycleSubmissions: (cycleId: string) =>
    api.get(`/admin/nerc/reporting-cycles/${cycleId}/submissions`),
  decideNercSubmission: (submissionId: string, data: JsonRecord) =>
    api.patch(`/admin/nerc/submissions/${submissionId}/decision`, data),
  overrideNercCycleStatus: (cycleId: string, data: JsonRecord) =>
    api.patch(`/admin/nerc/reporting-cycles/${cycleId}/status`, data),
  getAdminBankTransferSettings: () => api.get("/admin/payment-settings/bank-transfer"),
  updateBankTransferSettings: (data: JsonRecord) =>
    api.put("/admin/payment-settings/bank-transfer", data),
  listDirectPayments: (params?: JsonRecord) => api.get("/admin/direct-payments", { params }),
  verifyDirectPayment: (id: string, data?: JsonRecord) =>
    api.post(`/admin/direct-payments/${id}/verify`, data ?? {}),
  rejectDirectPayment: (id: string, data: JsonRecord) =>
    api.post(`/admin/direct-payments/${id}/reject`, data),
};

export const blogAPI = {
  listPosts: (params?: JsonRecord) => api.get("/blog/posts", { params }),
  getPost: (slug: string) => api.get(`/blog/posts/${slug}`),
  trackLinkClick: (slug: string, url: string) => api.post(`/blog/posts/${slug}/click`, { url }),
  listAds: (params?: JsonRecord) => api.get("/blog/ads", { params }),
  getPopupAd: (params?: JsonRecord) => api.get("/blog/ads/popup", { params }),
  getCampaignPopups: () => api.get("/blog/campaigns/popup"),
  trackAdImpression: (id: string, page_path: string) =>
    api.post(`/blog/ads/${id}/impression`, { page_path }),
  trackAdClick: (id: string, page_path: string) => api.post(`/blog/ads/${id}/click`, { page_path }),
  adminListPosts: (params?: JsonRecord) => api.get("/blog/admin/posts", { params }),
  adminCreatePost: (data: JsonRecord) => api.post("/blog/admin/posts", data),
  adminUpdatePost: (id: string, data: JsonRecord) => api.patch(`/blog/admin/posts/${id}`, data),
  adminDeletePost: (id: string) => api.delete(`/blog/admin/posts/${id}`),
  adminGetPostAnalytics: (id: string) => api.get(`/blog/admin/posts/${id}/analytics`),
  adminListAds: () => api.get("/blog/admin/ads"),
  adminCreateAd: (data: JsonRecord) => api.post("/blog/admin/ads", data),
  adminUpdateAd: (id: string, data: JsonRecord) => api.patch(`/blog/admin/ads/${id}`, data),
  adminDeleteAd: (id: string) => api.delete(`/blog/admin/ads/${id}`),
  adminListAdsAnalytics: (params?: JsonRecord) => api.get("/blog/admin/ads/analytics", { params }),
  adminGetAdAnalytics: (id: string) => api.get(`/blog/admin/ads/${id}/analytics`),
  adminListCampaigns: () => api.get("/blog/admin/campaigns"),
  adminCreateCampaign: (data: JsonRecord) => api.post("/blog/admin/campaigns", data),
  adminUpdateCampaign: (id: string, data: JsonRecord) =>
    api.patch(`/blog/admin/campaigns/${id}`, data),
  adminDeleteCampaign: (id: string) => api.delete(`/blog/admin/campaigns/${id}`),
};

export const contactAPI = {
  submit: (data: JsonRecord) => api.post("/contact", data),
  adminList: (params?: JsonRecord) => api.get("/contact/admin", { params }),
  adminUpdate: (id: string, data: JsonRecord) => api.patch(`/contact/admin/${id}`, data),
  adminDelete: (id: string) => api.delete(`/contact/admin/${id}`),
};

export const faqAPI = {
  list: () => api.get("/faq"),
  adminList: () => api.get("/faq/admin"),
  adminCreate: (data: JsonRecord) => api.post("/faq/admin", data),
  adminUpdate: (id: string, data: JsonRecord) => api.patch(`/faq/admin/${id}`, data),
  adminDelete: (id: string) => api.delete(`/faq/admin/${id}`),
};

export const opportunitiesAPI = {
  listPublic: (params?: JsonRecord) => api.get("/opportunities", { params }),
  apply: (id: string, data: JsonRecord) => api.post(`/opportunities/${id}/apply`, data),
  adminList: (params?: JsonRecord) => api.get("/opportunities/admin/list", { params }),
  adminCreate: (data: JsonRecord) => api.post("/opportunities/admin", data),
  adminUpdate: (id: string, data: JsonRecord) => api.patch(`/opportunities/admin/${id}`, data),
  adminDelete: (id: string) => api.delete(`/opportunities/admin/${id}`),
  adminListApplications: (params?: JsonRecord) => api.get("/opportunities/admin/applications/list", { params }),
  adminUpdateApplication: (id: string, data: JsonRecord) =>
    api.patch(`/opportunities/admin/applications/${id}`, data),
};

export const integrationAPI = {
  list: () => api.get("/integrations"),
  create: (data: JsonRecord) => api.post("/integrations", data),
  update: (id: string, data: JsonRecord) => api.patch(`/integrations/${id}`, data),
  delete: (id: string) => api.delete(`/integrations/${id}`),
  test: (id: string) => api.post(`/integrations/${id}/test`),
  previewDispatch: (id: string, data: JsonRecord) => api.post(`/integrations/${id}/dispatch/preview`, data),
  dispatch: (id: string, data: JsonRecord) => api.post(`/integrations/${id}/dispatch`, data),
  listLogs: (params?: JsonRecord) => api.get("/integrations/logs/list", { params }),
};

export const analyticsAPI = {
  getFullAnalytics: (params?: JsonRecord) => api.get("/analytics", { params }),
  trackPageView: (data: JsonRecord) => api.post("/analytics/pageview", data),
};

export const agentAPI = {
  getInstances: () => api.get("/agent/instances"),
  chat: (data: JsonRecord) => api.post("/agent/chat", data),
  getConversations: (params?: JsonRecord) => api.get("/agent/conversations", { params }),
  getMessages: (conversationId: string, params?: JsonRecord) =>
    api.get(`/agent/conversations/${conversationId}/messages`, { params }),
  closeConversation: (conversationId: string) =>
    api.patch(`/agent/conversations/${conversationId}/close`),
  createTask: (data: JsonRecord) => api.post("/agent/tasks", data),
  getTasks: (params?: JsonRecord) => api.get("/agent/tasks", { params }),
  getTaskDetail: (taskId: string) => api.get(`/agent/tasks/${taskId}`),
  adminGetDefinitions: () => api.get("/agent/admin/definitions"),
  adminGetDefinition: (id: string) => api.get(`/agent/admin/definitions/${id}`),
  adminUpdateDefinition: (id: string, data: JsonRecord) =>
    api.patch(`/agent/admin/definitions/${id}`, data),
  adminAddKnowledge: (id: string, data: JsonRecord) =>
    api.post(`/agent/admin/definitions/${id}/knowledge`, data),
  adminUpdateKnowledge: (id: string, docId: string, data: JsonRecord) =>
    api.put(`/agent/admin/definitions/${id}/knowledge/${docId}`, data),
  adminRemoveKnowledge: (id: string, docId: string) =>
    api.delete(`/agent/admin/definitions/${id}/knowledge/${docId}`),
  adminAssignAgents: (data: JsonRecord) => api.post("/agent/admin/assign", data),
  adminRevokeAgents: (data: JsonRecord) => api.post("/agent/admin/revoke", data),
  adminGetInstances: (params?: JsonRecord) => api.get("/agent/admin/instances", { params }),
  adminGetTasks: (params?: JsonRecord) => api.get("/agent/admin/tasks", { params }),
  adminGetEscalations: (params?: JsonRecord) => api.get("/agent/admin/escalations", { params }),
  adminResolveEscalation: (id: string, data: JsonRecord) =>
    api.patch(`/agent/admin/escalations/${id}`, data),
  adminGetUsage: (params?: JsonRecord) => api.get("/agent/admin/usage", { params }),
  adminHealth: () => api.get("/agent/admin/health"),
  adminExportTraining: (params?: JsonRecord) =>
    api.get("/agent/admin/training-export", { params, responseType: "blob" }),
  adminSeed: () => api.post("/agent/admin/seed"),
  adminRunBlogWriter: (data: JsonRecord) => api.post("/agent/admin/run-blog-writer", data),
};

export const tariffAPI = {
  getTemplates: (country: string) => api.get("/tariffs/templates", { params: { country } }),
  getUserTariffs: () => api.get("/tariffs"),
  create: (data: JsonRecord) => api.post("/tariffs", data),
  getDetail: (id: string) => api.get(`/tariffs/${id}`),
  update: (id: string, data: JsonRecord) => api.put(`/tariffs/${id}`, data),
  delete: (id: string) => api.delete(`/tariffs/${id}`),
};

export const partnerAPI = {
  listRecyclerPickups: () => api.get("/partner/recycler/pickups"),
  recyclerSlaSummary: () => api.get("/partner/recycler/sla-summary"),
  logPortalEvent: (data: JsonRecord) => api.post("/partner/portal-events", data),
  listPortalEvents: (params?: JsonRecord) => api.get("/partner/portal-events", { params }),
  listFinancierFunding: () => api.get("/partner/financier/funding-requests"),
  createFinancierFunding: (data: JsonRecord) => api.post("/partner/financier/funding-requests", data),
  financierFinancials: () => api.get("/partner/financier/financials-summary"),
  listFinancierEscrowDecisions: (params?: JsonRecord) =>
    api.get("/partner/financier/escrow-decisions", { params }),
  listTrainingInstitutes: () => api.get("/partner/training/institutes"),
  importTrainingGraduates: (formData: FormData) =>
    api.post("/partner/training/import-graduates", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  listTrainingVerificationRequests: () => api.get("/partner/training/verification-requests"),
  decideTrainingVerificationRequest: (id: string, data: JsonRecord) =>
    api.patch(`/partner/training/verification-requests/${id}/decision`, data),
  trainingImpactSummary: () => api.get("/partner/training/impact-summary"),
};

export const verificationAPI = {
  searchProfessionals: (params: JsonRecord) => api.get("/public/professionals/search", { params }),
  searchCompanies: (params: JsonRecord) => api.get("/public/companies/search", { params }),
  listTrainingInstitutes: () => api.get("/public/training-institutes"),
  submitCompetencyRequest: (data: JsonRecord) => api.post("/public/requests", data),
};

export const pitchdeckAPI = {
  getPublicDeck: (slug = "pitch") => api.get(`/pitchdeck/public/${slug}`),
  listAdminDecks: () => api.get("/pitchdeck/admin/decks"),
  getAdminDeck: (id: string) => api.get(`/pitchdeck/admin/decks/${id}`),
  saveDeck: (data: JsonRecord) => (data.id
    ? api.put(`/pitchdeck/admin/decks/${String(data.id)}`, data)
    : api.post("/pitchdeck/admin/decks", data)),
  saveSlide: (data: JsonRecord) => (data.id
    ? api.put(`/pitchdeck/admin/slides/${String(data.id)}`, data)
    : api.post("/pitchdeck/admin/slides", data)),
  deleteSlide: (id: string) => api.delete(`/pitchdeck/admin/slides/${id}`),
  saveCard: (data: JsonRecord) => (data.id
    ? api.put(`/pitchdeck/admin/cards/${String(data.id)}`, data)
    : api.post("/pitchdeck/admin/cards", data)),
  deleteCard: (id: string) => api.delete(`/pitchdeck/admin/cards/${id}`),
  saveMetric: (data: JsonRecord) => (data.id
    ? api.put(`/pitchdeck/admin/metrics/${String(data.id)}`, data)
    : api.post("/pitchdeck/admin/metrics", data)),
};

export const cmsAPI = {
  resolvePage: (route_path: string) => api.get("/cms/resolve", { params: { route_path } }),
  listAdminPages: () => api.get("/cms/admin/pages"),
  getAdminPage: (id: string) => api.get(`/cms/admin/pages/${id}`),
  savePage: (data: JsonRecord) =>
    data.id ? api.put(`/cms/admin/pages/${String(data.id)}`, data) : api.post("/cms/admin/pages", data),
  saveSection: (data: JsonRecord) =>
    data.id ? api.put(`/cms/admin/sections/${String(data.id)}`, data) : api.post("/cms/admin/sections", data),
  deleteSection: (id: string) => api.delete(`/cms/admin/sections/${id}`),
  saveCard: (data: JsonRecord) =>
    data.id ? api.put(`/cms/admin/cards/${String(data.id)}`, data) : api.post("/cms/admin/cards", data),
  deleteCard: (id: string) => api.delete(`/cms/admin/cards/${id}`),
  saveLink: (data: JsonRecord) =>
    data.id ? api.put(`/cms/admin/links/${String(data.id)}`, data) : api.post("/cms/admin/links", data),
  deleteLink: (id: string) => api.delete(`/cms/admin/links/${id}`),
  publishPage: (id: string) => api.post(`/cms/admin/pages/${id}/publish`),
  unpublishPage: (id: string) => api.post(`/cms/admin/pages/${id}/unpublish`),
  rollbackPage: (id: string, revision_number: number) =>
    api.post(`/cms/admin/pages/${id}/rollback`, { revision_number }),
  reorder: (entity: "sections" | "cards" | "links", items: Array<{ id: string; order_index: number }>) =>
    api.post("/cms/admin/reorder", { entity, items }),
  bootstrapSeeds: () => api.post("/cms/admin/bootstrap-seeds"),
};

export const v2API = {
  health: () => api.get("/v2/health"),
  registerActor: (data: JsonRecord) => api.post("/v2/onboarding/register-actor", data),
  registerSerials: (data: JsonRecord) => api.post("/v2/assets/serial-registrations", data),
  listEscrowPolicies: (organization_id: string) =>
    api.get("/v2/escrow/policies", { params: { organization_id } }),
  createEscrowPolicy: (data: JsonRecord) => api.post("/v2/escrow/policies", data),
  evaluateEscrowDecision: (data: JsonRecord) => api.post("/v2/escrow/decisions/evaluate", data),
  executeEscrowDecision: (decision_id: string, organization_id: string) =>
    api.post("/v2/escrow/executions/submit", { decision_id, organization_id }),
  listLifecycleEvents: (organization_id: string, params?: JsonRecord) =>
    api.get("/v2/lifecycle/events", { params: { organization_id, ...(params || {}) } }),
  createLifecycleEvent: (data: JsonRecord) => api.post("/v2/lifecycle/events", data),
};

export const loadProfileAPI = {
  upload: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("project_id", projectId);
    form.append("file", file);
    return api.post("/load-profiles/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  manual: (data: JsonRecord) => api.post("/load-profiles/manual", data),
  generateSynthetic: (data: JsonRecord) => api.post("/load-profiles/synthetic", data),
  confirmSynthetic: (data: JsonRecord) => api.post("/load-profiles/synthetic/confirm", data),
  getProfile: (projectId: string) => api.get(`/load-profiles/${projectId}`),
  getHourly: (projectId: string) => api.get(`/load-profiles/${projectId}/hourly`),
};

export const simulationAPI = {
  run: (data: JsonRecord) => api.post("/simulation/run", data, { timeout: 120000 }),
  preview: (data: JsonRecord) => api.post("/simulation/preview", data, { timeout: 20000 }),
  getDesignConfig: (projectId: string) => api.get(`/simulation/${projectId}/design-config`),
  getDesignVersions: (projectId: string) => api.get(`/simulation/${projectId}/design-versions`),
  restoreDesignVersion: (projectId: string, resultId: string) =>
    api.post(`/simulation/${projectId}/design-versions/${resultId}/restore`),
  getResults: (projectId: string) => api.get(`/simulation/${projectId}/results`),
  getHourlyFlows: (projectId: string, params?: JsonRecord) =>
    api.get(`/simulation/${projectId}/results/hourly`, { params }),
  getSolarResource: (lat: number, lon: number) =>
    api.get("/simulation/solar-resource", { params: { lat, lon } }),
  autoSize: (data: JsonRecord) => api.post("/simulation/auto-size", data),
  generateAIFeedback: (projectId: string) => api.post(`/simulation/${projectId}/ai-feedback`),
  saveAIFeedback: (projectId: string, editedText: string) =>
    api.put(`/simulation/${projectId}/ai-feedback`, { edited_text: editedText }),
};

export const designReportAPI = {
  getHtmlData: (projectId: string) => api.get(`/design-reports/${projectId}/html`),
  getV2Json: (projectId: string) => api.get(`/design-reports/${projectId}/v2/json`),
  downloadPdf: (projectId: string) =>
    api.get(`/design-reports/${projectId}/pdf`, { responseType: "blob" }),
  downloadV2Pdf: (projectId: string) =>
    api.get(`/design-reports/${projectId}/v2/pdf`, { responseType: "blob" }),
  downloadExcel: (projectId: string) =>
    api.get(`/design-reports/${projectId}/excel`, { responseType: "blob" }),
  downloadV2Excel: (projectId: string) =>
    api.get(`/design-reports/${projectId}/v2/excel`, { responseType: "blob" }),
  downloadPack: (projectId: string) =>
    api.get(`/design-reports/${projectId}/pack`, { responseType: "blob" }),
  createShareLink: (projectId: string, data: JsonRecord) =>
    api.post(`/design-reports/${projectId}/share`, data),
  getSharedReport: (token: string) => api.get(`/design-reports/shared/${token}`),
  downloadSharedReportPdf: (token: string) =>
    api.get(`/design-reports/shared/${token}/pdf`, { responseType: "blob" }),
  listImportedReports: (projectId: string) => api.get(`/design-reports/${projectId}/imported-reports`),
  uploadImportedReport: (projectId: string, file: File, reportLabel = "imported") => {
    const form = new FormData();
    form.append("file", file);
    form.append("report_label", reportLabel);
    return api.post(`/design-reports/${projectId}/imported-reports`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const apiKeyAPI = {
  list: () => api.get("/api-keys"),
  create: (data: { name: string; scopes?: string[]; expires_at?: string | null }) =>
    api.post("/api-keys", data),
  revoke: (id: string) => api.delete(`/api-keys/${id}`),
};

export function downloadBlob(blob: BlobPart, filename: string): void {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default api;
