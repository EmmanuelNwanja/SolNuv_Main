import Head from 'next/head';
import { useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import { adminAPI } from '../../services/api';
import { getAdminLayout } from '../../components/Layout';
import AdminRoute from '../../components/AdminRoute';
import { LoadingSpinner } from '../../components/ui/index';
import type {
  NercAdminDecisionAction,
  NercApplicationWithProject,
  NercApplicationStatus,
  NercSubmissionEvent,
  NercSubmissionDecisionAction,
  NercReportingCycleWithProject,
} from '../../types/contracts';
import toast from 'react-hot-toast';

type NercSlaOverview = {
  total: number;
  pending_review: number;
  sla_breached: number;
  due_in_5_days: number;
};

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as AxiosError<{ message?: string }>;
  return err.response?.data?.message ?? fallback;
}

export default function NercAdminPage() {
  const [loading, setLoading] = useState(true);
  const [sla, setSla] = useState<NercSlaOverview | null>(null);
  const [applications, setApplications] = useState<NercApplicationWithProject[]>([]);
  const [cycles, setCycles] = useState<NercReportingCycleWithProject[]>([]);
  const [statusFilter, setStatusFilter] = useState<NercApplicationStatus | ''>('');
  const [cycleStatusFilter, setCycleStatusFilter] = useState<'pending' | 'submitted' | 'overdue' | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<'sla_breached' | 'permit_required' | 'overdue' | 'geo_unverified' | ''>('');
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [submissionBusy, setSubmissionBusy] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedCycleSubmissions, setSelectedCycleSubmissions] = useState<NercSubmissionEvent[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [slaRes, appsRes, cyclesRes] = await Promise.all([
        adminAPI.getNercSlaOverview(),
        adminAPI.listNercApplications(statusFilter ? { status: statusFilter } : {}),
        adminAPI.listNercReportingCycles({ limit: 30, ...(cycleStatusFilter ? { status: cycleStatusFilter } : {}) }),
      ]);
      setSla(slaRes.data.data || null);
      const allApps = appsRes.data.data?.applications || [];
      const allCycles = cyclesRes.data.data?.cycles || [];
      const filteredApps = allApps.filter((app) => {
        if (priorityFilter === 'sla_breached') return !!app.sla_breached;
        if (priorityFilter === 'permit_required') return app.application_type === 'permit_required';
        if (priorityFilter === 'geo_unverified') return app.projects?.geo_verified === false;
        return true;
      });
      const filteredCycles = allCycles.filter((cycle) => {
        if (priorityFilter === 'overdue') return cycle.status === 'overdue';
        return true;
      });
      setApplications(filteredApps);
      setCycles(filteredCycles);
    } catch {
      toast.error('Failed to load NERC admin data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter, cycleStatusFilter, priorityFilter]);

  async function takeDecision(id: string, action: NercAdminDecisionAction) {
    setDecisionBusy(id + action);
    try {
      let regulator_decision_note = '';
      if (action === 'reject' || action === 'changes_requested') {
        regulator_decision_note = window.prompt('Provide a reason (e.g. insufficient project information):', '') || '';
        if (!regulator_decision_note.trim()) {
          toast.error('Reason is required for this action');
          return;
        }
      }
      await adminAPI.decideNercApplication(id, {
        action,
        regulator_decision_note: regulator_decision_note || undefined,
      });
      toast.success('Decision saved');
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Decision failed'));
    } finally {
      setDecisionBusy(null);
    }
  }

  async function loadCycleSubmissions(cycleId: string) {
    setSelectedCycleId(cycleId);
    try {
      const { data } = await adminAPI.listNercCycleSubmissions(cycleId);
      setSelectedCycleSubmissions(data.data?.submissions || []);
    } catch {
      toast.error('Failed to load submission events');
      setSelectedCycleSubmissions([]);
    }
  }

  async function takeSubmissionDecision(submissionId: string, action: NercSubmissionDecisionAction) {
    setSubmissionBusy(`${submissionId}:${action}`);
    try {
      await adminAPI.decideNercSubmission(submissionId, { action });
      toast.success('Submission decision saved');
      if (selectedCycleId) await loadCycleSubmissions(selectedCycleId);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Submission decision failed'));
    } finally {
      setSubmissionBusy(null);
    }
  }

  async function overrideCycleStatus(cycleId: string, status: 'pending' | 'submitted' | 'overdue') {
    setSubmissionBusy(`${cycleId}:status:${status}`);
    try {
      await adminAPI.overrideNercCycleStatus(cycleId, { status });
      toast.success('Cycle status updated');
      await load();
      if (selectedCycleId === cycleId) await loadCycleSubmissions(cycleId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update cycle status'));
    } finally {
      setSubmissionBusy(null);
    }
  }

  return (
    <AdminRoute>
      <Head><title>NERC Compliance - SolNuv Admin</title></Head>
      <div className="max-w-screen-xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">NERC Compliance Queue</h1>
          <p className="text-sm text-slate-500">Review SolNuv assisted NERC requests and approve/reject with reason when needed.</p>
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
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="input max-w-[220px]"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter((e.target.value || '') as NercApplicationStatus | '')}
                  >
                    <option value="">All statuses</option>
                    <option value="submitted">submitted</option>
                    <option value="in_review">in_review</option>
                    <option value="changes_requested">changes_requested</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                  </select>
                  <button className={`text-xs px-2.5 py-1.5 rounded-full border ${priorityFilter === 'sla_breached' ? 'bg-red-50 border-red-200 text-red-700' : 'border-slate-200 text-slate-600'}`} onClick={() => setPriorityFilter((p) => p === 'sla_breached' ? '' : 'sla_breached')}>SLA breached</button>
                  <button className={`text-xs px-2.5 py-1.5 rounded-full border ${priorityFilter === 'permit_required' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-600'}`} onClick={() => setPriorityFilter((p) => p === 'permit_required' ? '' : 'permit_required')}>permit_required</button>
                  <button className={`text-xs px-2.5 py-1.5 rounded-full border ${priorityFilter === 'geo_unverified' ? 'bg-slate-100 border-slate-300 text-slate-800' : 'border-slate-200 text-slate-600'}`} onClick={() => setPriorityFilter((p) => p === 'geo_unverified' ? '' : 'geo_unverified')}>geo_unverified</button>
                </div>
              </div>
              <div className="space-y-2">
                {applications.map((app) => (
                  <div key={app.id} className="rounded-xl border border-slate-200 p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{app.projects?.name || 'Project'}</p>
                      <p className="text-xs text-slate-500">
                        {(app.application_type || '').replace('_', ' ')} · {app.status?.replace('_', ' ')} · SLA due {fmtDate(app.sla_due_at)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {app.projects?.companies?.name || app.projects?.owner_context?.display_name || 'No company linked'}
                        {app.projects?.owner_context?.email ? ` · ${app.projects.owner_context.email}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-outline text-sm" disabled={decisionBusy === `${app.id}start_review`} onClick={() => takeDecision(app.id, 'start_review')}>Accept & Start Review</button>
                      <button className="btn-outline text-sm" disabled={decisionBusy === `${app.id}changes_requested`} onClick={() => takeDecision(app.id, 'changes_requested')}>Request Changes</button>
                      <button className="btn-primary text-sm" disabled={decisionBusy === `${app.id}approve`} onClick={() => takeDecision(app.id, 'approve')}>Mark Registered</button>
                      <button className="btn-outline text-sm border-red-200 text-red-600 hover:bg-red-50" disabled={decisionBusy === `${app.id}reject`} onClick={() => takeDecision(app.id, 'reject')}>Reject</button>
                    </div>
                  </div>
                ))}
                {applications.length === 0 && <p className="text-sm text-slate-500 py-3">No applications found.</p>}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-forest-900">Reporting Cadence Monitor</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input max-w-[180px]" value={cycleStatusFilter} onChange={(e) => setCycleStatusFilter((e.target.value || '') as 'pending' | 'submitted' | 'overdue' | '')}>
                    <option value="">All cycle statuses</option>
                    <option value="pending">pending</option>
                    <option value="submitted">submitted</option>
                    <option value="overdue">overdue</option>
                  </select>
                  <button className={`text-xs px-2.5 py-1.5 rounded-full border ${priorityFilter === 'overdue' ? 'bg-red-50 border-red-200 text-red-700' : 'border-slate-200 text-slate-600'}`} onClick={() => setPriorityFilter((p) => p === 'overdue' ? '' : 'overdue')}>overdue</button>
                </div>
              </div>
              <div className="space-y-2">
                {cycles.map((cycle) => (
                  <div key={cycle.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-800">{cycle.projects?.name || 'Project'} ({cycle.cadence})</p>
                    <p className="text-xs text-slate-500">
                      Period {fmtDate(cycle.period_start)} - {fmtDate(cycle.period_end)} · Due {fmtDate(cycle.due_date)} · Status {cycle.status}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {cycle.projects?.companies?.name || cycle.projects?.owner_context?.display_name || 'No company linked'}
                      {cycle.projects?.owner_context?.email ? ` · ${cycle.projects.owner_context.email}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="btn-outline text-xs" onClick={() => loadCycleSubmissions(cycle.id)}>View submissions</button>
                      <button className="btn-outline text-xs" disabled={submissionBusy === `${cycle.id}:status:pending`} onClick={() => overrideCycleStatus(cycle.id, 'pending')}>Mark Pending</button>
                      <button className="btn-outline text-xs" disabled={submissionBusy === `${cycle.id}:status:submitted`} onClick={() => overrideCycleStatus(cycle.id, 'submitted')}>Mark Submitted</button>
                      <button className="btn-outline text-xs border-red-200 text-red-600 hover:bg-red-50" disabled={submissionBusy === `${cycle.id}:status:overdue`} onClick={() => overrideCycleStatus(cycle.id, 'overdue')}>Mark Overdue</button>
                    </div>
                    {selectedCycleId === cycle.id && (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        {selectedCycleSubmissions.length === 0 && <p className="text-xs text-slate-500">No submission events yet.</p>}
                        {selectedCycleSubmissions.map((submission) => (
                          <div key={submission.id} className="rounded-lg border border-slate-200 p-2.5">
                            <p className="text-xs text-slate-600">Submitted {fmtDate(submission.submitted_at)} · status {submission.submission_status}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button className="btn-outline text-xs" disabled={submissionBusy === `${submission.id}:accept`} onClick={() => takeSubmissionDecision(submission.id, 'accept')}>Accept</button>
                              <button className="btn-outline text-xs" disabled={submissionBusy === `${submission.id}:request_changes`} onClick={() => takeSubmissionDecision(submission.id, 'request_changes')}>Request Changes</button>
                              <button className="btn-outline text-xs border-red-200 text-red-600 hover:bg-red-50" disabled={submissionBusy === `${submission.id}:reject`} onClick={() => takeSubmissionDecision(submission.id, 'reject')}>Reject</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
