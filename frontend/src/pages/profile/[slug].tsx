import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { dashboardAPI } from '../../services/api';
import { queryParamToString } from '../../utils/nextRouter';
import { LoadingSpinner } from '../../components/ui/index';
import {
  RiBuilding2Line,
  RiFlashlightLine,
  RiHome3Line,
  RiLeafLine,
  RiMailLine,
  RiMapPin2Line,
  RiPhoneLine,
  RiPlantLine,
  RiPulseLine,
  RiRouteLine,
  RiStackLine,
  RiStarFill,
  RiSunLine,
  RiTimeLine,
} from 'react-icons/ri';

function formatNumber(value: unknown, digits = 2) {
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

type MapPoint = Record<string, unknown> & { id?: string };

type Cluster = {
  id: string;
  state: string;
  points: MapPoint[];
  statusCounts: Record<string, number>;
  size?: number;
  intensity?: number;
  lat?: number;
  lng?: number;
};

function str(v: unknown) {
  return v == null ? '' : String(v);
}

export default function PublicPortfolioPage() {
  const router = useRouter();
  const slug = queryParamToString(router.query.slug);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedMapProjectId, setSelectedMapProjectId] = useState<string | null>(null);

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
    const firstPoint = (data?.map_summary as { points?: MapPoint[] } | undefined)?.points?.[0];
    if (firstPoint?.id) setSelectedMapProjectId(str(firstPoint.id));
  }, [data]);

  if (loading) return <div className="min-h-screen flex justify-center items-center"><LoadingSpinner size="lg" /></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-500">{errorMessage || 'Public profile not found.'}</div>;

  const profile = (data.profile as Record<string, unknown>) || {};
  const stats = (data.stats as Record<string, unknown>) || {};
  const envImpact = (data.environmental_impact as Record<string, unknown>) || {};
  const points = ((data.map_summary as { points?: MapPoint[] } | undefined)?.points || []) as MapPoint[];
  const selectedPoint =
    points.find((point) => str(point.id) === selectedMapProjectId) || points[0] || null;
  const contact = (profile.contact as Record<string, unknown> | undefined) || {};
  const equipmentSummary = (data.equipment_summary as { manufacturers?: { panel?: string[]; battery?: string[]; inverter?: string[] } } | undefined)?.manufacturers;

  const handleMarkerClick = (cluster: Cluster) => {
    const clusterPointIds = cluster.points.map((p) => str(p.id)).filter(Boolean);
    const currentIdx = selectedMapProjectId ? clusterPointIds.indexOf(selectedMapProjectId) : -1;
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % clusterPointIds.length : 0;
    setSelectedMapProjectId(clusterPointIds[nextIdx]);
  };

  const clusters = Object.values(
    (points || []).reduce<Record<string, Cluster>>((acc, point) => {
      const stateKey = str(point.state) || 'Unknown';
      if (!acc[stateKey]) {
        acc[stateKey] = {
          id: stateKey,
          state: stateKey,
          points: [],
          statusCounts: { active: 0, decommissioned: 0, recycled: 0, pending_recovery: 0 },
        };
      }
      acc[stateKey].points.push(point);
      const st = str(point.status);
      if (st && acc[stateKey].statusCounts[st] !== undefined) acc[stateKey].statusCounts[st] += 1;
      return acc;
    }, {})
  ).map((cluster) => ({
    ...cluster,
    size: cluster.points.length,
    intensity: Math.min(1, cluster.points.length / Math.max(points.length, 1)),
    lat: cluster.points.reduce((s, p) => s + Number(p.latitude || 0), 0) / cluster.points.length,
    lng: cluster.points.reduce((s, p) => s + Number(p.longitude || 0), 0) / cluster.points.length,
  }));

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
      <Head>
        <title>{str(profile.name)} - SolNuv Portfolio</title>
        <meta name="description" content={`Explore ${str(profile.name) || 'this brand'} portfolio: ${Number(stats.total_projects) || 0} projects, ${formatNumber(stats.cumulative_executed_capacity_mw, 3)} MW deployed across ${Number(stats.regional_coverage_states) || 0} states.`} />
        <meta property="og:title" content={`${str(profile.name)} - Solar Portfolio`} />
        <meta property="og:description" content={`Executed capacity: ${formatNumber(stats.cumulative_executed_capacity_mw, 3)} MW. Storage: ${formatNumber(stats.cumulative_storage_capacity_mwh, 3)} MWh.`} />
        <meta property="og:type" content="profile" />
        {profile.logo_url && <meta property="og:image" content={str(profile.logo_url)} />}
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-10 md:py-12 space-y-6">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-900 via-emerald-900 to-slate-900 text-white p-8 shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4 items-start">
                  {profile.logo_url ? (
                    <img src={str(profile.logo_url)} alt={`${str(profile.name) || 'Brand'} logo`} className="w-16 h-16 rounded-xl object-cover border border-white/20 bg-white" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-white/20 bg-white/10 flex items-center justify-center">
                      <RiBuilding2Line className="text-3xl text-white/90" />
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3 block">Public Portfolio</span>
                    <h1 className="font-display font-bold text-3xl md:text-4xl leading-tight">{str(profile.name)}</h1>
                    <p className="text-white/75 mt-2 max-w-2xl">{str(profile.bio) || 'Solar lifecycle and compliance specialist.'}</p>
                  </div>
                </div>

                {profile.website && (
                  <a href={str(profile.website)} target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/20 transition">
                    Visit Website
                  </a>
                )}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-7">
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Projects</p><p className="text-2xl font-bold text-white">{Number(stats.total_projects) || 0}</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Executed Capacity</p><p className="text-2xl font-bold text-white">{formatNumber(stats.cumulative_executed_capacity_mw, 3)} MW</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Storage Capacity</p><p className="text-2xl font-bold text-white">{formatNumber(stats.cumulative_storage_capacity_mwh, 3)} MWh</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Coverage</p><p className="text-2xl font-bold text-emerald-300">{Number(stats.regional_coverage_states) || 0} States</p></div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Client Rating</p><p className="text-2xl font-bold text-amber-300">{formatNumber(stats.average_rating || 0, 1)}</p></div>
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

                    {clusters.map((cluster) => {
                      const x = ((Number(cluster.lng) - lngMin) / lngRange) * 86 + 7;
                      const y = 92 - (((Number(cluster.lat) - latMin) / latRange) * 80 + 8);
                      const isActive = selectedPoint?.state === cluster.state;
                      const size = Math.min(28, Math.max(12, 10 + cluster.size * 2));
                      const heatBg = `rgba(16, 185, 129, ${0.15 + (cluster.intensity * 0.6)})`;

                      return (
                        <button
                          key={cluster.id}
                          type="button"
                          onClick={() => handleMarkerClick(cluster)}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-emerald-500 border-white text-white shadow-[0_0_0_8px_rgba(16,185,129,0.25)]' : 'bg-forest-900 border-white text-white hover:scale-110'}`}
                          style={{ left: `${x}%`, top: `${y}%` }}
                          title={`${cluster.state}: ${cluster.size} project${cluster.size !== 1 ? 's' : ''}`}
                        >
                          <span style={{ position: 'absolute', width: `${size}px`, height: `${size}px`, borderRadius: '9999px', background: heatBg, zIndex: -1 }} />
                          {cluster.size}
                        </button>
                      );
                    })}
                  </div>

                  {selectedPoint && (
                    <div className="mt-3 rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{str(selectedPoint.name)}</p>
                          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1"><RiMapPin2Line /> {str(selectedPoint.city)}, {str(selectedPoint.state)}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${str(selectedPoint.status) === 'active' ? 'bg-emerald-100 text-emerald-700' : str(selectedPoint.status) === 'decommissioned' ? 'bg-red-100 text-red-700' : str(selectedPoint.status) === 'recycled' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {str(selectedPoint.status)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        {Number(selectedPoint.capacity_kw) > 0 && (
                          <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2 text-xs">
                            <p className="text-slate-500 flex items-center gap-1"><RiSunLine /> Capacity</p>
                            <p className="font-bold text-slate-800 mt-0.5">{Number(selectedPoint.capacity_kw) >= 1000 ? `${(Number(selectedPoint.capacity_kw) / 1000).toFixed(2)} MW` : `${selectedPoint.capacity_kw} kW`}</p>
                          </div>
                        )}
                        {selectedPoint.installation_date && (
                          <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2 text-xs">
                            <p className="text-slate-500 flex items-center gap-1"><RiTimeLine /> Commissioned</p>
                            <p className="font-bold text-slate-800 mt-0.5">{formatDate(String(selectedPoint.installation_date))}</p>
                          </div>
                        )}
                        {Number(selectedPoint.panel_count) > 0 && (
                          <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2 text-xs">
                            <p className="text-slate-500 flex items-center gap-1"><RiPlantLine /> Panels</p>
                            <p className="font-bold text-slate-800 mt-0.5">{str(selectedPoint.panel_count)}</p>
                          </div>
                        )}
                        {Number(selectedPoint.battery_count) > 0 && (
                          <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2 text-xs">
                            <p className="text-slate-500 flex items-center gap-1"><RiStackLine /> Batteries</p>
                            <p className="font-bold text-slate-800 mt-0.5">{str(selectedPoint.battery_count)}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">Click marker again to cycle through projects in this location.</p>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {clusters.slice(0, 6).map((cluster) => (
                      <div key={`heat-${cluster.id}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <p className="font-semibold text-slate-700 truncate">{cluster.state}</p>
                        <p className="text-slate-500">{cluster.size} project{cluster.size !== 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><RiPhoneLine /> Contact</h3>
                <div className="text-sm text-slate-700 space-y-2 mt-3">
                  <p className="flex items-center gap-2"><RiPhoneLine className="text-slate-500" /> {str(contact.phone) || 'N/A'}</p>
                  <p className="flex items-center gap-2 break-all"><RiMailLine className="text-slate-500" /> {str(contact.email) || 'N/A'}</p>
                  <p className="flex items-start gap-2"><RiMapPin2Line className="text-slate-500 mt-0.5" /> <span>{str(contact.address) || 'N/A'}</span></p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><RiStackLine /> Fleet Summary</h3>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
                  <div className="rounded-xl border border-slate-100 p-2"><p className="text-slate-500 text-xs">Panels</p><p className="font-bold text-slate-800">{Number(stats.total_panels) || 0}</p></div>
                  <div className="rounded-xl border border-slate-100 p-2"><p className="text-slate-500 text-xs">Batteries</p><p className="font-bold text-slate-800">{Number(stats.total_batteries) || 0}</p></div>
                  <div className="rounded-xl border border-slate-100 p-2"><p className="text-slate-500 text-xs">Inverters</p><p className="font-bold text-slate-800">{Number(stats.total_inverters) || 0}</p></div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><RiPulseLine /> Manufacturer Footprint</h3>
                <div className="space-y-2 text-sm mt-3">
                  <p><span className="text-slate-500">Panel:</span> <span className="text-slate-800">{(equipmentSummary?.panel || []).join(', ') || 'N/A'}</span></p>
                  <p><span className="text-slate-500">Battery:</span> <span className="text-slate-800">{(equipmentSummary?.battery || []).join(', ') || 'N/A'}</span></p>
                  <p><span className="text-slate-500">Inverter:</span> <span className="text-slate-800">{(equipmentSummary?.inverter || []).join(', ') || 'N/A'}</span></p>
                </div>
              </div>

              {(Number(envImpact.co2_offset_tonnes_per_year) > 0 || Number(envImpact.homes_powered) > 0) && (
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-3xl p-5 shadow-sm border border-emerald-200">
                  <h3 className="font-semibold text-emerald-900 flex items-center gap-2"><RiLeafLine className="text-emerald-600" /> Environmental Impact</h3>
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center"><RiLeafLine className="text-emerald-600" /></div>
                      <div>
                        <p className="text-xs text-emerald-700/70">CO₂ Offset (per year)</p>
                        <p className="font-bold text-emerald-900">{formatNumber(envImpact.co2_offset_tonnes_per_year, 1)} tonnes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center"><RiLeafLine className="text-emerald-600" /></div>
                      <div>
                        <p className="text-xs text-emerald-700/70">Lifetime CO₂ Avoided ({Number(envImpact.analysis_period_years) || 25}yr)</p>
                        <p className="font-bold text-emerald-900">{formatNumber(envImpact.co2_offset_lifetime_tonnes, 1)} tonnes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center"><RiPlantLine className="text-green-600" /></div>
                      <div>
                        <p className="text-xs text-emerald-700/70">Equivalent Trees Planted</p>
                        <p className="font-bold text-emerald-900">{Number(envImpact.trees_equivalent || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center"><RiHome3Line className="text-green-600" /></div>
                      <div>
                        <p className="text-xs text-emerald-700/70">Homes Powered (annual)</p>
                        <p className="font-bold text-emerald-900">{Number(envImpact.homes_powered || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center"><RiSunLine className="text-amber-600" /></div>
                      <div>
                        <p className="text-xs text-emerald-700/70">Est. Annual Generation</p>
                        <p className="font-bold text-emerald-900">{formatNumber(envImpact.annual_generation_mwh, 1)} MWh</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h2 className="font-semibold text-forest-900 mb-4 flex items-center gap-2"><RiFlashlightLine /> Project Portfolio</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {((data.projects as Array<Record<string, unknown>>) || []).map((project) => (
                <article key={str(project.id)} className="rounded-2xl border border-slate-100 p-4 hover:border-emerald-200 transition">
                  <h3 className="font-semibold text-slate-800 leading-tight">{str(project.name)}</h3>
                  <p className="text-xs text-slate-500 mt-1">{str(project.city)}, {str(project.state)} • <span className="capitalize">{str(project.status)}</span></p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Capacity</p><p className="font-semibold text-slate-800">{formatNumber(project.project_capacity_mw, 4)} MW</p></div>
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">Commissioned</p><p className="font-semibold text-slate-800">{formatDate(String(project.installation_date ?? ''))}</p></div>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-1">
                    <p className="flex items-center gap-1"><RiPlantLine /> Panels: {Number((project.equipment_summary as Record<string, unknown> | undefined)?.panel_count) || 0}</p>
                    <p className="flex items-center gap-1"><RiStackLine /> Batteries: {Number((project.equipment_summary as Record<string, unknown> | undefined)?.battery_count) || 0}</p>
                    <p className="flex items-center gap-1"><RiPulseLine /> Inverters: {Number((project.equipment_summary as Record<string, unknown> | undefined)?.inverter_count) || 0}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h2 className="font-semibold text-forest-900 mb-4">Client Reviews</h2>
            <div className="space-y-3">
              {((data.reviews as unknown[]) || []).length === 0 && <p className="text-sm text-slate-400">No public reviews yet.</p>}
              {((data.reviews as Array<Record<string, unknown>>) || []).map((r, idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex justify-between">
                    <p className="text-sm font-semibold text-slate-700">{str(r.client_name) || 'Client'}</p>
                    <p className="text-sm text-amber-600 inline-flex items-center gap-1"><RiStarFill /> {Number(r.rating || 0)}</p>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{str(r.comment) || 'No comment provided.'}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
