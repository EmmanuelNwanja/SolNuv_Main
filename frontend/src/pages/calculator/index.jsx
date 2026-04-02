import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { calculatorAPI, downloadBlob, engineeringAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { MotionSection } from '../../components/PageMotion';
import { useAuth } from '../../context/AuthContext';
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
  const { plan, isPro } = useAuth();
  const [activeTab, setActiveTab] = useState('panel');
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState({ panels: [], batteries: [] });
  const [usageData, setUsageData] = useState(null);

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

  const [roiForm, setRoiForm] = useState({
    tariff_band: 'A',
    tariff_rate_ngn_per_kwh: 225,
    generator_fuel_price_ngn_per_liter: 1000,
    current_grid_kwh_per_day: 25,
    current_generator_liters_per_day: 8,
    proposed_solar_capex_ngn: 3500000,
    annual_om_cost_ngn: 120000,
    projected_grid_kwh_offset_per_day: 18,
    projected_generator_liters_offset_per_day: 6,
  });
  const [roiResult, setRoiResult] = useState(null);

  const [sohForm, setSohForm] = useState({
    chemistry: 'lithium-iron-phosphate',
    installation_date: '2022-01-01',
    rated_capacity_kwh: 10,
    measured_capacity_kwh: 8.5,
    avg_depth_of_discharge_pct: 65,
    estimated_cycles_per_day: 1,
    ambient_temperature_c: 32,
    warranty_years: 5,
  });
  const [sohResult, setSohResult] = useState(null);

  const [cableForm, setCableForm] = useState({
    current_amps: 80,
    one_way_length_m: 22,
    system_voltage_v: 48,
    allowable_voltage_drop_pct: 3,
    conductor_material: 'copper',
    ambient_temperature_c: 34,
  });
  const [cableResult, setCableResult] = useState(null);
  const [cableProjectId, setCableProjectId] = useState('');
  const [syncingQueue, setSyncingQueue] = useState(false);

  const CABLE_QUEUE_KEY = 'solnuv_cable_sync_queue_v1';

  useEffect(() => {
    calculatorAPI.getBrands()
      .then(r => setBrands(r.data.data || { panels: [], batteries: [] }))
      .catch(() => {});

    // Fetch usage data for Free plan users
    calculatorAPI.getUsage()
      .then(r => setUsageData(r.data.data || null))
      .catch(() => {});

    const flush = async () => {
      if (typeof window === 'undefined' || !navigator.onLine) return;
      let queued = [];
      try {
        queued = JSON.parse(localStorage.getItem(CABLE_QUEUE_KEY) || '[]');
      } catch {
        queued = [];
      }
      if (!Array.isArray(queued) || queued.length === 0) return;

      setSyncingQueue(true);
      const failed = [];
      for (const entry of queued) {
        try {
          await engineeringAPI.saveCableCompliance(entry.projectId, entry.payload);
        } catch {
          failed.push(entry);
        }
      }
      localStorage.setItem(CABLE_QUEUE_KEY, JSON.stringify(failed));
      setSyncingQueue(false);

      if (failed.length === 0) {
        toast.success('Offline cable entries synced successfully');
      }
    };

    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);

  function handleCalcError(err, fallbackMsg) {
    if (err?.response?.status === 429) {
      const msg = err.response?.data?.message || 'Monthly limit reached.';
      toast.error(msg, { duration: 6000 });
      // Refresh usage display
      calculatorAPI.getUsage().then(r => setUsageData(r.data.data || null)).catch(() => {});
    } else {
      toast.error(fallbackMsg);
    }
  }

  async function runPanel() {
    setLoading(true);
    try {
      const { data } = await calculatorAPI.panel(panelForm);
      setPanelResult(data.data);
      if (usageData?.is_limited) calculatorAPI.getUsage().then(r => setUsageData(r.data.data || null)).catch(() => {});
    } catch (err) { handleCalcError(err, 'Calculation failed — check your inputs'); }
    finally { setLoading(false); }
  }

  async function runBattery() {
    setLoading(true);
    try {
      const { data } = await calculatorAPI.battery(batteryForm);
      setBatteryResult(data.data);
      if (usageData?.is_limited) calculatorAPI.getUsage().then(r => setUsageData(r.data.data || null)).catch(() => {});
    } catch (err) { handleCalcError(err, 'Calculation failed'); }
    finally { setLoading(false); }
  }

  async function runDegrad() {
    setLoading(true);
    try {
      const { data } = await calculatorAPI.degradation(degradForm);
      setDegradResult(data.data);
      if (usageData?.is_limited) calculatorAPI.getUsage().then(r => setUsageData(r.data.data || null)).catch(() => {});
    } catch (err) { handleCalcError(err, 'Calculation failed'); }
    finally { setLoading(false); }
  }

  async function runROI() {
    setLoading(true);
    try {
      const { data } = await calculatorAPI.roi(roiForm);
      setRoiResult(data.data);
      if (usageData?.is_limited) calculatorAPI.getUsage().then(r => setUsageData(r.data.data || null)).catch(() => {});
    } catch (err) {
      handleCalcError(err, 'ROI calculation failed');
    } finally {
      setLoading(false);
    }
  }

  async function runSoh() {
    setLoading(true);
    try {
      const { data } = await calculatorAPI.batterySoh(sohForm);
      setSohResult(data.data);
      if (usageData?.is_limited) calculatorAPI.getUsage().then(r => setUsageData(r.data.data || null)).catch(() => {});
    } catch (err) {
      handleCalcError(err, 'Battery SoH calculation failed');
    } finally {
      setLoading(false);
    }
  }

  async function runCable() {
    setLoading(true);
    try {
      const { data } = await calculatorAPI.cableSize(cableForm);
      setCableResult(data.data);
      if (usageData?.is_limited) calculatorAPI.getUsage().then(r => setUsageData(r.data.data || null)).catch(() => {});
    } catch (err) {
      handleCalcError(err, 'Cable sizing calculation failed');
    } finally {
      setLoading(false);
    }
  }

  async function exportRoiPdf() {
    if (!roiResult) return;
    try {
      const { data } = await calculatorAPI.exportRoiPdf(roiForm);
      downloadBlob(data, `SolNuv_Hybrid_ROI_Proposal_${Date.now()}.pdf`);
    } catch {
      toast.error('Failed to export ROI PDF');
    }
  }

  async function exportCablePdf() {
    if (!cableResult) return;
    try {
      const { data } = await calculatorAPI.exportCableCertificatePdf(cableForm);
      downloadBlob(data, `SolNuv_Cable_Compliance_${Date.now()}.pdf`);
    } catch {
      toast.error('Failed to export cable certificate');
    }
  }

  async function saveCableComplianceRecord() {
    if (!cableResult) {
      toast.error('Run cable sizing first');
      return;
    }

    if (!cableProjectId) {
      toast.error('Add a project ID to save a compliance record');
      return;
    }

    const payload = {
      ...cableForm,
      computed_area_mm2: cableResult.calculations?.required_area_mm2,
      recommended_standard_mm2: cableResult.calculations?.recommended_standard_mm2,
      estimated_voltage_drop_v: cableResult.calculations?.predicted_voltage_drop_v,
      estimated_voltage_drop_pct: cableResult.calculations?.predicted_voltage_drop_pct,
      is_compliant: cableResult.calculations?.compliant,
      snapshot: cableResult,
    };

    if (!navigator.onLine) {
      let queued = [];
      try {
        queued = JSON.parse(localStorage.getItem(CABLE_QUEUE_KEY) || '[]');
      } catch {
        queued = [];
      }
      queued.push({ projectId: cableProjectId, payload, queuedAt: new Date().toISOString() });
      localStorage.setItem(CABLE_QUEUE_KEY, JSON.stringify(queued));
      toast.success('Saved offline. It will auto-sync when internet is back.');
      return;
    }

    try {
      await engineeringAPI.saveCableCompliance(cableProjectId, payload);
      toast.success('Cable compliance record saved');
    } catch {
      toast.error('Failed to save compliance record');
    }
  }

  const tabs = [
    { id: 'panel',   label: '☀️ Panel Value',        desc: 'Silver + Second-Life' },
    { id: 'battery', label: '🔋 Battery Value',       desc: 'Recycling + Second-Life' },
    { id: 'degrade', label: '📅 Decommission Date',   desc: 'West African Climate' },
    { id: 'roi',     label: '💼 Hybrid ROI',          desc: 'Proposal Payback Engine' },
    { id: 'soh',     label: '🧪 Battery SoH',         desc: 'Warranty Ledger Heuristic' },
    { id: 'cable',   label: '🧰 DC Cable Sizing',     desc: 'Voltage Drop Compliance' },
  ];

  return (
    <>
      <Head><title>Value Calculator — SolNuv</title></Head>

      <MotionSection className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-900 via-emerald-900 to-slate-900 text-white px-8 py-10 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_60%)]" />
        <div className="relative">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3 block">Engineering Suite</span>
          <h1 className="font-display font-bold text-3xl">Recovery Value Calculator</h1>
          <p className="text-white/70 text-sm mt-2 max-w-xl">
            Silver, refurbishment, battery recycling, ROI, cable compliance — all in one engineering toolkit.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/90 text-xs font-semibold border border-white/10">💡 ROI + SoH + Cable Compliance</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 text-xs font-semibold border border-amber-500/20">📶 Offline Ready — auto-syncs</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 text-xs font-semibold border border-emerald-500/20">📄 PDF Exports</span>
          </div>
        </div>
      </MotionSection>

      {/* Tabs */}
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-start h-full ${activeTab === t.id ? 'bg-forest-900 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-forest-900/30 hover:shadow-sm'}`}>
            <span>{t.label}</span>
            <span className={`text-xs font-normal ${activeTab === t.id ? 'text-white/70' : 'text-slate-400'}`}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Usage banner — Free plan only */}
      {usageData?.is_limited && (
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Free Plan Usage — {Object.values(usageData.usage || {}).reduce((a, b) => a + b, 0)} / 12 calculations used this month
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {['panel','battery','degradation','roi','battery-soh','cable-size'].map(t => {
                const used = usageData.usage?.[t] || 0;
                const labels = { panel: 'Panel', battery: 'Battery', degradation: 'Decommission', roi: 'ROI', 'battery-soh': 'SoH', 'cable-size': 'Cable' };
                return (
                  <span key={t} className={`text-xs ${used >= 2 ? 'text-red-600 font-semibold' : 'text-amber-600'}`}>
                    {labels[t]}: {used}/2{used >= 2 ? ' ✕' : ''}
                  </span>
                );
              })}
            </div>
          </div>
          <Link href="/plans" className="text-xs whitespace-nowrap font-semibold bg-forest-900 text-white px-3 py-2 rounded-lg hover:bg-forest-800 transition-colors">
            Upgrade to Pro →
          </Link>
        </div>
      )}

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

        {/* ── ROI / PROPOSAL ENGINE ───────────────────────────────────────── */}
        {activeTab === 'roi' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">Hybrid ROI Proposal Inputs</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">NERC Tariff Band</label>
                  <select className="input" value={roiForm.tariff_band} onChange={(e) => setRoiForm((f) => ({ ...f, tariff_band: e.target.value }))}>
                    {['A', 'B', 'C', 'D', 'E'].map((b) => <option key={b} value={b}>Band {b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tariff (N/kWh)</label>
                  <input type="number" className="input" value={roiForm.tariff_rate_ngn_per_kwh} onChange={(e) => setRoiForm((f) => ({ ...f, tariff_rate_ngn_per_kwh: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Generator Fuel Price (N/L)</label>
                  <input type="number" className="input" value={roiForm.generator_fuel_price_ngn_per_liter} onChange={(e) => setRoiForm((f) => ({ ...f, generator_fuel_price_ngn_per_liter: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Solar CAPEX (N)</label>
                  <input type="number" className="input" value={roiForm.proposed_solar_capex_ngn} onChange={(e) => setRoiForm((f) => ({ ...f, proposed_solar_capex_ngn: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Grid Offset (kWh/day)</label>
                  <input type="number" className="input" value={roiForm.projected_grid_kwh_offset_per_day} onChange={(e) => setRoiForm((f) => ({ ...f, projected_grid_kwh_offset_per_day: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Generator Offset (L/day)</label>
                  <input type="number" className="input" value={roiForm.projected_generator_liters_offset_per_day} onChange={(e) => setRoiForm((f) => ({ ...f, projected_generator_liters_offset_per_day: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="label">Annual O&M Cost (N)</label>
                <input type="number" className="input" value={roiForm.annual_om_cost_ngn} onChange={(e) => setRoiForm((f) => ({ ...f, annual_om_cost_ngn: Number(e.target.value) }))} />
              </div>
              <button onClick={runROI} disabled={loading} className="btn-primary w-full">
                {loading ? 'Calculating...' : 'Calculate ROI →'}
              </button>
            </div>

            <div className="space-y-4">
              {roiResult ? (
                <>
                  <div className="card">
                    <p className="text-xs font-semibold text-slate-400 mb-2">PAYBACK</p>
                    <p className="font-display text-4xl font-bold text-forest-900">{roiResult.investment_metrics?.payback_months || '-'} months</p>
                    <p className="text-sm text-slate-500 mt-1">~{roiResult.investment_metrics?.payback_years || '-'} years</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card">
                      <p className="text-xs text-slate-500">Annual Net Savings</p>
                      <p className="text-xl font-bold text-emerald-700">N{fmt(roiResult.annual_savings?.net_ngn)}</p>
                    </div>
                    <div className="card">
                      <p className="text-xs text-slate-500">10-Year Net Savings</p>
                      <p className="text-xl font-bold text-forest-900">N{fmt(roiResult.investment_metrics?.ten_year_net_savings_ngn)}</p>
                    </div>
                  </div>
                  <div className="card">
                    <p className="text-xs text-slate-500">10-Year ROI</p>
                    <p className="text-2xl font-bold text-forest-900">{roiResult.investment_metrics?.ten_year_roi_pct}%</p>
                  </div>
                  <button type="button" onClick={exportRoiPdf} className="btn-outline w-full">
                    Export Proposal PDF
                  </button>
                </>
              ) : (
                <div className="card flex items-center justify-center h-64 text-slate-300">
                  <p className="text-sm">Run ROI to generate proposal economics</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BATTERY SOH LEDGER HEURISTIC ─────────────────────────────────── */}
        {activeTab === 'soh' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">Battery SoH Inputs</h2>
              <div>
                <label className="label">Chemistry</label>
                <select className="input" value={sohForm.chemistry} onChange={(e) => setSohForm((f) => ({ ...f, chemistry: e.target.value }))}>
                  <option value="lithium-iron-phosphate">Lithium Iron Phosphate</option>
                  <option value="lithium">Lithium</option>
                  <option value="lead-acid">Lead Acid</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Installed Date</label>
                  <input type="date" className="input" value={sohForm.installation_date} onChange={(e) => setSohForm((f) => ({ ...f, installation_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Rated Capacity (kWh)</label>
                  <input type="number" className="input" value={sohForm.rated_capacity_kwh} onChange={(e) => setSohForm((f) => ({ ...f, rated_capacity_kwh: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Measured Capacity (kWh)</label>
                  <input type="number" className="input" value={sohForm.measured_capacity_kwh} onChange={(e) => setSohForm((f) => ({ ...f, measured_capacity_kwh: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Average DoD (%)</label>
                  <input type="number" className="input" value={sohForm.avg_depth_of_discharge_pct} onChange={(e) => setSohForm((f) => ({ ...f, avg_depth_of_discharge_pct: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cycles per Day</label>
                  <input type="number" className="input" value={sohForm.estimated_cycles_per_day} onChange={(e) => setSohForm((f) => ({ ...f, estimated_cycles_per_day: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Ambient Temp (°C)</label>
                  <input type="number" className="input" value={sohForm.ambient_temperature_c} onChange={(e) => setSohForm((f) => ({ ...f, ambient_temperature_c: Number(e.target.value) }))} />
                </div>
              </div>
              <button onClick={runSoh} disabled={loading} className="btn-primary w-full">
                {loading ? 'Calculating...' : 'Estimate SoH →'}
              </button>
            </div>

            <div className="space-y-4">
              {sohResult ? (
                <>
                  <div className="card">
                    <p className="text-xs text-slate-500">Estimated SoH</p>
                    <p className="font-display text-4xl font-bold text-forest-900">{sohResult.soh?.estimated_soh_pct}%</p>
                    <p className="text-sm text-slate-500 mt-1">Usable capacity: {sohResult.soh?.estimated_usable_capacity_kwh} kWh</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card">
                      <p className="text-xs text-slate-500">Total Cycles</p>
                      <p className="text-xl font-bold text-forest-900">{fmt(sohResult.cycle_model?.total_cycles)}</p>
                    </div>
                    <div className="card">
                      <p className="text-xs text-slate-500">Cumulative Damage</p>
                      <p className="text-xl font-bold text-amber-600">{sohResult.cycle_model?.cumulative_damage_pct}%</p>
                    </div>
                  </div>
                  <div className="card">
                    <p className="text-xs text-slate-500">Warranty Risk Flag</p>
                    <p className="text-sm font-semibold text-forest-900 mt-1">{sohResult.warranty_assessment?.risk_flag?.replace(/_/g, ' ')}</p>
                  </div>
                </>
              ) : (
                <div className="card flex items-center justify-center h-64 text-slate-300">
                  <p className="text-sm">Run SoH estimate to create warranty evidence</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DC CABLE SIZING / COMPLIANCE ─────────────────────────────────── */}
        {activeTab === 'cable' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">DC Cable Sizing Inputs</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Current (A)</label>
                  <input type="number" className="input" value={cableForm.current_amps} onChange={(e) => setCableForm((f) => ({ ...f, current_amps: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">One-way Length (m)</label>
                  <input type="number" className="input" value={cableForm.one_way_length_m} onChange={(e) => setCableForm((f) => ({ ...f, one_way_length_m: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">System Voltage (V)</label>
                  <input type="number" className="input" value={cableForm.system_voltage_v} onChange={(e) => setCableForm((f) => ({ ...f, system_voltage_v: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Allowable Drop (%)</label>
                  <input type="number" className="input" value={cableForm.allowable_voltage_drop_pct} onChange={(e) => setCableForm((f) => ({ ...f, allowable_voltage_drop_pct: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Conductor</label>
                  <select className="input" value={cableForm.conductor_material} onChange={(e) => setCableForm((f) => ({ ...f, conductor_material: e.target.value }))}>
                    <option value="copper">Copper</option>
                    <option value="aluminum">Aluminum</option>
                  </select>
                </div>
                <div>
                  <label className="label">Ambient Temp (°C)</label>
                  <input type="number" className="input" value={cableForm.ambient_temperature_c} onChange={(e) => setCableForm((f) => ({ ...f, ambient_temperature_c: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="label">Project ID (for sync/save)</label>
                <input type="text" className="input" placeholder="Paste project UUID" value={cableProjectId} onChange={(e) => setCableProjectId(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">If offline, records are queued in local storage and auto-synced when online.</p>
              </div>
              <button onClick={runCable} disabled={loading} className="btn-primary w-full">
                {loading ? 'Calculating...' : 'Calculate Cable Size →'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={exportCablePdf} className="btn-outline">Export Certificate PDF</button>
                <button type="button" onClick={saveCableComplianceRecord} className="btn-outline">Save/Queue Record</button>
              </div>
              {syncingQueue && <p className="text-xs text-emerald-600">Syncing offline queue...</p>}
            </div>

            <div className="space-y-4">
              {cableResult ? (
                <>
                  <div className="card">
                    <p className="text-xs text-slate-500">Recommended Cable Area</p>
                    <p className="font-display text-4xl font-bold text-forest-900">{cableResult.calculations?.recommended_standard_mm2} mm²</p>
                    <p className="text-xs text-slate-400 mt-1">Required minimum: {cableResult.calculations?.required_area_mm2} mm²</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card">
                      <p className="text-xs text-slate-500">Predicted Drop</p>
                      <p className="text-xl font-bold text-forest-900">{cableResult.calculations?.predicted_voltage_drop_v} V</p>
                    </div>
                    <div className="card">
                      <p className="text-xs text-slate-500">Drop Percentage</p>
                      <p className="text-xl font-bold text-forest-900">{cableResult.calculations?.predicted_voltage_drop_pct}%</p>
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 border ${cableResult.calculations?.compliant ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-sm font-semibold">{cableResult.calculations?.compliant ? 'Compliance PASS' : 'Compliance FAIL'}</p>
                    <p className="text-xs text-slate-600 mt-1">Use this result for on-site QA and compliance certificate records.</p>
                  </div>
                </>
              ) : (
                <div className="card flex items-center justify-center h-64 text-slate-300">
                  <p className="text-sm">Run cable sizing for compliance-ready output</p>
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
            <p className="font-semibold">From calculator to operations-grade engineering workflow</p>
            <p className="text-sm text-white/70 mt-0.5">Generate ROI proposals, monitor battery health, and produce cable compliance evidence for every project in your fleet.</p>
          </div>
          <Link href="/projects/add" className="btn-amber flex-shrink-0">Add a Project →</Link>
        </div>
      </div>
    </>
  );
}

Calculator.getLayout = getDashboardLayout;