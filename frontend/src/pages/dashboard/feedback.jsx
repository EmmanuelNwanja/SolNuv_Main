import Head from 'next/head';
import { useEffect, useState } from 'react';
import { dashboardAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { MotionSection } from '../../components/PageMotion';
import { LoadingSpinner, EmptyState } from '../../components/ui/index';
import { RiChatSmile3Line, RiLinksLine, RiStarLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function ClientFeedbackPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [creatingFor, setCreatingFor] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await dashboardAPI.getFeedbackOverview();
      setData(res.data.data);
    } catch {
      toast.error('Failed to load client feedback');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function generateLink(projectId) {
    setCreatingFor(projectId);
    try {
      const { data } = await dashboardAPI.createFeedbackLink(projectId);
      const url = data.data?.feedback_url;
      if (url) {
        let copied = false;
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(url);
            copied = true;
          } catch {}
        }

        if (!copied && typeof document !== 'undefined') {
          const input = document.createElement('textarea');
          input.value = url;
          input.setAttribute('readonly', '');
          input.style.position = 'absolute';
          input.style.left = '-9999px';
          document.body.appendChild(input);
          input.select();
          copied = document.execCommand('copy');
          document.body.removeChild(input);
        }

        if (copied) toast.success('Feedback link copied to clipboard');
        else toast.success('Feedback link generated. Copy it from the project row below.');
      }
      await loadData();
    } catch {
      toast.error('Failed to generate feedback link');
    } finally {
      setCreatingFor(null);
    }
  }

  const summary = data?.summary || {};

  return (
    <>
      <Head><title>Client Feedback — SolNuv</title></Head>

      <MotionSection className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-forest-900 to-emerald-900 text-white p-6 sm:p-8 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3">
            <RiChatSmile3Line /> Reputation Engine
          </span>
          <h1 className="font-display font-bold text-3xl">Client Feedback</h1>
          <p className="text-white/70 text-sm mt-2">Create shareable rating links and track reviews to build your public reputation</p>
          {data && (
            <div className="mt-5 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/90 text-xs font-semibold border border-white/10">
                <RiStarLine /> {summary.average_rating || 0} avg rating
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/90 text-xs font-semibold border border-white/10">
                {summary.total_feedback || 0} total reviews
              </span>
            </div>
          )}
        </div>
      </MotionSection>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="space-y-8">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-xs text-slate-500">Total Reviews</p>
              <p className="font-display text-3xl font-bold text-forest-900">{summary.total_feedback || 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">Average Rating</p>
              <p className="font-display text-3xl font-bold text-amber-600">{summary.average_rating || 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">Showcase Reviews</p>
              <p className="font-display text-3xl font-bold text-emerald-600">{summary.showcase_reviews || 0}</p>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-forest-900 mb-4 flex items-center gap-2"><RiLinksLine /> Feedback Links by Project</h2>
            {!data?.projects?.length ? (
              <EmptyState title="No projects yet" description="Create your first project to generate a client feedback link." />
            ) : (
              <div className="space-y-3">
                {data.projects.map((project) => (
                  <div key={project.id} className="rounded-xl p-3 bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{project.name}</p>
                      {project.feedback_token && (
                        <p className="text-xs text-slate-400 mt-1 break-all">/feedback/{project.feedback_token}</p>
                      )}
                    </div>
                    <button
                      onClick={() => generateLink(project.id)}
                      disabled={creatingFor === project.id}
                      className="btn-outline text-sm px-4 py-2"
                    >
                      {creatingFor === project.id ? 'Generating...' : (project.feedback_token ? 'Copy Link' : 'Generate Link')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold text-forest-900 mb-4 flex items-center gap-2"><RiStarLine className="text-amber-500" /> Recent Reviews</h2>
            {!data?.feedback?.length ? (
              <p className="text-sm text-slate-400">No feedback submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {data.feedback.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">{item.client_name || 'Anonymous client'}</p>
                      <p className="text-sm text-amber-600">{'★'.repeat(Number(item.rating || 0))}</p>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{item.comment || 'No comment provided.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

ClientFeedbackPage.getLayout = getDashboardLayout;
