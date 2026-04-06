import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { simulationAPI, designReportAPI, downloadBlob } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { getDashboardLayout } from '../../../components/Layout';
import { LoadingSpinner } from '../../../components/ui/index';
import { MotionSection } from '../../../components/PageMotion';
import {
  RiArrowLeftLine, RiDownloadLine, RiShareLine, RiSunLine,
  RiBatteryLine, RiMoneyDollarCircleLine, RiFlashlightLine,
  RiFileExcel2Line, RiFilePdf2Line, RiLinkM,
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
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [shareUrl, setShareUrl] = useState('');
  const [exporting, setExporting] = useState('');

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
    setExporting('pdf');
    try {
      const res = await designReportAPI.downloadPdf(projectId);
      downloadBlob(res.data, `SolNuv_Report_${projectId}.pdf`);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'PDF export requires Pro plan');
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
    { key: 'tariff', label: 'Tariff' },
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
          <MetricCard label="NPV (25yr)" value={`${currSym}${fmt(result?.npv_25yr)}`} unit="" />
          <MetricCard label="IRR" value={result?.irr_pct != null ? fmt(result.irr_pct, 1) : '—'} unit="%" />
          <MetricCard label="LCOE" value={result?.lcoe_normal != null ? `${currSym}${fmt(result.lcoe_normal, 2)}` : '—'} unit="/kWh" />
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'text-forest-900 dark:text-white border-b-2 border-forest-900 dark:border-green-400'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
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
                  {design?.bess_capacity_kwh > 0 && (
                    <>
                      <div><span className="text-gray-500">Battery:</span> <strong>{design.bess_capacity_kwh} kWh</strong></div>
                      <div><span className="text-gray-500">Chemistry:</span> <strong>{design.bess_chemistry?.toUpperCase()}</strong></div>
                      <div><span className="text-gray-500">Strategy:</span> <strong>{design.bess_dispatch_strategy?.replace(/_/g, ' ')}</strong></div>
                      <div><span className="text-gray-500">DoD:</span> <strong>{design.bess_dod_pct}%</strong></div>
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
                <h3 className="text-sm font-semibold mb-4">25-Year Cashflow</h3>
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
        </div>
      </MotionSection>
    </>
  );
}

ResultsDashboard.getLayout = getDashboardLayout;
