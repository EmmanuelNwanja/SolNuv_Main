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
} from 'react-icons/ri';

export const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', path: '/admin', title: 'Admin Control Center - SolNuv' },
  { id: 'users', label: 'Users', path: '/admin/users', title: 'Admin Users - SolNuv' },
  { id: 'paystack', label: 'Paystack Plans', path: '/admin/paystack', title: 'Admin Paystack Plans - SolNuv' },
  { id: 'promo', label: 'Promo Codes', path: '/admin/promo', title: 'Admin Promo Codes - SolNuv' },
  { id: 'finance', label: 'Finance', path: '/admin/finance', title: 'Admin Finance - SolNuv' },
  { id: 'push', label: 'Push Notifications', path: '/admin/push', title: 'Admin Notifications - SolNuv' },
  { id: 'logs', label: 'Activity Log', path: '/admin/logs', title: 'Admin Activity Log - SolNuv' },
  { id: 'admins', label: 'Admin Management', path: '/admin/admins', title: 'Admin Management - SolNuv' },
];

export function AdminConsole({ forcedTab = 'overview', showTabs = false }) {
  const { isPlatformAdmin, platformAdminRole } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(forcedTab);
  const [loading, setLoading] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState([]);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [paystackPlans, setPaystackPlans] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [finance, setFinance] = useState(null);
  const [logs, setLogs] = useState([]);
  const [admins, setAdmins] = useState([]);
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
    applies_to_plans: ['pro', 'elite', 'enterprise'],
  });

  const [newPush, setNewPush] = useState({ title: '', message: '', target_type: 'all', target_value: '' });

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
      paystack: [{ key: 'paystack', request: adminAPI.listPaystackPlans() }],
      promo: [{ key: 'promo', request: adminAPI.listPromoCodes() }],
      finance: [{ key: 'finance', request: adminAPI.getFinance() }],
      push: [],
      logs: [{ key: 'logs', request: adminAPI.getActivityLogs() }],
      admins: [{ key: 'admins', request: adminAPI.listAdmins() }],
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
          if (key === 'paystack') setPaystackPlans(payload || []);
          if (key === 'promo') setPromoCodes(payload || []);
          if (key === 'finance') setFinance(payload || null);
          if (key === 'logs') setLogs(payload || []);
          if (key === 'admins') setAdmins(payload || []);
        });

        setLoadWarnings(warnings);
        if (warnings.length > 0) {
          toast.error(`Some admin sections failed to load: ${warnings.join(', ')}`);
        }
      })
      .finally(() => setLoading(false));
  }, [isPlatformAdmin, forcedTab]);

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
        applies_to_plans: ['pro', 'elite', 'enterprise'],
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
            <Link href="/admin/admins" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition-colors">Manage Admins</Link>
            <Link href="/admin/finance" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition-colors">Finance</Link>
            <Link href="/admin/push" className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition-colors">Send Notification</Link>
          </div>
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
        <div className="card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <input
              className="input max-w-sm"
              placeholder="Search users"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="text-xs text-slate-400">{filteredUsers.length} users</span>
          </div>
          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <div key={u.id} className="p-3 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{u.first_name} {u.last_name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                  <p className="text-xs text-slate-400">Plan: {u.companies?.subscription_plan || 'free'} ({u.companies?.subscription_interval || 'monthly'})</p>
                </div>
                <button
                  className={`btn-outline text-xs px-3 py-1 ${u.is_active ? 'border-emerald-500 text-emerald-700' : 'border-red-500 text-red-700'}`}
                  onClick={async () => {
                    try {
                      await adminAPI.updateUserVerification({ user_id: u.id, is_active: !u.is_active });
                      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
                    } catch {
                      toast.error('Failed to update user status');
                    }
                  }}
                >
                  {u.is_active ? 'Deactivate' : 'Activate'}
                </button>
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

          <div className="card space-y-2">
            <h2 className="font-semibold text-forest-900">Promo Codes</h2>
            {promoCodes.map((promo) => (
              <div key={promo.id} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-3">
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
        <div className="card">
          <h2 className="font-semibold text-forest-900 mb-3">Finance Summary</h2>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Revenue</p><p className="text-lg font-bold text-forest-900">N{Number(finance.summary?.revenue_ngn || 0).toLocaleString('en-NG')}</p></div>
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Discounts</p><p className="text-lg font-bold text-amber-700">N{Number(finance.summary?.discounts_ngn || 0).toLocaleString('en-NG')}</p></div>
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Transactions</p><p className="text-lg font-bold text-forest-900">{finance.summary?.transactions || 0}</p></div>
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
    </AdminRoute>
  );
}

function AdminDashboardPage() {
  return <AdminConsole forcedTab="overview" showTabs={false} />;
}

AdminDashboardPage.getLayout = getAdminLayout;

export default AdminDashboardPage;
