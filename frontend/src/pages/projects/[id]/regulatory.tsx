import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type FormEvent, useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import { getDashboardLayout } from '../../../components/Layout';
import { LoadingSpinner } from '../../../components/ui/index';
import { downloadBlob, nercAPI } from '../../../services/api';
import type {
  NercApplication,
  NercMiniGridType,
  NercProjectTriage,
  NercReportingCycle,
  ProjectRegulatoryProfile,
} from '../../../types/contracts';
import { queryParamToString } from '../../../utils/nextRouter';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';

type RegulatoryFormState = {
  mini_grid_type: NercMiniGridType;
  declared_capacity_kw: number;
  notes: string;
};

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as AxiosError<{ message?: string }>;
  return err.response?.data?.message ?? fallback;
}

export default function ProjectRegulatoryPage() {
  const router = useRouter();
  const { plan, isPro } = useAuth();
  const id = queryParamToString(router.query.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingPortalSubmission, setConfirmingPortalSubmission] = useState(false);
  const [profile, setProfile] = useState<ProjectRegulatoryProfile | null>(null);
  const [applications, setApplications] = useState<NercApplication[]>([]);
  const [reportingCycles, setReportingCycles] = useState<NercReportingCycle[]>([]);
  const [triage, setTriage] = useState<NercProjectTriage | null>(null);
  const [form, setForm] = useState<RegulatoryFormState>({
    mini_grid_type: 'interconnected',
    declared_capacity_kw: 0,
    notes: '',
  });

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [profileRes, appRes, cyclesRes] = await Promise.all([
        nercAPI.getProjectProfile(id),
        nercAPI.listProjectApplications(id),
        nercAPI.listProjectReportingCycles(id),
      ]);
      const profileData = profileRes.data.data;
      setProfile(profileData);
      setApplications(appRes.data.data || []);
      setReportingCycles(cyclesRes.data.data || []);
      try {
        const triageRes = await nercAPI.getProjectTriage(id);
        setTriage(triageRes.data.data || null);
      } catch {
        setTriage(null);
      }
      setForm({
        mini_grid_type: profileData?.mini_grid_type || 'interconnected',
        declared_capacity_kw: Number(profileData?.declared_capacity_kw || 0),
        notes: profileData?.notes || '',
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to load regulatory profile'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await nercAPI.updateProjectProfile(id, form);
      setProfile(data.data);
      toast.success('Regulatory profile updated');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save profile'));
    } finally {
      setSaving(false);
    }
  }

  async function createDraftApplication() {
    try {
      await nercAPI.createApplication(id, {});
      toast.success('New application draft created');
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create application'));
    }
  }

  async function requestSolNuvApply() {
    try {
      await nercAPI.createAssistedRequest(id, {});
      toast.success('Request submitted to SolNuv Admin');
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to submit assisted request'));
    }
  }

  async function confirmPortalSubmission() {
    setConfirmingPortalSubmission(true);
    try {
      await nercAPI.confirmPortalSubmission(id, {});
      toast.success('Submission confirmation saved');
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to confirm submission'));
    } finally {
      setConfirmingPortalSubmission(false);
    }
  }

  async function exportCurrentProject(format: 'csv' | 'excel') {
    try {
      const { data } = await nercAPI.exportProject(id, format);
      downloadBlob(data, `SolNuv_NERC_Project_${id}.${format === 'excel' ? 'xlsx' : 'csv'}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to export project data'));
    }
  }

  async function exportBulkBand(format: 'csv' | 'excel') {
    const band = (triage?.capacity_kw || form.declared_capacity_kw || 0) < 100 ? 'under_100' : 'over_100';
    try {
      const { data } = await nercAPI.exportProjects(band, format);
      downloadBlob(data, `SolNuv_NERC_Projects_${band}.${format === 'excel' ? 'xlsx' : 'csv'}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to export bulk project data'));
    }
  }

  const effectiveCapacity = Number(triage?.capacity_kw || form.declared_capacity_kw || 0);
  const isUnder100 = effectiveCapacity < 100;
  const primaryNercCta = isUnder100 ? 'Register Project with NERC' : 'Submit Compliance with NERC';
  const primaryNercMessage = isUnder100
    ? 'Projects under 100kW follow a lighter registration path.'
    : 'Projects above 100kW follow the full NERC compliance submission path.';
  const latestApplication = applications[0] || null;
  const hasDraftApplication = applications.some((app) => app.status === 'draft' || app.status === 'changes_requested');
  const hasSubmittedApplication = applications.some((app) =>
    ['submitted', 'in_review', 'approved'].includes(app.status)
  );
  const hasPortalConfirmedSubmission = applications.some(
    (app) => app.application_payload?.request_mode === 'user_portal_confirmation' && app.status === 'submitted'
  );
  const hasApplicationStarted = applications.length > 0;
  const hasApplicationCompleted = hasSubmittedApplication || hasPortalConfirmedSubmission;
  const hasReportingStarted = reportingCycles.length > 0;
  const hasReportingSubmitted = reportingCycles.some((cycle) => cycle.status === 'submitted');
  const stageProfileComplete = Boolean(profile);
  const stageApplicationState = hasApplicationCompleted ? 'done' : hasApplicationStarted ? 'active' : 'todo';
  const stageReportingState = hasReportingSubmitted ? 'done' : hasReportingStarted ? 'active' : 'todo';
  const canShowCreateDraft = !hasApplicationCompleted && !hasDraftApplication;
  const canShowConfirmSubmission = !hasPortalConfirmedSubmission && !hasApplicationCompleted;
  const canShowAssistedRequest = !hasApplicationCompleted;
  const showBulkExport = !isUnder100;

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <>
      <Head><title>Project Regulatory - SolNuv</title></Head>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900">NERC Regulatory Workspace</h1>
            <p className="text-sm text-slate-500">Simplified NERC submission workflow with export + assisted filing request.</p>
          </div>
          <Link href={`/projects/${id}`} className="btn-outline text-sm">Back to Project</Link>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-forest-900 text-white px-3 py-1">1. Profile</span>
            <span
              className={`rounded-full px-3 py-1 ${
                stageApplicationState === 'done'
                  ? 'bg-emerald-600 text-white'
                  : stageApplicationState === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
              }`}
            >
              2. Application
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                stageReportingState === 'done'
                  ? 'bg-emerald-600 text-white'
                  : stageReportingState === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
              }`}
            >
              3. Reporting
            </span>
          </div>
          {triage && (
            <p className="text-sm text-slate-600 mt-3">
              Triage: <strong>{triage.regulatory_pathway.replace('_', ' ')}</strong> · {triage.capacity_kw.toFixed(2)} kW
              {triage.net_metering_eligible ? ` · Net metering band (${triage.net_metering_band_kw[0]}-${triage.net_metering_band_kw[1]} kW)` : ''}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Progress: {stageProfileComplete ? 'Profile saved' : 'Profile pending'} ·{' '}
            {stageApplicationState === 'done' ? 'Application submitted' : stageApplicationState === 'active' ? 'Application in progress' : 'Application pending'} ·{' '}
            {stageReportingState === 'done' ? 'Reporting submitted' : stageReportingState === 'active' ? 'Reporting in progress' : 'Reporting pending'}
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-forest-900 mb-4">Regulatory Profile</h2>
          <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Mini-Grid Type</label>
              <select
                className="input"
                value={form.mini_grid_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      mini_grid_type: e.target.value as NercMiniGridType,
                    }))
                  }
              >
                <option value="isolated">Isolated</option>
                <option value="interconnected">Interconnected</option>
              </select>
            </div>
            <div>
              <label className="label">Declared Capacity (kW)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.declared_capacity_kw}
                onChange={(e) => setForm((prev) => ({ ...prev, declared_capacity_kw: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea
                className="input min-h-[90px]"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-3 items-center">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
              {canShowCreateDraft && (
                <button type="button" className="btn-outline" onClick={createDraftApplication}>Create Draft</button>
              )}
              <span className="text-xs rounded-full bg-slate-100 px-3 py-1">Pathway: {(profile?.regulatory_pathway || '-').replace('_', ' ')}</span>
              <span className="text-xs rounded-full bg-slate-100 px-3 py-1">Cadence: {profile?.reporting_cadence || '-'}</span>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-forest-900">NERC Submission Actions</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">{primaryNercMessage}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <a
              href="https://minigrid.nerc.gov.ng/"
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-sm"
            >
              {primaryNercCta}
            </a>
            {canShowConfirmSubmission && (
              <button
                className="btn-outline text-sm"
                onClick={confirmPortalSubmission}
                disabled={confirmingPortalSubmission}
              >
                {confirmingPortalSubmission ? 'Saving...' : 'Confirm Application Submitted'}
              </button>
            )}
            {canShowAssistedRequest && (
              <button
                className="btn-outline text-sm"
                onClick={requestSolNuvApply}
                disabled={!isPro}
                title={!isPro ? 'Available on Pro plan and above' : undefined}
              >
                Let SolNuv Apply
              </button>
            )}
            {!isPro && (
              <span className="text-xs text-slate-500 self-center">Upgrade from {plan} to Pro+ to enable assisted filing.</span>
            )}
          </div>
          {hasApplicationCompleted && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 mb-4">
              Application stage completed. Proceed to reporting updates when due.
            </div>
          )}
          <p className="text-xs text-slate-500 mb-4">
            SolNuv cannot automatically verify your status on NERC&apos;s portal. Use <strong>Confirm Application Submitted</strong> after submitting on NERC.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <button className="btn-outline text-sm" onClick={() => exportCurrentProject('csv')}>Export Current Project CSV</button>
            <button className="btn-outline text-sm" onClick={() => exportCurrentProject('excel')}>Export Current Project Excel</button>
            {showBulkExport && (
              <>
                <button className="btn-outline text-sm" onClick={() => exportBulkBand('csv')}>
                  Export {isUnder100 ? '<100kW' : '>100kW'} Bulk CSV
                </button>
                <button className="btn-outline text-sm" onClick={() => exportBulkBand('excel')}>
                  Export {isUnder100 ? '<100kW' : '>100kW'} Bulk Excel
                </button>
              </>
            )}
          </div>

          {applications.length > 0 ? (
            <div className="space-y-2">
              {applications.slice(0, 6).map((app) => (
                <div key={app.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">{app.title}</p>
                  <p className="text-xs text-slate-500">{app.application_type.replace('_', ' ')} · {app.status.replace('_', ' ')}</p>
                  {app.regulator_decision_note && (
                    <p className="text-xs text-amber-700 mt-1">Admin note: {app.regulator_decision_note}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No assisted requests yet.</p>
          )}
          {latestApplication && (
            <p className="text-xs text-slate-500 mt-3">
              Latest application status: <strong>{latestApplication.status.replace('_', ' ')}</strong>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

ProjectRegulatoryPage.getLayout = getDashboardLayout;
