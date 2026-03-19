import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { calculatorAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import toast from 'react-hot-toast';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const CONDITIONS = ['excellent','good','fair','poor','damaged'];
const CLIMATE_ZONES = [
  { value: 'coastal_humid', label: 'Coastal / Humid (Lagos, Rivers, Delta, Bayelsa)' },
  { value: 'sahel_dry',     label: 'Sahel / Dry Heat (Kano, Sokoto, Borno)' },
  { value: 'se_humid',      label: 'Southeast Humid (Enugu, Anambra, Imo)' },
  { value: 'mixed',         label: 'Mixed / Inland (FCT, Oyo, Kwara, Kaduna)' },
];

function fmt(n) { return Math.round(n || 0).toLocaleString('en-NG'); }
function pct(n) { return `${Math.round((n || 0) * 100)}%`; }

export default function Calculator() {
  const [activeTab, setActiveTab] = useState('panel');
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState({ panels: [], batteries: [] });

  const [panelForm, setPanelForm] = useState({
    size_watts: 400, quantity: 10,
    installation_date: '2018-01-01',
    climate_zone: 'coastal_humid',
    condition: 'good',
  });
  const [panelResult, setPanelResult] = useState(null);

  const [batteryForm, setBatteryForm] = useState({
    brand: 'Felicity',
    capacity_kwh: 2.4,
    quantity: 4,
    installation_date: '2020-01-01',
    condition: 'good',
  });
  const [batteryResult, setBatteryResult] = useState(null);

  const [degradForm, setDegradForm] = useState({ state: 'Lagos', installation_date: '2021-01-01' });
  const [degradResult, setDegradResult] = useState(null);

  useEffect(() => {
    calculatorAPI.getBrands()
      .then(r => setBrands(r.data.data || { panels: [], batteries: [] }))
      .catch(() => {});
  }, []);

  async function runPanel() {
    setLoading(true);
    try {
      const { data } = await calculatorAPI.panel(panelForm);
      setPanelResult(data.data);
    } catch { toast.error('Calculation failed — check your inputs'); }
    finally { setLoading(false); }
  }

  async function runBattery() {
    setLoading(true);
    try {
      const { data } = await calculatorAPI.battery(batteryForm);
      setBatteryResult(data.data);
    } catch { toast.error('Calculation failed'); }
    finally { setLoading(false); }
  }

  async function runDegrad() {
    setLoading(true);
    try {
      const { data } = await calculatorAPI.degradation(degradForm);
      setDegradResult(data.data);
    } catch { toast.error('Calculation failed'); }
    finally { setLoading(false); }
  }

  const tabs = [
    { id: 'panel',   label: '☀️ Panel Value',        desc: 'Silver + Second-Life' },
    { id: 'battery', label: '🔋 Battery Value',       desc: 'Recycling + Second-Life' },
    { id: 'degrade', label: '📅 Decommission Date',   desc: 'West African Climate' },
  ];

  return (
    <>
      <Head><title>Value Calculator — SolNuv</title></Head>

      <div className="page-header">
        <h1 className="font-display font-bold text-2xl text-forest-900">Recovery Value Calculator</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          See what your solar equipment is worth at end-of-life — silver, refurbishment, and battery recycling.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex flex-col items-start ${activeTab === t.id ? 'bg-forest-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-forest-900/30'}`}>
            <span>{t.label}</span>
            <span className={`text-xs font-normal ${activeTab === t.id ? 'text-white/70' : 'text-slate-400'}`}>{t.desc}</span>
          </button>
        ))}
      </div>

      <div className="max-w-4xl">
        {/* ── PANEL CALCULATOR ─────────────────────────────────────────────────── */}
        {activeTab === 'panel' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">Panel Details</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Wattage per Panel</label>
                  <input type="number" className="input" value={panelForm.size_watts} min="50" max="800"
                    onChange={e => setPanelForm(f => ({ ...f, size_watts: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Number of Panels</label>
                  <input type="number" className="input" value={panelForm.quantity} min="1"
                    onChange={e => setPanelForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Installation Date</label>
                <input type="date" className="input" value={panelForm.installation_date}
                  onChange={e => setPanelForm(f => ({ ...f, installation_date: e.target.value }))} />
                <p className="text-xs text-slate-400 mt-1">Used to calculate panel age and silver content (older panels had more silver).</p>
              </div>

              <div>
                <label className="label">Climate Zone</label>
                <select className="input" value={panelForm.climate_zone}
                  onChange={e => setPanelForm(f => ({ ...f, climate_zone: e.target.value }))}>
                  {CLIMATE_ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Panel Condition</label>
                <select className="input" value={panelForm.condition}
                  onChange={e => setPanelForm(f => ({ ...f, condition: e.target.value }))}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>

              <button onClick={runPanel} disabled={loading} className="btn-primary w-full">
                {loading ? 'Calculating...' : 'Calculate Panel Value →'}
              </button>
            </div>

            {/* Results */}
            <div className="space-y-4">
              {panelResult ? (
                <>
                  {/* Health */}
                  <div className="card">
                    <p className="text-xs font-semibold text-slate-400 mb-3">PANEL HEALTH</p>
                    <div className="flex items-end gap-3 mb-2">
                      <span className="font-display font-bold text-4xl text-forest-900">
                        {panelResult.panel_health?.soh_pct ?? Math.round((panelResult.panel_health?.soh || 0) * 100)}%
                      </span>
                      <span className="text-slate-500 text-sm pb-1">
                        State of Health · {panelResult.panel_health?.years_old}yr old
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div className="h-3 bg-emerald-500 rounded-full"
                        style={{ width: `${panelResult.panel_health?.soh_pct ?? Math.round((panelResult.panel_health?.soh || 0) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Each {panelResult.original_watts}W panel now produces ~
                      <strong> {panelResult.panel_health?.remaining_watts}W</strong> at its tested output.
                      ({panelResult.panel_health?.degradation_rate} annual degradation in this climate)
                    </p>
                  </div>

                  {/* Recommendation banner */}
                  {panelResult.comparison?.recommendation && (
                    <div className={`rounded-xl p-4 ${panelResult.comparison.recommendation.route === 'second_life' ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                      <p className="font-semibold text-sm mb-1">
                        {panelResult.comparison.recommendation.route === 'second_life' ? '✅ Recommended: Refurbish for Second-Life' : '⚙️ Recommended: Silver Recycling'}
                      </p>
                      <p className="text-xs text-slate-600">{panelResult.comparison.recommendation.reason}</p>
                    </div>
                  )}

                  {/* Two-column value comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Silver route */}
                    <div className={`rounded-xl p-4 border-2 ${panelResult.comparison?.recommendation?.route === 'silver_recycling' ? 'border-forest-900 bg-forest-900/5' : 'border-slate-200'}`}>
                      <p className="text-xs font-semibold text-slate-500 mb-1">SILVER RECYCLING</p>
                      <p className="font-display font-bold text-xl text-forest-900">
                        ₦{fmt(panelResult.silver_recycling?.installer_receives_ngn)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {panelResult.silver_recycling?.total_silver_grams?.toFixed(3)}g total silver
                      </p>
                      <p className="text-xs text-slate-400">
                        ₦{fmt(panelResult.silver_recycling?.installer_receives_min)}–₦{fmt(panelResult.silver_recycling?.installer_receives_max)} range
                      </p>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        Dismantle panels · extract silver · installer gets ~20% of spot value
                      </p>
                    </div>

                    {/* Second-life route */}
                    <div className={`rounded-xl p-4 border-2 ${panelResult.comparison?.recommendation?.route === 'second_life' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                      <p className="text-xs font-semibold text-slate-500 mb-1">SECOND-LIFE REFURB</p>
                      {panelResult.second_life_refurbishment?.is_viable ? (
                        <>
                          <p className="font-display font-bold text-xl text-emerald-700">
                            ₦{fmt(panelResult.second_life_refurbishment?.installer_receives_ngn)}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {panelResult.panel_health?.remaining_watts}W tested output
                          </p>
                          <p className="text-xs text-slate-400">
                            ₦{fmt(panelResult.second_life_refurbishment?.installer_receives_min)}–₦{fmt(panelResult.second_life_refurbishment?.installer_receives_max)} range
                          </p>
                          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            Keep panels intact · test · repackage at {panelResult.panel_health?.remaining_watts}W rating
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 mt-2">Not viable — SOH below 70%</p>
                      )}
                    </div>
                  </div>

                  {/* Multiplier callout */}
                  {panelResult.comparison?.refurb_vs_silver_multiple > 1 && (
                    <div className="bg-forest-900 rounded-xl p-4 text-white text-center">
                      <p className="text-3xl font-display font-bold text-amber-400">
                        {panelResult.comparison.refurb_vs_silver_multiple}×
                      </p>
                      <p className="text-sm text-white/80 mt-1">
                        more value from refurbishment vs. dismantling for silver
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 space-y-1">
                    <p>💎 Silver: {panelResult.silver_recycling?.silver_grams_per_panel?.toFixed(3)}g/panel (manufacture era: ~{new Date(panelForm.installation_date).getFullYear() - 1})</p>
                    <p>💵 Silver spot: ₦{fmt(panelResult.silver_price_ngn_per_gram)}/gram (${panelResult.silver_price_usd_per_gram}/g)</p>
                    <p>📐 New panel landed cost: ~₦{fmt(panelResult.panel_health?.remaining_watts * 0.28 * (panelResult.usd_to_ngn_rate || 1620))}/unit at {panelResult.panel_health?.remaining_watts}W</p>
                  </div>
                </>
              ) : (
                <div className="card flex items-center justify-center h-64 text-slate-300">
                  <p className="text-sm">Fill in the form and click Calculate</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BATTERY CALCULATOR ─────────────────────────────────────────────── */}
        {activeTab === 'battery' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">Battery Details</h2>

              <div>
                <label className="label">Brand</label>
                <select className="input" value={batteryForm.brand}
                  onChange={e => setBatteryForm(f => ({ ...f, brand: e.target.value }))}>
                  {brands.batteries.length > 0
                    ? brands.batteries.map(b => <option key={b.brand} value={b.brand}>{b.brand} ({b.chemistry})</option>)
                    : ['Felicity','Luminous','Pylontech','RITAR','BYD','Other Lead-Acid','Other Lithium'].map(b => <option key={b} value={b}>{b}</option>)
                  }
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Capacity per Unit (kWh)</label>
                  <input type="number" className="input" value={batteryForm.capacity_kwh} min="0.5" step="0.1"
                    onChange={e => setBatteryForm(f => ({ ...f, capacity_kwh: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Number of Units</label>
                  <input type="number" className="input" value={batteryForm.quantity} min="1"
                    onChange={e => setBatteryForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Installation Date</label>
                <input type="date" className="input" value={batteryForm.installation_date}
                  onChange={e => setBatteryForm(f => ({ ...f, installation_date: e.target.value }))} />
                <p className="text-xs text-slate-400 mt-1">Used to estimate State of Health (SOH).</p>
              </div>

              <div>
                <label className="label">Condition</label>
                <select className="input" value={batteryForm.condition}
                  onChange={e => setBatteryForm(f => ({ ...f, condition: e.target.value }))}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>

              <button onClick={runBattery} disabled={loading} className="btn-primary w-full">
                {loading ? 'Calculating...' : 'Calculate Battery Value →'}
              </button>
            </div>

            {/* Results */}
            <div className="space-y-4">
              {batteryResult ? (
                <>
                  {/* Health */}
                  <div className="card">
                    <p className="text-xs font-semibold text-slate-400 mb-3">BATTERY HEALTH</p>
                    <div className="flex items-end gap-3 mb-2">
                      <span className="font-display font-bold text-4xl text-forest-900">
                        {batteryResult.battery_health?.soh_pct}%
                      </span>
                      <span className="text-slate-500 text-sm pb-1">
                        SOH · {batteryResult.battery_health?.years_old}yr old
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
                      <div
                        className={`h-3 rounded-full ${batteryResult.battery_health?.soh_pct >= 80 ? 'bg-emerald-500' : batteryResult.battery_health?.soh_pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${batteryResult.battery_health?.soh_pct}%` }} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {batteryResult.battery_health?.effective_capacity_kwh}kWh usable capacity
                      from {batteryResult.total_capacity_kwh}kWh rated
                      ({batteryResult.chemistry})
                    </p>
                  </div>

                  {/* Recommendation */}
                  {batteryResult.comparison?.recommendation && (
                    <div className={`rounded-xl p-4 ${batteryResult.battery_health?.is_viable_second_life ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                      <p className="font-semibold text-sm mb-1">
                        {batteryResult.battery_health?.is_viable_second_life ? '✅ Recommended: Second-Life Deployment' : '♻️ Recommended: Material Recycling'}
                      </p>
                      <p className="text-xs text-slate-600">{batteryResult.comparison.recommendation.reason}</p>
                    </div>
                  )}

                  {/* Value comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl p-4 border-2 ${!batteryResult.battery_health?.is_viable_second_life ? 'border-forest-900 bg-forest-900/5' : 'border-slate-200'}`}>
                      <p className="text-xs font-semibold text-slate-500 mb-1">MATERIAL RECYCLING</p>
                      <p className="font-display font-bold text-xl text-forest-900">
                        ₦{fmt(batteryResult.material_recycling?.installer_receives_ngn)}
                      </p>
                      <div className="text-xs text-slate-400 mt-2 space-y-0.5">
                        {batteryResult.material_recycling?.materials?.lead_kg && (
                          <p>Lead: {batteryResult.material_recycling.materials.lead_kg}kg recoverable</p>
                        )}
                        {batteryResult.material_recycling?.materials?.lithium_kg && (
                          <p>Li: {batteryResult.material_recycling.materials.lithium_kg}kg → {batteryResult.material_recycling.materials.li_carbonate_kg}kg Li₂CO₃</p>
                        )}
                      </div>
                    </div>

                    <div className={`rounded-xl p-4 border-2 ${batteryResult.battery_health?.is_viable_second_life ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                      <p className="text-xs font-semibold text-slate-500 mb-1">SECOND-LIFE</p>
                      {batteryResult.second_life?.is_viable ? (
                        <>
                          <p className="font-display font-bold text-xl text-emerald-700">
                            ₦{fmt(batteryResult.second_life?.installer_receives_ngn)}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {batteryResult.battery_health?.effective_capacity_kwh}kWh usable
                          </p>
                          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            Deploy in backup, rural solar, or telecom storage
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 mt-2">Not viable — SOH below 70%</p>
                      )}
                    </div>
                  </div>

                  {batteryResult.comparison?.second_life_vs_recycling_multiple > 1 && (
                    <div className="bg-forest-900 rounded-xl p-4 text-white text-center">
                      <p className="text-3xl font-display font-bold text-amber-400">
                        {batteryResult.comparison.second_life_vs_recycling_multiple}×
                      </p>
                      <p className="text-sm text-white/80 mt-1">more value from second-life vs. material recycling</p>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
                    Note: {batteryResult.material_recycling?.note}
                  </p>
                </>
              ) : (
                <div className="card flex items-center justify-center h-64 text-slate-300">
                  <p className="text-sm">Fill in the form and click Calculate</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DEGRADATION / DECOMMISSION CALCULATOR ──────────────────────────── */}
        {activeTab === 'degrade' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">Installation Details</h2>
              <div>
                <label className="label">State</label>
                <select className="input" value={degradForm.state}
                  onChange={e => setDegradForm(f => ({ ...f, state: e.target.value }))}>
                  {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Installation Date</label>
                <input type="date" className="input" value={degradForm.installation_date}
                  onChange={e => setDegradForm(f => ({ ...f, installation_date: e.target.value }))} />
              </div>
              <button onClick={runDegrad} disabled={loading} className="btn-primary w-full">
                {loading ? 'Calculating...' : 'Predict Decommission Date →'}
              </button>
            </div>

            <div className="space-y-4">
              {degradResult ? (
                <>
                  <div className={`rounded-2xl p-6 text-white ${degradResult.urgency === 'overdue' ? 'bg-red-600' : degradResult.urgency === 'critical' ? 'bg-amber-600' : degradResult.urgency === 'soon' ? 'bg-amber-500' : 'bg-forest-900'}`}>
                    <p className="text-white/70 text-sm mb-1">Estimated Decommission</p>
                    <p className="font-display text-3xl font-bold">
                      {new Date(degradResult.adjusted_failure_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-sm mt-2 text-white/80">
                      {degradResult.urgency === 'overdue'
                        ? `⚠️ ${Math.abs(degradResult.days_until_decommission)} days overdue`
                        : `${degradResult.days_until_decommission} days from today`}
                    </p>
                  </div>
                  <div className="card space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Climate Zone</span>
                      <span className="font-semibold text-forest-900">{degradResult.climate_zone?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Expected Lifespan</span>
                      <span className="font-semibold text-forest-900">{degradResult.years_expected} years</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed pt-1 border-t border-slate-100">
                      {degradResult.explanation}
                    </p>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-blue-600 font-medium">vs. OEM Warranty (20–25 years)</p>
                      <p className="text-xs text-blue-500 mt-1">
                        Standard panels are rated for 20–25 years. In West African conditions, expect 7–12 years. Our algorithm uses local climate data, not the factory default.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card flex items-center justify-center h-64 text-slate-300">
                  <p className="text-sm">Select a state and date to get a prediction</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 bg-gradient-to-r from-forest-900 to-emerald-800 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Track your full fleet automatically</p>
            <p className="text-sm text-white/70 mt-0.5">Log all your projects and get these calculations updated in real time as silver prices change.</p>
          </div>
          <Link href="/projects/add" className="btn-amber flex-shrink-0">Add a Project →</Link>
        </div>
      </div>
    </>
  );
}

Calculator.getLayout = getDashboardLayout;