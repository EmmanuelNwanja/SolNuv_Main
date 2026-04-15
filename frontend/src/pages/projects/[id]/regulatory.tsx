import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getDashboardLayout } from '../../../components/Layout';
import { LoadingSpinner } from '../../../components/ui/index';
import { nercAPI } from '../../../services/api';
import { queryParamToString } from '../../../utils/nextRouter';
import toast from 'react-hot-toast';

export default function ProjectRegulatoryPage() {
  const router = useRouter();
  const id = queryParamToString(router.query.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingApp, setSubmittingApp] = useState(null);
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [form, setForm] = useState({
    mini_grid_type: 'interconnected',
    declared_capacity_kw: 0,
    notes: '',
  });

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [profileRes, appRes, cycleRes] = await Promise.all([
        nercAPI.getProjectProfile(id),
        nercAPI.listProjectApplications(id),
        nercAPI.listProjectReportingCycles(id),
      ]);
      const profileData = profileRes.data.data;
      setProfile(profileData);
      setApplications(appRes.data.data || []);
      setCycles(cycleRes.data.data || []);
      setForm({
        mini_grid_type: profileData?.mini_grid_type || 'interconnected',
        declared_capacity_kw: Number(profileData?.declared_capacity_kw || 0),
        notes: profileData?.notes || '',
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load regulatory profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await nercAPI.updateProjectProfile(id, form);
      setProfile(data.data);
      toast.success('Regulatory profile updated');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function createDraftApplication() {
    try {
      await nercAPI.createApplication(id, {});
      toast.success('New application draft created');
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to create application');
    }
  }

  async function submitApplication(appId) {
    setSubmittingApp(appId);
    try {
      await nercAPI.submitApplication(appId);
      toast.success('Application submitted');
      load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to submit application');
    } finally {
      setSubmittingApp(null);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <>
      <Head><title>Project Regulatory - SolNuv</title></Head>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900">NERC Regulatory Workspace</h1>
            <p className="text-sm text-slate-500">NERC-R-001-2026 filing, pathway checks, and periodic reporting records.</p>
          </div>
          <Link href={`/projects/${id}`} className="btn-outline text-sm">Back to Project</Link>
        </div>

        <div className="card">
          <h2 className="font-semibold text-forest-900 mb-4">Regulatory Profile</h2>
          <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Mini-Grid Type</label>
              <select
                className="input"
                value={form.mini_grid_type}
                onChange={(e) => setForm((prev) => ({ ...prev, mini_grid_type: e.target.value }))}
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
              <span className="text-xs rounded-full bg-slate-100 px-3 py-1">Pathway: {(profile?.regulatory_pathway || '-').replace('_', ' ')}</span>
              <span className="text-xs rounded-full bg-slate-100 px-3 py-1">Cadence: {profile?.reporting_cadence || '-'}</span>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-forest-900">Permit / Registration Applications</h2>
            <button onClick={createDraftApplication} className="btn-outline text-sm">Create Draft</button>
          </div>
          {applications.length === 0 ? (
            <p className="text-sm text-slate-500">No applications yet.</p>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => (
                <div key={app.id} className="rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{app.title}</p>
                    <p className="text-xs text-slate-500">{app.application_type.replace('_', ' ')} · {app.status.replace('_', ' ')}</p>
                  </div>
                  {['draft', 'changes_requested'].includes(app.status) && (
                    <button className="btn-primary text-sm" disabled={submittingApp === app.id} onClick={() => submitApplication(app.id)}>
                      {submittingApp === app.id ? 'Submitting...' : 'Submit'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-forest-900 mb-3">NERC Reporting Cycles</h2>
          {cycles.length === 0 ? (
            <p className="text-sm text-slate-500">No reporting cycles yet.</p>
          ) : (
            <div className="space-y-2">
              {cycles.map((cycle) => (
                <div key={cycle.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">{cycle.cadence} cycle · {cycle.status}</p>
                  <p className="text-xs text-slate-500">
                    Period: {new Date(cycle.period_start).toLocaleDateString()} - {new Date(cycle.period_end).toLocaleDateString()} · Due: {new Date(cycle.due_date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

ProjectRegulatoryPage.getLayout = getDashboardLayout;
