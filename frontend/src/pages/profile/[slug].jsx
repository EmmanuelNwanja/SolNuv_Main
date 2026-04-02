import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { dashboardAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/index';
import {
  RiBuilding2Line,
  RiFlashlightLine,
  RiMailLine,
  RiMapPin2Line,
  RiPhoneLine,
  RiPlantLine,
  RiPulseLine,
  RiRouteLine,
  RiStackLine,
  RiStarFill,
} from 'react-icons/ri';

function formatNumber(value, digits = 2) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(digits);
}

function formatDate(value) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PublicPortfolioPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedMapProjectId, setSelectedMapProjectId] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setErrorMessage('');

    dashboardAPI.getPublicProfile(slug)
      .then((r) => setData(r.data.data))
      .catch((err) => {
        setData(null);
        const status = err?.response?.status;
        if (status === 404) {
          setErrorMessage('Public profile not found.');
        } else {
          setErrorMessage('Unable to load public profile right now. Please retry in a moment.');
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    const firstPoint = data?.map_summary?.points?.[0];
    if (firstPoint?.id) setSelectedMapProjectId(firstPoint.id);
  }, [data]);

  if (loading) return <div className="min-h-screen flex justify-center items-center"><LoadingSpinner size="lg" /></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-500">{errorMessage || 'Public profile not found.'}</div>;

  const profile = data.profile || {};
  const stats = data.stats || {};
  const points = data.map_summary?.points || [];
  const selectedPoint = points.find((point) => point.id === selectedMapProjectId) || points[0] || null;

  const latitudes = points.map((point) => Number(point.latitude));
  const longitudes = points.map((point) => Number(point.longitude));
  const latMin = latitudes.length ? Math.min(...latitudes) : 0;
  const latMax = latitudes.length ? Math.max(...latitudes) : 1;
  const lngMin = longitudes.length ? Math.min(...longitudes) : 0;
  const lngMax = longitudes.length ? Math.max(...longitudes) : 1;

  const latRange = Math.max(latMax - latMin, 0.05);
  const lngRange = Math.max(lngMax - lngMin, 0.05);

  return (
    <>
      <Head><title>{profile?.name} — SolNuv Portfolio</title></Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-10 md:py-12 space-y-6">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-900 via-emerald-900 to-slate-900 text-white p-8 shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4 items-start">
                  {profile?.logo_url ? (
                    <img src={profile.logo_url} alt={`${profile.name || 'Brand'} logo`} className="w-16 h-16 rounded-xl object-cover border border-white/20 bg-white" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-white/20 bg-white/10 flex items-center justify-center">
                      <RiBuilding2Line className="text-3xl text-white/90" />
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3 block">Public Portfolio</span>
                    <h1 className="font-display font-bold text-3xl md:text-4xl leading-tight">{profile?.name}</h1>
                    <p className="text-white/75 mt-2 max-w-2xl">{profile?.bio || 'Solar lifecycle and compliance specialist.'}</p>
                  </div>
                </div>

                {profile?.website && (
                  <a href={profile.website} target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/20 transition">
                    Visit Website
                  </a>
                )}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-7">
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Projects</p><p className="text-2xl font-bold text-white">{stats?.total_projects || 0}</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Executed Capacity</p><p className="text-2xl font-bold text-white">{formatNumber(stats?.cumulative_executed_capacity_mw, 3)} MW</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Storage Capacity</p><p className="text-2xl font-bold text-white">{formatNumber(stats?.cumulative_storage_capacity_mwh, 3)} MWh</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Coverage</p><p className="text-2xl font-bold text-emerald-300">{stats?.regional_coverage_states || 0} States</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Client Rating</p><p className="text-2xl font-bold text-amber-300">{formatNumber(stats?.average_rating || 0, 1)}</p></div>
              </div>
            </div>
          </section>

          <section className="grid xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h2 className="font-semibold text-forest-900 mb-1 flex items-center gap-2"><RiRouteLine /> Interactive Project Location Map</h2>
              <p className="text-sm text-slate-500">Tap any marker to inspect project location and deployment status.</p>

              {points.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 mt-4 text-center text-slate-500">
                  No geotagged projects yet. Add latitude/longitude in project records to activate map plotting.
                </div>
              ) : (
                <>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 relative h-[340px] overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(13,59,46,0.10),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.10),transparent_45%)]" />
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                    {points.map((point) => {
                      const x = ((Number(point.longitude) - lngMin) / lngRange) * 86 + 7;
                      const y = 92 - (((Number(point.latitude) - latMin) / latRange) * 80 + 8);
                      const isActive = selectedPoint?.id === point.id;

                      return (
                        <button
                          key={point.id}
                          type="button"
                          onClick={() => setSelectedMapProjectId(point.id)}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all ${isActive ? 'w-5 h-5 bg-emerald-500 border-white shadow-[0_0_0_6px_rgba(16,185,129,0.25)]' : 'w-4 h-4 bg-forest-900 border-white hover:scale-110'}`}
                          style={{ left: `${x}%`, top: `${y}%` }}
                          title={`${point.name} (${point.city}, ${point.state})`}
                        />
                      );
                    })}
                  </div>

                  {selectedPoint && (
                    <div className="mt-3 rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <p className="font-semibold text-slate-800">{selectedPoint.name}</p>
                      <p className="text-sm text-slate-600 mt-1 flex items-center gap-1"><RiMapPin2Line /> {selectedPoint.city}, {selectedPoint.state}</p>
                      <p className="text-xs text-slate-500 mt-1 capitalize">Status: {selectedPoint.status}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><RiPhoneLine /> Contact</h3>
                <div className="text-sm text-slate-700 space-y-2 mt-3">
                  <p className="flex items-center gap-2"><RiPhoneLine className="text-slate-500" /> {profile?.contact?.phone || 'N/A'}</p>
                  <p className="flex items-center gap-2 break-all"><RiMailLine className="text-slate-500" /> {profile?.contact?.email || 'N/A'}</p>
                  <p className="flex items-start gap-2"><RiMapPin2Line className="text-slate-500 mt-0.5" /> <span>{profile?.contact?.address || 'N/A'}</span></p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><RiStackLine /> Fleet Summary</h3>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
                  <div className="rounded-xl border border-slate-100 p-2"><p className="text-slate-500 text-xs">Panels</p><p className="font-bold text-slate-800">{stats?.total_panels || 0}</p></div>
                  <div className="rounded-xl border border-slate-100 p-2"><p className="text-slate-500 text-xs">Batteries</p><p className="font-bold text-slate-800">{stats?.total_batteries || 0}</p></div>
                  <div className="rounded-xl border border-slate-100 p-2"><p className="text-slate-500 text-xs">Inverters</p><p className="font-bold text-slate-800">{stats?.total_inverters || 0}</p></div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><RiPulseLine /> Manufacturer Footprint</h3>
                <div className="space-y-2 text-sm mt-3">
                  <p><span className="text-slate-500">Panel:</span> <span className="text-slate-800">{(data.equipment_summary?.manufacturers?.panel || []).join(', ') || 'N/A'}</span></p>
                  <p><span className="text-slate-500">Battery:</span> <span className="text-slate-800">{(data.equipment_summary?.manufacturers?.battery || []).join(', ') || 'N/A'}</span></p>
                  <p><span className="text-slate-500">Inverter:</span> <span className="text-slate-800">{(data.equipment_summary?.manufacturers?.inverter || []).join(', ') || 'N/A'}</span></p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h2 className="font-semibold text-forest-900 mb-4 flex items-center gap-2"><RiFlashlightLine /> Project Portfolio</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {(data.projects || []).map((project) => (
                <article key={project.id} className="rounded-2xl border border-slate-100 p-4 hover:border-emerald-200 transition">
                  <h3 className="font-semibold text-slate-800 leading-tight">{project.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{project.city}, {project.state} • <span className="capitalize">{project.status}</span></p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Capacity</p><p className="font-semibold text-slate-800">{formatNumber(project.project_capacity_mw, 4)} MW</p></div>
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Commissioned</p><p className="font-semibold text-slate-800">{formatDate(project.installation_date)}</p></div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-1">
                    <p className="flex items-center gap-1"><RiPlantLine /> Panels: {project.equipment_summary?.panel_count || 0}</p>
                    <p className="flex items-center gap-1"><RiStackLine /> Batteries: {project.equipment_summary?.battery_count || 0}</p>
                    <p className="flex items-center gap-1"><RiPulseLine /> Inverters: {project.equipment_summary?.inverter_count || 0}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h2 className="font-semibold text-forest-900 mb-4">Client Reviews</h2>
            <div className="space-y-3">
              {(data.reviews || []).length === 0 && <p className="text-sm text-slate-400">No public reviews yet.</p>}
              {(data.reviews || []).map((r, idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex justify-between">
                    <p className="text-sm font-semibold text-slate-700">{r.client_name || 'Client'}</p>
                    <p className="text-sm text-amber-600 inline-flex items-center gap-1"><RiStarFill /> {Number(r.rating || 0)}</p>
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
