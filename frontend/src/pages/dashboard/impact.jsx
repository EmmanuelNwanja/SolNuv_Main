import Head from 'next/head';
import { useEffect, useState } from 'react';
import { dashboardAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { StatCard, LoadingSpinner } from '../../components/ui/index';
import { RiLeafLine, RiRecycleLine, RiSunLine, RiFlashlightLine } from 'react-icons/ri';

export default function Impact() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.getImpact()
      .then(r => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  const actual = data?.actual || {};
  const expected = data?.expected || {};

  const pct = expected.panels_to_recycle > 0
    ? Math.round((actual.panels_recycled / expected.panels_to_recycle) * 100)
    : 0;

  return (
    <>
      <Head><title>Impact Calculator — SolNuv</title></Head>

      <div className="page-header">
        <h1 className="font-display font-bold text-2xl text-forest-900 flex items-center gap-2">
          <RiLeafLine className="text-emerald-500" /> Environmental Impact
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Your contribution to responsible solar energy in Nigeria</p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Progress bar */}
        <div className="card">
          <div className="flex justify-between items-end mb-2">
            <p className="font-semibold text-forest-900">Recycling Progress</p>
            <p className="text-2xl font-display font-bold text-emerald-600">{pct}%</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
            <div className="h-4 bg-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-2">{actual.panels_recycled || 0} panels formally recycled of {expected.panels_to_recycle || 0} total tracked</p>
        </div>

        {/* Actual impact */}
        <div>
          <h2 className="font-semibold text-forest-900 mb-3 flex items-center gap-2"><RiRecycleLine className="text-emerald-500" /> Actual Impact (Recycled)</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard label="Panels Recycled" value={actual.panels_recycled || 0} icon={RiSunLine} color="emerald" />
            <StatCard label="Silver Recovered" value={`${(actual.silver_recovered_grams || 0).toFixed(1)}g`} icon={RiFlashlightLine} color="amber" />
            <StatCard label="CO₂ Avoided" value={`${((actual.co2_avoided_kg || 0) / 1000).toFixed(1)}t`} sub="equivalent" icon={RiLeafLine} color="forest" />
          </div>
        </div>

        {/* Expected impact */}
        <div>
          <h2 className="font-semibold text-forest-900 mb-3 flex items-center gap-2"><RiSunLine className="text-amber-500" /> Expected Impact (Active Fleet)</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard label="Panels to Recycle" value={expected.panels_to_recycle || 0} icon={RiSunLine} color="slate" />
            <StatCard label="Expected Silver" value={`${(expected.expected_silver_grams || 0).toFixed(1)}g`} icon={RiFlashlightLine} color="slate" />
            <StatCard label="Potential CO₂ Saving" value={`${((expected.expected_co2_avoided_kg || 0) / 1000).toFixed(1)}t`} icon={RiLeafLine} color="slate" />
          </div>
        </div>

        {/* Silver value card */}
        <div className="bg-forest-900 rounded-2xl p-6 text-white">
          <p className="text-white/70 text-sm mb-1">Silver Recovered vs. Lost to Informal Sector</p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs text-white/50">Formal Recycling (You)</p>
              <p className="font-display text-2xl font-bold text-emerald-400">₦{(data?.silver_value_ngn || 0).toLocaleString('en-NG')}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Informal Scrappers</p>
              <p className="font-display text-2xl font-bold text-red-400">₦0</p>
              <p className="text-xs text-white/40 mt-1">They burn cables; silver is lost forever</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-amber-800 mb-2">How Impact Score is Calculated</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Recycled projects score 3 points · Decommissioned score 2 points · Active projects score 1 point · Every gram of silver adds 0.1 points. This score determines your leaderboard rank and reflects your commitment to responsible solar lifecycle management in Nigeria.
          </p>
        </div>
      </div>
    </>
  );
}

Impact.getLayout = getDashboardLayout;
