import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { dashboardAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/index';

export default function PublicPortfolioPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!slug) return;
    dashboardAPI.getPublicProfile(slug)
      .then((r) => setData(r.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="min-h-screen flex justify-center items-center"><LoadingSpinner size="lg" /></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-500">Public profile not found.</div>;

  return (
    <>
      <Head><title>{data.profile?.name} — SolNuv Portfolio</title></Head>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-900 via-emerald-900 to-slate-900 text-white p-8 shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
            <div className="relative">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3 block">Public Portfolio</span>
              <h1 className="font-display font-bold text-3xl">{data.profile?.name}</h1>
              <p className="text-white/70 mt-2">{data.profile?.bio || 'Solar lifecycle and compliance specialist.'}</p>
              <div className="grid sm:grid-cols-4 gap-4 mt-6">
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Projects</p><p className="text-2xl font-bold text-white">{data.stats?.total_projects || 0}</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Recycled</p><p className="text-2xl font-bold text-emerald-300">{data.stats?.recycled_projects || 0}</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Avg Rating</p><p className="text-2xl font-bold text-amber-300">{data.stats?.average_rating || 0}</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Reviews</p><p className="text-2xl font-bold text-white">{data.stats?.total_feedback || 0}</p></div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <h2 className="font-semibold text-forest-900 mb-4">Recent Projects</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {(data.recent_projects || []).map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-100 p-3">
                  <p className="font-semibold text-slate-700">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{p.city}, {p.state} • {p.status}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <h2 className="font-semibold text-forest-900 mb-4">Client Reviews</h2>
            <div className="space-y-3">
              {(data.reviews || []).length === 0 && <p className="text-sm text-slate-400">No public reviews yet.</p>}
              {(data.reviews || []).map((r, idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex justify-between">
                    <p className="text-sm font-semibold text-slate-700">{r.client_name || 'Client'}</p>
                    <p className="text-sm text-amber-600">{'★'.repeat(Number(r.rating || 0))}</p>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{r.comment || 'No comment provided.'}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
