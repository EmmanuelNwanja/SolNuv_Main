import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import { getAdminLayout } from '../../components/Layout';
import AdminRoute from '../../components/AdminRoute';
import { LoadingSpinner } from '../../components/ui/index';
import toast from 'react-hot-toast';
import {
  RiSunLine, RiBarChartLine, RiFileTextLine, RiShareLine,
  RiRefreshLine, RiDeleteBinLine, RiEyeLine, RiCloseLine,
  RiFlashlightLine, RiBatteryChargeLine, RiPieChartLine,
  RiAddLine, RiEditLine, RiCheckLine, RiArrowLeftLine,
  RiExternalLinkLine, RiShieldCheckLine, RiLeafLine,
  RiGridLine, RiHome4Line,
} from 'react-icons/ri';

const TABS = ['overview', 'simulations', 'tariffs', 'shares', 'adoption'];

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
        active ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}
    >
      <Icon className="text-sm" /> {label}
    </button>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color = 'emerald' }) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-3">
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        <Icon className="text-base" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-slate-900">{value ?? '—'}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function fmt(n) { return n != null ? Number(n).toLocaleString() : '—'; }
function fmtMoney(n, c = 'ZAR') { return n != null ? `${c} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function fmtPct(n) { return n != null ? Number(n).toFixed(1) + '%' : '—'; }
function fmtTopology(t) { return t ? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'; }
function fmtInstall(t) { return t ? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'; }

/* ═══════════════════════════ OVERVIEW TAB ═══════════════════════════ */
function OverviewTab({ data }) {
  if (!data) return <p className="text-sm text-slate-400 py-8">Loading...</p>;
  const d = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={RiSunLine} label="Total Designs" value={fmt(d.designs?.total)} sub={`+${d.designs?.last_30d || 0} last 30d`} color="emerald" />
        <KpiCard icon={RiFlashlightLine} label="Simulations Run" value={fmt(d.simulations?.total)} sub={`+${d.simulations?.last_30d || 0} last 30d`} color="blue" />
        <KpiCard icon={RiFileTextLine} label="Tariff Templates" value={fmt(d.tariffs?.templates)} sub={`${d.tariffs?.company_custom || 0} company-custom`} color="violet" />
        <KpiCard icon={RiBatteryChargeLine} label="Load Profiles" value={fmt(d.load_profiles?.total)} color="amber" />
        <KpiCard icon={RiShareLine} label="Report Shares" value={fmt(d.report_shares?.total)} sub={`${d.report_shares?.active_links || 0} active links`} color="rose" />
        <KpiCard icon={RiLeafLine} label="Total CO₂ Avoided" value={`${fmt(d.total_co2_avoided_tonnes)} t`} sub="lifetime tonnes" color="emerald" />
      </div>

      {/* Grid Topology Distribution */}
      {Object.keys(d.topology_distribution || {}).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Grid Topology Distribution</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(d.topology_distribution).sort((a,b) => b[1] - a[1]).map(([topo, count]) => (
              <div key={topo} className="rounded-xl bg-blue-50 text-blue-700 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{topo.replace(/_/g, ' ')}</p>
                <p className="text-xl font-bold mt-0.5">{fmt(count)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Installation Type Distribution */}
      {Object.keys(d.installation_type_distribution || {}).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Installation Type Distribution</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(d.installation_type_distribution).sort((a,b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="rounded-xl bg-violet-50 text-violet-700 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{type.replace(/_/g, ' ')}</p>
                <p className="text-xl font-bold mt-0.5">{fmt(count)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ SIMULATIONS TAB ═══════════════════════════ */
function SimulationsTab() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const { data: res } = await adminAPI.listSimulations({ page: p, limit: 20 });
      setRows(res.data?.simulations || []);
      setTotal(res.data?.total || 0);
    } catch { toast.error('Failed to load simulations'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(page); }, [page]);

  if (loading && rows.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{fmt(total)} simulation result{total !== 1 ? 's' : ''}</p>
        <button onClick={() => load(page)} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><RiRefreshLine /> Refresh</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Project</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Company</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Topology</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Install</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">PV (kWp)</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">BESS (kWh)</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">Generation</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">Self-Use %</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">Savings</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">Payback</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">CO₂ (t)</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-none hover:bg-slate-50">
                <td className="px-3 py-2.5 text-slate-700 font-medium truncate max-w-[160px]">{r.project_name}</td>
                <td className="px-3 py-2.5 text-slate-500 truncate max-w-[140px]">{r.company_name}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{fmtTopology(r.grid_topology)}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{fmtInstall(r.installation_type)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmt(r.pv_kwp)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-600">{r.bess_kwh > 0 ? fmt(r.bess_kwh) : '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmt(r.annual_gen_kwh)} kWh</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{fmtPct(r.self_consumption_pct)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-600">{fmt(r.year1_savings)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-600">{r.payback_months ? `${(Number(r.payback_months) / 12).toFixed(1)}y` : '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-teal-600">{r.co2_avoided_tonnes > 0 ? Number(r.co2_avoided_tonnes).toFixed(1) : '—'}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{fmtDate(r.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-sm text-slate-400">No simulations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {total > 20 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40">Prev</button>
          <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ TARIFFS TAB ═══════════════════════════ */
function TariffsTab() {
  const [tariffs, setTariffs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | templates | company
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filter === 'templates') params.is_template = 'true';
      if (filter === 'company') params.is_template = 'false';
      const { data: res } = await adminAPI.listTariffStructures(params);
      setTariffs(res.data?.tariffs || []);
      setTotal(res.data?.total || 0);
    } catch { toast.error('Failed to load tariffs'); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [filter]);

  const viewDetail = async (id) => {
    setDetailLoading(true);
    try {
      const { data: res } = await adminAPI.getTariffDetail(id);
      setDetail(res.data);
    } catch { toast.error('Failed to load tariff detail'); }
    setDetailLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete tariff template "${name}"? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteTariffTemplate(id);
      toast.success('Template deleted');
      setDetail(null);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  if (detail) {
    const t = detail;
    return (
      <div>
        <button onClick={() => setDetail(null)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-4">
          <RiArrowLeftLine /> Back to list
        </button>
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t.tariff_name}</h3>
              <p className="text-sm text-slate-400">{t.utility_name || '—'} &middot; {t.country} &middot; {(t.tariff_type || 'flat').toUpperCase()} &middot; {t.currency}</p>
            </div>
            <div className="flex items-center gap-2">
              {t.is_template && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-50 text-emerald-700">Template</span>
              )}
              {t.is_template && (
                <button onClick={() => handleDelete(t.id, t.tariff_name)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <RiDeleteBinLine /> Delete
                </button>
              )}
            </div>
          </div>

          {t.tariff_rates?.length > 0 && (
            <>
              <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 mt-4">Rate Schedule</h4>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Season</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Period</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Rate/kWh</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Weekday Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.tariff_rates.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-none">
                        <td className="px-3 py-2 text-slate-700">{r.season_key}</td>
                        <td className="px-3 py-2 text-slate-600">{r.period_name}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700">{t.currency} {Number(r.rate_per_kwh).toFixed(4)}</td>
                        <td className="px-3 py-2 text-xs font-mono text-slate-400">{JSON.stringify(r.weekday_hours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {t.tariff_ancillary_charges?.length > 0 && (
            <>
              <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 mt-4">Ancillary Charges</h4>
              <div className="space-y-1">
                {t.tariff_ancillary_charges.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-slate-50">
                    <span className="text-slate-700">{c.charge_label}</span>
                    <span className="font-mono text-slate-600">{Number(c.rate).toFixed(2)} {c.unit}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {['all', 'templates', 'company'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors capitalize ${
                filter === f ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >{f}</button>
          ))}
        </div>
        <p className="text-xs text-slate-400">{fmt(total)} tariff structure{total !== 1 ? 's' : ''}</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Country</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Utility</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Type</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Currency</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase text-slate-500">Template</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Created</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tariffs.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-none hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-700 truncate max-w-[200px]">{t.tariff_name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{t.country}</td>
                  <td className="px-3 py-2.5 text-slate-500">{t.utility_name || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500 uppercase text-xs">{t.tariff_type}</td>
                  <td className="px-3 py-2.5 text-slate-500">{t.currency}</td>
                  <td className="px-3 py-2.5 text-center">
                    {t.is_template
                      ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Template" />
                      : <span className="inline-block w-2 h-2 rounded-full bg-slate-300" title="Company" />}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{fmtDate(t.created_at)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => viewDetail(t.id)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto">
                      <RiEyeLine /> View
                    </button>
                  </td>
                </tr>
              ))}
              {tariffs.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">No tariff structures found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ REPORT SHARES TAB ═══════════════════════════ */
function SharesTab() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (activeOnly) params.active_only = 'true';
      const { data: res } = await adminAPI.listReportShares(params);
      setRows(res.data?.shares || []);
      setTotal(res.data?.total || 0);
    } catch { toast.error('Failed to load shares'); }
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => { load(page); }, [page, activeOnly]);

  const revoke = async (id) => {
    if (!confirm('Revoke this share link? It will become inaccessible.')) return;
    try {
      await adminAPI.revokeReportShare(id);
      toast.success('Share link revoked');
      load(page);
    } catch { toast.error('Failed to revoke'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={activeOnly} onChange={e => { setActiveOnly(e.target.checked); setPage(1); }} className="rounded" />
          Active only
        </label>
        <p className="text-xs text-slate-400">{fmt(total)} share link{total !== 1 ? 's' : ''}</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Project</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Company</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">PV (kWp)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">Views</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase text-slate-500">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Expires</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">Created</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const expired = r.expires_at && new Date(r.expires_at) < new Date();
                const active = r.is_active && !expired;
                return (
                  <tr key={r.id} className="border-b border-slate-50 last:border-none hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-700 truncate max-w-[160px]">{r.project_name}</td>
                    <td className="px-3 py-2.5 text-slate-500 truncate max-w-[140px]">{r.company_name}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmt(r.pv_kwp)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-600">{r.view_count || 0}</td>
                    <td className="px-3 py-2.5 text-center">
                      {active
                        ? <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-50 text-emerald-700">Active</span>
                        : expired
                          ? <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-500">Expired</span>
                          : <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-red-50 text-red-600">Revoked</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{fmtDate(r.expires_at)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {active && (
                        <button onClick={() => revoke(r.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 mx-auto">
                          <RiCloseLine /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">No report shares found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {total > 20 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40">Prev</button>
          <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ ADOPTION TAB ═══════════════════════════ */
function AdoptionTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await adminAPI.getDesignAdoption();
        setData(res.data);
      } catch { toast.error('Failed to load adoption data'); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-sm text-slate-400 py-8">No data available.</p>;

  const planColors = { free: 'bg-slate-100 text-slate-600', pro: 'bg-blue-50 text-blue-700', elite: 'bg-violet-50 text-violet-700', enterprise: 'bg-amber-50 text-amber-700' };

  return (
    <div className="space-y-6">
      {/* Companies using design */}
      <KpiCard icon={RiShieldCheckLine} label="Companies Using Design Features" value={fmt(data.companies_using_design)} color="emerald" />

      {/* Designs by plan */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Designs by Plan Tier</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.designs_by_plan || {}).sort((a,b) => b[1] - a[1]).map(([plan, count]) => (
            <div key={plan} className={`rounded-xl px-4 py-3 ${planColors[plan] || 'bg-slate-50 text-slate-600'}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{plan}</p>
              <p className="text-xl font-bold mt-0.5">{fmt(count)}</p>
            </div>
          ))}
          {Object.keys(data.designs_by_plan || {}).length === 0 && <p className="text-sm text-slate-400 col-span-4">No design data yet.</p>}
        </div>
      </div>

      {/* Simulations by plan */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Simulations by Plan Tier</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.simulations_by_plan || {}).sort((a,b) => b[1] - a[1]).map(([plan, count]) => (
            <div key={plan} className={`rounded-xl px-4 py-3 ${planColors[plan] || 'bg-slate-50 text-slate-600'}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{plan}</p>
              <p className="text-xl font-bold mt-0.5">{fmt(count)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dispatch strategy breakdown */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">BESS Dispatch Strategy Usage</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.dispatch_strategy_breakdown || {}).sort((a,b) => b[1] - a[1]).map(([strat, count]) => (
            <div key={strat} className="rounded-xl bg-blue-50 text-blue-700 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{strat.replace(/_/g, ' ')}</p>
              <p className="text-xl font-bold mt-0.5">{fmt(count)}</p>
            </div>
          ))}
          {Object.keys(data.dispatch_strategy_breakdown || {}).length === 0 && <p className="text-sm text-slate-400 col-span-4">No BESS designs yet.</p>}
        </div>
      </div>

      {/* Load profile sources */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Load Profile Sources</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.load_profile_sources || {}).sort((a,b) => b[1] - a[1]).map(([src, count]) => (
            <div key={src} className="rounded-xl bg-amber-50 text-amber-700 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{src.replace(/_/g, ' ')}</p>
              <p className="text-xl font-bold mt-0.5">{fmt(count)}</p>
            </div>
          ))}
          {Object.keys(data.load_profile_sources || {}).length === 0 && <p className="text-sm text-slate-400 col-span-4">No load profiles yet.</p>}
        </div>
      </div>

      {/* Grid topology breakdown */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Grid Topology Adoption</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.topology_breakdown || {}).sort((a,b) => b[1] - a[1]).map(([topo, count]) => (
            <div key={topo} className="rounded-xl bg-cyan-50 text-cyan-700 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{topo.replace(/_/g, ' ')}</p>
              <p className="text-xl font-bold mt-0.5">{fmt(count)}</p>
            </div>
          ))}
          {Object.keys(data.topology_breakdown || {}).length === 0 && <p className="text-sm text-slate-400 col-span-4">No topology data yet.</p>}
        </div>
      </div>

      {/* Installation type breakdown */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Installation Type Adoption</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.installation_type_breakdown || {}).sort((a,b) => b[1] - a[1]).map(([type, count]) => (
            <div key={type} className="rounded-xl bg-violet-50 text-violet-700 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{type.replace(/_/g, ' ')}</p>
              <p className="text-xl font-bold mt-0.5">{fmt(count)}</p>
            </div>
          ))}
          {Object.keys(data.installation_type_breakdown || {}).length === 0 && <p className="text-sm text-slate-400 col-span-4">No installation type data yet.</p>}
        </div>
      </div>

      {/* Environmental impact */}
      {data.environmental_impact && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Environmental & Fuel Impact (Platform Total)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon={RiLeafLine} label="CO₂ Avoided (Lifetime)" value={`${fmt(data.environmental_impact.total_co2_avoided_tonnes)} t`} color="emerald" />
            <KpiCard icon={RiFlashlightLine} label="Diesel Cost Avoided (Annual)" value={fmtMoney(data.environmental_impact.total_diesel_cost_avoided)} color="amber" />
            <KpiCard icon={RiFlashlightLine} label="Petrol Cost Avoided (Annual)" value={fmtMoney(data.environmental_impact.total_petrol_cost_avoided)} color="rose" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ MAIN PAGE ═══════════════════════════ */
function DesignAdminPage() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await adminAPI.getDesignOverview();
        setOverview(res.data);
      } catch { /* handled per-tab */ }
      setLoading(false);
    })();
  }, []);

  const tabIcons = {
    overview: RiBarChartLine,
    simulations: RiFlashlightLine,
    tariffs: RiSunLine,
    shares: RiShareLine,
    adoption: RiPieChartLine,
  };

  return (
    <AdminRoute>
      <Head>
        <title>Design & Modelling - SolNuv Admin</title>
      </Head>
      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-slate-900">Design & Modelling</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage tariff templates, monitor simulations, report shares, and feature adoption</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(t => (
            <TabButton key={t} active={tab === t} onClick={() => setTab(t)} icon={tabIcons[t]} label={t.charAt(0).toUpperCase() + t.slice(1)} />
          ))}
        </div>

        {/* Content */}
        {tab === 'overview' && <OverviewTab data={overview} />}
        {tab === 'simulations' && <SimulationsTab />}
        {tab === 'tariffs' && <TariffsTab />}
        {tab === 'shares' && <SharesTab />}
        {tab === 'adoption' && <AdoptionTab />}
      </div>
    </AdminRoute>
  );
}

DesignAdminPage.getLayout = getAdminLayout;
export default DesignAdminPage;
