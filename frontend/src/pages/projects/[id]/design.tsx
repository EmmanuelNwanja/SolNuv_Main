import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import { queryParamToString } from '../../../utils/nextRouter';
import { projectsAPI, tariffAPI, loadProfileAPI, simulationAPI, calculatorAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { getDashboardLayout } from '../../../components/Layout';
import { LoadingSpinner } from '../../../components/ui/index';
import { MotionSection } from '../../../components/PageMotion';
import SystemVisualPreview from '../../../components/SystemVisualPreview';
import {
  RiArrowLeftLine, RiArrowRightLine, RiCheckLine,
  RiMapPinLine, RiMoneyDollarCircleLine, RiFlashlightLine,
  RiSunLine, RiBatteryLine, RiLineChartLine, RiPlayLine,
  RiPlugLine, RiSignalWifiOffLine, RiExchangeLine, RiGlobalLine,
  RiHome4Line, RiBuilding2Line, RiPlantLine, RiDropLine,
  RiParkingBoxLine, RiGridLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';

// Format number with thousand separators, allow decimals
function formatWithCommas(value) {
  if (value === '' || value === undefined || value === null) return '';
  const str = String(value);
  // Allow trailing decimal point or trailing zeros after decimal
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
        // Allow empty, digits, single decimal point
        if (raw === '' || /^-?\d*\.?\d*$/.test(raw)) {
          onChange(raw);
        }
      }}
      {...props}
    />
  );
}

  const STEPS = [
  { key: 'location', label: 'Location', icon: RiMapPinLine },
  { key: 'tariff', label: 'Tariff', icon: RiMoneyDollarCircleLine },
  { key: 'load', label: 'Load Profile', icon: RiFlashlightLine },
  { key: 'pv', label: 'PV System', icon: RiSunLine },
  { key: 'bess', label: 'Battery', icon: RiBatteryLine },
  { key: 'inverter', label: 'Inverter', icon: RiPlugLine },
  { key: 'financial', label: 'Financial', icon: RiLineChartLine },
  { key: 'simulate', label: 'Simulate', icon: RiPlayLine },
];

const PANEL_TECHNOLOGIES = [
  'Monocrystalline PERC', 'Polycrystalline', 'Thin-Film CdTe', 'Thin-Film CIGS',
  'TOPCon', 'HJT', 'Bifacial Mono PERC', 'Bifacial TOPCon', 'Bifacial HJT',
  'Amorphous Silicon', 'Organic PV',
];

const BATTERY_CHEMISTRIES = [
  'LFP', 'NMC', 'NCA', 'LTO',
  'Lead-Acid (Flooded)', 'Lead-Acid (AGM)', 'Lead-Acid (Gel)',
  'Sodium-Ion', 'Flow (Vanadium)', 'NiCd',
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

const GRID_TOPOLOGIES = [
  { value: 'grid_tied', label: 'Grid-Tied (PV Only)', icon: RiPlugLine, desc: 'PV system connected to the grid with no battery storage. Excess solar is exported.' },
  { value: 'grid_tied_bess', label: 'Grid-Tied + Battery', icon: RiGlobalLine, desc: 'PV + battery connected to the grid. Maximise self-consumption or arbitrage.' },
  { value: 'off_grid', label: 'Off-Grid', icon: RiSignalWifiOffLine, desc: 'Fully independent system with PV + battery. No grid connection. Battery is mandatory.' },
  { value: 'hybrid', label: 'Hybrid (Grid + Islanding)', icon: RiExchangeLine, desc: 'Grid-connected with battery backup. Can island during outages for critical loads.' },
];

const INSTALLATION_TYPES = [
  { value: 'rooftop_flat', label: 'Rooftop (Flat)', icon: RiHome4Line, desc: 'Panels flush-mounted on flat concrete or metal roof surface.' },
  { value: 'rooftop_tilted', label: 'Rooftop (Tilted Rack)', icon: RiHome4Line, desc: 'Panels on tilted racks above the roof. Better airflow and optimal angle.' },
  { value: 'ground_fixed', label: 'Ground Mount (Fixed)', icon: RiPlantLine, desc: 'Fixed-tilt ground racking system in open field or compound.' },
  { value: 'ground_tracker', label: 'Ground (Single-Axis Tracker)', icon: RiGridLine, desc: 'Motorised single-axis tracker following the sun. +15-25% yield.' },
  { value: 'carport', label: 'Carport / Canopy', icon: RiParkingBoxLine, desc: 'Elevated canopy over parking or walkway. High albedo from concrete.' },
  { value: 'bipv', label: 'BIPV (Building-Integrated)', icon: RiBuilding2Line, desc: 'Panels integrated into building facade or roof material.' },
  { value: 'floating', label: 'Floating Solar', icon: RiDropLine, desc: 'Panels on floating platforms over water bodies. Cooler temps boost yield.' },
];

export default function DesignWizard() {
  const router = useRouter();
  const projectId = queryParamToString(router.query.id);
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
    // System type
    grid_topology: 'grid_tied_bess',
    installation_type: 'rooftop_tilted',
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
    // User-supplied PV module specs (optional)
    user_pv_module_make: '',
    user_pv_module_model: '',
    user_pv_module_power_w: '',
    user_pv_module_vmp: '',
    user_pv_module_imp: '',
    // BESS
    include_bess: false,
    bess_capacity_kwh: '',
    bess_power_kw: '',
    battery_chemistry: 'LFP',
    bess_dispatch_strategy: 'self_consumption',
    peak_shave_threshold_kw: '',
    bess_min_soc: 10,
    bess_round_trip_efficiency: 92,
    // User-supplied battery/PCS specs (optional)
    user_battery_make: '',
    user_battery_model: '',
    user_battery_capacity_kwh: '',
    user_battery_voltage: '',
    user_battery_max_discharge_kw: '',
    user_pcs_make: '',
    user_pcs_model: '',
    user_pcs_power_kw: '',
    // Inverter (optional)
    user_inverter_make: '',
    user_inverter_model: '',
    user_inverter_power_kw: '',
    user_inverter_voltage: '',
    // Off-grid / Hybrid
    autonomy_days: 2,
    backup_generator_kw: '',
    diesel_cost_per_litre: '',
    grid_availability_pct: 100,
    grid_outage_hours_day: '',
    feed_in_tariff_per_kwh: '',
    // Financial
    total_cost: '',
    financing_type: 'cash',
    discount_rate_pct: 10,
    tariff_escalation_pct: 8,
    om_cost_annual: '',
    loan_interest_rate: 0,
    loan_term_years: 0,
    project_horizon_years: 25,
  });

  // Solar resource preview
  const [solarPreview, setSolarPreview] = useState(null);
  const [profileStale, setProfileStale] = useState(false);
  const [calcPrefill, setCalcPrefill] = useState<{ annual_kwh?: number; peak_kw?: number; total_cost?: number } | null>(null);
  const [projectCalcs, setProjectCalcs] = useState<any[]>([]);
  const [selectedCalcId, setSelectedCalcId] = useState('');
  const [designVersions, setDesignVersions] = useState<any[]>([]);
  const [syncSource, setSyncSource] = useState<'project' | 'saved_design' | 'calculation' | null>(null);
  const [fieldSources, setFieldSources] = useState<Record<string, string>>({});
  const [selectedCalcFields, setSelectedCalcFields] = useState({
    annual_kwh: true,
    peak_kw: true,
    total_cost: true,
  });
  const [restorePreview, setRestorePreview] = useState<any | null>(null);
  const [pendingRestoreVersionId, setPendingRestoreVersionId] = useState('');
  const [livePreview, setLivePreview] = useState<any | null>(null);
  const [previewPending, setPreviewPending] = useState(false);

  const updateForm = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Mark profile preview as stale when load inputs change
    if (['annual_kwh', 'peak_kw', 'business_type'].includes(field)) {
      setProfileStale(true);
    }
  }, []);

  const applyValuesWithSource = useCallback((entries: Array<{ field: string; value: any }>, source: 'project' | 'saved_design' | 'calculation') => {
    for (const entry of entries) {
      if (entry.value === undefined || entry.value === null || entry.value === '') continue;
      updateForm(entry.field, entry.value);
    }
    setFieldSources((prev) => {
      const next = { ...prev };
      for (const entry of entries) {
        if (entry.value === undefined || entry.value === null || entry.value === '') continue;
        next[entry.field] = source;
      }
      return next;
    });
    setSyncSource(source);
  }, [updateForm]);

  const applyCalcPrefill = useCallback((prefill) => {
    if (!prefill) return;
    if (prefill.annual_kwh && !form.annual_kwh) updateForm('annual_kwh', String(prefill.annual_kwh));
    if (prefill.peak_kw && !form.peak_kw) updateForm('peak_kw', String(prefill.peak_kw));
    if (prefill.total_cost && !form.total_cost) updateForm('total_cost', String(prefill.total_cost));
    setSyncSource('calculation');
  }, [form.annual_kwh, form.peak_kw, form.total_cost, updateForm]);

  const applyCalculationToForm = useCallback((calc: any) => {
    if (!calc) return;
    const input = calc.input_params || {};
    const result = calc.result_data || {};
    const annual = Number(input.annual_kwh || input.annual_consumption_kwh || result.annual_kwh || 0);
    const peak = Number(input.peak_kw || input.peak_demand_kw || result.peak_kw || 0);
    const capex = Number(input.total_cost || input.capex || result.total_cost || result.system_cost || 0);
    const entries: Array<{ field: string; value: any }> = [];
    if (selectedCalcFields.annual_kwh && annual > 0) entries.push({ field: 'annual_kwh', value: String(annual) });
    if (selectedCalcFields.peak_kw && peak > 0) entries.push({ field: 'peak_kw', value: String(peak) });
    if (selectedCalcFields.total_cost && capex > 0) entries.push({ field: 'total_cost', value: String(capex) });
    applyValuesWithSource(entries, 'calculation');
  }, [applyValuesWithSource, selectedCalcFields]);

  function derivePrefillFromCalculations(rows = []) {
    const merged = { annual_kwh: 0, peak_kw: 0, total_cost: 0 };
    for (const row of rows) {
      const input = row?.input_params || {};
      const result = row?.result_data || {};
      const annual = Number(input.annual_kwh || input.annual_consumption_kwh || result.annual_kwh || 0);
      const peak = Number(input.peak_kw || input.peak_demand_kw || result.peak_kw || 0);
      const total = Number(input.total_cost || input.capex || result.total_cost || result.system_cost || 0);
      if (annual > 0 && merged.annual_kwh <= 0) merged.annual_kwh = annual;
      if (peak > 0 && merged.peak_kw <= 0) merged.peak_kw = peak;
      if (total > 0 && merged.total_cost <= 0) merged.total_cost = total;
    }
    if (merged.annual_kwh || merged.peak_kw || merged.total_cost) return merged;
    return null;
  }

  // Load project data
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const { data } = await projectsAPI.get(projectId);
        const p = data?.data || data;
        setProject(p);
        applyValuesWithSource([
          { field: 'location_lat', value: p.latitude ? String(p.latitude) : '' },
          { field: 'location_lon', value: p.longitude ? String(p.longitude) : '' },
        ], 'project');

        const equipment = p.equipment || [];
        const panels = equipment.filter((eq) => eq.equipment_type === 'panel');
        const batteries = equipment.filter((eq) => eq.equipment_type === 'battery');
        const panelCapacity = panels.reduce((sum, eq) => sum + (Number(eq.size_watts || 0) * Number(eq.quantity || 0)) / 1000, 0);
        const batteryCapacity = batteries.reduce((sum, eq) => sum + Number(eq.capacity_kwh || 0) * Number(eq.quantity || 0), 0);
        if (panelCapacity > 0) updateForm('pv_capacity_kwp', String(Number(panelCapacity.toFixed(2))));
        if (batteryCapacity > 0) {
          updateForm('include_bess', true);
          updateForm('bess_capacity_kwh', String(Number(batteryCapacity.toFixed(2))));
        }
        setFieldSources((prev) => ({
          ...prev,
          ...(panelCapacity > 0 ? { pv_capacity_kwp: 'project' } : {}),
          ...(batteryCapacity > 0 ? { bess_capacity_kwh: 'project' } : {}),
        }));
        setSyncSource('project');

        const [designRes, calcRes] = await Promise.all([
          simulationAPI.getDesignConfig(projectId).catch(() => null),
          calculatorAPI.getProjectCalculations(projectId).catch(() => null),
        ]);

        const savedDesign = designRes?.data?.data;
        if (savedDesign) {
          applyValuesWithSource([
            { field: 'location_lat', value: savedDesign.location_lat != null ? String(savedDesign.location_lat) : '' },
            { field: 'location_lon', value: savedDesign.location_lon != null ? String(savedDesign.location_lon) : '' },
            { field: 'pv_capacity_kwp', value: savedDesign.pv_capacity_kwp != null ? String(savedDesign.pv_capacity_kwp) : '' },
            { field: 'grid_topology', value: savedDesign.grid_topology || '' },
            { field: 'installation_type', value: savedDesign.installation_type || '' },
            { field: 'bess_capacity_kwh', value: savedDesign.bess_capacity_kwh != null ? String(savedDesign.bess_capacity_kwh) : '' },
            { field: 'bess_power_kw', value: savedDesign.bess_power_kw != null ? String(savedDesign.bess_power_kw) : '' },
            { field: 'total_cost', value: savedDesign.capex_total != null ? String(savedDesign.capex_total) : '' },
          ], 'saved_design');
          if (savedDesign.bess_capacity_kwh > 0) updateForm('include_bess', true);
          if (savedDesign.pv_tilt_deg != null) updateForm('tilt_angle', String(savedDesign.pv_tilt_deg));
          if (savedDesign.pv_azimuth_deg != null) updateForm('azimuth_angle', String(savedDesign.pv_azimuth_deg));
          if (savedDesign.discount_rate_pct != null) updateForm('discount_rate_pct', String(savedDesign.discount_rate_pct));
          if (savedDesign.tariff_escalation_pct != null) updateForm('tariff_escalation_pct', String(savedDesign.tariff_escalation_pct));
          if (savedDesign.om_annual != null) updateForm('om_cost_annual', String(savedDesign.om_annual));
          if (savedDesign.analysis_period_years != null) updateForm('project_horizon_years', String(savedDesign.analysis_period_years));
          if (savedDesign.bess_dod_pct != null) updateForm('bess_min_soc', Math.max(0, 100 - Number(savedDesign.bess_dod_pct)));
        }

        const activeCalcs = calcRes?.data?.data?.active || [];
        setProjectCalcs(activeCalcs);
        const prefill = derivePrefillFromCalculations(activeCalcs);
        setCalcPrefill(prefill);
        applyCalcPrefill(prefill);

        const versionsRes = await simulationAPI.getDesignVersions(projectId).catch(() => null);
        setDesignVersions(versionsRes?.data?.data || []);
      } catch {
        toast.error('Project not found');
        router.push('/projects');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, router, updateForm, applyCalcPrefill]);

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

  // Live preview: debounced lightweight simulation for instant feedback. Hits
  // the rate-limited /simulation/preview endpoint (no DB writes, no quota).
  useEffect(() => {
    const lat = parseFloat(form.location_lat);
    const lon = parseFloat(form.location_lon);
    const pv = parseFloat(form.pv_capacity_kwp);
    const annualLoad = parseFloat(form.annual_kwh);
    if (!lat || !lon || !(pv > 0) || !(annualLoad > 0)) {
      setLivePreview(null);
      return;
    }
    setPreviewPending(true);
    const t = setTimeout(() => {
      simulationAPI.preview({
        lat,
        lon,
        pv_capacity_kwp: pv,
        pv_technology: 'mono_perc',
        tilt_deg: parseFloat(form.tilt_angle) || undefined,
        azimuth_deg: parseFloat(form.azimuth_angle) || undefined,
        system_losses_pct: parseFloat(String(form.system_losses_pct)) || 14,
        installation_type: form.installation_type,
        bess_capacity_kwh: form.include_bess ? parseFloat(form.bess_capacity_kwh) || 0 : 0,
        bess_chemistry: (form.battery_chemistry || 'lfp').toLowerCase(),
        grid_topology: form.grid_topology,
        annual_load_kwh: annualLoad,
        capex_total: parseFloat(form.total_cost) || 0,
        om_annual: parseFloat(form.om_cost_annual) || 0,
        discount_rate_pct: parseFloat(String(form.discount_rate_pct)) || 10,
        tariff_escalation_pct: parseFloat(String(form.tariff_escalation_pct)) || 8,
        analysis_period_years: parseFloat(String(form.project_horizon_years)) || 25,
        include_risk: false,
      })
        .then((r) => setLivePreview(r.data?.data || null))
        .catch(() => setLivePreview(null))
        .finally(() => setPreviewPending(false));
    }, 500);
    return () => {
      clearTimeout(t);
      setPreviewPending(false);
    };
  }, [
    form.location_lat, form.location_lon,
    form.pv_capacity_kwp, form.tilt_angle, form.azimuth_angle, form.system_losses_pct,
    form.include_bess, form.bess_capacity_kwh, form.battery_chemistry,
    form.grid_topology, form.installation_type,
    form.annual_kwh, form.total_cost, form.om_cost_annual,
    form.discount_rate_pct, form.tariff_escalation_pct, form.project_horizon_years,
  ]);

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
      setProfileStale(false);
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
      setProfileStale(false);
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
      const num = (v: unknown) => parseFloat(String(v));
      const int = (v: unknown) => parseInt(String(v), 10);
      // First create/update project design
      const designPayload = {
        project_id: projectId,
        tariff_id: form.grid_topology === 'off_grid' ? undefined : (selectedTariffId || undefined),
        location_lat: num(form.location_lat),
        location_lon: num(form.location_lon),
        pv_capacity_kwp: num(form.pv_capacity_kwp),
        panel_technology: form.panel_technology,
        tilt_angle: num(form.tilt_angle) || 0,
        azimuth_angle: num(form.azimuth_angle) || 0,
        pv_generation_source: form.pv_generation_source,
        system_losses_pct: num(form.system_losses_pct),
        annual_degradation_pct: num(form.annual_degradation_pct),
        bess_capacity_kwh: form.include_bess ? num(form.bess_capacity_kwh) || 0 : 0,
        bess_power_kw: form.include_bess ? num(form.bess_power_kw) || 0 : 0,
        battery_chemistry: form.battery_chemistry,
        bess_dispatch_strategy: form.bess_dispatch_strategy,
        peak_shave_threshold_kw: form.peak_shave_threshold_kw ? num(form.peak_shave_threshold_kw) : undefined,
        bess_min_soc: num(form.bess_min_soc) / 100,
        bess_round_trip_efficiency: num(form.bess_round_trip_efficiency) / 100,
        total_cost: num(form.total_cost) || 0,
        financing_type: form.financing_type,
        discount_rate_pct: num(form.discount_rate_pct),
        tariff_escalation_pct: num(form.tariff_escalation_pct),
        om_cost_annual: num(form.om_cost_annual) || 0,
        loan_interest_rate_pct: num(form.loan_interest_rate) || 0,
        loan_term_years: int(form.loan_term_years) || 0,
        project_horizon_years: int(form.project_horizon_years) || 25,
        // Grid topology fields
        grid_topology: form.grid_topology,
        installation_type: form.installation_type,
        autonomy_days: num(form.autonomy_days) || 2,
        backup_generator_kw: num(form.backup_generator_kw) || undefined,
        diesel_cost_per_litre: num(form.diesel_cost_per_litre) || undefined,
        grid_availability_pct: num(form.grid_availability_pct) || 100,
        grid_outage_hours_day: num(form.grid_outage_hours_day) || undefined,
        feed_in_tariff_per_kwh: num(form.feed_in_tariff_per_kwh) || undefined,
        // User-supplied PV module specs
        user_pv_module_make: form.user_pv_module_make || undefined,
        user_pv_module_model: form.user_pv_module_model || undefined,
        user_pv_module_power_w: form.user_pv_module_power_w ? num(form.user_pv_module_power_w) : undefined,
        user_pv_module_vmp: form.user_pv_module_vmp ? num(form.user_pv_module_vmp) : undefined,
        user_pv_module_imp: form.user_pv_module_imp ? num(form.user_pv_module_imp) : undefined,
        // User-supplied battery/PCS specs
        user_battery_make: form.user_battery_make || undefined,
        user_battery_model: form.user_battery_model || undefined,
        user_battery_capacity_kwh: form.user_battery_capacity_kwh ? num(form.user_battery_capacity_kwh) : undefined,
        user_battery_voltage: form.user_battery_voltage ? num(form.user_battery_voltage) : undefined,
        user_battery_max_discharge_kw: form.user_battery_max_discharge_kw ? num(form.user_battery_max_discharge_kw) : undefined,
        user_pcs_make: form.user_pcs_make || undefined,
        user_pcs_model: form.user_pcs_model || undefined,
        user_pcs_power_kw: form.user_pcs_power_kw ? num(form.user_pcs_power_kw) : undefined,
        // User-supplied inverter specs
        user_inverter_make: form.user_inverter_make || undefined,
        user_inverter_model: form.user_inverter_model || undefined,
        user_inverter_power_kw: form.user_inverter_power_kw ? num(form.user_inverter_power_kw) : undefined,
        user_inverter_voltage: form.user_inverter_voltage ? num(form.user_inverter_voltage) : undefined,
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
      case 0: return form.location_lat && form.location_lon && form.grid_topology && form.installation_type;
      case 1: return true; // Tariff is optional for flat-rate
      case 2: return form.annual_kwh;
      case 3: return form.pv_capacity_kwp;
      case 4: {
        if (form.grid_topology === 'grid_tied') return true; // No battery needed
        if (form.grid_topology === 'off_grid' || form.grid_topology === 'hybrid') {
          return form.bess_capacity_kwh && form.bess_power_kw; // Battery mandatory
        }
        return !form.include_bess || (form.bess_capacity_kwh && form.bess_power_kw);
      }
      case 5: return true; // Inverter is optional
      case 6: return form.total_cost;
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
          <Link href={`/projects/${projectId}/calculations`} className="btn-secondary text-sm">
            View Saved Calculations
          </Link>
        </div>
        <div className="mb-4 grid md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-slate-200 bg-white">
            <p className="text-xs font-semibold text-slate-600 mb-2">Apply Saved Calculation</p>
            <div className="flex gap-2">
              <select
                className="input text-sm flex-1"
                value={selectedCalcId}
                onChange={(e) => setSelectedCalcId(e.target.value)}
              >
                <option value="">Select calculation</option>
                {projectCalcs.map((calc: any) => (
                  <option key={calc.id} value={calc.id}>
                    {(calc.calculator_type || 'calc').toUpperCase()} - {new Date(calc.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  const calc = projectCalcs.find((c: any) => c.id === selectedCalcId);
                  if (!calc) return toast.error('Select a saved calculation');
                  applyCalculationToForm(calc);
                  toast.success('Saved calculation applied to design');
                }}
              >
                Apply
              </button>
            </div>
            <div className="mt-2 flex gap-3 text-xs text-slate-600">
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={selectedCalcFields.annual_kwh} onChange={e => setSelectedCalcFields(v => ({ ...v, annual_kwh: e.target.checked }))} />Annual</label>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={selectedCalcFields.peak_kw} onChange={e => setSelectedCalcFields(v => ({ ...v, peak_kw: e.target.checked }))} />Peak</label>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={selectedCalcFields.total_cost} onChange={e => setSelectedCalcFields(v => ({ ...v, total_cost: e.target.checked }))} />Capex</label>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-white">
            <p className="text-xs font-semibold text-slate-600 mb-2">Design Version History</p>
            <div className="flex gap-2">
              <select className="input text-sm flex-1" id="design-version-select">
                <option value="">Select version to restore</option>
                {designVersions.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {new Date(v.run_at).toLocaleString()} | kWh {Math.round(Number(v.annual_solar_gen_kwh || 0)).toLocaleString()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={async () => {
                  const el = document.getElementById('design-version-select') as HTMLSelectElement | null;
                  const versionId = el?.value || '';
                  if (!versionId) return toast.error('Select a design version');
                  const selected = designVersions.find((v: any) => v.id === versionId);
                  setPendingRestoreVersionId(versionId);
                  setRestorePreview(selected || null);
                }}
              >
                Restore
              </button>
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
          {syncSource && (
            <div className="mb-4 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
              Active sync source: <span className="font-semibold">{syncSource === 'saved_design' ? 'Saved Design' : syncSource === 'calculation' ? 'Saved Calculation' : 'Project'}</span>
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
            {['location_lat', 'location_lon', 'pv_capacity_kwp', 'bess_capacity_kwh', 'annual_kwh', 'peak_kw', 'total_cost'].map((f) => (
              <span key={f} className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                {f.replace(/_/g, ' ')}: <span className="font-semibold">{fieldSources[f] || 'manual'}</span>
              </span>
            ))}
          </div>
          {calcPrefill && (
            <div className="mb-4 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 flex items-center justify-between gap-3">
              <span>
                Synced from saved project calculations:
                {calcPrefill.annual_kwh ? ` annual ${calcPrefill.annual_kwh.toLocaleString()} kWh` : ''}
                {calcPrefill.peak_kw ? `, peak ${calcPrefill.peak_kw.toLocaleString()} kW` : ''}
                {calcPrefill.total_cost ? `, capex ${calcPrefill.total_cost.toLocaleString()}` : ''}
              </span>
              <button type="button" className="text-emerald-700 font-semibold underline" onClick={() => applyCalcPrefill(calcPrefill)}>
                Re-apply
              </button>
            </div>
          )}

          {/* STEP 0: Location */}
          {step === 0 && (
            <div className="space-y-6">
              {/* Grid Topology Selection */}
              <div>
                <h2 className="text-lg font-semibold text-forest-900 dark:text-white mb-1">System Type</h2>
                <p className="text-sm text-gray-500 mb-3">Choose the grid connection topology for this project.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GRID_TOPOLOGIES.map(t => {
                    const Icon = t.icon;
                    const selected = form.grid_topology === t.value;
                    return (
                      <button key={t.value}
                        onClick={() => {
                          updateForm('grid_topology', t.value);
                          // Auto-enable battery for topologies that require it
                          if (t.value === 'off_grid' || t.value === 'grid_tied_bess' || t.value === 'hybrid') {
                            updateForm('include_bess', true);
                          }
                          if (t.value === 'grid_tied') {
                            updateForm('include_bess', false);
                          }
                        }}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500'
                            : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 hover:border-slate-300'
                        }`}>
                        <Icon className={`text-xl mt-0.5 flex-shrink-0 ${selected ? 'text-emerald-600' : 'text-gray-400'}`} />
                        <div>
                          <div className={`text-sm font-semibold ${selected ? 'text-emerald-700 dark:text-emerald-300' : 'text-forest-900 dark:text-white'}`}>
                            {t.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* User-supplied PV module specs (optional) */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Optional: Specify PV Module</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="label">Make</label>
                    <input className="input" value={form.user_pv_module_make} onChange={e => updateForm('user_pv_module_make', e.target.value)} placeholder="e.g. Jinko" />
                  </div>
                  <div>
                    <label className="label">Model</label>
                    <input className="input" value={form.user_pv_module_model} onChange={e => updateForm('user_pv_module_model', e.target.value)} placeholder="e.g. Tiger Neo 540W" />
                  </div>
                  <div>
                    <label className="label">Power (W)</label>
                    <input className="input" type="number" value={form.user_pv_module_power_w} onChange={e => updateForm('user_pv_module_power_w', e.target.value)} placeholder="e.g. 540" />
                  </div>
                  <div>
                    <label className="label">Vmp (V)</label>
                    <input className="input" type="number" value={form.user_pv_module_vmp} onChange={e => updateForm('user_pv_module_vmp', e.target.value)} placeholder="e.g. 41.1" />
                  </div>
                  <div>
                    <label className="label">Imp (A)</label>
                    <input className="input" type="number" value={form.user_pv_module_imp} onChange={e => updateForm('user_pv_module_imp', e.target.value)} placeholder="e.g. 13.1" />
                  </div>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">If filled, these specs will be used for sizing/validation and override auto-sizing.</p>
              </div>

              {/* Hybrid: Grid outage fields */}
              {form.grid_topology === 'hybrid' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Grid Reliability</h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Define how unreliable your grid supply is. This directly affects battery sizing and islanding behaviour in the simulation.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Avg. Grid Outage (hours/day)</label>
                      <p className="text-xs text-gray-400 mb-1">Average daily hours without grid power. Higher values mean more battery reliance and longer islanding periods.</p>
                      <input type="number" step="0.5" min="0" max="24" className="input" value={form.grid_outage_hours_day}
                        onChange={e => updateForm('grid_outage_hours_day', e.target.value)} placeholder="e.g. 6" />
                    </div>
                    {/* User-supplied battery/PCS specs (optional) */}
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
                      <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Optional: Specify Battery & PCS</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <label className="label">Battery Make</label>
                          <input className="input" value={form.user_battery_make} onChange={e => updateForm('user_battery_make', e.target.value)} placeholder="e.g. BYD" />
                        </div>
                        <div>
                          <label className="label">Battery Model</label>
                          <input className="input" value={form.user_battery_model} onChange={e => updateForm('user_battery_model', e.target.value)} placeholder="e.g. LVS 15.4" />
                        </div>
                        <div>
                          <label className="label">Battery Capacity (kWh)</label>
                          <input className="input" type="number" value={form.user_battery_capacity_kwh} onChange={e => updateForm('user_battery_capacity_kwh', e.target.value)} placeholder="e.g. 15.4" />
                        </div>
                        <div>
                          <label className="label">Battery Voltage (V)</label>
                          <input className="input" type="number" value={form.user_battery_voltage} onChange={e => updateForm('user_battery_voltage', e.target.value)} placeholder="e.g. 51.2" />
                        </div>
                        <div>
                          <label className="label">Max Discharge (kW)</label>
                          <input className="input" type="number" value={form.user_battery_max_discharge_kw} onChange={e => updateForm('user_battery_max_discharge_kw', e.target.value)} placeholder="e.g. 5" />
                        </div>
                        <div>
                          <label className="label">PCS Make</label>
                          <input className="input" value={form.user_pcs_make} onChange={e => updateForm('user_pcs_make', e.target.value)} placeholder="e.g. Goodwe" />
                        </div>
                        <div>
                          <label className="label">PCS Model</label>
                          <input className="input" value={form.user_pcs_model} onChange={e => updateForm('user_pcs_model', e.target.value)} placeholder="e.g. GW10KN-ET" />
                        </div>
                        <div>
                          <label className="label">PCS Power (kW)</label>
                          <input className="input" type="number" value={form.user_pcs_power_kw} onChange={e => updateForm('user_pcs_power_kw', e.target.value)} placeholder="e.g. 10" />
                        </div>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">If filled, these specs will be used for sizing/validation and override auto-sizing.</p>
                    </div>
                    <div>
                      <label className="label">Grid Availability (%)</label>
                      <p className="text-xs text-gray-400 mb-1">Percentage of time grid power is available over a year. 100% = always on, 50% = unreliable half the time.</p>
                      <input type="number" step="1" min="0" max="100" className="input" value={form.grid_availability_pct}
                        onChange={e => updateForm('grid_availability_pct', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Installation Type Selection */}
              <div>
                <h2 className="text-lg font-semibold text-forest-900 dark:text-white mb-1">Installation Type</h2>
                <p className="text-sm text-gray-500 mb-3">Select how the panels will be mounted. This affects simulation accuracy (albedo, cell temperature).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {INSTALLATION_TYPES.map(t => {
                    const Icon = t.icon;
                    const selected = form.installation_type === t.value;
                    return (
                      <button key={t.value}
                        onClick={() => updateForm('installation_type', t.value)}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500'
                            : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 hover:border-slate-300'
                        }`}>
                        <Icon className={`text-lg mt-0.5 flex-shrink-0 ${selected ? 'text-emerald-600' : 'text-gray-400'}`} />
                        <div>
                          <div className={`text-sm font-semibold ${selected ? 'text-emerald-700 dark:text-emerald-300' : 'text-forest-900 dark:text-white'}`}>
                            {t.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System Visual Preview */}
              <SystemVisualPreview
                installationType={form.installation_type}
                capacityKwp={form.pv_capacity_kwp || null}
                className="max-w-md mx-auto"
              />

              {/* Location */}
              <div>
                <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Project Location</h2>
                <p className="text-sm text-gray-500 mb-3">Enter coordinates for satellite solar resource assessment.</p>
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
                        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
            </div>
          )}

          {/* STEP 1: Tariff */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Grid Tariff Structure</h2>

              {form.grid_topology === 'off_grid' ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">Off-Grid System</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    No grid tariff applies to off-grid systems. Savings are calculated based on avoided diesel/generator costs.
                  </p>
                  {/* Diesel cost for off-grid comparison */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Backup Generator Size (kW)</label>
                      <input type="number" className="input" value={form.backup_generator_kw}
                        onChange={e => updateForm('backup_generator_kw', e.target.value)} placeholder="e.g. 50" />
                      <p className="text-xs text-gray-400 mt-1">Total rated output of your diesel/gas backup generator.</p>
                    </div>
                    <div>
                      <label className="label">Diesel Cost (per litre)</label>
                      <input type="number" step="0.01" className="input" value={form.diesel_cost_per_litre}
                        onChange={e => updateForm('diesel_cost_per_litre', e.target.value)} placeholder="e.g. 800" />
                      <p className="text-xs text-gray-400 mt-1">Current diesel pump price at your site — used to calculate generator operating cost vs. solar savings.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
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
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-500">
                      No tariff templates found for {form.country}. The simulation will use an estimated flat rate.
                    </div>
                  )}

                  {/* Feed-in tariff for grid-connected systems */}
                  <div>
                    <label className="label">Feed-in Tariff Rate (per kWh exported)</label>
                    <input type="number" step="0.01" className="input" value={form.feed_in_tariff_per_kwh}
                      onChange={e => updateForm('feed_in_tariff_per_kwh', e.target.value)}
                      placeholder="Optional — revenue for exported solar" />
                    <p className="text-xs text-gray-400 mt-1">Leave empty if net metering or no export compensation.</p>
                  </div>
                </>
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
                  <NumericInput value={form.annual_kwh}
                    onChange={v => updateForm('annual_kwh', v)} placeholder="e.g. 500,000" />
                  <p className="text-xs text-gray-400 mt-1">Total kWh consumed per year. Check your utility bills or estimate from generator fuel logs.</p>
                </div>
                <div>
                  <label className="label">Peak Demand (kW)</label>
                  <NumericInput value={form.peak_kw}
                    onChange={v => updateForm('peak_kw', v)} placeholder="Optional" />
                  <p className="text-xs text-gray-400 mt-1">Target peak demand for the site. The profile shape will be adjusted to match. Leave blank to derive from load shape.</p>
                </div>
                <div>
                  <label className="label">Business Type</label>
                  <select className="input" value={form.business_type} onChange={e => updateForm('business_type', e.target.value)}>
                    {BUSINESS_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Determines the hourly load shape pattern used to build the synthetic profile.</p>
                </div>
              </div>

              {loadMethod === 'synthetic' && (
                <div className="space-y-3">
                  <button onClick={handleSyntheticPreview} className="btn-primary text-sm">Generate Synthetic Profile</button>
                  {loadProfileStats && profileStale && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2">
                      <span className="text-sm text-amber-700 dark:text-amber-300">Profile outdated — inputs have changed.</span>
                      <button onClick={handleSyntheticPreview} className="text-sm font-semibold text-amber-800 dark:text-amber-200 underline">Regenerate</button>
                    </div>
                  )}
                  {loadProfileStats && !profileStale && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Profile Preview</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                        <div><span className="text-gray-500">Annual:</span> {loadProfileStats.stats?.annualKwh?.toLocaleString()} kWh</div>
                        <div><span className="text-gray-500">Peak:</span> {loadProfileStats.stats?.peakKw?.toFixed(1)} kW</div>
                        <div><span className="text-gray-500">Avg. Daily:</span> {loadProfileStats.stats?.avgDailyKwh?.toFixed(1)} kWh</div>
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
                      {form.peak_kw && (
                        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                          ℹ Profile shaped to target peak of {parseFloat(form.peak_kw).toLocaleString()} kW (load factor: {((loadProfileStats.stats?.annualKwh / (parseFloat(form.peak_kw) * 8760)) * 100)?.toFixed(1)}%).
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
                  <NumericInput value={form.pv_capacity_kwp}
                    onChange={v => updateForm('pv_capacity_kwp', v)} placeholder="e.g. 100" className="input" />
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
                  <p className="text-xs text-gray-400 mt-1">Accounts for wiring, inverter, soiling, and mismatch losses. Typical range: 14–20%.</p>
                </div>
                <div>
                  <label className="label">Annual Degradation (%)</label>
                  <input type="number" step="0.1" className="input" value={form.annual_degradation_pct}
                    onChange={e => updateForm('annual_degradation_pct', e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">Rate at which panel output declines yearly. Mono/LFP: ~0.5–0.7%; older panels: up to 1.2%.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Battery */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Battery Energy Storage</h2>

              {form.grid_topology === 'grid_tied' ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm text-gray-500 italic">Grid-tied (PV only) systems do not include battery storage. You can change the system type in the Location step.</p>
                </div>
              ) : (
                <>
                  {(form.grid_topology === 'off_grid' || form.grid_topology === 'hybrid') && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
                      Battery storage is <strong>required</strong> for {form.grid_topology === 'off_grid' ? 'off-grid' : 'hybrid'} systems.
                    </div>
                  )}

                  {form.grid_topology !== 'off_grid' && form.grid_topology !== 'hybrid' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.include_bess}
                        onChange={e => updateForm('include_bess', e.target.checked)} className="accent-forest-900 w-4 h-4" />
                      <span className="text-sm">Include battery storage</span>
                    </label>
                  )}

                  {form.include_bess && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Capacity (kWh) *</label>
                        <NumericInput value={form.bess_capacity_kwh}
                          onChange={v => updateForm('bess_capacity_kwh', v)} placeholder="e.g. 200" className="input" />
                        <p className="text-xs text-gray-400 mt-1">Total usable energy storage. Estimate: load (kW) × backup hours ÷ max DoD.</p>
                      </div>
                      <div>
                        <label className="label">Power Rating (kW) *</label>
                        <NumericInput value={form.bess_power_kw}
                          onChange={v => updateForm('bess_power_kw', v)} placeholder="e.g. 100" className="input" />
                        <p className="text-xs text-gray-400 mt-1">Max continuous charge/discharge rate. Must match your inverter rating.</p>
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
                      {form.bess_dispatch_strategy === 'peak_shave' && (
                        <div>
                          <label className="label">Peak Shave Threshold (kW)</label>
                          <input type="number" min="0" step="0.1" className="input" value={form.peak_shave_threshold_kw}
                            onChange={e => updateForm('peak_shave_threshold_kw', e.target.value)}
                            placeholder={form.peak_kw ? `Default: ${Math.round(Number(form.peak_kw) * 0.8)} kW (80% of peak)` : 'e.g. 50'} />
                          <p className="text-xs text-gray-400 mt-1">Battery discharges when grid demand exceeds this threshold. Leave blank to auto-set at 80% of your load profile peak.</p>
                        </div>
                      )}
                      <div>
                        <label className="label">Min SOC (%)</label>
                        <input type="number" min="0" max="50" className="input" value={form.bess_min_soc}
                          onChange={e => updateForm('bess_min_soc', e.target.value)} />
                        <p className="text-xs text-gray-400 mt-1">Minimum allowed state of charge. Keeping above 10–20% significantly extends battery life.</p>
                      </div>
                      <div>
                        <label className="label">Round-Trip Efficiency (%)</label>
                        <input type="number" min="50" max="100" className="input" value={form.bess_round_trip_efficiency}
                          onChange={e => updateForm('bess_round_trip_efficiency', e.target.value)} />
                        <p className="text-xs text-gray-400 mt-1">Energy returned per energy stored. LFP: ~95%; Lead-acid: ~80–85%.</p>
                      </div>

                      {/* Off-grid / Hybrid: Autonomy days */}
                      {(form.grid_topology === 'off_grid' || form.grid_topology === 'hybrid') && (
                        <>
                          <div>
                            <label className="label">Target Autonomy (days)</label>
                            <input type="number" step="0.5" min="0.5" max="7" className="input" value={form.autonomy_days}
                              onChange={e => updateForm('autonomy_days', e.target.value)} placeholder="e.g. 2" />
                            <p className="text-xs text-gray-400 mt-1">Days of battery backup without solar generation.</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 5: Inverter */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Inverter Specifications</h2>
              <p className="text-sm text-gray-500">Enter your inverter details for accurate simulation. Leave blank to use estimated values.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Make / Brand</label>
                  <input type="text" className="input" value={form.user_inverter_make}
                    onChange={e => updateForm('user_inverter_make', e.target.value)}
                    placeholder="e.g. SMA, Huawei, Fronius" />
                </div>
                <div>
                  <label className="label">Model</label>
                  <input type="text" className="input" value={form.user_inverter_model}
                    onChange={e => updateForm('user_inverter_model', e.target.value)}
                    placeholder="e.g. Sunny Tripower 10" />
                </div>
                <div>
                  <label className="label">Rated Power (kW)</label>
                  <NumericInput value={form.user_inverter_power_kw}
                    onChange={v => updateForm('user_inverter_power_kw', v)} placeholder="e.g. 10" className="input" />
                  <p className="text-xs text-gray-400 mt-1">AC output rating of the inverter.</p>
                </div>
                <div>
                  <label className="label">DC Input Voltage (V)</label>
                  <NumericInput value={form.user_inverter_voltage}
                    onChange={v => updateForm('user_inverter_voltage', v)} placeholder="e.g. 600" className="input" />
                  <p className="text-xs text-gray-400 mt-1">Max DC input voltage rating.</p>
                </div>
              </div>

              {(form.grid_topology === 'off_grid' || form.grid_topology === 'hybrid') && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
                  <strong>Note:</strong> For off-grid and hybrid systems, the inverter must be sized to handle the peak load plus battery charging. Recommended: inverter rating ≥ peak load × 1.2.
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Financial */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Financial Parameters</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Total System Cost *</label>
                  <NumericInput value={form.total_cost}
                    onChange={v => updateForm('total_cost', v)} placeholder="e.g. 50,000,000" className="input" />
                  <p className="text-xs text-gray-400 mt-1">Full installed cost including equipment, labour, and commissioning (in ₦).</p>
                </div>
                <div>
                  <label className="label">Annual O&M Cost</label>
                  <NumericInput value={form.om_cost_annual}
                    onChange={v => updateForm('om_cost_annual', v)} placeholder="e.g. 500,000" className="input" />
                  <p className="text-xs text-gray-400 mt-1">Yearly maintenance estimate. Typical: 0.5–1.5% of system CAPEX.</p>
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
                  <p className="text-xs text-gray-400 mt-1">Your cost of capital or required return rate. Use CBN MPR (~26%) as a baseline.</p>
                </div>
                <div>
                  <label className="label">Tariff Escalation (%/yr)</label>
                  <input type="number" step="0.5" className="input" value={form.tariff_escalation_pct}
                    onChange={e => updateForm('tariff_escalation_pct', e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">Expected annual electricity tariff increase. Nigeria average: 8–15%.</p>
                </div>
                <div>
                  <label className="label">Analysis Period (years)</label>
                  <input type="number" min="5" max="40" step="1" className="input" value={form.project_horizon_years}
                    onChange={e => updateForm('project_horizon_years', e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">Payback horizon for financial projections (default 25 years).</p>
                </div>
                {form.financing_type === 'loan' && (
                  <>
                    <div>
                      <label className="label">Loan Interest Rate (%)</label>
                      <input type="number" step="0.1" className="input" value={form.loan_interest_rate}
                        onChange={e => updateForm('loan_interest_rate', e.target.value)} />
                      <p className="text-xs text-gray-400 mt-1">Annual interest rate on the project financing loan.</p>
                    </div>
                    <div>
                      <label className="label">Loan Term (years)</label>
                      <input type="number" className="input" value={form.loan_term_years}
                        onChange={e => updateForm('loan_term_years', e.target.value)} />
                      <p className="text-xs text-gray-400 mt-1">Repayment period. Typically 3–10 years for solar projects.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 7: Simulate */}
          {step === 7 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-forest-900 dark:text-white">Review & Simulate</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review your design parameters before running the simulation.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* System Type */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60">
                  <div className="flex items-center gap-2 mb-2">
                    {(() => { const topo = GRID_TOPOLOGIES.find(t => t.value === form.grid_topology); const Icon = topo?.icon || RiPlugLine; return <Icon className="text-teal-500" />; })()}
                    <h3 className="text-sm font-semibold text-forest-900 dark:text-white">System Type</h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-gray-300">
                    {GRID_TOPOLOGIES.find(t => t.value === form.grid_topology)?.label || form.grid_topology}
                  </p>
                  {form.grid_topology === 'hybrid' && form.grid_outage_hours_day && (
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Outages: {form.grid_outage_hours_day} hrs/day</p>
                  )}
                </div>

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
                  <p className="text-xs text-slate-400 dark:text-gray-500">Tariff escalation: {form.tariff_escalation_pct}%/yr · {form.project_horizon_years}yr horizon</p>
                </div>
              </div>

              <LivePreviewCard preview={livePreview} pending={previewPending} />

              <DesignCanvasSpikeSlot form={form} />

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

        {restorePreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5">
              <h3 className="text-lg font-semibold text-forest-900 mb-2">Restore Design Version</h3>
              <p className="text-sm text-slate-600 mb-3">
                Run: {new Date(restorePreview.run_at).toLocaleString()} | Annual solar: {Math.round(Number(restorePreview.annual_solar_gen_kwh || 0)).toLocaleString()} kWh
              </p>
              <div className="text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                <p>Year-1 savings: {Math.round(Number(restorePreview.year1_savings || 0)).toLocaleString()}</p>
                <p>Payback: {restorePreview.simple_payback_months ? `${(Number(restorePreview.simple_payback_months) / 12).toFixed(1)} years` : 'N/A'}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => { setRestorePreview(null); setPendingRestoreVersionId(''); }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    await simulationAPI.restoreDesignVersion(projectId, pendingRestoreVersionId);
                    const refreshed = await simulationAPI.getDesignConfig(projectId);
                    const restored = refreshed?.data?.data;
                    if (restored) {
                      applyValuesWithSource([
                        { field: 'location_lat', value: restored.location_lat != null ? String(restored.location_lat) : '' },
                        { field: 'location_lon', value: restored.location_lon != null ? String(restored.location_lon) : '' },
                        { field: 'pv_capacity_kwp', value: restored.pv_capacity_kwp != null ? String(restored.pv_capacity_kwp) : '' },
                        { field: 'grid_topology', value: restored.grid_topology || '' },
                        { field: 'installation_type', value: restored.installation_type || '' },
                        { field: 'bess_capacity_kwh', value: restored.bess_capacity_kwh != null ? String(restored.bess_capacity_kwh) : '' },
                        { field: 'total_cost', value: restored.capex_total != null ? String(restored.capex_total) : '' },
                      ], 'saved_design');
                    }
                    setRestorePreview(null);
                    setPendingRestoreVersionId('');
                    toast.success('Design version restored');
                  }}
                >
                  Confirm Restore
                </button>
              </div>
            </div>
          </div>
        )}
      </MotionSection>
    </>
  );
}

DesignWizard.getLayout = getDashboardLayout;

function LivePreviewCard({ preview, pending }: { preview: any | null; pending: boolean }) {
  if (!preview && !pending) return null;
  const annualKwh = preview?.annual_solar_gen_kwh;
  const utilisationPct =
    preview?.annual_solar_gen_kwh > 0 && preview?.solar_utilised_kwh != null
      ? (preview.solar_utilised_kwh / preview.annual_solar_gen_kwh) * 100
      : null;
  const npv = preview?.npv_25yr;
  const irr = preview?.irr_pct;
  const paybackYears =
    typeof preview?.simple_payback_months === 'number'
      ? preview.simple_payback_months / 12
      : null;
  const fmtNum = (v: any, digits = 0) =>
    typeof v === 'number' && Number.isFinite(v)
      ? v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
      : '—';
  return (
    <div className="mt-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          Live preview
        </div>
        <div className="text-[10px] text-indigo-700/70 dark:text-indigo-300/70">
          {pending ? 'Updating…' : 'Indicative — run full simulation for final numbers'}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <PreviewStat label="Annual gen" value={`${fmtNum(annualKwh)} kWh`} />
        <PreviewStat label="Solar utilised" value={utilisationPct != null ? `${fmtNum(utilisationPct, 1)}%` : '—'} />
        <PreviewStat label="NPV (25y)" value={fmtNum(npv)} />
        <PreviewStat label="IRR" value={irr != null ? `${fmtNum(irr, 1)}%` : '—'} />
        <PreviewStat label="Payback" value={paybackYears != null ? `${fmtNum(paybackYears, 1)} yrs` : '—'} />
      </div>
    </div>
  );
}

const DesignShadingCanvas = dynamic(() => import('../../../components/DesignShadingCanvas'), {
  ssr: false,
});

function DesignCanvasSpikeSlot({ form }: { form: any }) {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_DESIGN_CANVAS === 'true';
  const lat = parseFloat(form?.location_lat);
  const lon = parseFloat(form?.location_lon);
  const pv = parseFloat(form?.pv_capacity_kwp);
  const tilt = parseFloat(form?.tilt_angle);
  const azimuth = parseFloat(form?.azimuth_angle);
  if (!enabled) return null;
  if (!lat || !lon || !(pv > 0)) return null;
  return (
    <div className="mt-3">
      <DesignShadingCanvas
        lat={lat}
        lon={lon}
        tiltDeg={Number.isFinite(tilt) ? tilt : Math.abs(lat)}
        azimuthDeg={Number.isFinite(azimuth) ? azimuth : (lat >= 0 ? 180 : 0)}
        pvCapacityKwp={pv}
      />
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/70 dark:bg-slate-900/40 border border-indigo-100 dark:border-indigo-900 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{value}</div>
    </div>
  );
}
