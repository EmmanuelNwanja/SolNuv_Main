import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { projectsAPI, tariffAPI, loadProfileAPI, simulationAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { getDashboardLayout } from '../../../components/Layout';
import { LoadingSpinner } from '../../../components/ui/index';
import { MotionSection } from '../../../components/PageMotion';
import {
  RiArrowLeftLine, RiArrowRightLine, RiCheckLine,
  RiMapPinLine, RiMoneyDollarCircleLine, RiFlashlightLine,
  RiSunLine, RiBatteryLine, RiLineChartLine, RiPlayLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';

const STEPS = [
  { key: 'location', label: 'Location', icon: RiMapPinLine },
  { key: 'tariff', label: 'Tariff', icon: RiMoneyDollarCircleLine },
  { key: 'load', label: 'Load Profile', icon: RiFlashlightLine },
  { key: 'pv', label: 'PV System', icon: RiSunLine },
  { key: 'bess', label: 'Battery', icon: RiBatteryLine },
  { key: 'financial', label: 'Financial', icon: RiLineChartLine },
  { key: 'simulate', label: 'Simulate', icon: RiPlayLine },
];

const PANEL_TECHNOLOGIES = [
  'Monocrystalline PERC', 'Polycrystalline', 'Thin-Film CdTe', 'Thin-Film CIGS',
  'TOPCon', 'HJT', 'Bifacial Mono PERC', 'Bifacial TOPCon', 'Bifacial HJT',
  'Amorphous Silicon', 'Organic PV',
];

const BATTERY_CHEMISTRIES = [
  'LFP', 'NMC', 'NCA', 'Lead-Acid (Flooded)', 'Lead-Acid (AGM)',
  'Lead-Acid (Gel)', 'Sodium-Ion', 'Flow (Vanadium)',
];

const BUSINESS_TYPES = [
  { value: 'office', label: 'Office / Commercial' },
  { value: 'factory', label: 'Factory / Manufacturing' },
  { value: 'retail', label: 'Retail / Shopping' },
  { value: 'warehouse', label: 'Warehouse / Distribution' },
  { value: 'residential', label: 'Residential' },
  { value: 'hospital', label: 'Hospital / Healthcare' },
  { value: 'school', label: 'School / Education' },
];

const DISPATCH_STRATEGIES = [
  { value: 'self_consumption', label: 'Self-Consumption (maximise own use)' },
  { value: 'tou_arbitrage', label: 'TOU Arbitrage (charge off-peak, discharge peak)' },
  { value: 'peak_shave', label: 'Peak Shaving (cap grid demand)' },
  { value: 'backup', label: 'Backup (load-shedding / outage support)' },
];

export default function DesignWizard() {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [autoSizing, setAutoSizing] = useState(false);

  // Tariff state
  const [tariffTemplates, setTariffTemplates] = useState([]);
  const [selectedTariffId, setSelectedTariffId] = useState('');

  // Load profile state
  const [loadMethod, setLoadMethod] = useState('synthetic');
  const [loadProfileStats, setLoadProfileStats] = useState(null);

  // Design form state
  const [form, setForm] = useState({
    // Location
    location_lat: '',
    location_lon: '',
    country: 'NG',
    // Load profile
    annual_kwh: '',
    peak_kw: '',
    business_type: 'office',
    monthly_kwh: Array(12).fill(''),
    // PV
    pv_capacity_kwp: '',
    panel_technology: 'Monocrystalline PERC',
    tilt_angle: '',
    azimuth_angle: '',
    pv_generation_source: 'modelled',
    system_losses_pct: 14,
    annual_degradation_pct: 0.5,
    // BESS
    include_bess: false,
    bess_capacity_kwh: '',
    bess_power_kw: '',
    battery_chemistry: 'LFP',
    bess_dispatch_strategy: 'self_consumption',
    bess_min_soc: 10,
    bess_round_trip_efficiency: 92,
    // Financial
    total_cost: '',
    financing_type: 'cash',
    discount_rate_pct: 10,
    tariff_escalation_pct: 8,
    om_cost_annual: '',
    loan_interest_rate: 0,
    loan_term_years: 0,
  });

  // Solar resource preview
  const [solarPreview, setSolarPreview] = useState(null);

  const updateForm = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Load project data
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const { data } = await projectsAPI.get(projectId);
        const p = data?.data || data;
        setProject(p);
        if (p.location_lat) updateForm('location_lat', p.location_lat);
        if (p.location_lon) updateForm('location_lon', p.location_lon);
      } catch {
        toast.error('Project not found');
        router.push('/projects');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, router, updateForm]);

  // Load tariff templates based on country
  useEffect(() => {
    if (form.country) {
      tariffAPI.getTemplates(form.country)
        .then(r => setTariffTemplates(r.data?.data || []))
        .catch(() => {});
    }
  }, [form.country]);

  // Fetch solar resource when lat/lon change
  useEffect(() => {
    const lat = parseFloat(form.location_lat);
    const lon = parseFloat(form.location_lon);
    if (!lat || !lon) return;
    const t = setTimeout(() => {
      simulationAPI.getSolarResource(lat, lon)
        .then(r => {
          const d = r.data?.data;
          setSolarPreview(d);
          if (d?.optimal_tilt_deg && !form.tilt_angle) updateForm('tilt_angle', Math.round(d.optimal_tilt_deg));
          if (d?.optimal_azimuth_deg !== undefined && !form.azimuth_angle) updateForm('azimuth_angle', Math.round(d.optimal_azimuth_deg));
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [form.location_lat, form.location_lon]);

  // Auto-size handler
  const handleAutoSize = async () => {
    setAutoSizing(true);
    try {
      const { data } = await simulationAPI.autoSize({
        annual_kwh: parseFloat(form.annual_kwh),
        peak_kw: parseFloat(form.peak_kw) || undefined,
        location_lat: parseFloat(form.location_lat),
        location_lon: parseFloat(form.location_lon),
        include_bess: form.include_bess,
      });
      const rec = data?.data;
      if (rec) {
        if (rec.recommended_pv_kwp) updateForm('pv_capacity_kwp', Math.round(rec.recommended_pv_kwp * 10) / 10);
        if (rec.recommended_bess_kwh) {
          updateForm('bess_capacity_kwh', Math.round(rec.recommended_bess_kwh));
          updateForm('bess_power_kw', Math.round(rec.recommended_bess_kw || rec.recommended_bess_kwh / 2));
        }
        toast.success('AI sizing recommendation applied');
      }
    } catch {
      toast.error('Auto-size failed');
    } finally {
      setAutoSizing(false);
    }
  };

  // Generate synthetic load profile preview
  const handleSyntheticPreview = async () => {
    if (!form.annual_kwh) return toast.error('Enter annual consumption (kWh)');
    try {
      const { data } = await loadProfileAPI.generateSynthetic({
        project_id: projectId,
        business_type: form.business_type,
        annual_kwh: parseFloat(form.annual_kwh),
        peak_kw: parseFloat(form.peak_kw) || undefined,
        country: form.country,
      });
      setLoadProfileStats(data?.data);
      toast.success('Synthetic profile generated — review and confirm');
    } catch {
      toast.error('Failed to generate load profile');
    }
  };

  // Confirm & save synthetic profile
  const handleConfirmProfile = async () => {
    try {
      const { data } = await loadProfileAPI.confirmSynthetic({
        project_id: projectId,
        business_type: form.business_type,
        annual_kwh: parseFloat(form.annual_kwh),
        peak_kw: parseFloat(form.peak_kw) || undefined,
        country: form.country,
      });
      setLoadProfileStats(data?.data);
      toast.success('Load profile saved');
    } catch {
      toast.error('Failed to save profile');
    }
  };

  // Manual monthly entry save
  const handleManualSave = async () => {
    try {
      await loadProfileAPI.manual({
        project_id: projectId,
        monthly_kwh: form.monthly_kwh.map(v => parseFloat(v) || 0),
        peak_kw: parseFloat(form.peak_kw) || undefined,
        business_type: form.business_type,
      });
      toast.success('Manual load profile saved');
    } catch {
      toast.error('Failed to save manual profile');
    }
  };

  // File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data } = await loadProfileAPI.upload(projectId, file);
      setLoadProfileStats(data?.data);
      toast.success('File uploaded and parsed');
    } catch {
      toast.error('Failed to upload file');
    }
  };

  // Run simulation
  const handleSimulate = async () => {
    setSimulating(true);
    try {
      // First create/update project design
      const designPayload = {
        project_id: projectId,
        tariff_id: selectedTariffId || undefined,
        location_lat: parseFloat(form.location_lat),
        location_lon: parseFloat(form.location_lon),
        pv_capacity_kwp: parseFloat(form.pv_capacity_kwp),
        panel_technology: form.panel_technology,
        tilt_angle: parseFloat(form.tilt_angle) || 0,
        azimuth_angle: parseFloat(form.azimuth_angle) || 0,
        pv_generation_source: form.pv_generation_source,
        system_losses_pct: parseFloat(form.system_losses_pct),
        annual_degradation_pct: parseFloat(form.annual_degradation_pct),
        bess_capacity_kwh: form.include_bess ? parseFloat(form.bess_capacity_kwh) || 0 : 0,
        bess_power_kw: form.include_bess ? parseFloat(form.bess_power_kw) || 0 : 0,
        battery_chemistry: form.battery_chemistry,
        bess_dispatch_strategy: form.bess_dispatch_strategy,
        bess_min_soc: parseFloat(form.bess_min_soc) / 100,
        bess_round_trip_efficiency: parseFloat(form.bess_round_trip_efficiency) / 100,
        total_cost: parseFloat(form.total_cost) || 0,
        financing_type: form.financing_type,
        discount_rate_pct: parseFloat(form.discount_rate_pct),
        tariff_escalation_pct: parseFloat(form.tariff_escalation_pct),
        om_cost_annual: parseFloat(form.om_cost_annual) || 0,
        loan_interest_rate_pct: parseFloat(form.loan_interest_rate) || 0,
        loan_term_years: parseInt(form.loan_term_years) || 0,
      };

      await simulationAPI.run(designPayload);
      toast.success('Simulation complete!');
      router.push(`/projects/${projectId}/results`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!project) return null;

  const canProceed = () => {
    switch (step) {
      case 0: return form.location_lat && form.location_lon;
      case 1: return true; // Tariff is optional for flat-rate
      case 2: return form.annual_kwh;
      case 3: return form.pv_capacity_kwp;
      case 4: return !form.include_bess || (form.bess_capacity_kwh && form.bess_power_kw);
      case 5: return form.total_cost;
      default: return true;
    }
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <>
      <Head><title>Design — {project.name} | SolNuv</title></Head>
      <MotionSection>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/projects/${projectId}`)} className="btn-icon">
              <RiArrowLeftLine />
            </button>
            <div>
              <h1 className="text-xl font-bold text-forest-900 dark:text-white">System Design</h1>
              <p className="text-sm text-gray-500">{project.name}</p>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <button key={s.key} onClick={() => i <= step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                  active ? 'bg-forest-900 text-white shadow-md' :
                  done ? 'bg-green-100 text-green-700 cursor-pointer' :
                  'bg-gray-100 text-gray-400 dark:bg-gray-800'
                }`}>
                {done ? <RiCheckLine className="text-green-600" /> : <Icon />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div className="card p-6 min-h-[400px]">

          {/* STEP 0: Location */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Project Location</h2>
              <p className="text-sm text-gray-500">Enter coordinates for solar resource assessment (NASA POWER data).</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Latitude *</label>
                  <input type="number" step="any" className="input" value={form.location_lat}
                    onChange={e => updateForm('location_lat', e.target.value)} placeholder="e.g. 6.5244" />
                </div>
                <div>
                  <label className="label">Longitude *</label>
                  <input type="number" step="any" className="input" value={form.location_lon}
                    onChange={e => updateForm('location_lon', e.target.value)} placeholder="e.g. 3.3792" />
                </div>
                <div>
                  <label className="label">Country</label>
                  <select className="input" value={form.country} onChange={e => updateForm('country', e.target.value)}>
                    <option value="NG">Nigeria</option>
                    <option value="ZA">South Africa</option>
                    <option value="KE">Kenya</option>
                    <option value="GH">Ghana</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) { toast.error('Geolocation not supported by your browser'); return; }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          updateForm('location_lat', pos.coords.latitude.toFixed(6));
                          updateForm('location_lon', pos.coords.longitude.toFixed(6));
                          toast.success('Device location captured!');
                        },
                        () => toast.error('Failed to get device location. Enable location permissions.'),
                        { enableHighAccuracy: true, timeout: 15000 }
                      );
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors w-full justify-center"
                  >
                    <RiMapPinLine /> Use My Location
                  </button>
                </div>
              </div>
              {solarPreview && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Solar Resource Preview</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Avg GHI:</span>
                    <span className="dark:text-gray-200">{solarPreview.annual_ghi_kwh_m2 ? (solarPreview.annual_ghi_kwh_m2 / 365).toFixed(2) : '—'} kWh/m²/day</span>
                    <span className="text-gray-500 dark:text-gray-400">Optimal Tilt:</span>
                    <span className="dark:text-gray-200">{solarPreview.optimal_tilt_deg?.toFixed(0) ?? '—'}°</span>
                    <span className="text-gray-500 dark:text-gray-400">Avg Temp:</span>
                    <span className="dark:text-gray-200">{solarPreview.monthly_avg_temp_c?.length ? (solarPreview.monthly_avg_temp_c.reduce((a, b) => a + b, 0) / solarPreview.monthly_avg_temp_c.length).toFixed(1) : '—'}°C</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Tariff */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Grid Tariff Structure</h2>
              <p className="text-sm text-gray-500">Select a tariff template or skip for a flat-rate estimate.</p>
              
              {tariffTemplates.length > 0 && (
                <div className="space-y-2">
                  <label className="label">Tariff Template</label>
                  <select className="input" value={selectedTariffId}
                    onChange={e => setSelectedTariffId(e.target.value)}>
                    <option value="">— No tariff (use average rate) —</option>
                    {tariffTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.tariff_name} ({t.utility_name})</option>
                    ))}
                  </select>
                </div>
              )}
              
              {tariffTemplates.length === 0 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-500">
                  No tariff templates found for {form.country}. The simulation will use an estimated flat rate.
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Load Profile */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Energy Load Profile</h2>

              <div className="flex gap-2">
                {['synthetic', 'manual', 'upload'].map(m => (
                  <button key={m} onClick={() => setLoadMethod(m)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${loadMethod === m ? 'bg-forest-900 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>
                    {m === 'synthetic' ? 'AI Generated' : m === 'manual' ? 'Monthly Entry' : 'Upload File'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Annual Consumption (kWh) *</label>
                  <input type="number" className="input" value={form.annual_kwh}
                    onChange={e => updateForm('annual_kwh', e.target.value)} placeholder="e.g. 500000" />
                </div>
                <div>
                  <label className="label">Peak Demand (kW)</label>
                  <input type="number" className="input" value={form.peak_kw}
                    onChange={e => updateForm('peak_kw', e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className="label">Business Type</label>
                  <select className="input" value={form.business_type} onChange={e => updateForm('business_type', e.target.value)}>
                    {BUSINESS_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
              </div>

              {loadMethod === 'synthetic' && (
                <div className="space-y-3">
                  <button onClick={handleSyntheticPreview} className="btn-primary text-sm">Generate Synthetic Profile</button>
                  {loadProfileStats && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Profile Preview</p>
                      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                        <div><span className="text-gray-500">Annual:</span> {loadProfileStats.stats?.annualKwh?.toLocaleString()} kWh</div>
                        <div><span className="text-gray-500">Peak:</span> {loadProfileStats.stats?.peakKw?.toFixed(1)} kW</div>
                        <div><span className="text-gray-500">Load Factor:</span> {(loadProfileStats.stats?.loadFactor * 100)?.toFixed(1)}%</div>
                      </div>
                      {loadProfileStats.monthly_kwh && (
                        <div className="grid grid-cols-6 gap-1 text-xs">
                          {MONTHS.map((m, i) => (
                            <div key={m} className="text-center p-1 bg-white dark:bg-gray-800 rounded">
                              <div className="text-gray-400">{m}</div>
                              <div className="font-medium">{(loadProfileStats.monthly_kwh[i] || 0).toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={handleConfirmProfile} className="btn-primary text-sm mt-3">Confirm & Save Profile</button>
                    </div>
                  )}
                </div>
              )}

              {loadMethod === 'manual' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Enter monthly kWh consumption:</p>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {MONTHS.map((m, i) => (
                      <div key={m}>
                        <label className="label text-xs">{m}</label>
                        <input type="number" className="input text-sm" value={form.monthly_kwh[i]}
                          onChange={e => {
                            const arr = [...form.monthly_kwh];
                            arr[i] = e.target.value;
                            updateForm('monthly_kwh', arr);
                          }} />
                      </div>
                    ))}
                  </div>
                  <button onClick={handleManualSave} className="btn-primary text-sm">Save Monthly Profile</button>
                </div>
              )}

              {loadMethod === 'upload' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Upload CSV or Excel with hourly/15-min/30-min interval data (kW column).</p>
                  <input type="file" accept=".csv,.xlsx,.xls,.txt" onChange={handleFileUpload} className="input text-sm" />
                  {loadProfileStats && (
                    <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
                      Parsed: {loadProfileStats.stats?.annualKwh?.toLocaleString()} kWh annual, {loadProfileStats.stats?.peakKw?.toFixed(1)} kW peak
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PV System */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-forest-900 dark:text-white">PV System Configuration</h2>
                <button onClick={handleAutoSize} disabled={autoSizing || !form.annual_kwh}
                  className="btn-secondary text-sm flex items-center gap-1">
                  {autoSizing ? <LoadingSpinner className="w-4 h-4" /> : <RiSunLine />}
                  AI Auto-Size
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">PV Capacity (kWp) *</label>
                  <input type="number" step="0.1" className="input" value={form.pv_capacity_kwp}
                    onChange={e => updateForm('pv_capacity_kwp', e.target.value)} placeholder="e.g. 100" />
                </div>
                <div>
                  <label className="label">Panel Technology</label>
                  <select className="input" value={form.panel_technology} onChange={e => updateForm('panel_technology', e.target.value)}>
                    {PANEL_TECHNOLOGIES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tilt Angle (°)</label>
                  <input type="number" step="1" min="0" max="90" className="input" value={form.tilt_angle}
                    onChange={e => updateForm('tilt_angle', e.target.value)} placeholder="Auto from location" />
                </div>
                <div>
                  <label className="label">Azimuth (°, 0=N, 180=S)</label>
                  <input type="number" step="1" min="0" max="359" className="input" value={form.azimuth_angle}
                    onChange={e => updateForm('azimuth_angle', e.target.value)} placeholder="Auto from location" />
                </div>
                <div>
                  <label className="label">System Losses (%)</label>
                  <input type="number" step="0.5" className="input" value={form.system_losses_pct}
                    onChange={e => updateForm('system_losses_pct', e.target.value)} />
                </div>
                <div>
                  <label className="label">Annual Degradation (%)</label>
                  <input type="number" step="0.1" className="input" value={form.annual_degradation_pct}
                    onChange={e => updateForm('annual_degradation_pct', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Battery */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Battery Energy Storage</h2>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.include_bess}
                  onChange={e => updateForm('include_bess', e.target.checked)} className="accent-forest-900 w-4 h-4" />
                <span className="text-sm">Include battery storage</span>
              </label>

              {form.include_bess && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Capacity (kWh) *</label>
                    <input type="number" className="input" value={form.bess_capacity_kwh}
                      onChange={e => updateForm('bess_capacity_kwh', e.target.value)} placeholder="e.g. 200" />
                  </div>
                  <div>
                    <label className="label">Power Rating (kW) *</label>
                    <input type="number" className="input" value={form.bess_power_kw}
                      onChange={e => updateForm('bess_power_kw', e.target.value)} placeholder="e.g. 100" />
                  </div>
                  <div>
                    <label className="label">Chemistry</label>
                    <select className="input" value={form.battery_chemistry} onChange={e => updateForm('battery_chemistry', e.target.value)}>
                      {BATTERY_CHEMISTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Dispatch Strategy</label>
                    <select className="input" value={form.bess_dispatch_strategy} onChange={e => updateForm('bess_dispatch_strategy', e.target.value)}>
                      {DISPATCH_STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Min SOC (%)</label>
                    <input type="number" min="0" max="50" className="input" value={form.bess_min_soc}
                      onChange={e => updateForm('bess_min_soc', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Round-Trip Efficiency (%)</label>
                    <input type="number" min="50" max="100" className="input" value={form.bess_round_trip_efficiency}
                      onChange={e => updateForm('bess_round_trip_efficiency', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Financial */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Financial Parameters</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Total System Cost *</label>
                  <input type="number" className="input" value={form.total_cost}
                    onChange={e => updateForm('total_cost', e.target.value)} placeholder="e.g. 50000000" />
                </div>
                <div>
                  <label className="label">Annual O&M Cost</label>
                  <input type="number" className="input" value={form.om_cost_annual}
                    onChange={e => updateForm('om_cost_annual', e.target.value)} placeholder="e.g. 500000" />
                </div>
                <div>
                  <label className="label">Financing Type</label>
                  <select className="input" value={form.financing_type} onChange={e => updateForm('financing_type', e.target.value)}>
                    <option value="cash">Cash Purchase</option>
                    <option value="loan">Loan / Lease</option>
                    <option value="ppa">PPA</option>
                  </select>
                </div>
                <div>
                  <label className="label">Discount Rate (%)</label>
                  <input type="number" step="0.5" className="input" value={form.discount_rate_pct}
                    onChange={e => updateForm('discount_rate_pct', e.target.value)} />
                </div>
                <div>
                  <label className="label">Tariff Escalation (%/yr)</label>
                  <input type="number" step="0.5" className="input" value={form.tariff_escalation_pct}
                    onChange={e => updateForm('tariff_escalation_pct', e.target.value)} />
                </div>
                {form.financing_type === 'loan' && (
                  <>
                    <div>
                      <label className="label">Loan Interest Rate (%)</label>
                      <input type="number" step="0.1" className="input" value={form.loan_interest_rate}
                        onChange={e => updateForm('loan_interest_rate', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Loan Term (years)</label>
                      <input type="number" className="input" value={form.loan_term_years}
                        onChange={e => updateForm('loan_term_years', e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Simulate */}
          {step === 6 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Review & Simulate</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review your design parameters before running the simulation.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Location */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60">
                  <div className="flex items-center gap-2 mb-2">
                    <RiMapPinLine className="text-emerald-500" />
                    <h3 className="text-sm font-semibold text-forest-900 dark:text-white">Location</h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-gray-300">{form.location_lat}, {form.location_lon}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Country: {form.country}</p>
                  {solarPreview && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      GHI: {solarPreview.annual_ghi_kwh_m2 ? (solarPreview.annual_ghi_kwh_m2 / 365).toFixed(2) : '—'} kWh/m²/day
                    </p>
                  )}
                </div>

                {/* Tariff */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60">
                  <div className="flex items-center gap-2 mb-2">
                    <RiMoneyDollarCircleLine className="text-amber-500" />
                    <h3 className="text-sm font-semibold text-forest-900 dark:text-white">Tariff</h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-gray-300">
                    {selectedTariffId ? tariffTemplates.find(t => String(t.id) === String(selectedTariffId))?.tariff_name || 'Selected' : 'Flat rate estimate'}
                  </p>
                </div>

                {/* Load */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60">
                  <div className="flex items-center gap-2 mb-2">
                    <RiFlashlightLine className="text-blue-500" />
                    <h3 className="text-sm font-semibold text-forest-900 dark:text-white">Load Profile</h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-gray-300">{parseFloat(form.annual_kwh)?.toLocaleString() || '—'} kWh/yr</p>
                  {form.peak_kw && <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Peak: {form.peak_kw} kW</p>}
                </div>

                {/* PV System */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60">
                  <div className="flex items-center gap-2 mb-2">
                    <RiSunLine className="text-yellow-500" />
                    <h3 className="text-sm font-semibold text-forest-900 dark:text-white">PV System</h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-gray-300">{form.pv_capacity_kwp} kWp — {form.panel_technology}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Tilt: {form.tilt_angle || 'auto'}° · Azimuth: {form.azimuth_angle || 'auto'}°</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">Losses: {form.system_losses_pct}% · Degradation: {form.annual_degradation_pct}%/yr</p>
                </div>

                {/* Battery */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60">
                  <div className="flex items-center gap-2 mb-2">
                    <RiBatteryLine className="text-green-500" />
                    <h3 className="text-sm font-semibold text-forest-900 dark:text-white">Battery</h3>
                  </div>
                  {form.include_bess ? (
                    <>
                      <p className="text-sm text-slate-600 dark:text-gray-300">{form.bess_capacity_kwh} kWh / {form.bess_power_kw} kW</p>
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">{form.battery_chemistry} · {DISPATCH_STRATEGIES.find(s => s.value === form.bess_dispatch_strategy)?.label || form.bess_dispatch_strategy}</p>
                      <p className="text-xs text-slate-400 dark:text-gray-500">Min SOC: {form.bess_min_soc}% · RTE: {form.bess_round_trip_efficiency}%</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-gray-500 italic">No battery included</p>
                  )}
                </div>

                {/* Financial */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60">
                  <div className="flex items-center gap-2 mb-2">
                    <RiLineChartLine className="text-purple-500" />
                    <h3 className="text-sm font-semibold text-forest-900 dark:text-white">Financial</h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-gray-300">Cost: ₦{parseFloat(form.total_cost)?.toLocaleString() || '—'}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">{form.financing_type} · Discount: {form.discount_rate_pct}%</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">Tariff escalation: {form.tariff_escalation_pct}%/yr</p>
                </div>
              </div>

              <button onClick={handleSimulate} disabled={simulating}
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 mt-2">
                {simulating ? (
                  <><LoadingSpinner className="w-5 h-5" /> Running Simulation...</>
                ) : (
                  <><RiPlayLine className="text-lg" /> Run Full Simulation</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
            className="btn-secondary flex items-center gap-1">
            <RiArrowLeftLine /> Back
          </button>
          {step < STEPS.length - 1 && (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
              className="btn-primary flex items-center gap-1">
              Next <RiArrowRightLine />
            </button>
          )}
        </div>
      </MotionSection>
    </>
  );
}

DesignWizard.getLayout = getDashboardLayout;
