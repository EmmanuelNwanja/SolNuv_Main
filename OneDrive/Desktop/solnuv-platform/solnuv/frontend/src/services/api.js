import axios from 'axios';
import { supabase } from '../utils/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Supabase auth token to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Handle expired sessions
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==============================
// AUTH
// ==============================
export const authAPI = {
  saveProfile: (data) => api.post('/auth/profile', data),
  getMe: () => api.get('/auth/me'),
  inviteMember: (data) => api.post('/auth/invite', data),
  acceptInvite: (token) => api.post(`/auth/accept-invite/${token}`),
  checkInvite: (token) => api.get(`/auth/accept-invite/${token}`),
  getTeam: () => api.get('/auth/team'),
  getNotifications: () => api.get('/auth/notifications'),
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
};

// ==============================
// DASHBOARD
// ==============================
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
  getImpact: () => api.get('/dashboard/impact'),
  getLeaderboard: (params) => api.get('/dashboard/leaderboard', { params }),
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
  silver: (data) => api.post('/calculator/silver', data),
  battery: (data) => api.post('/calculator/battery', data),
  degradation: (data) => api.post('/calculator/degradation', data),
  getSilverPrice: () => api.get('/calculator/silver-price'),
  getBrands: () => api.get('/calculator/brands'),
  getStates: () => api.get('/calculator/states'),
};

// ==============================
// PAYMENTS
// ==============================
export const paymentsAPI = {
  getPlans: () => api.get('/payments/plans'),
  initialize: (data) => api.post('/payments/initialize', data),
  verify: (reference) => api.get(`/payments/verify/${reference}`),
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
