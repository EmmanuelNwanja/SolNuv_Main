import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { designReportAPI } from '../../services/api';
import { RiSunLine, RiBatteryLine, RiMoneyDollarCircleLine, RiFlashlightLine, RiLeafLine, RiBarChartBoxLine, RiTimeLine, RiFileChartLine, RiGlobalLine, RiLockLine, RiArrowRightSLine } from 'react-icons/ri';
import dynamic from 'next/dynamic';

const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false });
const Doughnut = dynamic(() => import('react-chartjs-2').then(m => m.Doughnut), { ssr: false });
const Line = dynamic(() => import('react-chartjs-2').then(m => m.Line), { ssr: false });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BRAND = { primary: '#0D3B2E', accent: '#10B981', amber: '#F59E0B', red: '#EF4444', blue: '#3B82F6' };

function fmt(n, d = 0) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtCurrency(n) {
  if (n == null) return '—';
  return '₦' + Number(n).toLocaleString('en', { maximumFractionDigits: 0 });
}

const TOPOLOGY_LABELS = {
  grid_tied: 'Grid-Tied',
  grid_tied_bess: 'Grid-Tied + Battery',
  off_grid: 'Off-Grid',
  hybrid: 'Hybrid',
};

const TECH_LABELS = {
  mono_perc: 'Monocrystalline PERC',
  poly: 'Polycrystalline',
  topcon: 'TOPCon',
  hjt: 'HJT',
  bifacial_perc: 'Bifacial Mono PERC',
};

const CHEM_LABELS = {
  lifepo4: 'LFP (LiFePO4)',
  nmc: 'NMC',
  nca: 'NCA',
};

const SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'pv-system', label: 'PV System' },
  { id: 'battery', label: 'Battery' },
  { id: 'tariff', label: 'Tariff' },
  { id: 'cost', label: 'Cost Analysis' },
  { id: 'comparison', label: 'Energy Comparison' },
  { id: 'charts', label: 'Charts' },
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'environmental', label: 'Environmental' },
  { id: 'ai-analysis', label: 'AI Analysis' },
  { id: 'monthly', label: 'Monthly Details' },
];

export default function SharedReport() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('summary');
  const [exportingPdf, setExportingPdf] = useState(false);
  const sectionRefs = useRef({});
  const reportRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data: res } = await designReportAPI.getSharedReport(token);
        setData(res?.data || res);
      } catch (e) {
        setError(e?.response?.data?.message || 'Report not found or link expired');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('chart.js').then(({ Chart, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler }) => {
        Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);
      });
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [data]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setExportingPdf(true);
    const filename = `SolNuv_Design_Report_${data?.project?.name?.replace(/\s+/g, '_') || 'Report'}_${Date.now()}.pdf`;
    try {
      const { exportToPdf } = await import('../../utils/pdfExport');
      await exportToPdf(reportRef.current, filename);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#10B981] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <RiLockLine className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Report Unavailable</h1>
          <p className="text-gray-500 mb-4">{error}</p>
          <a href="https://solnuv.com" className="inline-flex items-center gap-2 text-[#10B981] hover:underline">
            Go to SolNuv <RiArrowRightSLine />
          </a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { project, design, tariff, equipment, result } = data;
  const monthly = result?.monthly_summary || [];
  const cashflow = result?.yearly_cashflow || [];
  const energyComp = result?.energy_comparison || {};

  const totalSelfConsumed = monthly.reduce((s, m) => s + (m.solar_utilised_kwh || 0), 0);
  const totalGridImport = monthly.reduce((s, m) => s + (m.grid_import_kwh || 0), 0);
  const totalGridExport = monthly.reduce((s, m) => s + (m.grid_export_kwh || 0), 0);
  const totalLoad = monthly.reduce((s, m) => s + (m.load_kwh || 0), 0);

  const panels = equipment?.filter(e => e.equipment_type === 'panel') || [];
  const batteries = equipment?.filter(e => e.equipment_type === 'battery') || [];

  const co2Factor = 0.5;
  const treesFactor = 0.02;
  const annualCO2 = (result?.annual_generation_kwh || 0) * co2Factor;
  const treesOffset = annualCO2 * treesFactor;

  const energySplitChart = {
    labels: ['Self-Consumed', 'Grid Import', 'Grid Export'],
    datasets: [{
      data: [Math.round(totalSelfConsumed), Math.round(totalGridImport), Math.round(totalGridExport)],
      backgroundColor: [BRAND.accent, BRAND.primary, BRAND.amber],
      borderWidth: 0,
    }],
  };

  const monthlyChart = {
    labels: MONTHS,
    datasets: [
      { label: 'Load', data: monthly.map(m => Math.round(m.load_kwh || 0)), backgroundColor: BRAND.primary + 'CC' },
      { label: 'Solar', data: monthly.map(m => Math.round(m.pv_gen_kwh || 0)), backgroundColor: BRAND.amber + 'CC' },
    ],
  };

  const yearlyCostChart = cashflow.length > 0 ? {
    labels: cashflow.map(c => `Year ${c.year}`),
    datasets: [
      { label: 'Baseline Cost', data: cashflow.map(c => Math.round((c.baseline_cost || 0))), borderColor: BRAND.red, backgroundColor: BRAND.red + '20', fill: true, tension: 0.3 },
      { label: 'With Solar', data: cashflow.map(c => Math.round((c.with_solar_cost || 0))), borderColor: BRAND.accent, backgroundColor: BRAND.accent + '20', fill: true, tension: 0.3 },
    ],
  } : null;

  const cashflowChart = cashflow.length > 0 ? {
    labels: cashflow.map(c => `Yr ${c.year}`),
    datasets: [
      { label: 'Cumulative CF', data: cashflow.map(c => Math.round(c.cumulative_cashflow || 0)), borderColor: BRAND.accent, backgroundColor: BRAND.accent + '20', fill: true, tension: 0.3 },
      { label: 'Annual Savings', data: cashflow.map(c => Math.round(c.savings || 0)), borderColor: BRAND.amber, backgroundColor: 'transparent', tension: 0.3 },
    ],
  } : null;

  return (
    <>
      <Head>
        <title>{project?.name || 'Solar Design Report'} | SolNuv</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gray-100">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-[#0D3B2E] text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#10B981] rounded-lg flex items-center justify-center">
                    <RiSunLine className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-green-300">SolNuv Design Report</p>
                    <h1 className="text-lg font-bold">{project?.name || 'Solar Project'}</h1>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden md:block">
                  {project?.company && <p className="text-sm text-green-300">{project.company}</p>}
                  <p className="text-xs text-green-200">{project?.location}{project?.state && `, ${project.state}`}</p>
                </div>
                <button
                  onClick={() => downloadPdf()}
                  disabled={exportingPdf}
                  className="flex items-center gap-2 bg-[#10B981] hover:bg-[#0D9668] px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  {exportingPdf ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  {exportingPdf ? 'Exporting...' : 'Download PDF'}
                </button>
                <a href="https://solnuv.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors">
                  <span className="font-semibold">SolNuv</span>
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto flex" ref={reportRef}>
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto p-6">
            <nav className="space-y-1">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    activeSection === section.id
                      ? 'bg-[#10B981] text-white font-medium shadow-md'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 px-6 py-8 space-y-8">
            {/* Executive Summary */}
            {result?.executive_summary_text && (
              <section id="summary" ref={(el) => (sectionRefs.current['summary'] = el)} className="bg-gradient-to-r from-[#0D3B2E] to-[#166534] text-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-green-300 mb-3">Executive Summary</h2>
                <p className="text-base leading-relaxed opacity-95">{result.executive_summary_text}</p>
              </section>
            )}

            {/* Key Metrics */}
            <section className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">PV Capacity</p>
                  <p className="text-3xl font-bold text-[#0D3B2E]">{fmt(design?.pv_capacity_kwp, 1)} <span className="text-lg">kWp</span></p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Annual Generation</p>
                  <p className="text-3xl font-bold text-[#0D3B2E]">{fmt(result?.annual_generation_kwh)} <span className="text-lg">kWh</span></p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Year 1 Savings</p>
                  <p className="text-3xl font-bold text-[#10B981]">{fmtCurrency(result?.annual_savings)}</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Payback Period</p>
                  <p className="text-3xl font-bold text-[#0D3B2E]">{result?.simple_payback_years ? fmt(result.simple_payback_years, 1) : '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 divide-x divide-gray-100 bg-gray-50 border-t">
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">Solar Fraction</p>
                  <p className="text-lg font-semibold">{result?.solar_fraction != null ? fmt(result.solar_fraction, 1) + '%' : '—'}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">Self-Consumption</p>
                  <p className="text-lg font-semibold">{result?.self_consumption_ratio != null ? fmt(result.self_consumption_ratio, 1) + '%' : '—'}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">NPV</p>
                  <p className="text-lg font-semibold text-[#10B981]">{fmtCurrency(result?.npv_25yr)}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">IRR</p>
                  <p className="text-lg font-semibold">{result?.irr != null ? fmt(result.irr, 1) + '%' : '—'}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">LCOE</p>
                  <p className="text-lg font-semibold">{result?.lcoe != null ? '₦' + fmt(result.lcoe, 2) + '/kWh' : '—'}</p>
                </div>
              </div>
            </section>

            {/* PV System Configuration */}
            <section id="pv-system" ref={(el) => (sectionRefs.current['pv-system'] = el)} className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                  <RiSunLine className="w-5 h-5 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0D3B2E]">PV System Configuration</h2>
                  <p className="text-sm text-gray-500">Solar array specifications and design parameters</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Technology</p>
                  <p className="text-sm font-medium">{TECH_LABELS[design?.pv_technology] || design?.pv_technology || '—'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Array Tilt</p>
                  <p className="text-sm font-medium">{design?.pv_tilt_deg ?? '—'}°</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Array Azimuth</p>
                  <p className="text-sm font-medium">{design?.pv_azimuth_deg ?? '—'}°</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">System Losses</p>
                  <p className="text-sm font-medium">{design?.pv_system_losses_pct ?? 14}%</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Annual Degradation</p>
                  <p className="text-sm font-medium">{design?.pv_degradation_annual_pct ?? 0.5}%</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Analysis Period</p>
                  <p className="text-sm font-medium">{design?.analysis_period_years || 25} years</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Discount Rate</p>
                  <p className="text-sm font-medium">{design?.discount_rate_pct ?? 10}%</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Tariff Escalation</p>
                  <p className="text-sm font-medium">{design?.tariff_escalation_pct ?? 8}%/yr</p>
                </div>
              </div>
              {panels.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-3">Installed Panels</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {panels.map((p, i) => (
                      <div key={i} className="p-3 bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg">
                        <p className="font-medium text-sm">{p.brand || p.manufacturer || 'Generic'}</p>
                        <p className="text-xs text-gray-500 mt-1">{p.quantity || 1} × {p.rated_power_w ? (p.rated_power_w / 1000).toFixed(1) + ' kW' : '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Battery System */}
            {design?.bess_capacity_kwh > 0 && (
              <section id="battery" ref={(el) => (sectionRefs.current['battery'] = el)} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                    <RiBatteryLine className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#0D3B2E]">Battery Energy Storage System</h2>
                    <p className="text-sm text-gray-500">Energy storage specifications and performance</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Rated Capacity</p>
                    <p className="text-lg font-semibold">{fmt(design?.bess_capacity_kwh)} kWh</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Power Rating</p>
                    <p className="text-lg font-semibold">{fmt(design?.bess_power_kw)} kW</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Chemistry</p>
                    <p className="text-lg font-semibold">{CHEM_LABELS[design?.bess_chemistry] || design?.bess_chemistry || 'LFP'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Round-Trip Efficiency</p>
                    <p className="text-lg font-semibold">{((design?.bess_round_trip_efficiency || 0.9) * 100).toFixed(0)}%</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Depth of Discharge</p>
                    <p className="text-lg font-semibold">{design?.bess_dod_pct || 80}%</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Dispatch Strategy</p>
                    <p className="text-lg font-semibold capitalize">{(design?.bess_dispatch_strategy || 'self_consumption').replace(/_/g, ' ')}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Annual Throughput</p>
                    <p className="text-lg font-semibold">{fmt(result?.battery_discharged_kwh)} kWh</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Annual Cycles</p>
                    <p className="text-lg font-semibold">{fmt(result?.battery_cycles_annual, 0)}</p>
                  </div>
                </div>
                {batteries.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-sm font-medium text-gray-700 mb-3">Installed Batteries</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {batteries.map((b, i) => (
                        <div key={i} className="p-3 bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg">
                          <p className="font-medium text-sm">{b.brand || b.manufacturer || 'Generic'}</p>
                          <p className="text-xs text-gray-500 mt-1">{b.quantity || 1} × {b.rated_capacity_kwh ? b.rated_capacity_kwh + ' kWh' : '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Grid Tariff */}
            {tariff && (
              <section id="tariff" ref={(el) => (sectionRefs.current['tariff'] = el)} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                    <RiBarChartBoxLine className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#0D3B2E]">Grid Tariff Plan</h2>
                    <p className="text-sm text-gray-500">Electricity rate structure and utility details</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Tariff Name</p>
                    <p className="text-sm font-medium">{tariff.name || '—'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Utility</p>
                    <p className="text-sm font-medium">{tariff.utility || '—'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Currency</p>
                    <p className="text-sm font-medium">{tariff.currency || 'NGN'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Grid Topology</p>
                    <p className="text-sm font-medium">{TOPOLOGY_LABELS[design?.grid_topology] || design?.grid_topology || '—'}</p>
                  </div>
                </div>
                {tariff.rates?.length > 0 && (
                  <div className="overflow-x-auto">
                    <p className="text-sm font-medium text-gray-700 mb-3">Rate Schedule</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#0D3B2E] text-white">
                          <th className="px-4 py-3 text-left rounded-tl-lg">Season</th>
                          <th className="px-4 py-3 text-left">Period</th>
                          <th className="px-4 py-3 text-right rounded-tr-lg">Rate/kWh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tariff.rates.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{r.season_key || '—'}</td>
                            <td className="px-4 py-3">{r.period_name || '—'}</td>
                            <td className="px-4 py-3 text-right font-medium">{fmtCurrency(r.rate_per_kwh)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Cost Analysis */}
            <section id="cost" ref={(el) => (sectionRefs.current['cost'] = el)} className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                  <RiMoneyDollarCircleLine className="w-5 h-5 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0D3B2E]">Cost Analysis</h2>
                  <p className="text-sm text-gray-500">Financial comparison and economic metrics</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-5 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Baseline Annual Cost</p>
                  <p className="text-xl font-bold text-red-600">{fmtCurrency(result?.baseline_annual_cost)}</p>
                </div>
                <div className="p-5 bg-green-50 border border-green-100 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">With Solar Cost</p>
                  <p className="text-xl font-bold text-green-600">{fmtCurrency(result?.year1_annual_cost)}</p>
                </div>
                <div className="p-5 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Annual Savings</p>
                  <p className="text-xl font-bold text-[#10B981]">{fmtCurrency(result?.annual_savings)}</p>
                </div>
                <div className="p-5 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">LCOE</p>
                  <p className="text-xl font-bold">{result?.lcoe != null ? '₦' + fmt(result.lcoe, 2) + '/kWh' : '—'}</p>
                </div>
              </div>
              {result?.peak_demand_before_kw && result?.peak_demand_after_kw && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Peak Demand (Before Solar)</p>
                    <p className="text-xl font-bold">{fmt(result.peak_demand_before_kw, 1)} kW</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Peak Demand (After Solar)</p>
                    <p className="text-xl font-bold text-green-600">{fmt(result.peak_demand_after_kw, 1)} kW</p>
                  </div>
                </div>
              )}
            </section>

            {/* Energy Source Comparison */}
            {energyComp && Object.keys(energyComp).length > 0 && (
              <section id="comparison" ref={(el) => (sectionRefs.current['comparison'] = el)} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                    <RiGlobalLine className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#0D3B2E]">Energy Source Comparison</h2>
                    <p className="text-sm text-gray-500">Annual comparison with alternative energy sources</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#0D3B2E] text-white">
                        <th className="px-4 py-3 text-left rounded-tl-lg">Energy Source</th>
                        <th className="px-4 py-3 text-right">Annual Cost</th>
                        <th className="px-4 py-3 text-right">CO2 Emissions</th>
                        <th className="px-4 py-3 text-right rounded-tr-lg">Fuel Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr className="bg-[#10B981]/10 font-semibold">
                        <td className="px-4 py-4 text-[#10B981]">
                          <div className="flex items-center gap-2">
                            <RiSunLine />
                            Solar PV System
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">{fmtCurrency(result?.year1_annual_cost)}</td>
                        <td className="px-4 py-4 text-right text-green-600">0 kg</td>
                        <td className="px-4 py-4 text-right">0 L</td>
                      </tr>
                      {energyComp.grid && (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-4">Grid Electricity</td>
                          <td className="px-4 py-4 text-right">{fmtCurrency(energyComp.grid.annual_cost)}</td>
                          <td className="px-4 py-4 text-right">{fmt(energyComp.grid.co2_kg)} kg</td>
                          <td className="px-4 py-4 text-right">—</td>
                        </tr>
                      )}
                      {energyComp.diesel && (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-red-600">
                            <div className="flex items-center gap-2">
                              <RiFlashlightLine className="text-red-400" />
                              Diesel Generator
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-red-600">{fmtCurrency(energyComp.diesel.annual_cost)}</td>
                          <td className="px-4 py-4 text-right text-red-600">{fmt(energyComp.diesel.co2_kg)} kg</td>
                          <td className="px-4 py-4 text-right">{fmt(energyComp.diesel.fuel_liters)} L</td>
                        </tr>
                      )}
                      {energyComp.petrol && (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-red-600">
                            <div className="flex items-center gap-2">
                              <RiFlashlightLine className="text-red-400" />
                              Petrol Generator
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-red-600">{fmtCurrency(energyComp.petrol.annual_cost)}</td>
                          <td className="px-4 py-4 text-right text-red-600">{fmt(energyComp.petrol.co2_kg)} kg</td>
                          <td className="px-4 py-4 text-right">{fmt(energyComp.petrol.fuel_liters)} L</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Charts */}
            <section id="charts" ref={(el) => (sectionRefs.current['charts'] = el)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                  <h3 className="text-base font-semibold text-[#0D3B2E] mb-4">Energy Split (Annual)</h3>
                  <div className="h-72">
                    <Doughnut data={energySplitChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                  <h3 className="text-base font-semibold text-[#0D3B2E] mb-4">Monthly Energy (kWh)</h3>
                  <div className="h-72">
                    <Bar data={monthlyChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }} />
                  </div>
                </div>
              </div>
              {yearlyCostChart && (
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                  <h3 className="text-base font-semibold text-[#0D3B2E] mb-4">Lifetime Cost Projection</h3>
                  <div className="h-80">
                    <Line data={yearlyCostChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } }, plugins: { legend: { position: 'bottom' } } }} />
                  </div>
                </div>
              )}
              {cashflowChart && (
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                  <h3 className="text-base font-semibold text-[#0D3B2E] mb-4">Financial Projection</h3>
                  <div className="h-80">
                    <Line data={cashflowChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } }, plugins: { legend: { position: 'bottom' } } }} />
                  </div>
                </div>
              )}
            </section>

            {/* Yearly Cashflow */}
            {cashflow.length > 0 && (
              <section id="cashflow" ref={(el) => (sectionRefs.current['cashflow'] = el)} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                    <RiFileChartLine className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#0D3B2E]">Yearly Cashflow Projection</h2>
                    <p className="text-sm text-gray-500">Annual financial breakdown over project lifetime</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#0D3B2E] text-white">
                        <th className="px-4 py-3 text-left rounded-tl-lg">Year</th>
                        <th className="px-4 py-3 text-right">Savings</th>
                        <th className="px-4 py-3 text-right">O&M</th>
                        <th className="px-4 py-3 text-right">Net Cashflow</th>
                        <th className="px-4 py-3 text-right">Cumulative</th>
                        <th className="px-4 py-3 text-right rounded-tr-lg">Generation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cashflow.map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{c.year}</td>
                          <td className="px-4 py-3 text-right text-green-600">{fmtCurrency(c.savings)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{fmtCurrency(c.om_cost)}</td>
                          <td className="px-4 py-3 text-right font-medium">{fmtCurrency(c.net_cashflow)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(c.cumulative_cashflow)}</td>
                          <td className="px-4 py-3 text-right">{fmt(c.generation_kwh || 0)} kWh</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Environmental Impact */}
            <section id="environmental" ref={(el) => (sectionRefs.current['environmental'] = el)} className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                  <RiLeafLine className="w-5 h-5 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0D3B2E]">Environmental Impact</h2>
                  <p className="text-sm text-gray-500">Carbon offset and sustainability metrics</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-green-50 border border-green-100 rounded-xl text-center">
                  <p className="text-xs text-gray-500 mb-2">Annual CO2 Offset</p>
                  <p className="text-2xl font-bold text-green-600">{fmt(annualCO2, 0)} <span className="text-sm font-normal">kg</span></p>
                </div>
                <div className="p-5 bg-green-50 border border-green-100 rounded-xl text-center">
                  <p className="text-xs text-gray-500 mb-2">Trees Equivalent</p>
                  <p className="text-2xl font-bold text-green-600">{fmt(treesOffset, 0)}</p>
                </div>
                <div className="p-5 bg-blue-50 border border-blue-100 rounded-xl text-center">
                  <p className="text-xs text-gray-500 mb-2">Trees Planted</p>
                  <p className="text-2xl font-bold text-blue-600">{Math.round(treesOffset)}</p>
                </div>
                <div className="p-5 bg-gray-50 rounded-xl text-center">
                  <p className="text-xs text-gray-500 mb-2">25-Year CO2 Offset</p>
                  <p className="text-2xl font-bold">{fmt(annualCO2 * 25, 0)} <span className="text-sm font-normal">kg</span></p>
                </div>
              </div>
            </section>

            {/* AI Expert Analysis */}
            {result?.ai_feedback_text && (
              <section id="ai-analysis" ref={(el) => (sectionRefs.current['ai-analysis'] = el)} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#0D3B2E]">AI Expert Analysis</h2>
                    <p className="text-sm text-gray-500">Intelligent insights and recommendations</p>
                  </div>
                </div>
                <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{result.ai_feedback_text}</p>
                </div>
              </section>
            )}

            {/* Monthly Summary */}
            {monthly.length > 0 && (
              <section id="monthly" ref={(el) => (sectionRefs.current['monthly'] = el)} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                    <RiTimeLine className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#0D3B2E]">Monthly Energy Summary</h2>
                    <p className="text-sm text-gray-500">Detailed monthly performance breakdown</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#0D3B2E] text-white">
                        <th className="px-3 py-3 text-left rounded-tl-lg">Month</th>
                        <th className="px-3 py-3 text-right">Load</th>
                        <th className="px-3 py-3 text-right">Solar Gen</th>
                        <th className="px-3 py-3 text-right">Self-Used</th>
                        <th className="px-3 py-3 text-right">Grid Import</th>
                        <th className="px-3 py-3 text-right">Grid Export</th>
                        <th className="px-3 py-3 text-right rounded-tr-lg">Savings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthly.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-3 font-medium">{MONTHS[i] || `M${i + 1}`}</td>
                          <td className="px-3 py-3 text-right">{fmt(m.load_kwh || 0)}</td>
                          <td className="px-3 py-3 text-right">{fmt(m.pv_gen_kwh || 0)}</td>
                          <td className="px-3 py-3 text-right text-green-600">{fmt(m.solar_utilised_kwh || 0)}</td>
                          <td className="px-3 py-3 text-right text-blue-600">{fmt(m.grid_import_kwh || 0)}</td>
                          <td className="px-3 py-3 text-right text-amber-600">{fmt(m.grid_export_kwh || 0)}</td>
                          <td className="px-3 py-3 text-right text-green-600 font-medium">{fmtCurrency(m.savings)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-3 py-3">Total</td>
                        <td className="px-3 py-3 text-right">{fmt(totalLoad)}</td>
                        <td className="px-3 py-3 text-right">{fmt(result?.annual_generation_kwh)}</td>
                        <td className="px-3 py-3 text-right text-green-600">{fmt(totalSelfConsumed)}</td>
                        <td className="px-3 py-3 text-right text-blue-600">{fmt(totalGridImport)}</td>
                        <td className="px-3 py-3 text-right text-amber-600">{fmt(totalGridExport)}</td>
                        <td className="px-3 py-3 text-right text-green-600">{fmtCurrency(result?.annual_savings)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Disclaimer */}
            <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-800 mb-1">Disclaimer</h3>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    This report is generated by the SolNuv platform for preliminary design and feasibility assessment purposes. Actual system performance may vary based on local conditions, equipment specifications, and installation quality. A detailed engineering study by a qualified professional is recommended.
                  </p>
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="text-center py-8 border-t border-gray-200">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
                  <RiSunLine className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-[#0D3B2E]">SolNuv</span>
              </div>
              <p className="text-sm text-gray-500">Africa's Solar Engineering Platform</p>
              <p className="text-sm text-gray-400 mt-4">
                <a href="https://solnuv.com" target="_blank" rel="noopener noreferrer" className="text-[#10B981] hover:underline">
                  Create your own solar design at solnuv.com
                </a>
              </p>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
