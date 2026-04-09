import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { simulationAPI, designReportAPI, downloadBlob } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { getDashboardLayout } from '../../../components/Layout';
import { LoadingSpinner } from '../../../components/ui/index';
import { MotionSection } from '../../../components/PageMotion';
import SolarSchematic from '../../../components/SolarSchematic';
import {
  RiArrowLeftLine, RiDownloadLine, RiShareLine, RiSunLine,
  RiBatteryLine, RiMoneyDollarCircleLine, RiFlashlightLine,
  RiFileExcel2Line, RiFilePdf2Line, RiLinkM,
  RiRobot2Line, RiEditLine, RiCheckLine, RiPlugLine,
  RiAlertLine, RiErrorWarningLine, RiInformationLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Lazy-load Chart.js components
const Line = dynamic(() => import('react-chartjs-2').then(m => m.Line), { ssr: false });
const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false });
const Doughnut = dynamic(() => import('react-chartjs-2').then(m => m.Doughnut), { ssr: false });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BRAND = { primary: '#0D3B2E', accent: '#10B981', amber: '#F59E0B', red: '#EF4444', blue: '#3B82F6', purple: '#8B5CF6' };

const PV_TECH_LABELS = {
  mono_perc: 'Monocrystalline PERC', poly: 'Polycrystalline', cdte: 'Thin-Film CdTe',
  cigs: 'Thin-Film CIGS', topcon: 'TOPCon', hjt: 'HJT',
  bifacial_perc: 'Bifacial Mono PERC', topcon_bi: 'Bifacial TOPCon', hjt_bi: 'Bifacial HJT',
  a_si: 'Amorphous Silicon', organic: 'Organic PV',
};

const TOPOLOGY_LABELS = {
  grid_tied: 'Grid-Tied',
  grid_tied_bess: 'Grid-Tied + Battery',
  off_grid: 'Off-Grid',
  hybrid: 'Hybrid',
};

const TOPOLOGY_COLORS = {
  grid_tied: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  grid_tied_bess: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  off_grid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  hybrid: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

function fmt(n, d = 0) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function MetricCard({ icon: Icon, label, value, unit, color = 'forest' }) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className={`text-${color}-600`} />}
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">
        {value} <span className="text-sm font-normal text-gray-400">{unit}</span>
      </div>
    </div>
  );
}

export default function ResultsDashboard() {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { user, isElite } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [shareUrl, setShareUrl] = useState('');
  const [exporting, setExporting] = useState('');
  const [aiFeedback, setAiFeedback] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [editedFeedbackText, setEditedFeedbackText] = useState('');
  const reportRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const { data: res } = await designReportAPI.getHtmlData(projectId);
        setData(res?.data || res);
      } catch {
        toast.error('No simulation results found');
        router.push(`/projects/${projectId}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, router]);

  // Register Chart.js once on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('chart.js').then(({ Chart, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler }) => {
        Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);
      });
    }
  }, []);

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    setExporting('pdf');
    try {
      const { exportToPdf } = await import('../../../utils/pdfExport');
      await exportToPdf(reportRef.current, `SolNuv_Report_${project?.name?.replace(/\s+/g, '_') || projectId}_${Date.now()}.pdf`);
      toast.success('PDF downloaded');
    } catch (e) {
      console.error('PDF export failed:', e);
      toast.error('Failed to export PDF');
    } finally {
      setExporting('');
    }
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const res = await designReportAPI.downloadExcel(projectId);
      downloadBlob(res.data, `SolNuv_Report_${projectId}.xlsx`);
      toast.success('Excel downloaded');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Excel export requires Elite plan');
    } finally {
      setExporting('');
    }
  };

  const handleShare = async () => {
    try {
      const { data: res } = await designReportAPI.createShareLink(projectId, { expires_hours: 72 });
      const url = res?.data?.url;
      if (url) {
        setShareUrl(url);
        navigator.clipboard?.writeText(url);
        toast.success('Share link copied to clipboard');
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Share requires Pro plan');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const { project, design, result, tariff } = data;
  const monthly = result?.monthly_summary || [];
  const cashflow = result?.yearly_cashflow || [];
  const currency = tariff?.currency || 'NGN';
  const currSym = { ZAR: 'R', NGN: '₦', USD: '$' }[currency] || currency;

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'energy', label: 'Energy' },
    { key: 'battery', label: 'Battery', hide: !design?.bess_capacity_kwh },
    { key: 'financial', label: 'Financial' },
    { key: 'comparison', label: 'vs Grid/Diesel/Petrol' },
    { key: 'tariff', label: 'Tariff', hide: result?.grid_topology === 'off_grid' },
    { key: 'schematic', label: '⚡ Schematic', elite: true },
    { key: 'ai_feedback', label: 'AI Expert Analysis' },
  ].filter(t => !t.hide);

  // Chart data
  const monthlyEnergyChart = {
    labels: MONTHS,
    datasets: [
      { label: 'Load', data: monthly.map(m => m.load_kwh), backgroundColor: BRAND.primary + '99', borderColor: BRAND.primary, borderWidth: 1 },
      { label: 'Solar', data: monthly.map(m => m.pv_gen_kwh), backgroundColor: BRAND.amber + '99', borderColor: BRAND.amber, borderWidth: 1 },
      { label: 'Self-Use', data: monthly.map(m => m.solar_utilised_kwh), backgroundColor: BRAND.accent + '99', borderColor: BRAND.accent, borderWidth: 1 },
    ],
  };

  const energySplitChart = {
    labels: ['Self-Consumed', 'Grid Import', 'Grid Export'],
    datasets: [{
      data: [result?.solar_utilised_kwh || 0, result?.grid_import_kwh || 0, result?.grid_export_kwh || 0],
      backgroundColor: [BRAND.accent, BRAND.primary, BRAND.amber],
    }],
  };

  const cashflowChart = {
    labels: cashflow.map(c => `Yr ${c.year}`),
    datasets: [
      { label: 'Cumulative CF', data: cashflow.map(c => c.cumulative_cashflow), borderColor: BRAND.accent, backgroundColor: BRAND.accent + '20', fill: true, tension: 0.3 },
      { label: 'Annual Savings', data: cashflow.map(c => c.savings), borderColor: BRAND.amber, backgroundColor: 'transparent', tension: 0.3 },
    ],
  };

  return (
    <>
      <Head><title>Results — {project?.name} | SolNuv</title></Head>
      <MotionSection>
        <div ref={reportRef}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/projects/${projectId}`)} className="btn-icon">
              <RiArrowLeftLine />
            </button>
            <div>
              <h1 className="text-xl font-bold text-forest-900 dark:text-white">Design Results</h1>
              <p className="text-sm text-gray-500">{project?.name} — {project?.state}{project?.city ? `, ${project.city}` : ''}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExportPdf} disabled={exporting === 'pdf'} className="btn-secondary text-sm flex items-center gap-1">
              {exporting === 'pdf' ? <LoadingSpinner className="w-4 h-4" /> : <RiFilePdf2Line />} PDF
            </button>
            <button onClick={handleExportExcel} disabled={exporting === 'excel'} className="btn-secondary text-sm flex items-center gap-1">
              {exporting === 'excel' ? <LoadingSpinner className="w-4 h-4" /> : <RiFileExcel2Line />} Excel
            </button>
            <button onClick={handleShare} className="btn-secondary text-sm flex items-center gap-1">
              <RiShareLine /> Share
            </button>
          </div>
        </div>

        {shareUrl && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-xl text-sm flex items-center gap-2">
            <RiLinkM className="text-blue-600" />
            <input readOnly value={shareUrl} className="flex-1 bg-transparent outline-none text-blue-700 dark:text-blue-300" onClick={e => e.target.select()} />
          </div>
        )}

        {/* Executive Summary */}
        {result?.executive_summary_text && (
          <div className="mb-6 p-5 bg-gradient-to-r from-forest-900 to-green-800 text-white rounded-xl">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-green-300 mb-2">Executive Summary</h2>
            <p className="text-sm leading-relaxed opacity-90">{result.executive_summary_text}</p>
          </div>
        )}

        {/* Topology badge */}
        {result?.grid_topology && (
          <div className="mb-4 flex items-center gap-2">
            <RiPlugLine className="text-gray-400" />
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${TOPOLOGY_COLORS[result.grid_topology] || 'bg-gray-100 text-gray-700'}`}>
              {TOPOLOGY_LABELS[result.grid_topology] || result.grid_topology}
            </span>
          </div>
        )}

        {/* Design Warnings */}
        {result?.design_warnings?.length > 0 && (
          <div className="mb-6 space-y-2">
            {result.design_warnings.map((w, i) => {
              const sev = w.severity || 'warning';
              const styles = sev === 'critical'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
                : sev === 'info'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300';
              const Icon = sev === 'critical' ? RiErrorWarningLine : sev === 'info' ? RiInformationLine : RiAlertLine;
              return (
                <div key={i} className={`flex items-start gap-2 p-3 border rounded-xl text-sm ${styles}`}>
                  <Icon className="mt-0.5 flex-shrink-0 text-lg" />
                  <span>{w.message}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricCard icon={RiSunLine} label="PV Capacity" value={fmt(design?.pv_capacity_kwp, 1)} unit="kWp" />
          <MetricCard icon={RiFlashlightLine} label="Annual Gen" value={fmt(result?.annual_solar_gen_kwh)} unit="kWh" />
          <MetricCard icon={RiMoneyDollarCircleLine} label="Annual Savings" value={`${currSym}${fmt(result?.year1_savings)}`} unit="" />
          <MetricCard icon={RiMoneyDollarCircleLine} label="Payback" value={result?.simple_payback_months ? fmt(result.simple_payback_months / 12, 1) : '—'} unit="yrs" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <MetricCard label="Solar Fraction" value={result?.utilisation_pct != null ? fmt(result.utilisation_pct, 1) : '—'} unit="%" />
          <MetricCard label="Self-Consumption" value={result?.self_consumption_pct != null ? fmt(result.self_consumption_pct, 1) : '—'} unit="%" />
          <MetricCard label={`NPV (${design?.analysis_period_years || 25}yr)`} value={`${currSym}${fmt(result?.npv_25yr)}`} unit="" />
          <MetricCard label="IRR" value={result?.irr_pct != null ? fmt(result.irr_pct, 1) : '—'} unit="%" />
          <MetricCard label="LCOE" value={result?.lcoe_normal != null ? `${currSym}${fmt(result.lcoe_normal, 2)}` : '—'} unit="/kWh" />
        </div>

        {/* Topology-specific metrics */}
        {(result?.grid_topology === 'off_grid' || result?.grid_topology === 'hybrid') && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {result.unmet_load_kwh > 0 && (
              <MetricCard label="Unmet Load" value={fmt(result.unmet_load_kwh)} unit="kWh" color="red" />
            )}
            {result.unmet_load_hours > 0 && (
              <MetricCard label="Unmet Hours" value={fmt(result.unmet_load_hours)} unit="hrs/yr" color="red" />
            )}
            {result.loss_of_load_pct > 0 && (
              <MetricCard label="Loss of Load" value={fmt(result.loss_of_load_pct, 1)} unit="%" color="red" />
            )}
            {result.autonomy_achieved_days > 0 && (
              <MetricCard label="Autonomy" value={fmt(result.autonomy_achieved_days, 1)} unit="days" color="amber" />
            )}
            {result.islanded_hours > 0 && (
              <MetricCard label="Islanded" value={fmt(result.islanded_hours)} unit="hrs/yr" color="purple" />
            )}
            {result.feed_in_revenue > 0 && (
              <MetricCard label="Feed-in Revenue" value={`${currSym}${fmt(result.feed_in_revenue)}`} unit="" color="green" />
            )}
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                tab === t.key
                  ? 'text-forest-900 dark:text-white border-b-2 border-forest-900 dark:border-green-400'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              {t.elite && !isElite && (
                <span className="text-[9px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full leading-none">ELITE</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-6">

          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Energy split doughnut */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Energy Split</h3>
                  <div className="h-64">
                    <Doughnut data={energySplitChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                  </div>
                </div>
                {/* Monthly energy bar */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Monthly Energy (kWh)</h3>
                  <div className="h-64">
                    <Bar data={monthlyEnergyChart} options={{
                      responsive: true, maintainAspectRatio: false,
                      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() } } },
                      plugins: { legend: { position: 'bottom' } },
                    }} />
                  </div>
                </div>
              </div>

              {/* System specs */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-4">System Specifications</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-gray-500">Technology:</span> <strong>{PV_TECH_LABELS[design?.pv_technology] || design?.pv_technology}</strong></div>
                  <div><span className="text-gray-500">Tilt:</span> <strong>{design?.pv_tilt_deg}°</strong></div>
                  <div><span className="text-gray-500">Azimuth:</span> <strong>{design?.pv_azimuth_deg}°</strong></div>
                  <div><span className="text-gray-500">Losses:</span> <strong>{design?.pv_system_losses_pct}%</strong></div>
                  {/* User-supplied PV module */}
                  {design?.user_pv_module_make && (
                    <>
                      <div className="col-span-2 md:col-span-4 font-semibold text-blue-800 dark:text-blue-300 mt-2">PV Module (User Specified):</div>
                      <div><span className="text-gray-500">Make:</span> <strong>{design.user_pv_module_make}</strong></div>
                      <div><span className="text-gray-500">Model:</span> <strong>{design.user_pv_module_model}</strong></div>
                      <div><span className="text-gray-500">Power:</span> <strong>{design.user_pv_module_power_w} W</strong></div>
                      <div><span className="text-gray-500">Vmp:</span> <strong>{design.user_pv_module_vmp} V</strong></div>
                      <div><span className="text-gray-500">Imp:</span> <strong>{design.user_pv_module_imp} A</strong></div>
                    </>
                  )}
                  {design?.bess_capacity_kwh > 0 && (
                    <>
                      <div><span className="text-gray-500">Battery:</span> <strong>{design.bess_capacity_kwh} kWh</strong></div>
                      <div><span className="text-gray-500">Chemistry:</span> <strong>{design.bess_chemistry?.toUpperCase()}</strong></div>
                      <div><span className="text-gray-500">Strategy:</span> <strong>{design.bess_dispatch_strategy?.replace(/_/g, ' ')}</strong></div>
                      <div><span className="text-gray-500">DoD:</span> <strong>{design.bess_dod_pct}%</strong></div>
                    </>
                  )}
                  {/* User-supplied battery/PCS */}
                  {design?.user_battery_make && (
                    <>
                      <div className="col-span-2 md:col-span-4 font-semibold text-blue-800 dark:text-blue-300 mt-2">Battery & PCS (User Specified):</div>
                      <div><span className="text-gray-500">Battery Make:</span> <strong>{design.user_battery_make}</strong></div>
                      <div><span className="text-gray-500">Battery Model:</span> <strong>{design.user_battery_model}</strong></div>
                      <div><span className="text-gray-500">Battery Capacity:</span> <strong>{design.user_battery_capacity_kwh} kWh</strong></div>
                      <div><span className="text-gray-500">Battery Voltage:</span> <strong>{design.user_battery_voltage} V</strong></div>
                      <div><span className="text-gray-500">Max Discharge:</span> <strong>{design.user_battery_max_discharge_kw} kW</strong></div>
                      <div><span className="text-gray-500">PCS Make:</span> <strong>{design.user_pcs_make}</strong></div>
                      <div><span className="text-gray-500">PCS Model:</span> <strong>{design.user_pcs_model}</strong></div>
                      <div><span className="text-gray-500">PCS Power:</span> <strong>{design.user_pcs_power_kw} kW</strong></div>
                    </>
                  )}
                  {/* User-supplied inverter */}
                  {design?.user_inverter_make && (
                    <>
                      <div className="col-span-2 md:col-span-4 font-semibold text-blue-800 dark:text-blue-300 mt-2">Inverter (User Specified):</div>
                      <div><span className="text-gray-500">Inverter Make:</span> <strong>{design.user_inverter_make}</strong></div>
                      <div><span className="text-gray-500">Inverter Model:</span> <strong>{design.user_inverter_model}</strong></div>
                      <div><span className="text-gray-500">Inverter Power:</span> <strong>{design.user_inverter_power_kw} kW</strong></div>
                      <div><span className="text-gray-500">Inverter Voltage:</span> <strong>{design.user_inverter_voltage} V</strong></div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ENERGY TAB */}
          {tab === 'energy' && (
            <>
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-4">Monthly Energy Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-forest-900 text-white">
                        <th className="px-3 py-2 text-left">Month</th>
                        <th className="px-3 py-2 text-right">Load kWh</th>
                        <th className="px-3 py-2 text-right">Generation kWh</th>
                        <th className="px-3 py-2 text-right">Self-Use kWh</th>
                        <th className="px-3 py-2 text-right">Export kWh</th>
                        <th className="px-3 py-2 text-right">Grid kWh</th>
                        <th className="px-3 py-2 text-right">Savings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map((m, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2 font-medium">{MONTHS[i]}</td>
                          <td className="px-3 py-2 text-right">{fmt(m.load_kwh)}</td>
                          <td className="px-3 py-2 text-right">{fmt(m.pv_gen_kwh)}</td>
                          <td className="px-3 py-2 text-right text-green-600">{fmt(m.solar_utilised_kwh)}</td>
                          <td className="px-3 py-2 text-right text-amber-600">{fmt(m.grid_export_kwh)}</td>
                          <td className="px-3 py-2 text-right">{fmt(m.grid_import_kwh)}</td>
                          <td className="px-3 py-2 text-right font-medium">{currSym}{fmt(m.savings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* BATTERY TAB */}
          {tab === 'battery' && design?.bess_capacity_kwh > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <MetricCard icon={RiBatteryLine} label="Capacity" value={design.bess_capacity_kwh} unit="kWh" />
                <MetricCard label="Annual Throughput" value={fmt(result?.battery_discharged_kwh)} unit="kWh" />
                <MetricCard label="Annual Cycles" value={fmt(result?.battery_cycles_annual, 0)} unit="" />
                <MetricCard label="Peak Shave" value={result?.peak_shave_kw ? fmt(result.peak_shave_kw, 1) : '—'} unit="kW" />
              </div>
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-4">Monthly Battery Utilisation</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-forest-900 text-white">
                        <th className="px-3 py-2 text-left">Month</th>
                        <th className="px-3 py-2 text-right">Charge kWh</th>
                        <th className="px-3 py-2 text-right">Discharge kWh</th>
                        <th className="px-3 py-2 text-right">Cycles</th>
                        <th className="px-3 py-2 text-right">Avg SOC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map((m, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2 font-medium">{MONTHS[i]}</td>
                          <td className="px-3 py-2 text-right">{fmt(m.battery_charged_kwh)}</td>
                          <td className="px-3 py-2 text-right">{fmt(m.battery_discharged_kwh)}</td>
                          <td className="px-3 py-2 text-right">{fmt(m.bess_cycles, 1)}</td>
                          <td className="px-3 py-2 text-right">{m.bess_avg_soc ? (m.bess_avg_soc * 100).toFixed(1) + '%' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* FINANCIAL TAB */}
          {tab === 'financial' && (
            <>
              <div className="card p-5 mb-4">
                <h3 className="text-sm font-semibold mb-4">{design?.analysis_period_years || 25}-Year Cashflow</h3>
                <div className="h-72">
                  <Line data={cashflowChart} options={{
                    responsive: true, maintainAspectRatio: false,
                    scales: { y: { ticks: { callback: v => `${currSym}${(v / 1000000).toFixed(1)}M` } } },
                    plugins: { legend: { position: 'bottom' } },
                  }} />
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-4">Annual Cost Comparison</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl text-center">
                    <p className="text-xs text-gray-500 mb-1">Baseline Grid Cost</p>
                    <p className="text-lg font-bold text-red-600">{currSym}{fmt(result?.baseline_annual_cost)}</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl text-center">
                    <p className="text-xs text-gray-500 mb-1">With-Solar Grid Cost</p>
                    <p className="text-lg font-bold text-green-600">{currSym}{fmt(result?.year1_annual_cost)}</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl text-center">
                    <p className="text-xs text-gray-500 mb-1">Annual Savings</p>
                    <p className="text-lg font-bold text-amber-600">{currSym}{fmt(result?.year1_savings)}</p>
                    <p className="text-xs text-gray-500">{result?.baseline_annual_cost && result?.year1_savings ? ((result.year1_savings / result.baseline_annual_cost) * 100).toFixed(0) + '% reduction' : ''}</p>
                  </div>
                </div>
              </div>

              {cashflow.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Yearly Cashflow Table</h3>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="bg-forest-900 text-white">
                          <th className="px-3 py-2 text-left">Year</th>
                          <th className="px-3 py-2 text-right">Savings</th>
                          <th className="px-3 py-2 text-right">O&M</th>
                          <th className="px-3 py-2 text-right">Net CF</th>
                          <th className="px-3 py-2 text-right">Cumulative</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashflow.map((cf, i) => (
                          <tr key={i} className={`border-b border-gray-100 dark:border-gray-700 ${cf.cumulative_cashflow >= 0 && (i === 0 || cashflow[i - 1].cumulative_cashflow < 0) ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
                            <td className="px-3 py-2">{cf.year}</td>
                            <td className="px-3 py-2 text-right text-green-600">{currSym}{fmt(cf.savings)}</td>
                            <td className="px-3 py-2 text-right text-red-500">{currSym}{fmt(cf.om_cost)}</td>
                            <td className="px-3 py-2 text-right">{currSym}{fmt(cf.net_cashflow)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${cf.cumulative_cashflow >= 0 ? 'text-green-600' : 'text-red-500'}`}>{currSym}{fmt(cf.cumulative_cashflow)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* COMPARISON TAB — Solar vs Grid vs Diesel vs Petrol */}
          {tab === 'comparison' && (
            <div className="space-y-6">
              {/* Annual Cost Comparison */}
              {result?.energy_comparison?.annual_costs && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-forest-900 dark:text-white mb-4">Annual Cost Comparison (Year 1)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border-2 border-emerald-500">
                      <div className="text-xs text-emerald-600 font-medium mb-1">Solar System</div>
                      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{currSym}{fmt(result.energy_comparison.annual_costs.solar)}</div>
                      <div className="text-xs text-emerald-500 mt-1">Your choice</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 font-medium mb-1">Grid Only</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{currSym}{fmt(result.energy_comparison.annual_costs.grid_only)}</div>
                      <div className={`text-xs mt-1 ${result.energy_comparison.annual_savings.vs_grid > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {result.energy_comparison.annual_savings.vs_grid > 0 ? 'Save ' : ''}
                        {currSym}{fmt(Math.abs(result.energy_comparison.annual_savings.vs_grid))}/yr
                      </div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800">
                      <div className="text-xs text-orange-600 font-medium mb-1">Diesel Generator</div>
                      <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{currSym}{fmt(result.energy_comparison.annual_costs.diesel)}</div>
                      <div className="text-xs text-emerald-600 mt-1">Save {currSym}{fmt(result.energy_comparison.annual_savings.vs_diesel)}/yr</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
                      <div className="text-xs text-red-500 font-medium mb-1">Petrol Generator</div>
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">{currSym}{fmt(result.energy_comparison.annual_costs.petrol)}</div>
                      <div className="text-xs text-emerald-600 mt-1">Save {currSym}{fmt(result.energy_comparison.annual_savings.vs_petrol)}/yr</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lifetime Cost Comparison */}
              {result?.energy_comparison?.lifetime_costs && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-forest-900 dark:text-white mb-4">
                    Lifetime Cost ({result?.analysis_period_years || 25} Years)
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Solar System', value: result.energy_comparison.lifetime_costs.solar, color: 'bg-emerald-500' },
                      { label: 'Grid Only', value: result.energy_comparison.lifetime_costs.grid_only, color: 'bg-gray-500' },
                      { label: 'Diesel Gen.', value: result.energy_comparison.lifetime_costs.diesel, color: 'bg-orange-500' },
                      { label: 'Petrol Gen.', value: result.energy_comparison.lifetime_costs.petrol, color: 'bg-red-500' },
                    ].sort((a, b) => a.value - b.value).map((item, idx) => {
                      const maxVal = Math.max(
                        result.energy_comparison.lifetime_costs.solar,
                        result.energy_comparison.lifetime_costs.grid_only,
                        result.energy_comparison.lifetime_costs.diesel,
                        result.energy_comparison.lifetime_costs.petrol,
                      );
                      const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                      return (
                        <div key={idx}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">
                              {idx === 0 && <span className="text-emerald-600 font-semibold mr-1">Best</span>}
                              {item.label}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">{currSym}{fmt(item.value)}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div className={`${item.color} h-3 rounded-full`} style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Environmental Impact */}
              {result?.energy_comparison?.environmental && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-forest-900 dark:text-white mb-4">Environmental Impact (Annual)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmt(result.energy_comparison.environmental.co2_avoided_vs_grid_kg)}</div>
                      <div className="text-xs text-gray-500 mt-1">kg CO₂ avoided vs grid</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmt(result.energy_comparison.environmental.co2_avoided_lifetime_tonnes, 1)}</div>
                      <div className="text-xs text-gray-500 mt-1">tonnes CO₂ avoided (lifetime)</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmt(result.energy_comparison.environmental.trees_equivalent)}</div>
                      <div className="text-xs text-gray-500 mt-1">trees equivalent per year</div>
                    </div>
                    <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                      <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{fmt(result.energy_comparison.environmental.diesel_avoided_litres)}</div>
                      <div className="text-xs text-gray-500 mt-1">litres diesel avoided/yr</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fuel Consumption Comparison */}
              {result?.energy_comparison?.fuel_consumption && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-forest-900 dark:text-white mb-4">Fuel Consumption Comparison (Annual)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-forest-900 text-white">
                          <th className="px-3 py-2 text-left">Energy Source</th>
                          <th className="px-3 py-2 text-right">Fuel/yr</th>
                          <th className="px-3 py-2 text-right">CO₂/yr (kg)</th>
                          <th className="px-3 py-2 text-right">Cost/kWh</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-emerald-50/50 dark:bg-emerald-900/10">
                          <td className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-400">Solar</td>
                          <td className="px-3 py-2 text-right">—</td>
                          <td className="px-3 py-2 text-right">{fmt(result.energy_comparison.environmental.co2_solar_kg)}</td>
                          <td className="px-3 py-2 text-right">{currSym}{result.lcoe_normal?.toFixed(2) || '—'}</td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2">Grid Only</td>
                          <td className="px-3 py-2 text-right">—</td>
                          <td className="px-3 py-2 text-right">{fmt(result.energy_comparison.environmental.co2_grid_only_kg)}</td>
                          <td className="px-3 py-2 text-right">—</td>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2">Diesel Gen.</td>
                          <td className="px-3 py-2 text-right">{fmt(result.energy_comparison.fuel_consumption.diesel_litres_annual)} L</td>
                          <td className="px-3 py-2 text-right">{fmt(result.energy_comparison.environmental.co2_diesel_kg)}</td>
                          <td className="px-3 py-2 text-right">{currSym}{result.energy_comparison.fuel_consumption.diesel_cost_per_kwh?.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2">Petrol Gen.</td>
                          <td className="px-3 py-2 text-right">{fmt(result.energy_comparison.fuel_consumption.petrol_litres_annual)} L</td>
                          <td className="px-3 py-2 text-right">{fmt(result.energy_comparison.environmental.co2_petrol_kg)}</td>
                          <td className="px-3 py-2 text-right">{currSym}{result.energy_comparison.fuel_consumption.petrol_cost_per_kwh?.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Yearly Cost Projection Chart */}
              {result?.energy_comparison?.yearly_comparison?.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-forest-900 dark:text-white mb-4">Yearly Cost Projection</h3>
                  <div className="h-72">
                    <Line data={{
                      labels: result.energy_comparison.yearly_comparison.map(y => `Yr ${y.year}`),
                      datasets: [
                        { label: 'Solar', data: result.energy_comparison.yearly_comparison.map(y => y.solar_cost), borderColor: BRAND.accent, backgroundColor: BRAND.accent + '22', fill: false, tension: 0.3, pointRadius: 0 },
                        { label: 'Grid Only', data: result.energy_comparison.yearly_comparison.map(y => y.grid_cost), borderColor: BRAND.primary, borderDash: [5, 3], fill: false, tension: 0.3, pointRadius: 0 },
                        { label: 'Diesel', data: result.energy_comparison.yearly_comparison.map(y => y.diesel_cost), borderColor: BRAND.amber, borderDash: [3, 3], fill: false, tension: 0.3, pointRadius: 0 },
                        { label: 'Petrol', data: result.energy_comparison.yearly_comparison.map(y => y.petrol_cost), borderColor: BRAND.red, borderDash: [2, 2], fill: false, tension: 0.3, pointRadius: 0 },
                      ],
                    }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => `${currSym}${(v / 1000000).toFixed(1)}M` } } } }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">Annual cost comparison over project lifetime with escalation rates applied</p>
                </div>
              )}
            </div>
          )}

          {/* TARIFF TAB */}
          {tab === 'tariff' && tariff && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-2">{tariff.tariff_name}</h3>
              <p className="text-sm text-gray-500 mb-4">{tariff.utility_name} — {tariff.tariff_type?.toUpperCase()}</p>
              {tariff.tariff_rates?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-forest-900 text-white">
                        <th className="px-3 py-2 text-left">Season</th>
                        <th className="px-3 py-2 text-left">Period</th>
                        <th className="px-3 py-2 text-right">Rate/kWh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tariff.tariff_rates.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2">{r.season_key}</td>
                          <td className="px-3 py-2">{r.period_name}</td>
                          <td className="px-3 py-2 text-right font-medium">{currSym}{r.rate_per_kwh?.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* AI EXPERT ANALYSIS TAB */}
          {tab === 'ai_feedback' && (
            <div className="space-y-6">
              {/* Generate button or existing feedback */}
              {!aiFeedback && !result?.ai_expert_feedback ? (
                <div className="card p-8 text-center">
                  <RiRobot2Line className="text-4xl text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-forest-900 dark:text-white mb-2">AI Expert Analysis</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                    Get an AI-powered expert review of your solar system design — covering sizing, performance, financial outlook, and specific recommendations for your project.
                  </p>
                  <button
                    onClick={async () => {
                      setAiLoading(true);
                      try {
                        const { data: res } = await simulationAPI.generateAIFeedback(projectId);
                        const fb = res?.data?.feedback || res?.feedback;
                        setAiFeedback(fb);
                        toast.success('AI analysis generated');
                      } catch (e) {
                        toast.error(e?.response?.data?.message || 'Failed to generate AI analysis');
                      } finally {
                        setAiLoading(false);
                      }
                    }}
                    disabled={aiLoading}
                    className="btn-primary inline-flex items-center gap-2">
                    {aiLoading ? <LoadingSpinner className="w-4 h-4" /> : <RiRobot2Line />}
                    {aiLoading ? 'Analysing...' : 'Generate Expert Analysis'}
                  </button>
                </div>
              ) : (
                (() => {
                  const fb = aiFeedback || result?.ai_expert_feedback;
                  if (!fb) return null;

                  const ratingColors = {
                    excellent: 'bg-green-100 text-green-700',
                    good: 'bg-emerald-100 text-emerald-700',
                    fair: 'bg-amber-100 text-amber-700',
                    needs_improvement: 'bg-red-100 text-red-700',
                  };

                  return (
                    <>
                      {/* Rating + Summary */}
                      <div className="card p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <RiRobot2Line className="text-xl text-emerald-500" />
                            <h3 className="text-sm font-semibold">AI Expert Assessment</h3>
                            {fb.overall_rating && (
                              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ratingColors[fb.overall_rating] || 'bg-gray-100 text-gray-700'}`}>
                                {fb.overall_rating.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                            )}
                          </div>
                          {result?.ai_feedback_generated_at && (
                            <span className="text-xs text-gray-400">
                              {new Date(result.ai_feedback_generated_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {fb.summary && <p className="text-sm text-gray-600 dark:text-gray-300">{fb.summary}</p>}
                      </div>

                      {/* Sizing Assessment */}
                      {fb.sizing_assessment && (
                        <div className="card p-5">
                          <h3 className="text-sm font-semibold mb-3">Sizing Assessment</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">PV Sizing:</span>{' '}
                              <span className={`font-medium ${fb.sizing_assessment.pv_sizing === 'appropriate' ? 'text-green-600' : 'text-amber-600'}`}>
                                {fb.sizing_assessment.pv_sizing?.replace('_', ' ')}
                              </span>
                              {fb.sizing_assessment.pv_comment && (
                                <p className="text-xs text-gray-400 mt-0.5">{fb.sizing_assessment.pv_comment}</p>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-500">Battery Sizing:</span>{' '}
                              <span className={`font-medium ${fb.sizing_assessment.battery_sizing === 'appropriate' ? 'text-green-600' : fb.sizing_assessment.battery_sizing === 'not_applicable' ? 'text-gray-400' : 'text-amber-600'}`}>
                                {fb.sizing_assessment.battery_sizing?.replace('_', ' ')}
                              </span>
                              {fb.sizing_assessment.battery_comment && (
                                <p className="text-xs text-gray-400 mt-0.5">{fb.sizing_assessment.battery_comment}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Strengths & Concerns */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fb.strengths?.length > 0 && (
                          <div className="card p-5">
                            <h3 className="text-sm font-semibold text-green-700 mb-2">Strengths</h3>
                            <ul className="space-y-1.5">
                              {fb.strengths.map((s, i) => (
                                <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                  <span className="text-green-500 mt-0.5">✓</span>
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {fb.concerns?.length > 0 && (
                          <div className="card p-5">
                            <h3 className="text-sm font-semibold text-amber-700 mb-2">Concerns</h3>
                            <ul className="space-y-1.5">
                              {fb.concerns.map((c, i) => (
                                <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                  <span className="text-amber-500 mt-0.5">⚠</span>
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Recommendations */}
                      {fb.recommendations?.length > 0 && (
                        <div className="card p-5">
                          <h3 className="text-sm font-semibold mb-3">Recommendations</h3>
                          <ol className="space-y-2">
                            {fb.recommendations.map((r, i) => (
                              <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                <span className="bg-forest-900 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Financial Assessment */}
                      {fb.financial_assessment && (
                        <div className="card p-5">
                          <h3 className="text-sm font-semibold mb-2">Financial Outlook</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{fb.financial_assessment}</p>
                        </div>
                      )}

                      {/* Editable feedback */}
                      <div className="card p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold">Your Notes / Edits</h3>
                          {!editingFeedback ? (
                            <button
                              onClick={() => {
                                setEditingFeedback(true);
                                setEditedFeedbackText(result?.ai_feedback_edited || '');
                              }}
                              className="btn-secondary text-xs flex items-center gap-1">
                              <RiEditLine /> Edit
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                try {
                                  await simulationAPI.saveAIFeedback(projectId, editedFeedbackText);
                                  setEditingFeedback(false);
                                  toast.success('Feedback saved');
                                } catch {
                                  toast.error('Failed to save');
                                }
                              }}
                              className="btn-primary text-xs flex items-center gap-1">
                              <RiCheckLine /> Save
                            </button>
                          )}
                        </div>
                        {editingFeedback ? (
                          <textarea
                            value={editedFeedbackText}
                            onChange={e => setEditedFeedbackText(e.target.value)}
                            rows={6}
                            className="input w-full text-sm"
                            placeholder="Add your own notes, corrections, or additional commentary here. This editable version can be included in shared reports."
                          />
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            {result?.ai_feedback_edited || 'Click Edit to add your own commentary to this analysis before sharing.'}
                          </p>
                        )}
                      </div>

                      {/* Regenerate button */}
                      <div className="text-center">
                        <button
                          onClick={async () => {
                            setAiLoading(true);
                            try {
                              const { data: res } = await simulationAPI.generateAIFeedback(projectId);
                              const fb = res?.data?.feedback || res?.feedback;
                              setAiFeedback(fb);
                              toast.success('AI analysis regenerated');
                            } catch (e) {
                              toast.error(e?.response?.data?.message || 'Failed to regenerate');
                            } finally {
                              setAiLoading(false);
                            }
                          }}
                          disabled={aiLoading}
                          className="btn-secondary text-sm inline-flex items-center gap-1">
                          {aiLoading ? <LoadingSpinner className="w-4 h-4" /> : <RiRobot2Line />}
                          Regenerate Analysis
                        </button>
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          )}

          {/* SCHEMATIC TAB — Elite+ */}
          {tab === 'schematic' && (
            isElite ? (
              <SolarSchematic design={design} result={result} />
            ) : (
              <div className="card p-10 text-center space-y-4">
                <div className="text-5xl">⚡</div>
                <h3 className="text-lg font-semibold text-forest-900 dark:text-white">System Schematic — Elite Feature</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  View a full single-line wiring schematic for your solar + BESS system, including component specs, string configurations, protection devices, and topology-specific layouts.
                </p>
                <a href="/plans" className="btn-primary inline-flex items-center gap-2 mt-2">
                  Upgrade to Elite →
                </a>
              </div>
            )
          )}
        </div>
        </div>
      </MotionSection>
    </>
  );
}

ResultsDashboard.getLayout = getDashboardLayout;
