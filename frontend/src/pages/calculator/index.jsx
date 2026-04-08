import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { calculatorAPI, engineeringAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { MotionSection } from '../../components/PageMotion';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// Format number with thousand separators, allow decimals
function formatWithCommas(value) {
  if (value === '' || value === undefined || value === null) return '';
  const str = String(value);
  if (str.endsWith('.') || /\.\d*0+$/.test(str)) {
    const parts = str.split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return intPart + '.' + (parts[1] || '');
  }
  const num = parseFloat(str);
  if (isNaN(num)) return str;
  const parts = str.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? intPart + '.' + parts[1] : intPart;
}

function stripCommas(value) {
  return String(value).replace(/,/g, '');
}

function NumericInput({ value, onChange, className = 'input', ...props }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={formatWithCommas(value)}
      onChange={e => {
        const raw = stripCommas(e.target.value);
        if (raw === '' || /^-?\d*\.?\d*$/.test(raw)) {
          onChange(raw);
        }
      }}
      {...props}
    />
  );
}

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
  const [technologies, setTechnologies] = useState({ panel_technologies: [], battery_chemistries: [] });
  const [usageData, setUsageData] = useState(null);

  const [panelForm, setPanelForm] = useState({
    size_watts: 400, quantity: 10,
    installation_date: '2018-01-01',
    climate_zone: 'coastal_humid',
    condition: 'good',
    panel_technology: 'mono_perc',
    cleaning_frequency: 'monthly',
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

  const [degradForm, setDegradForm] = useState({ state: 'Lagos', installation_date: '2021-01-01', panel_technology: null });
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
  const roiRef = useRef(null);
  const cableRef = useRef(null);
  const motorRef = useRef(null);
  const gfmRef = useRef(null);
  const tddRef = useRef(null);

  const [motorForm, setMotorForm] = useState({
    motor_power_kw: 200, motor_voltage_v: 400, start_method: 'dol',
    num_motors: 1, source_capacity_kva: 1000, bess_capacity_kwh: 500,
    bess_power_kw: 250, inverter_topology: 'gfl',
  });
  const [motorResult, setMotorResult] = useState(null);

  const [gfmForm, setGfmForm] = useState({
    project_name: '',
    load_kw: 500,
    start_load_kw: 300,
    duration_sec: 30,
    grid_availability: 'primary', // primary, backup, isolated
    critical_load_pct: 30,
    require_black_start: false,
    budget_ngn: 50000000,
  });
  const [gfmRecommendations, setGfmRecommendations] = useState(null);

  const [tddForm, setTddForm] = useState({
    project_name: '',
    company_name: '',
    inverter_brand: '',
    inverter_model: '',
    inverter_power_kw: 250,
    inverter_topology: 'gfl',
    bess_capacity_kwh: 500,
    bess_power_kw: 250,
    panel_capacity_kwp: 400,
    transformer_kva: 500,
    grid_connection_kv: 0.4,
    site_address: '',
    commissioning_date: '',
  });
  const [tddReport, setTddReport] = useState(null);

  const CABLE_QUEUE_KEY = 'solnuv_cable_sync_queue_v1';

  useEffect(() => {
    calculatorAPI.getBrands()
      .then(r => setBrands(r.data.data || { panels: [], batteries: [] }))
      .catch(() => {});

    calculatorAPI.getTechnologies()
      .then(r => setTechnologies(r.data.data || { panel_technologies: [], battery_chemistries: [] }))
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

  function runMotor() {
    const { motor_power_kw, motor_voltage_v, start_method, num_motors, source_capacity_kva, bess_power_kw, inverter_topology } = motorForm;
    const lockedRotorAmps = (motor_power_kw * 1000) / (motor_voltage_v * Math.sqrt(3)) * 6.5;
    const startCurrent = start_method === 'dol' ? lockedRotorAmps : start_method === 'soft_start' ? lockedRotorAmps * 0.65 : lockedRotorAmps * 0.5;
    const voltageDipPct = Math.min((startCurrent * num_motors / source_capacity_kva) * 30, 50);
    const voltageDuringStart = 100 - voltageDipPct;
    const transientCapacity = inverter_topology === 'gfm' ? bess_power_kw * 1.5 : bess_power_kw * 1.1;
    const needsGfm = motor_power_kw > 50 || start_method === 'dol' || voltageDuringStart < 85;
    const riskLevel = voltageDuringStart < 80 ? 'HIGH' : voltageDuringStart < 90 ? 'MEDIUM' : 'LOW';
    setMotorResult({
      calculations: { start_current_amps: startCurrent.toFixed(0), voltage_during_start_v: voltageDuringStart.toFixed(0), voltage_dip_pct: voltageDipPct.toFixed(1), transient_capacity_kw: transientCapacity.toFixed(0) },
      assessment: { needs_gfm: needsGfm, topology_recommendation: needsGfm ? 'GFM Required' : 'GFL Acceptable', risk_level: riskLevel },
    });
  }

  function runGfmSelector() {
    const { load_kw, start_load_kw, duration_sec, grid_availability, critical_load_pct, require_black_start, budget_ngn } = gfmForm;
    
    // GFM requirements analysis
    const basePowerKw = load_kw * 1.2;
    const startBuffer = start_load_kw > load_kw * 0.3 ? 1.5 : 1.2;
    const recommendedPowerKw = basePowerKw * startBuffer;
    const recommendedCapacityKwh = recommendedPowerKw * 4;
    
    // Grid availability factor
    const gridFactor = grid_availability === 'isolated' ? 1.5 : grid_availability === 'backup' ? 1.25 : 1.0;
    const adjustedPowerKw = recommendedPowerKw * gridFactor;
    
    // Black start premium
    const blackStartPremium = require_black_start ? 1.3 : 1.0;
    const finalPowerKw = adjustedPowerKw * blackStartPremium;
    let finalCapacityKwh = finalPowerKw * (require_black_start ? 6 : 4);
    
    // Budget check
    const estimatedCostNgn = finalPowerKw * 150000 + finalCapacityKwh * 80000;
    const withinBudget = estimatedCostNgn <= budget_ngn;
    
    // Brand recommendations based on power class
    const brands = finalPowerKw > 500 ? [
      { brand: 'Huawei', model: ' Luna2000-200KTL', capacity: finalPowerKw, priceIndex: 1.0, features: ['GFM', 'Black Start', 'Grid Forming'] },
      { brand: 'Sungrow', model: 'SG250HX', capacity: finalPowerKw, priceIndex: 0.95, features: ['GFM', 'Grid Forming'] },
      { brand: 'Schneider', model: 'Conext XW Pro', capacity: finalPowerKw * 0.8, priceIndex: 1.2, features: ['GFM', 'Black Start'] },
    ] : finalPowerKw > 200 ? [
      { brand: 'Victron', model: 'Quattro', capacity: finalPowerKw, priceIndex: 1.1, features: ['GFM', 'Black Start'] },
      { brand: 'SMA', model: 'Sunny Storage', capacity: finalPowerKw, priceIndex: 1.0, features: ['GFM', 'Grid Forming'] },
      { brand: 'GoodWe', model: 'Lynx F G', capacity: finalPowerKw * 0.9, priceIndex: 0.85, features: ['GFM'] },
    ] : [
      { brand: 'Growatt', model: 'SPF 5000ES', capacity: finalPowerKw, priceIndex: 0.7, features: ['GFM'] },
      { brand: 'Deye', model: 'SUN-5KG', capacity: finalPowerKw * 0.8, priceIndex: 0.65, features: ['GFL Upgrade Available'] },
      { brand: 'Luxpower', model: 'WKS INV', capacity: finalPowerKw, priceIndex: 0.75, features: ['GFM'] },
    ];
    
    setGfmRecommendations({
      input: { ...gfmForm },
      specifications: {
        recommended_power_kw: Math.ceil(finalPowerKw),
        recommended_capacity_kwh: Math.ceil(finalCapacityKwh),
        min_transient_kw: Math.ceil(start_load_kw * 1.5),
        min_transient_duration_sec: duration_sec,
      },
      budget: {
        estimated_cost_ngn: Math.round(estimatedCostNgn),
        budget_ngn: budget_ngn,
        within_budget: withinBudget,
        gap_ngn: Math.round(estimatedCostNgn - budget_ngn),
      },
      brands: brands,
      notes: [
        `GFM required for ${grid_availability} grid with ${critical_load_pct}% critical load`,
        require_black_start ? 'Black start capability mandatory for islanded operation' : null,
        `System sized for ${duration_sec}s transient support at ${start_load_kw} kW`,
        withinBudget ? 'Within budget' : `Exceeds budget by ₦${Math.round((estimatedCostNgn - budget_ngn)/1000000)}M`,
      ].filter(Boolean),
    });
  }

  function runTddReport() {
    const { inverter_brand, inverter_model, inverter_power_kw, inverter_topology, bess_capacity_kwh, bess_power_kw, panel_capacity_kwp, transformer_kva, grid_connection_kv } = tddForm;
    
    // Technical compliance checks
    const checks = [];
    
    // GFM topology check
    if (inverter_topology !== 'gfm') {
      checks.push({ item: 'Inverter Topology', status: 'FAIL', message: `${inverter_brand} ${inverter_model} is ${inverter_topology.toUpperCase()}. GFM required for microgrid stability.` });
    } else {
      checks.push({ item: 'Inverter Topology', status: 'PASS', message: 'Grid-Forming inverter specified.' });
    }
    
    // BESS power ratio
    const bessRatio = bess_power_kw / inverter_power_kw;
    if (bessRatio < 1.0) {
      checks.push({ item: 'BESS Power Ratio', status: 'FAIL', message: `BESS power (${bess_power_kw}kW) is ${(bessRatio*100).toFixed(0)}% of inverter. Minimum 100% required.` });
    } else {
      checks.push({ item: 'BESS Power Ratio', status: 'PASS', message: `BESS/inverter ratio: ${(bessRatio*100).toFixed(0)}%` });
    }
    
    // BESS duration
    const duration = bess_capacity_kwh / bess_power_kw;
    if (duration < 2) {
      checks.push({ item: 'BESS Duration', status: 'FAIL', message: `${duration.toFixed(1)}h duration. Minimum 2h recommended for C&I.` });
    } else {
      checks.push({ item: 'BESS Duration', status: 'PASS', message: `${duration.toFixed(1)}h duration adequate.` });
    }
    
    // Transformer sizing
    const maxGen = panel_capacity_kwp * 0.8;
    if (transformer_kva < maxGen * 1.2) {
      checks.push({ item: 'Transformer Sizing', status: 'WARN', message: `${transformer_kva}kVA may be undersized for ${panel_capacity_kwp}kWp. Recommend ${Math.ceil(maxGen * 1.2)}kVA.` });
    } else {
      checks.push({ item: 'Transformer Sizing', status: 'PASS', message: `${transformer_kva}kVA adequate for ${panel_capacity_kwp}kWp.` });
    }
    
    // Voltage compatibility
    if (grid_connection_kv > 1 && inverter_power_kw > 500) {
      checks.push({ item: 'MV Connection', status: 'WARN', message: 'Medium voltage connection requires MV switchgear and protection.' });
    }
    
    const passCount = checks.filter(c => c.status === 'PASS').length;
    const failCount = checks.filter(c => c.status === 'FAIL').length;
    const warnCount = checks.filter(c => c.status === 'WARN').length;
    const overallStatus = failCount === 0 ? 'PASS' : 'FAIL';
    
    setTddReport({
      project_info: { ...tddForm },
      assessment_date: new Date().toISOString().split('T')[0],
      checks: checks,
      summary: { pass: passCount, fail: failCount, warn: warnCount, overall: overallStatus },
      risk_factors: checks.filter(c => c.status === 'FAIL').map(c => c.item),
      recommendations: [
        failCount > 0 ? 'Address all FAIL items before financial close' : null,
        inverter_topology === 'gfl' ? 'Upgrade to GFM inverter for microgrid operation' : null,
        warnCount > 0 ? 'Review WARN items with EPC contractor' : null,
        'Obtain OEM technical datasheets for all equipment',
        'Verify warranty terms and service agreements',
      ].filter(Boolean),
    });
  }

  async function exportRoiPdf() {
    if (!roiResult || !roiRef.current) return;
    try {
      const { exportToPdf } = await import('../../utils/pdfExport');
      await exportToPdf(roiRef.current, `SolNuv_Hybrid_ROI_Proposal_${Date.now()}.pdf`);
    } catch {
      toast.error('Failed to export ROI PDF');
    }
  }

  async function exportCablePdf() {
    if (!cableResult || !cableRef.current) return;
    try {
      const { exportToPdf } = await import('../../utils/pdfExport');
      await exportToPdf(cableRef.current, `SolNuv_Cable_Compliance_${Date.now()}.pdf`);
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
    { id: 'motor',   label: '⚡ Motor Starting',       desc: 'Inductive Load Analysis' },
    { id: 'gfm',     label: '🔋 GFM Selector',         desc: 'Grid-Forming Inverter Sizing' },
    { id: 'tdd',     label: '📋 TDD Report',          desc: 'Technical Due Diligence' },
  ];

  return (
    <>
      <Head><title>Solar Value Calculator — SolNuv</title></Head>

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

      {/* Usage banner — Free tier only */}
      {usageData?.is_limited && (
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {usageData.plan === 'free' ? 'Free Tier' : 'Basic Plan'} Usage — {usageData.total_used ?? Object.values(usageData.usage || {}).reduce((a, b) => a + b, 0)} / {usageData.total_limit ?? (usageData.plan === 'free' ? 6 : 54)} calculations used this month
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {usageData.plan === 'free'
                ? 'Subscribe to Basic or higher for more calculator access, simulations, and AI support.'
                : 'Upgrade to Pro for unlimited calculator access, simulations, and advanced AI tools.'}
            </p>
          </div>
          <Link href="/plans" className="text-xs whitespace-nowrap font-semibold bg-forest-900 text-white px-3 py-2 rounded-lg hover:bg-forest-800 transition-colors">
            View Plans →
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
                <label className="label">Panel Technology</label>
                <select className="input" value={panelForm.panel_technology}
                  onChange={e => setPanelForm(f => ({ ...f, panel_technology: e.target.value || null }))}>
                  <option value="">— Unknown / Era-based estimate —</option>
                  {['p-type','n-type','thin-film'].map(group => {
                    const opts = technologies.panel_technologies.filter(t => t.group === group);
                    if (!opts.length) return null;
                    return (
                      <optgroup key={group} label={group === 'p-type' ? 'p-type Silicon' : group === 'n-type' ? 'n-type Silicon' : 'Thin Film'}>
                        {opts.map(t => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                {panelForm.panel_technology && (() => {
                  const t = technologies.panel_technologies.find(x => x.key === panelForm.panel_technology);
                  return t ? (
                    <p className="text-xs text-slate-400 mt-1">
                      {t.deg_rate_pct_yr}%/yr degradation · {t.temp_coeff_pct_c}%/°C temp coeff
                      {t.bifacial ? ' · bifacial' : ''}
                      {t.silver_mg_per_wp === 0 ? ' · no silver' : ` · ${t.silver_mg_per_wp}mg/Wp silver`}
                    </p>
                  ) : null;
                })()}
              </div>

              <div>
                <label className="label">Panel Condition</label>
                <select className="input" value={panelForm.condition}
                  onChange={e => setPanelForm(f => ({ ...f, condition: e.target.value }))}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Cleaning Frequency</label>
                <select className="input" value={panelForm.cleaning_frequency}
                  onChange={e => setPanelForm(f => ({ ...f, cleaning_frequency: e.target.value }))}>
                  <option value="daily">Daily — staffed commercial / utility site</option>
                  <option value="weekly">Weekly — well-maintained residential</option>
                  <option value="monthly">Monthly — typical maintained install</option>
                  <option value="quarterly">Quarterly — common reality, many Nigeria sites</option>
                  <option value="rarely">Rarely / Uncleaned — worst-case soiling</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">Harmattan deposits reduce output between cleanings — especially for Sahel and mixed-zone sites.</p>
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
                    {panelResult.panel_health?.temp_derating_factor != null && panelResult.panel_health.temp_derating_factor < 1.0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        🌡️ At 40°C ambient (65°C cell): effective output ~{Math.round(panelResult.panel_health.temp_derating_factor * 100)}% of rated
                        {panelResult.panel_health?.effective_output_watts ? ` = ${panelResult.panel_health.effective_output_watts}W real-world per panel` : ''}.
                      </p>
                    )}
                    {panelResult.panel_health?.soiling_factor != null && panelResult.panel_health.soiling_loss_pct > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className="text-xs text-orange-600">
                          🌫️ Dust/harmattan soiling: ~{panelResult.panel_health.soiling_loss_pct}% output loss with current cleaning schedule
                          {panelResult.panel_health?.soiling_adjusted_output_watts ? ` → ${panelResult.panel_health.soiling_adjusted_output_watts}W real-world output per panel` : ''}.
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">Soiling is reversible — cleaning fully restores output and does not affect panel resale value.</p>
                      </div>
                    )}
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
          <div className="grid md:grid-cols-2 gap-6" ref={roiRef}>
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">Hybrid ROI Proposal Inputs</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">NERC Tariff Band</label>
                  <select className="input" value={roiForm.tariff_band} onChange={(e) => setRoiForm((f) => ({ ...f, tariff_band: e.target.value }))}>
                    {['A', 'B', 'C', 'D', 'E'].map((b) => <option key={b} value={b}>Band {b}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Band A = highest-supply customers; Band E = lowest. Affects your baseline tariff estimate.</p>
                </div>
                <div>
                  <label className="label">Tariff (N/kWh)</label>
                  <NumericInput value={roiForm.tariff_rate_ngn_per_kwh} onChange={(v) => setRoiForm((f) => ({ ...f, tariff_rate_ngn_per_kwh: Number(v) || 0 }))} />
                  <p className="text-xs text-gray-400 mt-1">Your actual NERC-billed rate per kWh from your electricity bill.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Generator Fuel Price (N/L)</label>
                  <NumericInput value={roiForm.generator_fuel_price_ngn_per_liter} onChange={(v) => setRoiForm((f) => ({ ...f, generator_fuel_price_ngn_per_liter: Number(v) || 0 }))} />
                  <p className="text-xs text-gray-400 mt-1">Current diesel pump price at the site in ₦/litre.</p>
                </div>
                <div>
                  <label className="label">Solar CAPEX (N)</label>
                  <NumericInput value={roiForm.proposed_solar_capex_ngn} onChange={(v) => setRoiForm((f) => ({ ...f, proposed_solar_capex_ngn: Number(v) || 0 }))} />
                  <p className="text-xs text-gray-400 mt-1">Total installed cost of the proposed solar+BESS system.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Grid Offset (kWh/day)</label>
                  <input type="number" className="input" value={roiForm.projected_grid_kwh_offset_per_day} onChange={(e) => setRoiForm((f) => ({ ...f, projected_grid_kwh_offset_per_day: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Estimated daily kWh the solar system will offset from grid supply.</p>
                </div>
                <div>
                  <label className="label">Generator Offset (L/day)</label>
                  <input type="number" className="input" value={roiForm.projected_generator_liters_offset_per_day} onChange={(e) => setRoiForm((f) => ({ ...f, projected_generator_liters_offset_per_day: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Litres of diesel per day the solar system will displace.</p>
                </div>
              </div>
              <div>
                <label className="label">Annual O&M Cost (N)</label>
                <NumericInput value={roiForm.annual_om_cost_ngn} onChange={(v) => setRoiForm((f) => ({ ...f, annual_om_cost_ngn: Number(v) || 0 }))} />
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
                  <optgroup label="Lithium">
                    <option value="lfp">LiFePO4 — Lithium Iron Phosphate</option>
                    <option value="nmc">NMC — Nickel Manganese Cobalt</option>
                    <option value="nca">NCA — Nickel Cobalt Aluminium (Tesla)</option>
                    <option value="lto">LTO — Lithium Titanate</option>
                  </optgroup>
                  <optgroup label="Lead Acid">
                    <option value="lead_acid_agm">Lead Acid — AGM (Sealed)</option>
                    <option value="lead_acid_gel">Lead Acid — Gel (Sealed)</option>
                    <option value="lead_acid_flooded">Lead Acid — Flooded (VRLA-FLA)</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="nicd">NiCd — Nickel Cadmium (Legacy)</option>
                  </optgroup>
                  <optgroup label="Legacy aliases">
                    <option value="lithium-iron-phosphate">Lithium Iron Phosphate (old key)</option>
                    <option value="lithium">Lithium (generic, old key)</option>
                    <option value="lead-acid">Lead Acid (generic, old key)</option>
                  </optgroup>
                </select>
                {(() => {
                  const chem = technologies.battery_chemistries.find(c => c.key === sohForm.chemistry);
                  return chem ? (
                    <p className="text-xs text-slate-400 mt-1">
                      Rec. DoD: {chem.recommended_dod_pct}% · RTE: {chem.round_trip_eff_pct}% · ~{chem.cycle_life_ref.toLocaleString()} cycles @ {chem.reference_dod_pct}% DoD
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Installed Date</label>
                  <input type="date" className="input" value={sohForm.installation_date} onChange={(e) => setSohForm((f) => ({ ...f, installation_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Rated Capacity (kWh)</label>
                  <input type="number" className="input" value={sohForm.rated_capacity_kwh} onChange={(e) => setSohForm((f) => ({ ...f, rated_capacity_kwh: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Original nameplate energy capacity when the battery was new.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Measured Capacity (kWh)</label>
                  <input type="number" className="input" value={sohForm.measured_capacity_kwh} onChange={(e) => setSohForm((f) => ({ ...f, measured_capacity_kwh: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Current usable capacity from a full charge-discharge test. Leave 0 to estimate from cycles.</p>
                </div>
                <div>
                  <label className="label">Average DoD (%)</label>
                  <input type="number" className="input" value={sohForm.avg_depth_of_discharge_pct} onChange={(e) => setSohForm((f) => ({ ...f, avg_depth_of_discharge_pct: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">How deeply the battery is discharged per cycle on average. Deeper cycles = faster degradation.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cycles per Day</label>
                  <input type="number" className="input" value={sohForm.estimated_cycles_per_day} onChange={(e) => setSohForm((f) => ({ ...f, estimated_cycles_per_day: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Number of charge/discharge cycles per day. Most residential/C&I systems: 1–1.5 cycles/day.</p>
                </div>
                <div>
                  <label className="label">Ambient Temp (°C)</label>
                  <input type="number" className="input" value={sohForm.ambient_temperature_c} onChange={(e) => setSohForm((f) => ({ ...f, ambient_temperature_c: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Average battery room/enclosure temperature. High temps (&gt;35°C) accelerate degradation.</p>
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
                  {sohResult.cycle_model?.round_trip_efficiency_pct != null && (
                    <div className="card">
                      <p className="text-xs text-slate-500">Round-Trip Efficiency</p>
                      <p className="text-xl font-bold text-forest-900">{sohResult.cycle_model.round_trip_efficiency_pct}%</p>
                    </div>
                  )}
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
          <div className="grid md:grid-cols-2 gap-6" ref={cableRef}>
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">DC Cable Sizing Inputs</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Current (A)</label>
                  <input type="number" className="input" value={cableForm.current_amps} onChange={(e) => setCableForm((f) => ({ ...f, current_amps: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Maximum continuous DC current the cable must carry (e.g. string Isc × 1.25).</p>
                </div>
                <div>
                  <label className="label">One-way Length (m)</label>
                  <input type="number" className="input" value={cableForm.one_way_length_m} onChange={(e) => setCableForm((f) => ({ ...f, one_way_length_m: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Distance from panel/string to combiner or inverter — one way only (return is calculated).</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">System Voltage (V)</label>
                  <input type="number" className="input" value={cableForm.system_voltage_v} onChange={(e) => setCableForm((f) => ({ ...f, system_voltage_v: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Nominal DC bus voltage (e.g. 48V off-grid, 600V or 1000V string).</p>
                </div>
                <div>
                  <label className="label">Allowable Drop (%)</label>
                  <input type="number" className="input" value={cableForm.allowable_voltage_drop_pct} onChange={(e) => setCableForm((f) => ({ ...f, allowable_voltage_drop_pct: Number(e.target.value) }))} />
                  <p className="text-xs text-gray-400 mt-1">Max acceptable voltage drop. IEC/NEC standard: ≤1.5% DC; ≤2% AC. Lower = more yield.</p>
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
                  <p className="text-xs text-gray-400 mt-1">Installation site temperature for derating the cable ampacity. Conduit in Nigerian sun can reach 60°C+.</p>
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

              <div>
                <label className="label">Panel Technology <span className="text-slate-400 font-normal">(optional)</span></label>
                <select className="input" value={degradForm.panel_technology || ''}
                  onChange={e => setDegradForm(f => ({ ...f, panel_technology: e.target.value || null }))}>
                  <option value="">— Unknown / Climate-based estimate —</option>
                  {['p-type','n-type','thin-film'].map(group => {
                    const opts = technologies.panel_technologies.filter(t => t.group === group);
                    if (!opts.length) return null;
                    return (
                      <optgroup key={group} label={group === 'p-type' ? 'p-type Silicon' : group === 'n-type' ? 'n-type Silicon' : 'Thin Film'}>
                        {opts.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </optgroup>
                    );
                  })}
                </select>
                <p className="text-xs text-slate-400 mt-1">Technology-specific degradation rates improve accuracy.</p>
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
                    {degradResult.panel_technology_label && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Panel Technology</span>
                        <span className="font-semibold text-forest-900">{degradResult.panel_technology_label}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Expected Lifespan</span>
                      <span className="font-semibold text-forest-900">{degradResult.years_expected} years</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed pt-1 border-t border-slate-100">
                      {degradResult.explanation}
                    </p>

                    {/* Climate stressor breakdown */}
                    {degradResult.climate_stressors && (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Climate Stressors
                          {degradResult.primary_stressor && (
                            <span className="ml-2 font-normal normal-case text-slate-400">
                              · Primary: <span className="font-semibold capitalize text-slate-600">{degradResult.primary_stressor}</span>
                            </span>
                          )}
                        </p>
                        {Object.entries(degradResult.climate_stressors).map(([key, s]) => (
                          <div key={key} className="flex items-start gap-2">
                            <span className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-xs font-bold leading-none flex-shrink-0 ${
                              s.severity === 'severe'   ? 'bg-red-100 text-red-700' :
                              s.severity === 'high'     ? 'bg-orange-100 text-orange-700' :
                              s.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                                                          'bg-slate-100 text-slate-500'}`}>
                              {s.severity.toUpperCase()}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-slate-700 capitalize">{key} (×{s.factor})</p>
                              <p className="text-xs text-slate-400">{s.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-blue-600 font-medium">vs. OEM Warranty (20–25 years)</p>
                      <p className="text-xs text-blue-500 mt-1">
                        Standard panels are rated for 20–25 years. In West African conditions, expect 7–12 years. Our algorithm uses local climate data, not the factory default.
                      </p>
                    </div>

                    {/* Maintenance recommendations */}
                    {degradResult.maintenance_recommendations?.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Maintenance Recommendations</p>
                        <ul className="space-y-1.5">
                          {degradResult.maintenance_recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                              <span className="text-emerald-500 flex-shrink-0 mt-0.5">✓</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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

        {/* MOTOR STARTING ANALYZER */}
        {activeTab === 'motor' && (
          <div className="grid md:grid-cols-2 gap-6" ref={motorRef}>
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">Motor Starting Analysis</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Motor Power (kW)</label>
                  <input type="number" className="input" value={motorForm.motor_power_kw} onChange={e => setMotorForm(f => ({ ...f, motor_power_kw: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Voltage</label>
                  <select className="input" value={motorForm.motor_voltage_v} onChange={e => setMotorForm(f => ({ ...f, motor_voltage_v: Number(e.target.value) }))}>
                    <option value={400}>400V</option>
                    <option value={690}>690V</option>
                    <option value={11000}>11kV</option>
                  </select>
                </div>
                <div>
                  <label className="label">Start Method</label>
                  <select className="input" value={motorForm.start_method} onChange={e => setMotorForm(f => ({ ...f, start_method: e.target.value }))}>
                    <option value="dol">DOL</option>
                    <option value="soft_start">Soft Start</option>
                    <option value="vfd">VFD</option>
                  </select>
                </div>
                <div>
                  <label className="label">Motors</label>
                  <input type="number" className="input" value={motorForm.num_motors} onChange={e => setMotorForm(f => ({ ...f, num_motors: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Grid (kVA)</label>
                  <input type="number" className="input" value={motorForm.source_capacity_kva} onChange={e => setMotorForm(f => ({ ...f, source_capacity_kva: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">BESS (kW)</label>
                  <input type="number" className="input" value={motorForm.bess_power_kw} onChange={e => setMotorForm(f => ({ ...f, bess_power_kw: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">BESS (kWh)</label>
                  <input type="number" className="input" value={motorForm.bess_capacity_kwh} onChange={e => setMotorForm(f => ({ ...f, bess_capacity_kwh: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Inverter</label>
                  <select className="input" value={motorForm.inverter_topology} onChange={e => setMotorForm(f => ({ ...f, inverter_topology: e.target.value }))}>
                    <option value="gfl">GFL</option>
                    <option value="gfm">GFM</option>
                  </select>
                </div>
              </div>
              <button onClick={runMotor} className="btn-primary w-full">Analyze</button>
            </div>
            <div className="space-y-4">
              {motorResult && (
                <>
                  <div className={`p-4 rounded-xl border ${motorResult.assessment.risk_level === 'LOW' ? 'bg-emerald-50 border-emerald-200' : motorResult.assessment.risk_level === 'MEDIUM' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="font-semibold">Risk: {motorResult.assessment.risk_level}</p>
                    <p className="text-sm text-slate-600">{motorResult.assessment.topology_recommendation}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card"><p className="text-xs text-slate-500">Start Current</p><p className="font-bold">{motorResult.calculations?.start_current_amps} A</p></div>
                    <div className="card"><p className="text-xs text-slate-500">Voltage</p><p className="font-bold">{motorResult.calculations?.voltage_during_start_v} V</p></div>
                    <div className="card"><p className="text-xs text-slate-500">Dip</p><p className="font-bold text-amber-600">{motorResult.calculations?.voltage_dip_pct}%</p></div>
                    <div className="card"><p className="text-xs text-slate-500">Transient</p><p className="font-bold">{motorResult.calculations?.transient_capacity_kw} kW</p></div>
                  </div>
                </>
              )}
              {!motorResult && <div className="card flex items-center justify-center h-64 text-slate-300"><p className="text-sm">Enter specs and analyze</p></div>}
            </div>
          </div>
        )}

        {/* ── GFM INVERTER SELECTOR ─────────────────────────────────────────────── */}
        {activeTab === 'gfm' && (
          <div className="grid md:grid-cols-2 gap-6" ref={gfmRef}>
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">GFM Inverter Selector</h2>
              <p className="text-xs text-slate-500">Size Grid-Forming inverter and BESS for microgrid applications</p>
              
              <div>
                <label className="label">Project Name</label>
                <input type="text" className="input" value={gfmForm.project_name} onChange={e => setGfmForm(f => ({ ...f, project_name: e.target.value }))} placeholder="e.g., Mining Site A" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Base Load (kW)</label>
                  <input type="number" className="input" value={gfmForm.load_kw} onChange={e => setGfmForm(f => ({ ...f, load_kw: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Max Start Load (kW)</label>
                  <input type="number" className="input" value={gfmForm.start_load_kw} onChange={e => setGfmForm(f => ({ ...f, start_load_kw: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Transient Duration (s)</label>
                  <input type="number" className="input" value={gfmForm.duration_sec} onChange={e => setGfmForm(f => ({ ...f, duration_sec: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Grid Availability</label>
                  <select className="input" value={gfmForm.grid_availability} onChange={e => setGfmForm(f => ({ ...f, grid_availability: e.target.value }))}>
                    <option value="primary">Primary Grid</option>
                    <option value="backup">Backup/Secondary</option>
                    <option value="isolated">Isolated/Off-grid</option>
                  </select>
                </div>
                <div>
                  <label className="label">Critical Load (%)</label>
                  <input type="number" className="input" value={gfmForm.critical_load_pct} onChange={e => setGfmForm(f => ({ ...f, critical_load_pct: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Budget (₦)</label>
                  <input type="number" className="input" value={gfmForm.budget_ngn} onChange={e => setGfmForm(f => ({ ...f, budget_ngn: Number(e.target.value) }))} />
                </div>
              </div>
              
              <label className="flex items-center gap-2">
                <input type="checkbox" className="checkbox" checked={gfmForm.require_black_start} onChange={e => setGfmForm(f => ({ ...f, require_black_start: e.target.checked }))} />
                <span className="text-sm">Require Black Start Capability</span>
              </label>
              
              <button onClick={runGfmSelector} className="btn-primary w-full">Get Recommendations</button>
            </div>
            
            <div className="space-y-4">
              {gfmRecommendations && (
                <>
                  <div className="card bg-gradient-to-br from-forest-50 to-emerald-50 border-forest-200">
                    <p className="text-xs font-semibold text-forest-600 mb-2">Recommended Specifications</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><p className="text-xs text-slate-500">Inverter Power</p><p className="font-bold text-forest-900">{gfmRecommendations.specifications.recommended_power_kw} kW</p></div>
                      <div><p className="text-xs text-slate-500">BESS Capacity</p><p className="font-bold text-forest-900">{gfmRecommendations.specifications.recommended_capacity_kwh} kWh</p></div>
                    </div>
                    <p className="text-xs text-slate-500">Transient: {gfmRecommendations.specifications.min_transient_kw} kW for {gfmRecommendations.specifications.min_transient_duration_sec}s</p>
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${gfmRecommendations.budget.within_budget ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="font-semibold">Budget: {gfmRecommendations.budget.within_budget ? 'Within' : 'Exceeds'}</p>
                    <p className="text-sm">Est. ₦{gfmRecommendations.budget.estimated_cost_ngn.toLocaleString()} vs ₦{gfmRecommendations.budget.budget_ngn.toLocaleString()}</p>
                  </div>
                  
                  <div className="card">
                    <p className="text-xs font-semibold text-slate-600 mb-3">Recommended GFM Inverters</p>
                    {gfmRecommendations.brands.map((b, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <div>
                          <p className="font-semibold text-sm">{b.brand}{b.model}</p>
                          <p className="text-xs text-slate-500">{b.capacity} kW | {b.features.join(', ')}</p>
                        </div>
                        <span className="text-xs bg-forest-100 text-forest-700 px-2 py-1 rounded">x{b.priceIndex}</span>
                      </div>
                    ))}
                  </div>
                  
                  {gfmRecommendations.notes.map((n, i) => (
                    <p key={i} className="text-xs text-slate-600">• {n}</p>
                  ))}
                </>
              )}
              {!gfmRecommendations && (
                <div className="card flex items-center justify-center h-64 text-slate-300"><p className="text-sm">Enter project specs for GFM recommendations</p></div>
              )}
            </div>
          </div>
        )}

        {/* ── TDD REPORT ────────────────────────────────────────────────────────── */}
        {activeTab === 'tdd' && (
          <div className="grid md:grid-cols-2 gap-6" ref={tddRef}>
            <div className="card space-y-4">
              <h2 className="font-semibold text-forest-900">Technical Due Diligence Report</h2>
              <p className="text-xs text-slate-500">Bank-ready technical assessment for C&I microgrid financing</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Project Name</label>
                  <input type="text" className="input" value={tddForm.project_name} onChange={e => setTddForm(f => ({ ...f, project_name: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Company</label>
                  <input type="text" className="input" value={tddForm.company_name} onChange={e => setTddForm(f => ({ ...f, company_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Inverter Brand</label>
                  <input type="text" className="input" value={tddForm.inverter_brand} onChange={e => setTddForm(f => ({ ...f, inverter_brand: e.target.value }))} placeholder="e.g., Huawei" />
                </div>
                <div>
                  <label className="label">Inverter Model</label>
                  <input type="text" className="input" value={tddForm.inverter_model} onChange={e => setTddForm(f => ({ ...f, inverter_model: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Inverter Power (kW)</label>
                  <input type="number" className="input" value={tddForm.inverter_power_kw} onChange={e => setTddForm(f => ({ ...f, inverter_power_kw: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Topology</label>
                  <select className="input" value={tddForm.inverter_topology} onChange={e => setTddForm(f => ({ ...f, inverter_topology: e.target.value }))}>
                    <option value="gfl">GFL (Grid-Following)</option>
                    <option value="gfm">GFM (Grid-Forming)</option>
                  </select>
                </div>
                <div>
                  <label className="label">BESS Capacity (kWh)</label>
                  <input type="number" className="input" value={tddForm.bess_capacity_kwh} onChange={e => setTddForm(f => ({ ...f, bess_capacity_kwh: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">BESS Power (kW)</label>
                  <input type="number" className="input" value={tddForm.bess_power_kw} onChange={e => setTddForm(f => ({ ...f, bess_power_kw: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">PV Capacity (kWp)</label>
                  <input type="number" className="input" value={tddForm.panel_capacity_kwp} onChange={e => setTddForm(f => ({ ...f, panel_capacity_kwp: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Transformer (kVA)</label>
                  <input type="number" className="input" value={tddForm.transformer_kva} onChange={e => setTddForm(f => ({ ...f, transformer_kva: Number(e.target.value) }))} />
                </div>
              </div>
              
              <button onClick={runTddReport} className="btn-primary w-full">Generate TDD Report</button>
            </div>
            
            <div className="space-y-4">
              {tddReport && (
                <>
                  <div className={`p-4 rounded-xl border ${tddReport.summary.overall === 'PASS' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="font-semibold">Overall: {tddReport.summary.overall}</p>
                    <p className="text-sm">PASS: {tddReport.summary.pass} | FAIL: {tddReport.summary.fail} | WARN: {tddReport.summary.warn}</p>
                  </div>
                  
                  <div className="card">
                    <p className="text-xs font-semibold text-slate-600 mb-3">Technical Checks</p>
                    {tddReport.checks.map((c, i) => (
                      <div key={i} className={`flex items-center justify-between py-2 border-b border-slate-100 last:border-0 ${c.status === 'FAIL' ? 'bg-red-50' : c.status === 'WARN' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.item}</p>
                          <p className="text-xs text-slate-500">{c.message}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${c.status === 'PASS' ? 'bg-emerald-200 text-emerald-800' : c.status === 'FAIL' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>{c.status}</span>
                      </div>
                    ))}
                  </div>
                  
                  {tddReport.risk_factors.length > 0 && (
                    <div className="card bg-red-50 border-red-200">
                      <p className="text-xs font-semibold text-red-800 mb-2">Risk Factors</p>
                      {tddReport.risk_factors.map((r, i) => (
                        <p key={i} className="text-sm text-red-700">• {r}</p>
                      ))}
                    </div>
                  )}
                  
                  <div className="card">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Recommendations</p>
                    {tddReport.recommendations.map((r, i) => (
                      <p key={i} className="text-sm text-slate-700 mb-1">• {r}</p>
                    ))}
                  </div>
                </>
              )}
              {!tddReport && (
                <div className="card flex items-center justify-center h-64 text-slate-300"><p className="text-sm">Enter equipment specs to generate TDD report</p></div>
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