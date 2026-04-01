import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { projectsAPI, downloadBlob } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getDashboardLayout } from '../../components/Layout';
import { StatusBadge, UrgencyBadge, EmptyState, LoadingSpinner } from '../../components/ui/index';
import { MotionSection } from '../../components/PageMotion';
import { RiAddLine, RiSearchLine, RiFilterLine, RiDownloadLine, RiSunLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'decommissioned', label: 'Decommissioned' },
  { value: 'recycled', label: 'Recycled' },
  { value: 'pending_recovery', label: 'Pending Recovery' },
];

export default function ProjectsList() {
  const { isOnboarded } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  const activeCount = projects.filter((p) => p.status === 'active').length;
  const pendingRecoveryCount = projects.filter((p) => p.status === 'pending_recovery').length;
  const silverTotal = projects.reduce((sum, p) => sum + (p.summary?.total_silver_grams || 0), 0);

  const fetchProjects = useCallback(async () => {
    if (!isOnboarded) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await projectsAPI.list({ search, status: statusFilter, page, limit: 20 });
      setProjects(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      if (err?.response?.data?.code === 'PROFILE_INCOMPLETE') {
        router.replace('/onboarding');
        return;
      }
      toast.error('Failed to load projects');
    }
    finally { setLoading(false); }
  }, [search, statusFilter, page, isOnboarded, router]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  async function handleExportCSV() {
    setExporting(true);
    try {
      const { data } = await projectsAPI.exportCSV();
      downloadBlob(data, `SolNuv_Projects_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('CSV exported!');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  }

  return (
    <>
      <Head><title>My Projects — SolNuv</title></Head>

      <MotionSection className="mb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-900 via-forest-800 to-emerald-700 px-6 py-7 text-white">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/60 mb-3">Asset Ledger</p>
              <h1 className="font-display font-bold text-3xl sm:text-4xl">My Projects</h1>
              <p className="text-white/75 text-sm mt-2">{total} project{total !== 1 ? 's' : ''} tracked across your deployment network.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{activeCount} active</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{pendingRecoveryCount} pending recovery</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{silverTotal.toFixed(1)}g recoverable silver</span>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={handleExportCSV} disabled={exporting} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors inline-flex items-center gap-2">
                <RiDownloadLine /> {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
              <Link href="/projects/add" className="btn-amber flex items-center gap-2">
                <RiAddLine /> Add Project
              </Link>
            </div>
          </div>
        </div>
      </MotionSection>

      {/* Filters */}
      <MotionSection className="flex gap-3 mb-6 flex-col sm:flex-row">
        <div className="relative flex-1">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" className="input pl-10" placeholder="Search projects..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="relative">
          <RiFilterLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select className="input pl-10 min-w-[180px]" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </MotionSection>

      {/* Projects */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={RiSunLine}
          title={search || statusFilter ? 'No projects match your filters' : 'No projects yet'}
          description={search || statusFilter ? 'Try adjusting your search or filter.' : 'Add your first solar installation to start tracking silver value and decommission dates.'}
          action={!search && !statusFilter && <Link href="/projects/add" className="btn-primary inline-flex items-center gap-2"><RiAddLine /> Add First Project</Link>}
        />
      ) : (
        <>
          <MotionSection className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {projects.map(proj => (
              <Link key={proj.id} href={`/projects/${proj.id}`}
                className="card-hover group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 bg-forest-900 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <RiSunLine className="text-amber-400" />
                  </div>
                  <StatusBadge status={proj.status} />
                </div>
                <h3 className="font-semibold text-forest-900 mb-0.5 group-hover:text-emerald-700 transition-colors">{proj.name}</h3>
                {proj.client_name && <p className="text-xs text-slate-400 mb-2">{proj.client_name}</p>}
                <p className="text-sm text-slate-500 mb-3">📍 {proj.city}, {proj.state}</p>
                <div className="flex gap-2 text-xs text-slate-500 mb-3">
                  <span>☀️ {proj.summary?.total_panels || 0} panels</span>
                  <span>•</span>
                  <span>🔋 {proj.summary?.total_batteries || 0} batteries</span>
                </div>
                {proj.summary?.total_silver_grams > 0 && (
                  <div className="bg-amber-50 rounded-lg p-2 mb-3">
                    <p className="text-xs text-amber-700 font-medium">💎 {proj.summary.total_silver_grams.toFixed(2)}g silver recoverable</p>
                  </div>
                )}
                {proj.estimated_decommission_date && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-400">Est. Decommission</p>
                    {proj.status === 'active' && (
                      <UrgencyBadge daysUntil={Math.ceil((new Date(proj.estimated_decommission_date) - new Date()) / (1000 * 60 * 60 * 24))} />
                    )}
                  </div>
                )}
              </Link>
            ))}
          </MotionSection>

          {/* Pagination */}
          {total > 20 && (
            <MotionSection className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost">← Prev</button>
              <span className="text-sm text-slate-500 self-center">Page {page} of {Math.ceil(total / 20)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="btn-ghost">Next →</button>
            </MotionSection>
          )}
        </>
      )}
    </>
  );
}

ProjectsList.getLayout = getDashboardLayout;
