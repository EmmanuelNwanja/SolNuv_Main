import Head from 'next/head';
import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { getAdminLayout } from '../../components/Layout';
import AdminRoute from '../../components/AdminRoute';
import { LoadingSpinner } from '../../components/ui/index';
import toast from 'react-hot-toast';

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function NercAdminPage() {
  const [loading, setLoading] = useState(true);
  const [sla, setSla] = useState(null);
  const [applications, setApplications] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [slaRes, appsRes, cyclesRes] = await Promise.all([
        adminAPI.getNercSlaOverview(),
        adminAPI.listNercApplications(statusFilter ? { status: statusFilter } : {}),
        adminAPI.listNercReportingCycles({ limit: 30 }),
      ]);
      setSla(slaRes.data.data || null);
      setApplications(appsRes.data.data?.applications || []);
      setCycles(cyclesRes.data.data?.cycles || []);
    } catch {
      toast.error('Failed to load NERC admin data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function takeDecision(id, action) {
    setDecisionBusy(id + action);
    try {
      await adminAPI.decideNercApplication(id, { action });
      toast.success('Decision saved');
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Decision failed');
    } finally {
      setDecisionBusy(null);
    }
  }

  return (
    <AdminRoute>
      <Head><title>NERC Compliance - SolNuv Admin</title></Head>
      <div className="max-w-screen-xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">NERC Compliance Queue</h1>
          <p className="text-sm text-slate-500">Review permit/registration applications and monitor SLA + reporting cadence.</p>
        </div>

        {loading ? <LoadingSpinner /> : (
          <>
            <div className="grid sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-white">
                <p className="text-xs uppercase text-slate-400">Total Applications</p>
                <p className="text-2xl font-bold text-slate-800">{sla?.total || 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 bg-white">
                <p className="text-xs uppercase text-slate-400">Pending Review</p>
                <p className="text-2xl font-bold text-amber-600">{sla?.pending_review || 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 bg-white">
                <p className="text-xs uppercase text-slate-400">SLA Breached</p>
                <p className="text-2xl font-bold text-red-600">{sla?.sla_breached || 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 bg-white">
                <p className="text-xs uppercase text-slate-400">Due In 5 Days</p>
                <p className="text-2xl font-bold text-blue-600">{sla?.due_in_5_days || 0}</p>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-forest-900">Application Review Queue</h2>
                <select className="input max-w-[220px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="submitted">submitted</option>
                  <option value="in_review">in_review</option>
                  <option value="changes_requested">changes_requested</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
              <div className="space-y-2">
                {applications.map((app) => (
                  <div key={app.id} className="rounded-xl border border-slate-200 p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{app.projects?.name || 'Project'}</p>
                      <p className="text-xs text-slate-500">
                        {(app.application_type || '').replace('_', ' ')} · {app.status?.replace('_', ' ')} · SLA due {fmtDate(app.sla_due_at)}
                      </p>
                      <p className="text-xs text-slate-400">{app.projects?.companies?.name || '—'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-outline text-sm" disabled={decisionBusy === `${app.id}start_review`} onClick={() => takeDecision(app.id, 'start_review')}>Start Review</button>
                      <button className="btn-outline text-sm" disabled={decisionBusy === `${app.id}changes_requested`} onClick={() => takeDecision(app.id, 'changes_requested')}>Request Changes</button>
                      <button className="btn-primary text-sm" disabled={decisionBusy === `${app.id}approve`} onClick={() => takeDecision(app.id, 'approve')}>Approve</button>
                      <button className="btn-outline text-sm border-red-200 text-red-600 hover:bg-red-50" disabled={decisionBusy === `${app.id}reject`} onClick={() => takeDecision(app.id, 'reject')}>Reject</button>
                    </div>
                  </div>
                ))}
                {applications.length === 0 && <p className="text-sm text-slate-500 py-3">No applications found.</p>}
              </div>
            </div>

            <div className="card">
              <h2 className="font-semibold text-forest-900 mb-3">Reporting Cadence Monitor</h2>
              <div className="space-y-2">
                {cycles.map((cycle) => (
                  <div key={cycle.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-800">{cycle.projects?.name || 'Project'} ({cycle.cadence})</p>
                    <p className="text-xs text-slate-500">
                      Period {fmtDate(cycle.period_start)} - {fmtDate(cycle.period_end)} · Due {fmtDate(cycle.due_date)} · Status {cycle.status}
                    </p>
                  </div>
                ))}
                {cycles.length === 0 && <p className="text-sm text-slate-500 py-3">No reporting cycles found.</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminRoute>
  );
}

NercAdminPage.getLayout = getAdminLayout;
