import axios from 'axios';
import { supabase } from '../utils/supabase';

function resolveApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'www.solnuv.com' || host === 'solnuv.com') {
      return 'https://api.solnuv.com';
    }
  }

  return 'http://localhost:5000';
}

const API_URL = resolveApiUrl();

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

let accessTokenCache = null;
let authListenerBound = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSessionSafely(timeoutMs = 1500) {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      wait(timeoutMs).then(() => null),
    ]);
    return result?.data?.session || null;
  } catch {
    return null;
  }
}

function readAccessTokenFromStorage() {
  if (typeof window === 'undefined') return null;

  try {
    const key = Object.keys(window.localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    if (!key) return null;

    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed?.access_token) return parsed.access_token;
    if (Array.isArray(parsed) && parsed[0]?.access_token) return parsed[0].access_token;
    if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
    return null;
  } catch {
    return null;
  }
}

function ensureAuthListener() {
  if (typeof window === 'undefined' || authListenerBound) return;
  authListenerBound = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    accessTokenCache = session?.access_token || null;
  });
}

// Attach Supabase auth token to every request
api.interceptors.request.use(async (config) => {
  ensureAuthListener();

  if (!accessTokenCache) {
    accessTokenCache = readAccessTokenFromStorage();
  }

  let token = accessTokenCache;
  if (!token) {
    const session = await getSessionSafely();
    token = session?.access_token || readAccessTokenFromStorage();
    if (token) accessTokenCache = token;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Handle expired sessions
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Avoid force-signing out users on every unauthorized API response.
      // Some endpoints can return 401/403 while session remains valid.
      window.dispatchEvent(new CustomEvent('solnuv:unauthorized', {
        detail: { url: error.config?.url || null },
      }));
    }
    return Promise.reject(error);
  }
);

// ==============================
// AUTH
// ==============================
export const authAPI = {
  wakeBackend: () => api.get('/health', { timeout: 6000 }),
  saveProfile: (data) => api.post('/auth/profile', data),
  getMe: () => api.get('/auth/me'),
  getMeQuick: () => api.get('/auth/me', { timeout: 10000 }),
  getProfileStatus: () => api.get('/auth/profile-status'),
  requestPhoneVerificationOtp: (data) => api.post('/auth/phone-verification/request', data),
  verifyPhoneVerificationOtp: (data) => api.post('/auth/phone-verification/verify', data),
  requestPasswordResetOtp: (data) => api.post('/auth/password-reset/request', data),
  verifyPasswordResetOtp: (data) => api.post('/auth/password-reset/verify', data),
  completePasswordReset: (data) => api.post('/auth/password-reset/complete', data),
  inviteMember: (data) => api.post('/auth/invite', data),
  acceptInvite: (token) => api.post(`/auth/accept-invite/${token}`),
  checkInvite: (token) => api.get(`/auth/accept-invite/${token}`),
  getTeam: () => api.get('/auth/team'),
  getNotifications: (markRead = false) => api.get('/auth/notifications', { params: markRead ? { mark_read: 'true' } : {} }),
};

// ==============================
// PROJECTS
// ==============================
export const projectsAPI = {
  list: (params) => api.get('/projects', { params }),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  requestRecovery: (id, data) => api.post(`/projects/${id}/recovery`, data),
  exportCSV: () => api.get('/projects/export/csv', { responseType: 'blob' }),
  verify: (qrCode) => api.get(`/projects/verify/${qrCode}`),
  getBatteryLedgerByQr: (qrCode) => api.get(`/projects/battery-ledger/${qrCode}`),
  addBatteryLogByQr: (qrCode, data) => api.post(`/projects/battery-ledger/${qrCode}/log`, data),
  // Equipment CRUD (draft / maintenance only)
  addEquipment: (id, data) => api.post(`/projects/${id}/equipment`, data),
  updateEquipment: (id, equipmentId, data) => api.put(`/projects/${id}/equipment/${equipmentId}`, data),
  deleteEquipment: (id, equipmentId) => api.delete(`/projects/${id}/equipment/${equipmentId}`),
  // Change history
  getHistory: (id) => api.get(`/projects/${id}/history`),
};

// ==============================
// DASHBOARD
// ==============================
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
  getImpact: () => api.get('/dashboard/impact'),
  getLeaderboard: (params) => api.get('/dashboard/leaderboard', { params }),
  getFeedbackOverview: () => api.get('/dashboard/feedback'),
  createFeedbackLink: (projectId) => api.post(`/dashboard/feedback/link/${projectId}`),
  submitPublicFeedback: (token, data) => api.post(`/dashboard/public/feedback/${token}`, data),
  getPublicProfile: (slug) => api.get(`/dashboard/public/profile/${slug}`),
};

// ==============================
// REPORTS
// ==============================
export const reportsAPI = {
  generateNesrea: (data) => api.post('/reports/nesrea', data, { responseType: 'blob' }),
  sendNesrea: (data) => api.post('/reports/nesrea', { ...data, action: 'send_to_nesrea' }),
  getCertificate: (projectId) => api.get(`/reports/certificate/${projectId}`, { responseType: 'blob' }),
  getHistory: () => api.get('/reports/history'),
  exportExcel: () => api.get('/reports/excel', { responseType: 'blob' }),
};

// ==============================
// CALCULATOR (public)
// ==============================
export const calculatorAPI = {
  panel: (data) => api.post('/calculator/panel', data),       // full: silver + second-life
  silver: (data) => api.post('/calculator/silver', data),     // legacy compat
  battery: (data) => api.post('/calculator/battery', data),   // full: recycling + second-life
  degradation: (data) => api.post('/calculator/degradation', data),
  roi: (data) => api.post('/calculator/roi', data),
  batterySoh: (data) => api.post('/calculator/battery-soh', data),
  cableSize: (data) => api.post('/calculator/cable-size', data),
  exportRoiPdf: (data) => api.post('/calculator/roi/pdf', data, { responseType: 'blob' }),
  exportCableCertificatePdf: (data) => api.post('/calculator/cable-size/pdf', data, { responseType: 'blob' }),
  getSilverPrice: () => api.get('/calculator/silver-price'),
  getBrands: () => api.get('/calculator/brands'),
  submitBrand: (data) => api.post('/calculator/brands/submit', data),
  getStates: () => api.get('/calculator/states'),
  getTechnologies: () => api.get('/calculator/technologies'),
  getUsage: () => api.get('/calculator/usage'),
};

export const engineeringAPI = {
  saveProposalScenario: (projectId, data) => api.post(`/projects/${projectId}/proposal-scenario`, data),
  listBatteryAssets: (projectId) => api.get(`/projects/${projectId}/battery-assets`),
  createBatteryAsset: (projectId, data) => api.post(`/projects/${projectId}/battery-assets`, data),
  addBatteryHealthLog: (projectId, assetId, data) => api.post(`/projects/${projectId}/battery-assets/${assetId}/logs`, data),
  getBatteryHealthLogs: (projectId, assetId) => api.get(`/projects/${projectId}/battery-assets/${assetId}/logs`),
  saveCableCompliance: (projectId, data) => api.post(`/projects/${projectId}/cable-compliance`, data),
};

// ==============================
// PAYMENTS
// ==============================
export const paymentsAPI = {
  getPlans: () => api.get('/payments/plans'),
  initialize: (data) => api.post('/payments/initialize', data),
  verify: (reference) => api.get(`/payments/verify/${reference}`),
  validatePromo: (data) => api.post('/payments/promo/validate', data),
  history: () => api.get('/payments/history'),
};

// ==============================
// ADMIN
// ==============================
export const adminAPI = {
  getOverview: () => api.get('/admin/overview'),
  listUsers: (params) => api.get('/admin/users', { params }),
  updateUserVerification: (data) => api.patch('/admin/users/verification', data),
  listPaystackPlans: () => api.get('/admin/paystack-plans'),
  upsertPaystackPlan: (data) => api.post('/admin/paystack-plans', data),
  listPromoCodes: () => api.get('/admin/promo-codes'),
  createPromoCode: (data) => api.post('/admin/promo-codes', data),
  togglePromoCode: (id, active) => api.patch(`/admin/promo-codes/${id}/toggle`, { active }),
  getFinance: (params) => api.get('/admin/finance', { params }),
  sendPushNotification: (data) => api.post('/admin/push-notifications', data),
  getActivityLogs: () => api.get('/admin/activity-logs'),
  listAdmins: () => api.get('/admin/admins'),
  upsertAdmin: (data) => api.post('/admin/admins', data),
  getOtps: () => api.get('/admin/otps', { timeout: 20000 }),
  generateOtp: (data) => api.post('/admin/otps', data, { timeout: 20000 }),
  listAllProjects: (params) => api.get('/admin/projects', { params }),
  adminBulkUpdateProjects: (projectIds, update) => api.patch('/admin/projects/bulk', { project_ids: projectIds, update }),
  adminUpdateProject: (id, data) => api.patch(`/admin/projects/${id}`, data),
  updateUserManagement: (data) => api.patch('/admin/users/verification', data),
  suspendUser: (id, data) => api.patch(`/admin/users/${id}/suspend`, data),
  deleteUser: (id, data) => api.delete(`/admin/users/${id}`, { data }),
  listRecoveryRequests: (params) => api.get('/admin/recovery-requests', { params }),
  approveDecommission: (id, data) => api.patch(`/admin/recovery-requests/${id}/approve`, data || {}),
  // Environment mode (test/live)
  getEnvironmentMode: () => api.get('/admin/settings/environment'),
  toggleEnvironmentMode: (mode) => api.patch('/admin/settings/environment', { mode }),
  // Design & Modelling admin
  getDesignOverview: () => api.get('/admin/design/overview'),
  listSimulations: (params) => api.get('/admin/design/simulations', { params }),
  listTariffStructures: (params) => api.get('/admin/design/tariffs', { params }),
  getTariffDetail: (id) => api.get(`/admin/design/tariffs/${id}`),
  createTariffTemplate: (data) => api.post('/admin/design/tariffs', data),
  updateTariffTemplate: (id, data) => api.patch(`/admin/design/tariffs/${id}`, data),
  deleteTariffTemplate: (id) => api.delete(`/admin/design/tariffs/${id}`),
  listReportShares: (params) => api.get('/admin/design/report-shares', { params }),
  revokeReportShare: (id) => api.patch(`/admin/design/report-shares/${id}/revoke`),
  getDesignAdoption: () => api.get('/admin/design/adoption'),
};

// ==============================
// BLOG
// ==============================
export const blogAPI = {
  listPosts: (params) => api.get('/blog/posts', { params }),
  getPost: (slug) => api.get(`/blog/posts/${slug}`),
  trackLinkClick: (slug, url) => api.post(`/blog/posts/${slug}/click`, { url }),
  listAds: (params) => api.get('/blog/ads', { params }),
  getPopupAd: (params) => api.get('/blog/ads/popup', { params }),
  getCampaignPopups: () => api.get('/blog/campaigns/popup'),
  trackAdImpression: (id, page_path) => api.post(`/blog/ads/${id}/impression`, { page_path }),
  trackAdClick: (id, page_path) => api.post(`/blog/ads/${id}/click`, { page_path }),
  // Admin ads
  adminListPosts: (params) => api.get('/blog/admin/posts', { params }),
  adminCreatePost: (data) => api.post('/blog/admin/posts', data),
  adminUpdatePost: (id, data) => api.patch(`/blog/admin/posts/${id}`, data),
  adminDeletePost: (id) => api.delete(`/blog/admin/posts/${id}`),
  adminGetPostAnalytics: (id) => api.get(`/blog/admin/posts/${id}/analytics`),
  adminListAds: () => api.get('/blog/admin/ads'),
  adminCreateAd: (data) => api.post('/blog/admin/ads', data),
  adminUpdateAd: (id, data) => api.patch(`/blog/admin/ads/${id}`, data),
  adminDeleteAd: (id) => api.delete(`/blog/admin/ads/${id}`),
  adminGetAdAnalytics: (id) => api.get(`/blog/admin/ads/${id}/analytics`),
  // Admin campaigns
  adminListCampaigns: () => api.get('/blog/admin/campaigns'),
  adminCreateCampaign: (data) => api.post('/blog/admin/campaigns', data),
  adminUpdateCampaign: (id, data) => api.patch(`/blog/admin/campaigns/${id}`, data),
  adminDeleteCampaign: (id) => api.delete(`/blog/admin/campaigns/${id}`),
};

// ==============================
// CONTACT
// ==============================
export const contactAPI = {
  submit: (data) => api.post('/contact', data),
  adminList: (params) => api.get('/contact/admin', { params }),
  adminUpdate: (id, data) => api.patch(`/contact/admin/${id}`, data),
  adminDelete: (id) => api.delete(`/contact/admin/${id}`),
};

// ==============================
// FAQ
// ==============================
export const faqAPI = {
  list: () => api.get('/faq'),
  adminList: () => api.get('/faq/admin'),
  adminCreate: (data) => api.post('/faq/admin', data),
  adminUpdate: (id, data) => api.patch(`/faq/admin/${id}`, data),
  adminDelete: (id) => api.delete(`/faq/admin/${id}`),
};

// ==============================
// ANALYTICS
// ==============================
export const analyticsAPI = {
  getFullAnalytics: (params) => api.get('/analytics', { params }),
  trackPageView: (data) => api.post('/analytics/pageview', data),
};

// ==============================
// AI AGENTS
// ==============================
export const agentAPI = {
  // User endpoints
  getInstances: () => api.get('/agent/instances'),
  chat: (data) => api.post('/agent/chat', data),
  getConversations: (params) => api.get('/agent/conversations', { params }),
  getMessages: (conversationId, params) => api.get(`/agent/conversations/${conversationId}/messages`, { params }),
  closeConversation: (conversationId) => api.patch(`/agent/conversations/${conversationId}/close`),
  createTask: (data) => api.post('/agent/tasks', data),
  getTasks: (params) => api.get('/agent/tasks', { params }),
  getTaskDetail: (taskId) => api.get(`/agent/tasks/${taskId}`),
  // Admin endpoints
  adminGetDefinitions: () => api.get('/agent/admin/definitions'),
  adminGetDefinition: (id) => api.get(`/agent/admin/definitions/${id}`),
  adminUpdateDefinition: (id, data) => api.patch(`/agent/admin/definitions/${id}`, data),
  adminAddKnowledge: (id, data) => api.post(`/agent/admin/definitions/${id}/knowledge`, data),
  adminUpdateKnowledge: (id, docId, data) => api.put(`/agent/admin/definitions/${id}/knowledge/${docId}`, data),
  adminRemoveKnowledge: (id, docId) => api.delete(`/agent/admin/definitions/${id}/knowledge/${docId}`),
  adminAssignAgents: (data) => api.post('/agent/admin/assign', data),
  adminRevokeAgents: (data) => api.post('/agent/admin/revoke', data),
  adminGetInstances: (params) => api.get('/agent/admin/instances', { params }),
  adminGetTasks: (params) => api.get('/agent/admin/tasks', { params }),
  adminGetEscalations: (params) => api.get('/agent/admin/escalations', { params }),
  adminResolveEscalation: (id, data) => api.patch(`/agent/admin/escalations/${id}`, data),
  adminGetUsage: (params) => api.get('/agent/admin/usage', { params }),
  adminExportTraining: (params) => api.get('/agent/admin/training-export', { params, responseType: 'blob' }),
  adminSeed: () => api.post('/agent/admin/seed'),
};

// ==============================
// TARIFFS
// ==============================
export const tariffAPI = {
  getTemplates: (country) => api.get('/tariffs/templates', { params: { country } }),
  getUserTariffs: () => api.get('/tariffs'),
  create: (data) => api.post('/tariffs', data),
  getDetail: (id) => api.get(`/tariffs/${id}`),
  update: (id, data) => api.put(`/tariffs/${id}`, data),
  delete: (id) => api.delete(`/tariffs/${id}`),
};

// ==============================
// LOAD PROFILES
// ==============================
export const loadProfileAPI = {
  upload: (projectId, file) => {
    const form = new FormData();
    form.append('project_id', projectId);
    form.append('file', file);
    return api.post('/load-profiles/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  manual: (data) => api.post('/load-profiles/manual', data),
  generateSynthetic: (data) => api.post('/load-profiles/synthetic', data),
  confirmSynthetic: (data) => api.post('/load-profiles/synthetic/confirm', data),
  getProfile: (projectId) => api.get(`/load-profiles/${projectId}`),
  getHourly: (projectId) => api.get(`/load-profiles/${projectId}/hourly`),
};

// ==============================
// SIMULATION ENGINE
// ==============================
export const simulationAPI = {
  run: (data) => api.post('/simulation/run', data, { timeout: 120000 }),
  getResults: (projectId) => api.get(`/simulation/${projectId}/results`),
  getHourlyFlows: (projectId, params) => api.get(`/simulation/${projectId}/results/hourly`, { params }),
  getSolarResource: (lat, lon) => api.get('/simulation/solar-resource', { params: { lat, lon } }),
  autoSize: (data) => api.post('/simulation/auto-size', data),
};

// ==============================
// DESIGN REPORTS
// ==============================
export const designReportAPI = {
  getHtmlData: (projectId) => api.get(`/design-reports/${projectId}/html`),
  downloadPdf: (projectId) => api.get(`/design-reports/${projectId}/pdf`, { responseType: 'blob' }),
  downloadExcel: (projectId) => api.get(`/design-reports/${projectId}/excel`, { responseType: 'blob' }),
  createShareLink: (projectId, data) => api.post(`/design-reports/${projectId}/share`, data),
  getSharedReport: (token) => api.get(`/design-reports/shared/${token}`),
};

// ==============================
// HELPERS
// ==============================
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default api;