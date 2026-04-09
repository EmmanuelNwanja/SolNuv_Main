import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getAdminLayout } from '../../components/Layout';
import { LoadingSpinner } from '../../components/ui/index';
import AdminRoute from '../../components/AdminRoute';
import toast from 'react-hot-toast';
import {
  RiArrowRightUpLine,
  RiLineChartLine,
  RiShieldCheckLine,
  RiSparkling2Line,
  RiTeamLine,
  RiUserSearchLine,
} from 'react-icons/ri';

export const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', path: '/admin', title: 'Admin Control Center - SolNuv' },
  { id: 'users', label: 'Users', path: '/admin/users', title: 'Admin Users - SolNuv' },
  { id: 'verification', label: 'Verification', path: '/admin/verification', title: 'Verification Requests - SolNuv' },
  { id: 'projects', label: 'Projects', path: '/admin/projects', title: 'Admin Projects - SolNuv' },
  { id: 'paystack', label: 'Paystack Plans', path: '/admin/paystack', title: 'Admin Paystack Plans - SolNuv' },
  { id: 'promo', label: 'Promo Codes', path: '/admin/promo', title: 'Admin Promo Codes - SolNuv' },
  { id: 'finance', label: 'Finance', path: '/admin/finance', title: 'Admin Finance - SolNuv' },
  { id: 'push', label: 'Push Notifications', path: '/admin/push', title: 'Admin Notifications - SolNuv' },
  { id: 'logs', label: 'Activity Log', path: '/admin/logs', title: 'Admin Activity Log - SolNuv' },
  { id: 'admins', label: 'Admin Management', path: '/admin/admins', title: 'Admin Management - SolNuv' },
  { id: 'blog', label: 'Blog & Ads', path: '/admin/blog', title: 'Blog & Ads - SolNuv' },
  { id: 'contact', label: 'Contact Inbox', path: '/admin/contact', title: 'Contact Inbox - SolNuv' },
  { id: 'analytics', label: 'Analytics', path: '/admin/analytics', title: 'Platform Analytics - SolNuv' },
  { id: 'pickup', label: 'Pickup Requests', path: '/admin/pickup', title: 'Pickup Requests - SolNuv' },
  { id: 'agents', label: 'AI Agents', path: '/admin/agents', title: 'AI Agents - SolNuv' },
  { id: 'design', label: 'Design & Modelling', path: '/admin/design', title: 'Design & Modelling - SolNuv' },
  { id: 'direct-payments', label: 'Direct Payments', path: '/admin/direct-payments', title: 'Direct Bank Transfers - SolNuv' },
];

export function AdminConsole({ forcedTab = 'overview', showTabs = false }) {
  const { isPlatformAdmin, platformAdminRole } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(forcedTab);
  const [loading, setLoading] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState([]);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('');
  const [projectGeoFilter, setProjectGeoFilter] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [paystackPlans, setPaystackPlans] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [finance, setFinance] = useState(null);
  const [logs, setLogs] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [recoveryRequests, setRecoveryRequests] = useState([]);
  const [pickupApprovingId, setPickupApprovingId] = useState(null);

  // User management panel state
  const [managingUser, setManagingUser] = useState(null);
  const [mgmtPlan, setMgmtPlan] = useState('');
  const [mgmtInterval, setMgmtInterval] = useState('monthly');
  const [mgmtMaxTeam, setMgmtMaxTeam] = useState(1);
  const [mgmtSuspendReason, setMgmtSuspendReason] = useState('');
  const [mgmtDeleteReason, setMgmtDeleteReason] = useState('');
  const [mgmtDeleteConfirm, setMgmtDeleteConfirm] = useState('');
  const [mgmtBusy, setMgmtBusy] = useState(false);
  const [mgmtAction, setMgmtAction] = useState(null); // 'suspend' | 'delete' | null

  // Payment tracking for plan upgrades
  const [mgmtPayChannel, setMgmtPayChannel] = useState('');
  const [mgmtBankRef, setMgmtBankRef] = useState('');
  const [mgmtBankDate, setMgmtBankDate] = useState('');
  const [mgmtBankTime, setMgmtBankTime] = useState('');
  const [mgmtCouponCode, setMgmtCouponCode] = useState('');
  const [mgmtCouponValue, setMgmtCouponValue] = useState('');
  const [mgmtCouponType, setMgmtCouponType] = useState('flat');
  const [mgmtAmountReceived, setMgmtAmountReceived] = useState('');
  const [mgmtUpgradeReason, setMgmtUpgradeReason] = useState('');

  // Finance filters
  const [financeChannel, setFinanceChannel] = useState('');
  const [financePlan, setFinancePlan] = useState('');
  const [financePage, setFinancePage] = useState(1);

  // Environment mode
  const [envMode, setEnvMode] = useState('test');
  const [envSwitching, setEnvSwitching] = useState(false);
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminUserSearchResults, setAdminUserSearchResults] = useState([]);
  const [adminRoleForm, setAdminRoleForm] = useState({
    user_id: '',
    role: 'operations',
    is_active: true,
    can_manage_admins: false,
  });
  const [assigningAdminRole, setAssigningAdminRole] = useState(false);
  const [searchingAdminUser, setSearchingAdminUser] = useState(false);

  const [newPromo, setNewPromo] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: 10,
    max_redemptions: '',
    applies_to_intervals: ['monthly', 'annual'],
    applies_to_plans: ['free', 'pro', 'elite', 'enterprise'],
  });

  const [newPush, setNewPush] = useState({ title: '', message: '', target_type: 'all', target_value: '' });

  // Direct Bank Transfer state
  const [directPayments, setDirectPayments] = useState([]);
  const [directPaymentsFilter, setDirectPaymentsFilter] = useState('');
  const [bankTransferSettings, setBankTransferSettings] = useState({ account_name: '', bank_name: '', account_number: '', additional_instructions: '', is_active: true });
  const [bankSettingsBusy, setBankSettingsBusy] = useState(false);
  const [directPaymentBusy, setDirectPaymentBusy] = useState(null); // id of row being actioned
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);

  // Verification state
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationAction, setVerificationAction] = useState(null); // { id, action: 'verify' | 'reject' }
  const [verificationRejectReason, setVerificationRejectReason] = useState('');

  useEffect(() => {
    setActiveTab(forcedTab);
  }, [forcedTab]);

  useEffect(() => {
    if (!isPlatformAdmin) {
      setLoading(false);
      return;
    }

    const requestsByTab = {
      overview: [{ key: 'overview', request: adminAPI.getOverview() }],
      users: [{ key: 'users', request: adminAPI.listUsers({ page: 1, limit: 30 }) }],
      verification: [{ key: 'verification', request: adminAPI.listVerificationRequests({ status: 'pending' }) }],
      projects: [{ key: 'projects', request: adminAPI.listAllProjects({ page: 1, limit: 100, search: projectSearch, status: projectStatusFilter, geo_verified: projectGeoFilter }) }],
      paystack: [{ key: 'paystack', request: adminAPI.listPaystackPlans() }],
      promo: [{ key: 'promo', request: adminAPI.listPromoCodes() }],
      finance: [{ key: 'finance', request: adminAPI.getFinance({ page: financePage, limit: 50, channel: financeChannel || undefined, plan: financePlan || undefined }) }],
      push: [],
      logs: [{ key: 'logs', request: adminAPI.getActivityLogs() }],
      admins: [{ key: 'admins', request: adminAPI.listAdmins() }],
      pickup: [{ key: 'pickup', request: adminAPI.listRecoveryRequests({ status: 'requested' }) }],
      'direct-payments': [
        { key: 'directPayments', request: adminAPI.listDirectPayments() },
        { key: 'bankTransferSettings', request: adminAPI.getAdminBankTransferSettings() },
      ],
    };

    const requests = requestsByTab[forcedTab] || requestsByTab.overview;

    if (requests.length === 0) {
      setLoading(false);
      return;
    }

    Promise.allSettled(requests.map((r) => r.request))
      .then((results) => {
        const warnings = [];
        results.forEach((result, idx) => {
          const key = requests[idx].key;
          if (result.status === 'rejected') {
            warnings.push(key);
            return;
          }

          const payload = result.value?.data?.data;
          if (key === 'overview') setOverview(payload || null);
          if (key === 'users') setUsers(payload?.users || []);
          if (key === 'verification') setVerificationRequests(payload?.requests || []);
          if (key === 'projects') setProjects(payload?.projects || []);
          if (key === 'paystack') setPaystackPlans(payload || []);
          if (key === 'promo') setPromoCodes(payload || []);
          if (key === 'finance') setFinance(payload || null);
          if (key === 'logs') setLogs(payload || []);
          if (key === 'admins') setAdmins(payload || []);
          if (key === 'pickup') setRecoveryRequests(payload?.requests || []);
          if (key === 'directPayments') setDirectPayments(payload?.submissions || []);
          if (key === 'bankTransferSettings') setBankTransferSettings(s => ({ ...s, ...(payload || {}) }));
        });

        setLoadWarnings(warnings);
        if (warnings.length > 0) {
          toast.error(`Some admin sections failed to load: ${warnings.join(', ')}`);
        }
      })
      .finally(() => setLoading(false));
  }, [isPlatformAdmin, forcedTab, projectSearch, projectStatusFilter, projectGeoFilter, financePage, financeChannel, financePlan]);

  // Fetch environment mode once on mount
  useEffect(() => {
    adminAPI.getEnvironmentMode().then(r => {
      setEnvMode(r.data?.data?.mode || 'test');
    }).catch(() => {});
  }, []);

  async function refreshProjects() {
    const { data } = await adminAPI.listAllProjects({ page: 1, limit: 100, search: projectSearch, status: projectStatusFilter, geo_verified: projectGeoFilter });
    setProjects(data.data?.projects || []);
  }

  async function handleAdminProjectUpdate(projectId, patch) {
    try {
      await adminAPI.adminUpdateProject(projectId, patch);
      await refreshProjects();
      toast.success('Project updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update project');
    }
  }

  async function handleBulkProjectUpdate(updatePatch) {
    if (selectedProjectIds.length === 0) {
      toast.error('Select at least one project');
      return;
    }
    setBulkBusy(true);
    try {
      await adminAPI.adminBulkUpdateProjects(selectedProjectIds, updatePatch);
      await refreshProjects();
      setSelectedProjectIds([]);
      toast.success(`Updated ${selectedProjectIds.length} project${selectedProjectIds.length !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  }

  function switchTab(tabId) {
    setActiveTab(tabId);
    const tab = ADMIN_TABS.find((t) => t.id === tabId);
    if (tab?.path) router.push(tab.path);
  }

  const activeMeta = ADMIN_TABS.find((t) => t.id === activeTab) || ADMIN_TABS[0];

  const filteredUsers = useMemo(() => users.filter((u) => {
    const hay = `${u.first_name || ''} ${u.last_name || ''} ${u.email || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  }), [users, search]);

  async function refreshPromo() {
    const { data } = await adminAPI.listPromoCodes();
    setPromoCodes(data.data || []);
  }

  async function refreshAdmins() {
    const { data } = await adminAPI.listAdmins();
    setAdmins(data.data || []);
  }

  async function handleCreatePromo(e) {
    e.preventDefault();
    try {
      await adminAPI.createPromoCode({
        ...newPromo,
        max_redemptions: newPromo.max_redemptions ? Number(newPromo.max_redemptions) : null,
      });
      toast.success('Promo code created');
      setNewPromo({
        code: '',
        discount_type: 'percent',
        discount_value: 10,
        max_redemptions: '',
        applies_to_intervals: ['monthly', 'annual'],
        applies_to_plans: ['free', 'pro', 'elite', 'enterprise'],
      });
      refreshPromo();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create promo code');
    }
  }

  async function handleTogglePromo(id, active) {
    try {
      await adminAPI.togglePromoCode(id, active);
      refreshPromo();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update promo code');
    }
  }

  async function handlePush(e) {
    e.preventDefault();
    try {
      await adminAPI.sendPushNotification(newPush);
      toast.success('Push notification sent');
      setNewPush({ title: '', message: '', target_type: 'all', target_value: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send notification');
    }
  }

  async function searchUsersForAdminRole(query) {
    const q = String(query || '').trim();
    if (q.length < 2) {
      setAdminUserSearchResults([]);
      return;
    }

    setSearchingAdminUser(true);
    try {
      const { data } = await adminAPI.listUsers({ search: q, page: 1, limit: 8 });
      setAdminUserSearchResults(data.data?.users || []);
    } catch {
      setAdminUserSearchResults([]);
    } finally {
      setSearchingAdminUser(false);
    }
  }

  async function handleAssignAdminRole(e) {
    e.preventDefault();
    if (!adminRoleForm.user_id) {
      toast.error('Select a user first');
      return;
    }

    setAssigningAdminRole(true);
    try {
      await adminAPI.upsertAdmin(adminRoleForm);
      toast.success('Admin role updated');
      await refreshAdmins();
      setAdminUserSearch('');
      setAdminUserSearchResults([]);
      setAdminRoleForm({
        user_id: '',
        role: 'operations',
        is_active: true,
        can_manage_admins: false,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update admin role');
    } finally {
      setAssigningAdminRole(false);
    }
  }

  async function loadVerificationRequests() {
    setVerificationLoading(true);
    try {
      const { data } = await adminAPI.listVerificationRequests({ status: 'pending' });
      setVerificationRequests(data.data?.requests || []);
    } catch (err) {
      toast.error('Failed to load verification requests');
    } finally {
      setVerificationLoading(false);
    }
  }

  async function handleVerifyUser(userId) {
    setVerificationAction({ id: userId, action: 'verify' });
    try {
      await adminAPI.verifyUser(userId);
      toast.success('User verified successfully');
      setVerificationAction(null);
      await loadVerificationRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to verify user');
      setVerificationAction(null);
    }
  }

  async function handleRejectVerification(userId) {
    if (!verificationRejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setVerificationAction({ id: userId, action: 'reject' });
    try {
      await adminAPI.rejectVerification(userId, verificationRejectReason);
      toast.success('Verification rejected');
      setVerificationAction(null);
      setVerificationRejectReason('');
      await loadVerificationRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject verification');
      setVerificationAction(null);
    }
  }

  if (loading || isPlatformAdmin === null) {
    return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <AdminRoute>
      <Head><title>{activeMeta.title}</title></Head>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 sm:p-8 text-white mb-6">
        <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-white/60 mb-3">Platform Operations</p>
            <h1 className="font-display font-bold text-3xl sm:text-4xl">SolNuv Admin Control Center</h1>
            <p className="text-sm text-white/75 mt-2 max-w-2xl">
              Role: {platformAdminRole || 'admin'}. Manage users, platform privileges, billing controls, and compliance operations from one command surface.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 inline-flex items-center gap-1.5"><RiShieldCheckLine /> Secure role controls</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 inline-flex items-center gap-1.5"><RiTeamLine /> User lifecycle tooling</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 inline-flex items-center gap-1.5"><RiLineChartLine /> Financial telemetry</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full lg:w-auto">
            <Link href="/admin/users" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition-colors">Review Users</Link>
            <Link href="/admin/projects" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition-colors">Review Projects</Link>
            <Link href="/admin/admins" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition-colors">Manage Admins</Link>
            <Link href="/admin/finance" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition-colors">Finance</Link>
            <Link href="/admin/push" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition-colors">Send Notification</Link>
          </div>
        </div>

        {/* Test / Live Mode Toggle */}
        <div className="relative mt-4 flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${envMode === 'live' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'}`}>
            <span className={`inline-block w-2 h-2 rounded-full ${envMode === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {envMode === 'live' ? 'LIVE MODE' : 'TEST MODE'}
          </span>
          {platformAdminRole === 'super_admin' && (
            <button
              disabled={envSwitching}
              onClick={async () => {
                const next = envMode === 'test' ? 'live' : 'test';
                if (!window.confirm(`Switch to ${next.toUpperCase()} mode? All admin views will show ${next} data only.`)) return;
                setEnvSwitching(true);
                try {
                  await adminAPI.toggleEnvironmentMode(next);
                  setEnvMode(next);
                  toast.success(`Switched to ${next.toUpperCase()} mode`);
                } catch (err) { toast.error(err.response?.data?.message || 'Failed to switch mode'); }
                finally { setEnvSwitching(false); }
              }}
              className="rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 transition-colors"
            >
              {envSwitching ? 'Switching...' : `Switch to ${envMode === 'test' ? 'Live' : 'Test'}`}
            </button>
          )}
          <span className="text-[10px] text-white/40">Data scope: all admin views filter by current mode</span>
        </div>
        {loadWarnings.length > 0 && (
          <p className="text-xs text-amber-200 mt-4">
            Partial data loaded. Retry affected sections: {loadWarnings.join(', ')}.
          </p>
        )}
      </div>

      {showTabs && (
        <div className="flex gap-2 overflow-auto mb-6 pb-1">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${activeTab === tab.id ? 'bg-forest-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'overview' && overview && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="card border-l-4 border-l-forest-700"><p className="text-xs text-slate-500">Users</p><p className="text-3xl font-bold text-forest-900 mt-1">{overview.users}</p><p className="text-xs text-slate-400 mt-1">Registered accounts on platform</p></div>
            <div className="card border-l-4 border-l-emerald-600"><p className="text-xs text-slate-500">Companies</p><p className="text-3xl font-bold text-forest-900 mt-1">{overview.companies}</p><p className="text-xs text-slate-400 mt-1">Distinct organizations onboarded</p></div>
            <div className="card border-l-4 border-l-cyan-600"><p className="text-xs text-slate-500">Projects</p><p className="text-3xl font-bold text-forest-900 mt-1">{overview.projects}</p><p className="text-xs text-slate-400 mt-1">Solar deployments tracked end-to-end</p></div>
            <div className="card border-l-4 border-l-amber-500"><p className="text-xs text-slate-500">Active Subscriptions</p><p className="text-3xl font-bold text-emerald-700 mt-1">{overview.active_subscriptions}</p><p className="text-xs text-slate-400 mt-1">Paying organizations</p></div>
            <div className="card border-l-4 border-l-indigo-500"><p className="text-xs text-slate-500">Revenue (30d)</p><p className="text-3xl font-bold text-forest-900 mt-1">N{Number(overview.revenue_30d_ngn || 0).toLocaleString('en-NG')}</p><p className="text-xs text-slate-400 mt-1">Gross processed this month</p></div>
            <div className="card border-l-4 border-l-rose-500"><p className="text-xs text-slate-500">Queued Push Notifications</p><p className="text-3xl font-bold text-amber-700 mt-1">{overview.queued_push_notifications}</p><p className="text-xs text-slate-400 mt-1">Messages waiting for delivery</p></div>
            <div className="card border-l-4 border-l-orange-500"><p className="text-xs text-slate-500">Solar Designs</p><p className="text-3xl font-bold text-forest-900 mt-1">{overview.designs || 0}</p><p className="text-xs text-slate-400 mt-1">Design configurations created</p></div>
            <div className="card border-l-4 border-l-teal-500"><p className="text-xs text-slate-500">Simulations Run</p><p className="text-3xl font-bold text-forest-900 mt-1">{overview.simulations || 0}</p><p className="text-xs text-slate-400 mt-1">Full energy + financial simulations</p></div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Link href="/admin/users" className="card hover:-translate-y-0.5 transition-transform group">
              <p className="text-xs uppercase tracking-wide text-slate-500">User Intelligence</p>
              <p className="text-base font-semibold text-slate-800 mt-1">Audit activation and plan states</p>
              <p className="text-sm text-slate-500 mt-2">Search, verify, and activate accounts with fast filters.</p>
              <p className="mt-4 inline-flex items-center text-sm font-semibold text-forest-900">Open users <RiArrowRightUpLine className="ml-1" /></p>
            </Link>

            <Link href="/admin/finance" className="card hover:-translate-y-0.5 transition-transform group">
              <p className="text-xs uppercase tracking-wide text-slate-500">Finance Pulse</p>
              <p className="text-base font-semibold text-slate-800 mt-1">Watch revenue and discount behavior</p>
              <p className="text-sm text-slate-500 mt-2">Track transactions and identify anomalous campaign effects.</p>
              <p className="mt-4 inline-flex items-center text-sm font-semibold text-forest-900">Open finance <RiArrowRightUpLine className="ml-1" /></p>
            </Link>

            <Link href="/admin/push" className="card hover:-translate-y-0.5 transition-transform group">
              <p className="text-xs uppercase tracking-wide text-slate-500">Comms Studio</p>
              <p className="text-base font-semibold text-slate-800 mt-1">Targeted announcement dispatch</p>
              <p className="text-sm text-slate-500 mt-2">Send precision notifications by plan, company, or user.</p>
              <p className="mt-4 inline-flex items-center text-sm font-semibold text-forest-900">Open notifications <RiArrowRightUpLine className="ml-1" /></p>
            </Link>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 inline-flex items-center gap-2">
            <RiSparkling2Line className="text-emerald-700" />
            Control center is tuned for route-specific loading: each section now fetches only what it needs for faster admin navigation.
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
            <input
              className="input max-w-sm"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="text-xs text-slate-400">{filteredUsers.length} users</span>
          </div>

          <div className="space-y-2">
            {filteredUsers.map((u) => {
              const isManaging = managingUser?.id === u.id;
              const plan = u.companies?.subscription_plan || 'free';
              const isVerified = u.verification_status === 'verified';
              return (
                <div key={u.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  {/* User row */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800">{u.first_name} {u.last_name}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          !u.is_active ? 'bg-red-100 text-red-700'
                          : plan === 'enterprise' ? 'bg-purple-100 text-purple-800'
                          : plan === 'elite' ? 'bg-amber-100 text-amber-800'
                          : plan === 'pro' ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                        }`}>
                          {!u.is_active ? 'Suspended' : plan === 'free' ? 'Basic' : plan.toUpperCase()}
                        </span>
                        {u.verification_status === 'verified' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">✓ Verified</span>}
                        {(u.verification_status === 'pending' || u.verification_status === 'pending_admin_review') && <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">⏳ Pending</span>}
                        {u.verification_status === 'rejected' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">✗ Rejected</span>}
                        {u.verification_status === 'unverified' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">○ Unverified</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{u.email}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {u.companies?.name || 'Solo user'}
                        {u.companies?.subscription_expires_at ? ` • Renews ${new Date(u.companies.subscription_expires_at).toLocaleDateString('en-NG')}` : ''}
                        {' • '}{u.companies?.max_team_members || 1} seat{(u.companies?.max_team_members || 1) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (isManaging) {
                          setManagingUser(null);
                          setMgmtAction(null);
                        } else {
                          setManagingUser(u);
                          setMgmtPlan(u.companies?.subscription_plan || 'free');
                          setMgmtInterval(u.companies?.subscription_interval || 'monthly');
                          setMgmtMaxTeam(u.companies?.max_team_members || 1);
                          setMgmtSuspendReason('');
                          setMgmtDeleteReason('');
                          setMgmtDeleteConfirm('');
                          setMgmtAction(null);
                          setMgmtPayChannel('');
                          setMgmtBankRef('');
                          setMgmtBankDate('');
                          setMgmtBankTime('');
                          setMgmtCouponCode('');
                          setMgmtCouponValue('');
                          setMgmtCouponType('flat');
                          setMgmtAmountReceived('');
                          setMgmtUpgradeReason('');
                        }
                      }}
                      className={`text-sm px-4 py-2 rounded-xl font-semibold border transition-all whitespace-nowrap ${
                        isManaging ? 'border-forest-900 bg-forest-900 text-white' : 'border-slate-300 text-slate-700 hover:border-forest-700 hover:text-forest-900'
                      }`}
                    >
                      {isManaging ? 'Close' : 'Manage'}
                    </button>
                  </div>

                  {/* Inline management panel */}
                  {isManaging && (
                    <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-5">

                      {/* Plan & billing */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Subscription Plan</p>
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="label text-xs">Plan</label>
                            <select className="input text-sm" value={mgmtPlan} onChange={e => setMgmtPlan(e.target.value)}>
                              <option value="free">Basic (Free)</option>
                              <option value="pro">Pro</option>
                              <option value="elite">Elite</option>
                              <option value="enterprise">Enterprise</option>
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">Interval</label>
                            <select className="input text-sm" value={mgmtInterval} onChange={e => setMgmtInterval(e.target.value)}>
                              <option value="monthly">Monthly</option>
                              <option value="annual">Annual</option>
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">Max Team Members</label>
                            <input className="input text-sm w-24" type="number" min={1} max={100} value={mgmtMaxTeam} onChange={e => setMgmtMaxTeam(Number(e.target.value))} />
                          </div>
                        </div>

                        {/* Payment tracking — required for non-free plan changes */}
                        {mgmtPlan !== 'free' && mgmtPlan !== (u.companies?.subscription_plan || 'free') && (
                          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment Confirmation</p>
                            <div className="flex flex-wrap gap-3 items-end">
                              <div>
                                <label className="label text-xs">Payment Channel <span className="text-red-500">*</span></label>
                                <select className="input text-sm" value={mgmtPayChannel} onChange={e => setMgmtPayChannel(e.target.value)}>
                                  <option value="">Select channel...</option>
                                  <option value="paystack">Paystack</option>
                                  <option value="direct_transfer">Direct Bank Transfer</option>
                                  <option value="coupon_only">Coupon Only</option>
                                  <option value="admin_grant">Admin Grant (free upgrade)</option>
                                </select>
                              </div>
                              <div>
                                <label className="label text-xs">Amount Received (₦)</label>
                                <input className="input text-sm w-32" type="number" min={0} placeholder="0" value={mgmtAmountReceived} onChange={e => setMgmtAmountReceived(e.target.value)} />
                              </div>
                            </div>

                            {/* Direct transfer requires bank confirmation */}
                            {mgmtPayChannel === 'direct_transfer' && (
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <label className="label text-xs">Bank Reference / Receipt No. <span className="text-red-500">*</span></label>
                                  <input className="input text-sm w-48" type="text" placeholder="e.g. TRF-2024-001" value={mgmtBankRef} onChange={e => setMgmtBankRef(e.target.value)} />
                                </div>
                                <div>
                                  <label className="label text-xs">Bank Confirmation Date <span className="text-red-500">*</span></label>
                                  <input className="input text-sm" type="date" value={mgmtBankDate} onChange={e => setMgmtBankDate(e.target.value)} />
                                </div>
                                <div>
                                  <label className="label text-xs">Confirmation Time <span className="text-red-500">*</span></label>
                                  <input className="input text-sm" type="time" value={mgmtBankTime} onChange={e => setMgmtBankTime(e.target.value)} />
                                </div>
                              </div>
                            )}

                            {/* Coupon fields */}
                            {(mgmtPayChannel === 'coupon_only' || mgmtPayChannel === 'paystack') && (
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <label className="label text-xs">Coupon Code {mgmtPayChannel === 'coupon_only' && <span className="text-red-500">*</span>}</label>
                                  <input className="input text-sm w-40" type="text" placeholder="PROMO2024" value={mgmtCouponCode} onChange={e => setMgmtCouponCode(e.target.value)} />
                                </div>
                                <div>
                                  <label className="label text-xs">Discount Value</label>
                                  <input className="input text-sm w-28" type="number" min={0} placeholder="0" value={mgmtCouponValue} onChange={e => setMgmtCouponValue(e.target.value)} />
                                </div>
                                <div>
                                  <label className="label text-xs">Discount Type</label>
                                  <select className="input text-sm" value={mgmtCouponType} onChange={e => setMgmtCouponType(e.target.value)}>
                                    <option value="flat">Flat (₦)</option>
                                    <option value="percent">Percent (%)</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="label text-xs">Upgrade Reason / Notes</label>
                              <textarea className="input text-sm w-full" rows={2} placeholder="Reason for this plan upgrade..." value={mgmtUpgradeReason} onChange={e => setMgmtUpgradeReason(e.target.value)} />
                            </div>
                          </div>
                        )}

                        <div className="mt-3">
                          <button
                            disabled={mgmtBusy || (mgmtPlan !== 'free' && mgmtPlan !== (u.companies?.subscription_plan || 'free') && !mgmtPayChannel)}
                            onClick={async () => {
                              setMgmtBusy(true);
                              try {
                                const payload = {
                                  user_id: u.id,
                                  company_plan: mgmtPlan,
                                  subscription_interval: mgmtInterval,
                                  max_team_members: mgmtMaxTeam,
                                };
                                // Attach payment info for plan upgrades
                                if (mgmtPlan !== 'free' && mgmtPlan !== (u.companies?.subscription_plan || 'free')) {
                                  payload.payment_channel = mgmtPayChannel;
                                  if (mgmtAmountReceived) payload.amount_received = Number(mgmtAmountReceived);
                                  if (mgmtUpgradeReason) payload.upgrade_reason = mgmtUpgradeReason;
                                  if (mgmtPayChannel === 'direct_transfer') {
                                    payload.bank_reference = mgmtBankRef;
                                    payload.bank_confirmed_at = mgmtBankDate && mgmtBankTime ? new Date(`${mgmtBankDate}T${mgmtBankTime}`).toISOString() : undefined;
                                  }
                                  if (mgmtCouponCode) {
                                    payload.coupon_code = mgmtCouponCode;
                                    if (mgmtCouponValue) payload.coupon_discount_value = Number(mgmtCouponValue);
                                    payload.coupon_discount_type = mgmtCouponType;
                                  }
                                }
                                await adminAPI.updateUserManagement(payload);
                                setUsers(prev => prev.map(x => x.id === u.id ? { ...x, companies: { ...x.companies, subscription_plan: mgmtPlan, subscription_interval: mgmtInterval, max_team_members: mgmtMaxTeam } } : x));
                                toast.success('Plan updated');
                                // Reset payment fields
                                setMgmtPayChannel(''); setMgmtBankRef(''); setMgmtBankDate(''); setMgmtBankTime('');
                                setMgmtCouponCode(''); setMgmtCouponValue(''); setMgmtCouponType('flat');
                                setMgmtAmountReceived(''); setMgmtUpgradeReason('');
                              } catch (err) { toast.error(err.response?.data?.message || 'Failed to update plan'); }
                              finally { setMgmtBusy(false); }
                            }}
                            className="btn-primary text-sm px-4 py-2"
                          >
                            {mgmtBusy ? 'Saving...' : 'Save Plan'}
                          </button>
                          {mgmtPlan !== 'free' && mgmtPlan !== (u.companies?.subscription_plan || 'free') && !mgmtPayChannel && (
                            <p className="text-xs text-amber-600 mt-1">Select a payment channel to proceed with plan upgrade</p>
                          )}
                        </div>
                      </div>

                      {/* Verification */}
                      {u.companies && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Company Verification</p>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-700">
                              {isVerified ? `✓ Verified on ${new Date(u.companies.verified_at).toLocaleDateString('en-NG')}` : 'Not verified'}
                            </span>
                            <button
                              disabled={mgmtBusy}
                              onClick={async () => {
                                setMgmtBusy(true);
                                try {
                                  await adminAPI.updateUserManagement({ user_id: u.id, company_verified: !isVerified });
                                  setUsers(prev => prev.map(x => x.id === u.id ? { ...x, companies: { ...x.companies, verified_at: !isVerified ? new Date().toISOString() : null } } : x));
                                  toast.success(isVerified ? 'Verification removed' : 'Company verified');
                                } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
                                finally { setMgmtBusy(false); }
                              }}
                              className={`text-sm px-4 py-2 rounded-xl font-semibold border transition-all ${
                                isVerified ? 'border-slate-300 text-slate-600 hover:border-red-400 hover:text-red-600' : 'border-blue-400 text-blue-700 hover:bg-blue-50'
                              }`}
                            >
                              {isVerified ? 'Unverify' : 'Mark Verified'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Suspend / Unsuspend */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                          {u.is_active ? 'Suspend Account' : 'Unsuspend Account'}
                        </p>
                        {u.is_active ? (
                          mgmtAction === 'suspend' ? (
                            <div className="space-y-2">
                              <textarea
                                className="input text-sm min-h-[72px]"
                                placeholder="Reason for suspension (required — user will be notified)"
                                value={mgmtSuspendReason}
                                onChange={e => setMgmtSuspendReason(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button onClick={() => setMgmtAction(null)} className="btn-ghost text-sm">Cancel</button>
                                <button
                                  disabled={mgmtBusy || !mgmtSuspendReason.trim()}
                                  onClick={async () => {
                                    setMgmtBusy(true);
                                    try {
                                      await adminAPI.suspendUser(u.id, { reason: mgmtSuspendReason, suspend: true });
                                      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: false } : x));
                                      toast.success('User suspended');
                                      setMgmtAction(null);
                                    } catch (err) { toast.error(err.response?.data?.message || 'Failed to suspend'); }
                                    finally { setMgmtBusy(false); }
                                  }}
                                  className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-xl font-semibold"
                                >
                                  {mgmtBusy ? 'Suspending...' : 'Confirm Suspend'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setMgmtAction('suspend')} className="text-sm px-4 py-2 rounded-xl border border-amber-400 text-amber-700 hover:bg-amber-50 font-semibold">
                              Suspend User
                            </button>
                          )
                        ) : (
                          <button
                            disabled={mgmtBusy}
                            onClick={async () => {
                              setMgmtBusy(true);
                              try {
                                await adminAPI.suspendUser(u.id, { reason: 'Admin unsuspend', suspend: false });
                                setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: true } : x));
                                toast.success('User unsuspended');
                              } catch (err) { toast.error(err.response?.data?.message || 'Failed to unsuspend'); }
                              finally { setMgmtBusy(false); }
                            }}
                            className="text-sm px-4 py-2 rounded-xl border border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-semibold"
                          >
                            {mgmtBusy ? 'Updating...' : 'Unsuspend User'}
                          </button>
                        )}
                      </div>

                      {/* Delete account */}
                      <div className="border-t border-red-100 pt-4">
                        <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Delete Account</p>
                        {mgmtAction === 'delete' ? (
                          <div className="space-y-2">
                            <textarea
                              className="input text-sm min-h-[72px]"
                              placeholder="Reason for deletion (required — recorded in audit log)"
                              value={mgmtDeleteReason}
                              onChange={e => setMgmtDeleteReason(e.target.value)}
                            />
                            <input
                              className="input text-sm"
                              placeholder={`Type DELETE to confirm`}
                              value={mgmtDeleteConfirm}
                              onChange={e => setMgmtDeleteConfirm(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => setMgmtAction(null)} className="btn-ghost text-sm">Cancel</button>
                              <button
                                disabled={mgmtBusy || !mgmtDeleteReason.trim() || mgmtDeleteConfirm !== 'DELETE'}
                                onClick={async () => {
                                  setMgmtBusy(true);
                                  try {
                                    await adminAPI.deleteUser(u.id, { reason: mgmtDeleteReason });
                                    setUsers(prev => prev.filter(x => x.id !== u.id));
                                    setManagingUser(null);
                                    toast.success('User account deleted');
                                  } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
                                  finally { setMgmtBusy(false); }
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
                              >
                                {mgmtBusy ? 'Deleting...' : 'Permanently Delete'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setMgmtAction('delete')} className="text-sm px-4 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 font-semibold">
                            Delete User Account
                          </button>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'verification' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-forest-900 text-xl">Verification Requests</h2>
              <p className="text-sm text-slate-500">Review and approve user verification requests</p>
            </div>
            <button onClick={() => loadVerificationRequests()} disabled={verificationLoading} className="btn-outline text-sm">
              {verificationLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {verificationLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-forest-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : verificationRequests.length === 0 ? (
            <div className="card text-center py-12">
              <RiShieldCheckLine className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No pending verification requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {verificationRequests.map((request) => (
                <div key={request.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="text-lg">
                          {request.business_type === 'registered' ? '🏢' : '👤'}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-forest-900">
                          {request.first_name} {request.last_name || ''}
                        </p>
                        <p className="text-sm text-slate-500">{request.email}</p>
                        <p className="text-xs text-slate-400">
                          {request.business_type === 'registered' ? 'Registered Business' : 'Solo User'} • 
                          Requested: {request.verification_requested_at 
                            ? new Date(request.verification_requested_at).toLocaleDateString() 
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      request.verification_status === 'pending_admin_review' 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {request.verification_status === 'pending_admin_review' ? 'CAC Review Required' : 'Pending Review'}
                    </span>
                  </div>

                  {request.verification_notes && (
                    <div className="bg-slate-50 rounded-lg p-3 mb-4">
                      <p className="text-xs font-medium text-slate-500 mb-1">User Notes:</p>
                      <p className="text-sm text-slate-700">{request.verification_notes}</p>
                    </div>
                  )}

                  {request.verification_documents?.length > 0 && request.verification_documents.map((doc, idx) => (
                    <div key={doc.id || idx} className="bg-blue-50 rounded-lg p-3 mb-4">
                      <p className="text-xs font-medium text-blue-700 mb-1">Document:</p>
                      {doc.file_url ? (
                        <a 
                          href={doc.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-700 underline"
                        >
                          View {doc.document_type === 'cac_certificate' ? 'CAC Certificate' : 'Document'}
                        </a>
                      ) : (
                        <p className="text-sm text-blue-700">Self-attestation (no document)</p>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleVerifyUser(request.id)}
                      disabled={verificationAction?.id === request.id}
                      className="btn-primary text-sm"
                    >
                      {verificationAction?.id === request.id && verificationAction.action === 'verify' 
                        ? 'Verifying...' 
                        : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => {
                        setVerificationAction({ id: request.id, action: 'reject' });
                        setVerificationRejectReason('');
                      }}
                      disabled={verificationAction?.id === request.id}
                      className="btn-outline text-sm text-red-600 border-red-300 hover:bg-red-50"
                    >
                      ✕ Reject
                    </button>
                  </div>

                  {verificationAction?.id === request.id && verificationAction.action === 'reject' && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <label className="label">Rejection Reason *</label>
                      <textarea
                        value={verificationRejectReason}
                        onChange={(e) => setVerificationRejectReason(e.target.value)}
                        className="input mb-3"
                        placeholder="Explain why the verification was rejected..."
                        rows={3}
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleRejectVerification(request.id)}
                          disabled={!verificationRejectReason.trim() || verificationAction?.id !== request.id}
                          className="btn-primary text-sm bg-red-600 hover:bg-red-700"
                        >
                          Confirm Rejection
                        </button>
                        <button
                          onClick={() => {
                            setVerificationAction(null);
                            setVerificationRejectReason('');
                          }}
                          className="btn-outline text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="card">
          <h2 className="font-semibold text-forest-900 mb-3">All Projects (Platform-wide)</h2>
          <div className="grid md:grid-cols-4 gap-2 mb-4">
            <input className="input" placeholder="Search project/location" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} />
            <select className="input" value={projectStatusFilter} onChange={(e) => setProjectStatusFilter(e.target.value)}>
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="decommissioned">Decommissioned</option>
              <option value="recycled">Recycled</option>
              <option value="pending_recovery">Pending Recovery</option>
            </select>
            <select className="input" value={projectGeoFilter} onChange={(e) => setProjectGeoFilter(e.target.value)}>
              <option value="">All verification</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
            <div className="text-xs text-slate-500 flex items-center">{projects.length} records</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-outline text-xs"
                onClick={() => setSelectedProjectIds(projects.map((p) => p.id))}
                disabled={projects.length === 0}
              >
                Select All
              </button>
              <button
                type="button"
                className="btn-outline text-xs"
                onClick={() => setSelectedProjectIds([])}
                disabled={selectedProjectIds.length === 0}
              >
                Clear
              </button>
              <span className="text-xs text-slate-500">{selectedProjectIds.length} selected</span>
            </div>

            <div className="mt-3 grid md:grid-cols-4 gap-2">
              <button type="button" className="btn-outline text-xs border-emerald-500 text-emerald-700" disabled={bulkBusy} onClick={() => handleBulkProjectUpdate({ geo_verified: true })}>Bulk Verify</button>
              <button type="button" className="btn-outline text-xs border-amber-500 text-amber-700" disabled={bulkBusy} onClick={() => handleBulkProjectUpdate({ geo_verified: false })}>Bulk Unverify</button>
              <button type="button" className="btn-outline text-xs border-red-500 text-red-700" disabled={bulkBusy} onClick={() => handleBulkProjectUpdate({ is_delisted: true })}>Bulk Delist</button>
              <button type="button" className="btn-outline text-xs border-cyan-500 text-cyan-700" disabled={bulkBusy} onClick={() => handleBulkProjectUpdate({ is_delisted: false })}>Bulk Restore</button>
            </div>

            <div className="mt-2 grid md:grid-cols-4 gap-2">
              <select className="input text-xs md:col-span-3" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                <option value="">Select bulk status...</option>
                <option value="active">Active</option>
                <option value="decommissioned">Decommissioned</option>
                <option value="recycled">Recycled</option>
                <option value="pending_recovery">Pending Recovery</option>
              </select>
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={bulkBusy || !bulkStatus}
                onClick={() => handleBulkProjectUpdate({ status: bulkStatus })}
              >
                Apply Status
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[640px] overflow-auto pr-1">
            {projects.map((p) => (
              <div key={p.id} className="p-3 rounded-xl border border-slate-100">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedProjectIds.includes(p.id)}
                      onChange={(e) => {
                        setSelectedProjectIds((prev) => e.target.checked ? [...new Set([...prev, p.id])] : prev.filter((id) => id !== p.id));
                      }}
                    />
                    <div>
                      <p className="font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.brand_name || 'Unknown brand'} • {p.brand_email || 'No email'}</p>
                    <p className="text-xs text-slate-500">{p.city}, {p.state} • {p.address || 'No address'}</p>
                    <p className="text-xs mt-1">
                      <span className={`px-2 py-0.5 rounded-full border ${p.geo_verified ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-amber-700 border-amber-200 bg-amber-50'}`}>{p.geo_verified ? 'Verified' : 'Unverified'}</span>
                      <span className={`ml-2 px-2 py-0.5 rounded-full border ${p.is_delisted ? 'text-red-700 border-red-200 bg-red-50' : 'text-cyan-700 border-cyan-200 bg-cyan-50'}`}>{p.is_delisted ? 'Delisted' : 'Active Listing'}</span>
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-2">
                    <select className="input text-xs" defaultValue={p.status} onChange={(e) => handleAdminProjectUpdate(p.id, { status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="decommissioned">Decommissioned</option>
                      <option value="recycled">Recycled</option>
                      <option value="pending_recovery">Pending Recovery</option>
                    </select>
                    <button className={`btn-outline text-xs ${p.geo_verified ? 'border-amber-400 text-amber-700' : 'border-emerald-500 text-emerald-700'}`} onClick={() => handleAdminProjectUpdate(p.id, { geo_verified: !p.geo_verified })}>
                      {p.geo_verified ? 'Mark Unverified' : 'Mark Verified'}
                    </button>
                    <button className={`btn-outline text-xs ${p.is_delisted ? 'border-cyan-500 text-cyan-700' : 'border-red-500 text-red-700'}`} onClick={() => handleAdminProjectUpdate(p.id, { is_delisted: !p.is_delisted })}>
                      {p.is_delisted ? 'Restore Listing' : 'Delist Project'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'paystack' && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-forest-900">Paystack Plan Catalog</h2>
          {paystackPlans.length === 0 && <p className="text-sm text-slate-500">No plans mapped yet. Add plan mappings to enable auto-renew from Paystack plans.</p>}
          {paystackPlans.map((p) => (
            <div key={p.id} className="border border-slate-100 rounded-xl p-3">
              <p className="text-sm font-medium text-slate-800">{p.plan_key} - {p.paystack_plan_code}</p>
              <p className="text-xs text-slate-500">Amount: N{Number(p.amount_kobo || 0) / 100} • Interval: {p.interval} • {p.active ? 'Active' : 'Inactive'}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'promo' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-indigo-700">Campaign Controls</p>
            <p className="text-sm text-indigo-900 mt-1">Build and monitor promo campaigns with instant activation control and redemption visibility.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <form className="card space-y-3" onSubmit={handleCreatePromo}>
              <h2 className="font-semibold text-forest-900">Create Promo Code</h2>
              <input className="input" placeholder="Code (e.g. APRIL10)" value={newPromo.code} onChange={(e) => setNewPromo((p) => ({ ...p, code: e.target.value.toUpperCase() }))} required />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={newPromo.discount_type} onChange={(e) => setNewPromo((p) => ({ ...p, discount_type: e.target.value }))}>
                  <option value="percent">Percent</option>
                  <option value="flat">Flat NGN</option>
                </select>
                <input className="input" type="number" min="1" value={newPromo.discount_value} onChange={(e) => setNewPromo((p) => ({ ...p, discount_value: Number(e.target.value) }))} required />
              </div>
              <input className="input" type="number" min="1" placeholder="Max redemptions (optional)" value={newPromo.max_redemptions} onChange={(e) => setNewPromo((p) => ({ ...p, max_redemptions: e.target.value }))} />
              <button type="submit" className="btn-primary">Create Promo</button>
            </form>

            <div className="card">
              <h2 className="font-semibold text-forest-900 mb-3">Campaign Snapshot</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Total Codes</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{promoCodes.length}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Active</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{promoCodes.filter((p) => p.active).length}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 col-span-2">
                  <p className="text-xs text-amber-700">Total Redemptions</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{promoCodes.reduce((sum, p) => sum + Number(p.redeemed_count || 0), 0)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card space-y-2">
            <h2 className="font-semibold text-forest-900">Promo Codes</h2>
            {promoCodes.length === 0 && <p className="text-sm text-slate-500">No promo codes yet. Create your first campaign above.</p>}
            {promoCodes.map((promo) => (
              <div key={promo.id} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-forest-200 transition-colors">
                <div>
                  <p className="font-medium text-slate-800">{promo.code}</p>
                  <p className="text-xs text-slate-500">{promo.discount_type === 'percent' ? `${promo.discount_value}%` : `N${promo.discount_value}`} • redeemed {promo.redeemed_count}/{promo.max_redemptions || 'unlimited'}</p>
                </div>
                <button onClick={() => handleTogglePromo(promo.id, !promo.active)} className={`btn-outline text-xs px-3 py-1 ${promo.active ? 'border-red-400 text-red-600' : 'border-emerald-500 text-emerald-700'}`}>
                  {promo.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'finance' && finance && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="card"><p className="text-xs text-slate-500">Total Revenue</p><p className="text-xl font-bold text-forest-900">₦{Number(finance.summary?.revenue_ngn || 0).toLocaleString('en-NG')}</p></div>
            <div className="card"><p className="text-xs text-slate-500">Total Discounts</p><p className="text-xl font-bold text-amber-700">₦{Number(finance.summary?.discounts_ngn || 0).toLocaleString('en-NG')}</p></div>
            <div className="card"><p className="text-xs text-slate-500">Transactions</p><p className="text-xl font-bold text-forest-900">{finance.summary?.transactions || 0}</p></div>
            <div className="card"><p className="text-xs text-slate-500">Coupon Uses</p><p className="text-xl font-bold text-purple-700">{finance.summary?.coupon_count || 0} (₦{Number(finance.summary?.coupon_discounts_ngn || 0).toLocaleString('en-NG')} off)</p></div>
          </div>

          {/* Per-channel & per-plan breakdown */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="card">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Revenue by Channel</p>
              <div className="space-y-1">
                {Object.entries(finance.summary?.by_channel || {}).map(([ch, v]) => (
                  <div key={ch} className="flex justify-between text-sm">
                    <span className="text-slate-600 capitalize">{ch.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-forest-900">₦{Number(v.revenue_ngn).toLocaleString('en-NG')} ({v.count})</span>
                  </div>
                ))}
                {Object.keys(finance.summary?.by_channel || {}).length === 0 && <p className="text-xs text-slate-400">No transactions yet</p>}
              </div>
            </div>
            <div className="card">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Revenue by Plan</p>
              <div className="space-y-1">
                {Object.entries(finance.summary?.by_plan || {}).map(([p, v]) => (
                  <div key={p} className="flex justify-between text-sm">
                    <span className="text-slate-600 capitalize">{p === 'free' ? 'Basic' : p}</span>
                    <span className="font-medium text-forest-900">₦{Number(v.revenue_ngn).toLocaleString('en-NG')} ({v.count})</span>
                  </div>
                ))}
                {Object.keys(finance.summary?.by_plan || {}).length === 0 && <p className="text-xs text-slate-400">No transactions yet</p>}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card">
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div>
                <label className="label text-xs">Channel</label>
                <select className="input text-sm" value={financeChannel} onChange={e => { setFinanceChannel(e.target.value); setFinancePage(1); }}>
                  <option value="">All Channels</option>
                  <option value="paystack">Paystack</option>
                  <option value="direct_transfer">Direct Transfer</option>
                  <option value="coupon_only">Coupon Only</option>
                  <option value="admin_grant">Admin Grant</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Plan</label>
                <select className="input text-sm" value={financePlan} onChange={e => { setFinancePlan(e.target.value); setFinancePage(1); }}>
                  <option value="">All Plans</option>
                  <option value="pro">Pro</option>
                  <option value="elite">Elite</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <span className="text-xs text-slate-400 ml-auto">{finance.total || 0} total • Page {finance.page || 1} • {finance.environment?.toUpperCase()} mode</span>
            </div>

            {/* Transaction table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                    <th className="py-2 pr-3">Date / Time</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Channel</th>
                    <th className="py-2 pr-3">Amount (₦)</th>
                    <th className="py-2 pr-3">Discount</th>
                    <th className="py-2 pr-3">Coupon</th>
                    <th className="py-2 pr-3">Admin / Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {(finance.transactions || []).map(tx => {
                    const ch = tx.payment_channel || 'paystack';
                    const channelBadge = {
                      paystack: 'bg-blue-100 text-blue-800',
                      direct_transfer: 'bg-emerald-100 text-emerald-800',
                      coupon_only: 'bg-purple-100 text-purple-800',
                      admin_grant: 'bg-amber-100 text-amber-800',
                    }[ch] || 'bg-slate-100 text-slate-600';
                    return (
                      <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <p className="font-medium text-slate-800">{new Date(tx.paid_at).toLocaleDateString('en-NG')}</p>
                          <p className="text-xs text-slate-400">{new Date(tx.paid_at).toLocaleTimeString('en-NG')}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <p className="font-medium text-slate-700">{tx.user?.first_name || ''} {tx.user?.last_name || ''}</p>
                          <p className="text-xs text-slate-400">{tx.user?.email || tx.user_id?.slice(0, 8)}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-forest-100 text-forest-800">{(tx.plan || 'free').toUpperCase()}</span>
                          <p className="text-xs text-slate-400 mt-0.5">{tx.billing_interval || 'monthly'}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${channelBadge}`}>{ch.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="py-2 pr-3 font-semibold text-slate-800">₦{Number(tx.amount_ngn || 0).toLocaleString('en-NG')}</td>
                        <td className="py-2 pr-3 text-amber-700">{Number(tx.discount_amount_ngn || 0) > 0 ? `₦${Number(tx.discount_amount_ngn).toLocaleString('en-NG')}` : '—'}</td>
                        <td className="py-2 pr-3">
                          {tx.coupon_code_used || tx.promo_code ? (
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-mono bg-purple-50 text-purple-700">{tx.coupon_code_used || tx.promo_code}</span>
                              {tx.coupon_discount_value > 0 && (
                                <p className="text-xs text-slate-400 mt-0.5">{tx.coupon_discount_type === 'percent' ? `${tx.coupon_discount_value}%` : `₦${Number(tx.coupon_discount_value).toLocaleString('en-NG')}`} off</p>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {tx.admin_upgrader ? (
                            <div>
                              <p className="text-slate-700 font-medium">{tx.admin_upgrader.first_name} {tx.admin_upgrader.last_name}</p>
                              <p className="text-slate-400">{tx.admin_upgrader.email}</p>
                            </div>
                          ) : tx.bank_reference ? (
                            <span className="text-slate-500 font-mono">{tx.bank_reference}</span>
                          ) : tx.paystack_reference ? (
                            <span className="text-slate-400 font-mono truncate max-w-[120px] inline-block">{tx.paystack_reference}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {(!finance.transactions || finance.transactions.length === 0) && (
                    <tr><td colSpan={8} className="py-8 text-center text-slate-400">No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(finance.total || 0) > 50 && (
              <div className="flex justify-center gap-2 mt-4">
                <button disabled={financePage <= 1} onClick={() => setFinancePage(p => Math.max(1, p - 1))} className="btn-ghost text-sm">← Prev</button>
                <span className="text-sm text-slate-500 py-2">Page {financePage}</span>
                <button disabled={(financePage * 50) >= (finance.total || 0)} onClick={() => setFinancePage(p => p + 1)} className="btn-ghost text-sm">Next →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'push' && (
        <form className="card space-y-3" onSubmit={handlePush}>
          <h2 className="font-semibold text-forest-900">Push Notifications</h2>
          <input className="input" value={newPush.title} onChange={(e) => setNewPush((p) => ({ ...p, title: e.target.value }))} placeholder="Title" required />
          <textarea className="input min-h-[120px]" value={newPush.message} onChange={(e) => setNewPush((p) => ({ ...p, message: e.target.value }))} placeholder="Message" required />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={newPush.target_type} onChange={(e) => setNewPush((p) => ({ ...p, target_type: e.target.value }))}>
              <option value="all">All Users</option>
              <option value="plan">By Plan</option>
              <option value="company">By Company ID</option>
              <option value="user">Single User ID</option>
            </select>
            <input className="input" value={newPush.target_value} onChange={(e) => setNewPush((p) => ({ ...p, target_value: e.target.value }))} placeholder="Target value (optional)" />
          </div>
          <button type="submit" className="btn-primary">Send Notification</button>
        </form>
      )}

      {activeTab === 'logs' && (
        <div className="card">
          <h2 className="font-semibold text-forest-900 mb-3">Activity Log</h2>
          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {logs.map((log) => (
              <div key={log.id} className="border border-slate-100 rounded-xl p-3">
                <p className="text-sm font-medium text-slate-700">{log.action}</p>
                <p className="text-xs text-slate-400">{log.actor_email || 'system'} • {new Date(log.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'admins' && (
        <div className="card">
          <h2 className="font-semibold text-forest-900 mb-3">Admin Management</h2>
          {platformAdminRole !== 'super_admin' && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
              Super Admin role is required for admin privilege changes.
            </p>
          )}

          {platformAdminRole === 'super_admin' && (
            <form onSubmit={handleAssignAdminRole} className="border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50">
              <p className="text-sm font-semibold text-slate-700 mb-2">Assign Admin Role</p>
              <div className="grid lg:grid-cols-5 gap-2">
                <div className="lg:col-span-2">
                  <input
                    className="input"
                    placeholder="Search users by name or email"
                    value={adminUserSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAdminUserSearch(val);
                      searchUsersForAdminRole(val);
                    }}
                  />
                  {searchingAdminUser && <p className="text-xs text-slate-400 mt-1">Searching users...</p>}
                  {!searchingAdminUser && adminUserSearchResults.length > 0 && (
                    <div className="mt-2 border border-slate-200 rounded-lg bg-white max-h-48 overflow-auto">
                      {adminUserSearchResults.map((u) => (
                        <button
                          type="button"
                          key={u.id}
                          className="w-full text-left px-3 py-2 hover:bg-forest-50 border-b border-slate-100 last:border-b-0"
                          onClick={() => {
                            setAdminRoleForm((prev) => ({ ...prev, user_id: u.id }));
                            setAdminUserSearch(`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email);
                            setAdminUserSearchResults([]);
                          }}
                        >
                          <p className="text-sm font-medium text-slate-800">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  className="input"
                  value={adminRoleForm.role}
                  onChange={(e) => setAdminRoleForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="operations">Operations Admin</option>
                  <option value="analytics">Analytics Admin</option>
                  <option value="finance">Finance Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>

                <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">
                  <input
                    type="checkbox"
                    checked={adminRoleForm.is_active}
                    onChange={(e) => setAdminRoleForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Active
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">
                  <input
                    type="checkbox"
                    checked={adminRoleForm.can_manage_admins}
                    onChange={(e) => setAdminRoleForm((prev) => ({ ...prev, can_manage_admins: e.target.checked }))}
                  />
                  Can Manage Admins
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Selected user ID: {adminRoleForm.user_id || 'None selected'}
                </p>
                <button
                  type="submit"
                  disabled={assigningAdminRole || !adminRoleForm.user_id}
                  className="btn-primary"
                >
                  {assigningAdminRole ? 'Saving...' : 'Assign Role'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {admins.map((admin) => (
              <div key={admin.id} className="border border-slate-100 rounded-xl p-3">
                <p className="font-medium text-slate-800">{admin.users?.first_name} {admin.users?.last_name}</p>
                <p className="text-xs text-slate-500">{admin.users?.email}</p>
                <p className="text-xs text-slate-400 mt-1">Role: {admin.role} • {admin.is_active ? 'Active' : 'Inactive'} • Manage Admins: {admin.can_manage_admins ? 'Yes' : 'No'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================== PICKUP REQUESTS ======================== */}
      {activeTab === 'pickup' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-forest-900">Pickup & Decommission Requests</h2>
            <button className="btn-ghost text-sm" onClick={async () => {
              const { data } = await adminAPI.listRecoveryRequests({ status: 'requested' });
              setRecoveryRequests(data?.data?.requests || []);
            }}>Refresh</button>
          </div>

          {recoveryRequests.length === 0 ? (
            <p className="text-slate-500 text-sm">No pending pickup requests.</p>
          ) : (
            <div className="space-y-3">
              {recoveryRequests.map(req => (
                <div key={req.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-800">{req.project?.name || 'Unknown Project'}</p>
                      <p className="text-xs text-slate-500">{req.project?.city}, {req.project?.state} • {req.project?.capacity_kw ? req.project.capacity_kw + ' kW' : ''}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Requested: {new Date(req.created_at).toLocaleDateString('en-NG')}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                      req.decommission_approved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {req.decommission_approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-slate-400">Contact:</span> <span className="text-slate-700">{req.contact_name || req.requester?.first_name} {req.requester?.last_name}</span></div>
                    <div><span className="text-slate-400">Phone:</span> <span className="text-slate-700">{req.contact_phone || req.requester?.phone || '—'}</span></div>
                    <div><span className="text-slate-400">Company:</span> <span className="text-slate-700">{req.requester_company_name || '—'}</span></div>
                    <div><span className="text-slate-400">Preferred Date:</span> <span className="text-slate-700">{req.preferred_date ? new Date(req.preferred_date).toLocaleDateString('en-NG') : '—'}</span></div>
                    <div><span className="text-slate-400">Recycler:</span> <span className="text-slate-700">{req.preferred_recycler || 'Leave to SolNuv'}</span></div>
                    <div><span className="text-slate-400">Address:</span> <span className="text-slate-700">{req.pickup_address || '—'}</span></div>
                  </div>

                  {req.project_summary && (
                    <p className="text-xs text-slate-500">System: {req.project_summary}</p>
                  )}
                  {req.notes && (
                    <p className="text-xs text-slate-500">Notes: {req.notes}</p>
                  )}

                  {!req.decommission_approved && (
                    <div className="pt-2 flex gap-3">
                      <input
                        className="input text-sm flex-1"
                        placeholder="Admin notes (optional)"
                        id={`notes-${req.id}`}
                        defaultValue=""
                      />
                      <button
                        disabled={pickupApprovingId === req.id}
                        onClick={async () => {
                          setPickupApprovingId(req.id);
                          try {
                            const notes = document.getElementById(`notes-${req.id}`)?.value;
                            await adminAPI.approveDecommission(req.id, { admin_notes: notes });
                            toast.success('Decommission approved — user notified');
                            setRecoveryRequests(prev => prev.map(r =>
                              r.id === req.id ? { ...r, decommission_approved: true, status: 'approved' } : r
                            ));
                          } catch (err) {
                            toast.error(err.response?.data?.message || 'Failed to approve');
                          } finally {
                            setPickupApprovingId(null);
                          }
                        }}
                        className="btn-primary text-sm whitespace-nowrap"
                      >
                        {pickupApprovingId === req.id ? 'Approving...' : '✅ Approve Decommission'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================== DIRECT BANK TRANSFERS ======================== */}
      {activeTab === 'direct-payments' && (
        <div className="space-y-6">
          {/* Bank Account Settings Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-base font-bold text-forest-900 mb-4">Bank Account Settings</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Account Name', key: 'account_name', placeholder: 'e.g. SolNuv Energy Ltd' },
                { label: 'Bank Name', key: 'bank_name', placeholder: 'e.g. Guaranty Trust Bank' },
                { label: 'Account Number', key: 'account_number', placeholder: '10-digit account number' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input
                    className="input w-full text-sm"
                    placeholder={placeholder}
                    value={bankTransferSettings[key] || ''}
                    onChange={e => setBankTransferSettings(s => ({ ...s, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Additional Instructions (shown to users)</label>
                <textarea
                  rows={2}
                  className="input w-full text-sm"
                  placeholder="e.g. Use your email as narration when transferring."
                  value={bankTransferSettings.additional_instructions || ''}
                  onChange={e => setBankTransferSettings(s => ({ ...s, additional_instructions: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bt-active"
                  checked={!!bankTransferSettings.is_active}
                  onChange={e => setBankTransferSettings(s => ({ ...s, is_active: e.target.checked }))}
                />
                <label htmlFor="bt-active" className="text-sm text-slate-600">Enable Direct Bank Transfer option for users</label>
              </div>
            </div>
            <div className="mt-4">
              <button
                disabled={bankSettingsBusy}
                className="btn-primary text-sm"
                onClick={async () => {
                  setBankSettingsBusy(true);
                  try {
                    await adminAPI.updateBankTransferSettings(bankTransferSettings);
                    toast.success('Bank transfer settings saved');
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to save settings');
                  } finally {
                    setBankSettingsBusy(false);
                  }
                }}
              >
                {bankSettingsBusy ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* Submissions Table */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-base font-bold text-forest-900">Payment Submissions</h2>
              <div className="flex items-center gap-2">
                <select
                  className="input text-sm"
                  value={directPaymentsFilter}
                  onChange={e => setDirectPaymentsFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button className="btn-ghost text-sm" onClick={async () => {
                  const { data } = await adminAPI.listDirectPayments(directPaymentsFilter ? { status: directPaymentsFilter } : undefined);
                  setDirectPayments(data?.data?.submissions || []);
                }}>Refresh</button>
              </div>
            </div>

            {directPayments.filter(s => !directPaymentsFilter || s.status === directPaymentsFilter).length === 0 ? (
              <p className="text-slate-500 text-sm">No submissions found.</p>
            ) : (
              <div className="space-y-3">
                {directPayments
                  .filter(s => !directPaymentsFilter || s.status === directPaymentsFilter)
                  .map(sub => (
                    <div key={sub.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {sub.user?.first_name} {sub.user?.last_name}
                            <span className="ml-2 text-xs text-slate-400">{sub.user?.email}</span>
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                            <span>Plan: <span className="font-semibold capitalize text-slate-700">{sub.plan_id}</span></span>
                            <span>Interval: <span className="font-semibold capitalize text-slate-700">{sub.billing_interval}</span></span>
                            <span>Amount: <span className="font-semibold text-slate-700">₦{Number(sub.amount_ngn || 0).toLocaleString('en-NG')}</span></span>
                            <span>Reference: <span className="font-mono text-slate-700">{sub.reference_note || '—'}</span></span>
                            <span>Submitted: <span className="text-slate-700">{sub.created_at ? new Date(sub.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></span>
                          </div>
                          {sub.admin_note && (
                            <p className="text-xs text-slate-400 mt-1">Admin note: {sub.admin_note}</p>
                          )}
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${sub.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : sub.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                          {sub.status?.toUpperCase()}
                        </span>
                      </div>

                      {sub.proof_url && (
                        <a href={sub.proof_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs text-forest-900 hover:underline">
                          View Receipt →
                        </a>
                      )}

                      {sub.status === 'pending' && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                          <button
                            disabled={directPaymentBusy === sub.id}
                            className="btn-primary text-sm py-2 px-4"
                            onClick={async () => {
                              setDirectPaymentBusy(sub.id);
                              try {
                                await adminAPI.verifyDirectPayment(sub.id, {});
                                setDirectPayments(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'verified' } : s));
                                toast.success('Payment verified — subscription activated');
                              } catch (err) {
                                toast.error(err.response?.data?.message || 'Verification failed');
                              } finally {
                                setDirectPaymentBusy(null);
                              }
                            }}
                          >
                            {directPaymentBusy === sub.id ? 'Verifying...' : '✓ Verify & Activate'}
                          </button>

                          {rejectingId === sub.id ? (
                            <div className="flex gap-2 flex-1">
                              <input
                                className="input text-sm flex-1"
                                placeholder="Rejection reason (required)"
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                              />
                              <button
                                disabled={directPaymentBusy === sub.id}
                                className="btn-outline text-sm text-red-600 border-red-200 py-2 px-3"
                                onClick={async () => {
                                  if (!rejectReason.trim()) { toast.error('Enter a rejection reason'); return; }
                                  setDirectPaymentBusy(sub.id);
                                  try {
                                    await adminAPI.rejectDirectPayment(sub.id, { admin_note: rejectReason });
                                    setDirectPayments(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'rejected', admin_note: rejectReason } : s));
                                    setRejectingId(null);
                                    setRejectReason('');
                                    toast.success('Submission rejected');
                                  } catch (err) {
                                    toast.error(err.response?.data?.message || 'Rejection failed');
                                  } finally {
                                    setDirectPaymentBusy(null);
                                  }
                                }}
                              >
                                Confirm
                              </button>
                              <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</button>
                            </div>
                          ) : (
                            <button
                              className="btn-outline text-sm text-red-600 border-red-200 py-2 px-4"
                              onClick={() => { setRejectingId(sub.id); setRejectReason(''); }}
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminRoute>
  );
}

function AdminDashboardPage() {
  return <AdminConsole forcedTab="overview" showTabs={false} />;
}

AdminDashboardPage.getLayout = getAdminLayout;

export default AdminDashboardPage;
