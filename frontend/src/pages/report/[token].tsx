// @ts-nocheck — large public report view: payload shape is runtime-defined by the design-report API.
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { designReportAPI } from '../../services/api';
import { queryParamToString } from '../../utils/nextRouter';
import { RiSunLine, RiBatteryLine, RiMoneyDollarCircleLine, RiFlashlightLine, RiLeafLine, RiBarChartBoxLine, RiTimeLine, RiFileChartLine, RiGlobalLine, RiLockLine, RiArrowRightSLine, RiRobot2Line } from 'react-icons/ri';
import dynamic from 'next/dynamic';
import SolarSchematic from '../../components/SolarSchematic';

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
  { id: 'project-details', label: 'Project Details' },
  { id: 'summary', label: 'Summary' },
  { id: 'schematic', label: 'Schematic' },
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
  const token = queryParamToString(router.query.token);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('summary');
  const [exportingPdf, setExportingPdf] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data: res } = await designReportAPI.getSharedReport(token);
        setData((res?.data as Record<string, unknown>) || (res as Record<string, unknown>));
      } catch (e: unknown) {
        const msg =
          typeof e === 'object' && e !== null && 'response' in e
            ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
            : '';
        setError(msg || 'Report not found or link expired');
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
      if (ref instanceof HTMLElement) observer.observe(ref);
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

  const { project, design, tariff, equipment, result } = data as {
    project: Record<string, unknown>;
    design: Record<string, unknown>;
    tariff: Record<string, unknown> | null | undefined;
    equipment: Array<Record<string, unknown>> | undefined;
    result: Record<string, unknown> | undefined;
    imported_reports?: Array<Record<string, unknown>>;
  };
  const importedReports = (data?.imported_reports as Array<Record<string, unknown>> | undefined) || [];
  const monthly = (result?.monthly_summary as Array<Record<string, number>> | undefined) || [];
  const cashflow = result?.yearly_cashflow || [];
  const energyComp = result?.energy_comparison || {};
  const uniqueTariffRates = Array.isArray(tariff?.rates)
    ? Array.from(
        new Map(
          tariff.rates.map((r) => [
            `${String(r?.season_key || '')}|${String(r?.period_name || '')}|${String(r?.rate_per_kwh || '')}`,
            r,
          ])
        ).values()
      )
    : [];

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
  const uncertainty = (result?.extended_metrics as Record<string, unknown> | undefined)?.uncertainty as Record<string, unknown> | undefined;
  const provenance = (result?.run_provenance as Record<string, unknown> | undefined) || {};

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

      <div className="min-h-screen min-h-[100dvh] bg-gray-100">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-[#0D3B2E] text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#10B981] rounded-lg flex items-center justify-center flex-shrink-0">
                  <RiSunLine className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-green-300 hidden sm:block">SolNuv Design Report</p>
                  <h1 className="text-sm sm:text-lg font-bold truncate">{project?.name || 'Solar Project'}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                <div className="text-right hidden lg:block">
                  {project?.company && <p className="text-sm text-green-300">{project.company}</p>}
                  <p className="text-xs text-green-200">{project?.location}{project?.state && `, ${project.state}`}</p>
                </div>
                <button
                  onClick={() => downloadPdf()}
                  disabled={exportingPdf}
                  className="flex items-center gap-1 sm:gap-2 bg-[#10B981] hover:bg-[#0D9668] px-2 sm:px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 text-xs sm:text-sm"
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
                  <span className="hidden sm:inline">{exportingPdf ? 'Exporting...' : 'Download PDF'}</span>
                  <span className="sm:hidden">PDF</span>
                </button>
                <a href="https://solnuv.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 sm:px-3 py-2 rounded-lg transition-colors text-xs sm:text-sm">
                  <span className="font-semibold">SolNuv</span>
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto" ref={reportRef}>
          {/* Main Content */}
          <main className="px-6 py-8 space-y-8">
            {/* Project Details Section */}
            <section id="project-details" ref={(el) => { sectionRefs.current['project-details'] = el; }} className="bg-white rounded-2xl p-6 shadow-sm border">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <RiFileChartLine className="text-[#10B981]" /> Project Details
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Client Information */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Client Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Client Name</span>
                      <span className="font-medium text-slate-800">{project?.client_name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Contact Email</span>
                      <span className="font-medium text-slate-800">{project?.client_email || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Contact Phone</span>
                      <span className="font-medium text-slate-800">{project?.client_phone || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Installer / Company Information */}
                <div className="bg-emerald-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-3">Installer / Company</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Company</span>
                      <span className="font-medium text-slate-800">{project?.company || '—'}</span>
                    </div>
                    {project?.company_email && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Email</span>
                        <span className="font-medium text-slate-800">{project.company_email}</span>
                      </div>
                    )}
                    {project?.company_phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Phone</span>
                        <span className="font-medium text-slate-800">{project.company_phone}</span>
                      </div>
                    )}
                    {project?.nesrea_reg && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">NESREA Reg.</span>
                        <span className="font-medium text-slate-800">{project.nesrea_reg}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Location */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Project Location</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Address</span>
                      <span className="font-medium text-slate-800">{project?.address || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">City / State</span>
                      <span className="font-medium text-slate-800">
                        {[project?.city, project?.state].filter(Boolean).join(', ') || '—'}
                      </span>
                    </div>
                    {project?.location_lat && project?.location_lon && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Coordinates</span>
                        <span className="font-medium text-slate-800">
                          {parseFloat(project.location_lat).toFixed(4)}°N, {parseFloat(project.location_lon).toFixed(4)}°E
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Project Specifications */}
                <div className="bg-amber-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3">Project Specifications</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">System Type</span>
                      <span className="font-medium text-slate-800 capitalize">
                        {TOPOLOGY_LABELS[design?.grid_topology] || design?.grid_topology || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">PV Capacity</span>
                      <span className="font-medium text-slate-800">{fmt(design?.pv_capacity_kwp, 2)} kWp</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Battery</span>
                      <span className="font-medium text-slate-800">
                        {design?.bess_capacity_kwh ? `${fmt(design.bess_capacity_kwh, 2)} kWh` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">PV Technology</span>
                      <span className="font-medium text-slate-800">
                        {TECH_LABELS[design?.pv_technology] || design?.pv_technology || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <div className="flex flex-wrap gap-6 text-sm">
                  {project?.installation_date && (
                    <div>
                      <span className="text-slate-500">Installation Date: </span>
                      <span className="font-medium text-slate-700">
                        {new Date(project.installation_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Generated: </span>
                    <span className="font-medium text-slate-700">
                      {new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Design Lifetime: </span>
                    <span className="font-medium text-slate-700">{design?.analysis_period_years || 25} Years</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Executive Summary */}
            {result?.executive_summary_text && (
              <section id="summary" ref={(el) => { sectionRefs.current['summary'] = el; }} className="bg-gradient-to-r from-[#0D3B2E] to-[#166534] text-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-green-300 mb-3">Executive Summary</h2>
                <p className="text-base leading-relaxed opacity-95">{result.executive_summary_text}</p>
              </section>
            )}

            {/* Schematic */}
            <section id="schematic" ref={(el) => { sectionRefs.current['schematic'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                  <RiFlashlightLine className="w-5 h-5 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0D3B2E]">System Schematic</h2>
                  <p className="text-sm text-gray-500">Generated single-line system representation</p>
                </div>
              </div>
              <SolarSchematic design={design} result={result} />
            </section>

            {/* Key Metrics */}
            <section className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 divide-x divide-gray-100">
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">PV Capacity</p>
                  <p className="text-3xl font-bold text-[#0D3B2E]">{fmt(design?.pv_capacity_kwp, 1)} <span className="text-lg">kWp</span></p>
                </div>
                {design?.bess_capacity_kwh > 0 && (
                  <div className="p-6 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Battery Capacity</p>
                    <p className="text-3xl font-bold text-[#0D3B2E]">{fmt(design?.bess_capacity_kwh, 1)} <span className="text-lg">kWh</span></p>
                  </div>
                )}
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Annual Generation</p>
                  <p className="text-3xl font-bold text-[#0D3B2E]">{fmt(result?.annual_solar_gen_kwh || result?.annual_generation_kwh)} <span className="text-lg">kWh</span></p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Year 1 Savings</p>
                  <p className="text-3xl font-bold text-[#10B981]">{fmtCurrency(result?.year1_savings || result?.annual_savings)}</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Payback Period</p>
                  <p className="text-3xl font-bold text-[#0D3B2E]">{result?.simple_payback_years ? fmt(result.simple_payback_years, 1) + ' yrs' : '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 divide-x divide-gray-100 bg-gray-50 border-t">
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">Solar Fraction</p>
                  <p className="text-lg font-semibold">{result?.utilisation_pct != null ? fmt(result.utilisation_pct, 1) + '%' : result?.solar_fraction != null ? fmt(result.solar_fraction, 1) + '%' : '—'}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">Self-Consumption</p>
                  <p className="text-lg font-semibold">{result?.self_consumption_pct != null ? fmt(result.self_consumption_pct, 1) + '%' : result?.self_consumption_ratio != null ? fmt(result.self_consumption_ratio, 1) + '%' : '—'}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">NPV</p>
                  <p className="text-lg font-semibold text-[#10B981]">{fmtCurrency(result?.npv_25yr)}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">IRR</p>
                  <p className="text-lg font-semibold">{result?.irr_pct != null ? fmt(result.irr_pct, 1) + '%' : result?.irr != null ? fmt(result.irr, 1) + '%' : '—'}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">LCOE</p>
                  <p className="text-lg font-semibold">{result?.lcoe_normal != null ? '₦' + fmt(result.lcoe_normal, 2) + '/kWh' : result?.lcoe != null ? '₦' + fmt(result.lcoe, 2) + '/kWh' : '—'}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">ROI</p>
                  <p className="text-lg font-semibold">{result?.roi_pct != null ? fmt(result.roi_pct, 1) + '%' : '—'}</p>
                </div>
              </div>
            </section>

            {/* Uncertainty + Traceability */}
            <section className="bg-white rounded-2xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-[#0D3B2E] mb-4">Uncertainty & Traceability</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">P50 (MWh)</p>
                  <p className="text-lg font-semibold">{fmt((uncertainty?.annual_generation_mwh as Record<string, number> | undefined)?.p50, 2)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">P90 (MWh)</p>
                  <p className="text-lg font-semibold">{fmt((uncertainty?.annual_generation_mwh as Record<string, number> | undefined)?.p90, 2)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">P95 (MWh)</p>
                  <p className="text-lg font-semibold">{fmt((uncertainty?.annual_generation_mwh as Record<string, number> | undefined)?.p95, 2)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Engine Version</p>
                  <p className="text-sm font-semibold">{String(provenance?.engine_version || "—")}</p>
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <p><span className="font-medium text-gray-700">Input Hash:</span> {String(provenance?.input_snapshot_hash || provenance?.inputs_hash || "—")}</p>
                <p><span className="font-medium text-gray-700">Formula Hash:</span> {String(provenance?.formula_bundle_hash || "—")}</p>
                <p><span className="font-medium text-gray-700">Weather Hash:</span> {String(provenance?.weather_dataset_hash || "—")}</p>
              </div>
            </section>

            {/* Imported Third-Party Reports */}
            {importedReports.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-[#0D3B2E] mb-4">Imported Design Reports</h2>
                <div className="space-y-2">
                  {importedReports.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{String(item.file_name || "Imported report")}</p>
                        <p className="text-xs text-gray-500">Label: {String(item.report_label || "imported")} · Source: {String(item.source || "external")}</p>
                      </div>
                      {item.file_public_url ? (
                        <a href={String(item.file_public_url)} target="_blank" rel="noopener noreferrer" className="text-sm text-[#10B981] hover:underline">
                          Open
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">No file URL</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* PV System Configuration */}
            <section id="pv-system" ref={(el) => { sectionRefs.current['pv-system'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
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
            {(design?.bess_capacity_kwh > 0 || design?.bess_power_kw > 0 || batteries.length > 0) && (
              <section id="battery" ref={(el) => { sectionRefs.current['battery'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
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
                  {design?.bess_capacity_kwh > 0 && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-400 mb-1">Rated Capacity</p>
                      <p className="text-lg font-semibold">{fmt(design?.bess_capacity_kwh)} kWh</p>
                    </div>
                  )}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Power Rating</p>
                    <p className="text-lg font-semibold">
                      {(
                        Number(design?.bess_power_kw || 0) ||
                        Number(design?.user_pcs_power_kw || 0) ||
                        Number(design?.user_battery_max_discharge_kw || 0) ||
                        Number(design?.user_inverter_power_kw || 0)
                      ) > 0
                        ? fmt(
                            Number(design?.bess_power_kw || 0) ||
                            Number(design?.user_pcs_power_kw || 0) ||
                            Number(design?.user_battery_max_discharge_kw || 0) ||
                            Number(design?.user_inverter_power_kw || 0)
                          ) + ' kW'
                        : '—'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Chemistry</p>
                    <p className="text-lg font-semibold">{CHEM_LABELS[design?.bess_chemistry] || design?.bess_chemistry || 'LFP'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400 mb-1">Round-Trip Efficiency</p>
                    <p className="text-lg font-semibold">{((design?.bess_round_trip_efficiency || 0.9) * 100).toFixed(0)}%</p>
                  </div>
                  {design?.bess_capacity_kwh > 0 && (
                    <>
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
                    </>
                  )}
                </div>
                {batteries.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-sm font-medium text-gray-700 mb-3">Installed Batteries</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {batteries.map((b, i) => (
                        <div key={i} className="p-3 bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg">
                          <p className="font-medium text-sm">{b.brand || b.manufacturer || 'Generic'}</p>
                          <p className="text-xs text-gray-500 mt-1">{b.quantity || 1} × {b.rated_capacity_kwh ? b.rated_capacity_kwh + ' kWh' : '—'}{b.rated_power_w ? ' / ' + (b.rated_power_w / 1000).toFixed(1) + ' kW' : ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Grid Tariff */}
            {tariff && (
              <section id="tariff" ref={(el) => { sectionRefs.current['tariff'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
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
                {uniqueTariffRates.length > 0 && (
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
                        {uniqueTariffRates.map((r, i) => (
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
            <section id="cost" ref={(el) => { sectionRefs.current['cost'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
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
                  <p className="text-xl font-bold text-[#10B981]">{fmtCurrency(result?.year1_savings || result?.annual_savings)}</p>
                  {result?.baseline_annual_cost && result?.year1_savings && (
                    <p className="text-xs text-gray-500 mt-1">{((result.year1_savings / result.baseline_annual_cost) * 100).toFixed(0)}% reduction</p>
                  )}
                </div>
                <div className="p-5 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">LCOE</p>
                  <p className="text-xl font-bold">{result?.lcoe_normal != null ? '₦' + fmt(result.lcoe_normal, 2) + '/kWh' : result?.lcoe != null ? '₦' + fmt(result.lcoe, 2) + '/kWh' : '—'}</p>
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
              <section id="comparison" ref={(el) => { sectionRefs.current['comparison'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                    <RiGlobalLine className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#0D3B2E]">Energy Source Comparison</h2>
                    <p className="text-sm text-gray-500">Annual comparison with alternative energy sources</p>
                  </div>
                </div>

                {/* Annual Cost Comparison */}
                {energyComp.annual_costs && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border-2 border-emerald-500">
                      <div className="text-xs text-emerald-600 font-medium mb-1">Solar System</div>
                      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmtCurrency(energyComp.annual_costs.solar)}</div>
                      <div className="text-xs text-emerald-500 mt-1">Your choice</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 font-medium mb-1">Grid Only</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{fmtCurrency(energyComp.annual_costs.grid_only)}</div>
                      {energyComp.annual_savings?.vs_grid > 0 && (
                        <div className="text-xs text-emerald-600 mt-1">Save {fmtCurrency(energyComp.annual_savings.vs_grid)}/yr</div>
                      )}
                    </div>
                    <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800">
                      <div className="text-xs text-orange-600 font-medium mb-1">Diesel Generator</div>
                      <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{fmtCurrency(energyComp.annual_costs.diesel)}</div>
                      {energyComp.annual_savings?.vs_diesel > 0 && (
                        <div className="text-xs text-emerald-600 mt-1">Save {fmtCurrency(energyComp.annual_savings.vs_diesel)}/yr</div>
                      )}
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
                      <div className="text-xs text-red-500 font-medium mb-1">Petrol Generator</div>
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">{fmtCurrency(energyComp.annual_costs.petrol)}</div>
                      {energyComp.annual_savings?.vs_petrol > 0 && (
                        <div className="text-xs text-emerald-600 mt-1">Save {fmtCurrency(energyComp.annual_savings.vs_petrol)}/yr</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lifetime Cost Comparison */}
                {energyComp.lifetime_costs && (
                  <div className="mb-6 pt-6 border-t">
                    <h3 className="text-base font-semibold text-[#0D3B2E] mb-4">
                      Lifetime Cost ({design?.analysis_period_years || 25} Years)
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Solar System', value: energyComp.lifetime_costs.solar, color: 'bg-emerald-500' },
                        { label: 'Grid Only', value: energyComp.lifetime_costs.grid_only, color: 'bg-gray-500' },
                        { label: 'Diesel Gen.', value: energyComp.lifetime_costs.diesel, color: 'bg-orange-500' },
                        { label: 'Petrol Gen.', value: energyComp.lifetime_costs.petrol, color: 'bg-red-500' },
                      ].sort((a, b) => a.value - b.value).map((item, idx) => {
                        const maxVal = Math.max(
                          energyComp.lifetime_costs.solar,
                          energyComp.lifetime_costs.grid_only,
                          energyComp.lifetime_costs.diesel,
                          energyComp.lifetime_costs.petrol,
                        );
                        const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                        return (
                          <div key={idx}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600 dark:text-gray-400">
                                {idx === 0 && <span className="text-emerald-600 font-semibold mr-1">Best</span>}
                                {item.label}
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-white">{fmtCurrency(item.value)}</span>
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

                {/* Fuel Consumption Comparison */}
                {energyComp.fuel_consumption && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-base font-semibold text-[#0D3B2E] mb-4">Fuel Consumption Comparison (Annual)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#0D3B2E] text-white">
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
                            <td className="px-3 py-2 text-right">{fmt(energyComp.environmental?.co2_solar_kg)}</td>
                            <td className="px-3 py-2 text-right">{result?.lcoe_normal != null ? '₦' + result.lcoe_normal.toFixed(2) : '—'}</td>
                          </tr>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-3 py-2">Grid Only</td>
                            <td className="px-3 py-2 text-right">—</td>
                            <td className="px-3 py-2 text-right">{fmt(energyComp.environmental?.co2_grid_only_kg)}</td>
                            <td className="px-3 py-2 text-right">—</td>
                          </tr>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-3 py-2">Diesel Gen.</td>
                            <td className="px-3 py-2 text-right">{fmt(energyComp.fuel_consumption.diesel_litres_annual)} L</td>
                            <td className="px-3 py-2 text-right">{fmt(energyComp.environmental?.co2_diesel_kg)}</td>
                            <td className="px-3 py-2 text-right">{energyComp.fuel_consumption.diesel_cost_per_kwh ? '₦' + energyComp.fuel_consumption.diesel_cost_per_kwh.toFixed(2) : '—'}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2">Petrol Gen.</td>
                            <td className="px-3 py-2 text-right">{fmt(energyComp.fuel_consumption.petrol_litres_annual)} L</td>
                            <td className="px-3 py-2 text-right">{fmt(energyComp.environmental?.co2_petrol_kg)}</td>
                            <td className="px-3 py-2 text-right">{energyComp.fuel_consumption.petrol_cost_per_kwh ? '₦' + energyComp.fuel_consumption.petrol_cost_per_kwh.toFixed(2) : '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Environmental Impact */}
                {energyComp.environmental && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-base font-semibold text-[#0D3B2E] mb-4">Environmental Impact (Annual)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmt(energyComp.environmental.co2_avoided_vs_grid_kg)}</div>
                        <div className="text-xs text-gray-500 mt-1">kg CO₂ avoided vs grid</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmt(energyComp.environmental.co2_avoided_lifetime_tonnes, 1)}</div>
                        <div className="text-xs text-gray-500 mt-1">tonnes CO₂ avoided (lifetime)</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">{fmt(energyComp.environmental.trees_equivalent)}</div>
                        <div className="text-xs text-gray-500 mt-1">trees equivalent per year</div>
                      </div>
                      <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                        <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{fmt(energyComp.environmental.diesel_avoided_litres)}</div>
                        <div className="text-xs text-gray-500 mt-1">litres diesel avoided/yr</div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Charts */}
            <section id="charts" ref={(el) => { sectionRefs.current['charts'] = el; }} className="space-y-6">
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
              <section id="cashflow" ref={(el) => { sectionRefs.current['cashflow'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
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

            {/* Environmental Impact - Summary */}
            {energyComp?.environmental && !energyComp?.annual_costs && (
              <section id="environmental" ref={(el) => { sectionRefs.current['environmental'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
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
            )}

            {/* Environmental Impact - With Energy Comparison Data */}
            {energyComp?.environmental && energyComp?.annual_costs && (
              <section id="environmental" ref={(el) => { sectionRefs.current['environmental'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                    <RiLeafLine className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#0D3B2E]">Environmental Impact Summary</h2>
                    <p className="text-sm text-gray-500">Carbon offset and sustainability metrics</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-5 bg-green-50 border border-green-100 rounded-xl text-center">
                    <p className="text-xs text-gray-500 mb-2">Annual CO2 Avoided</p>
                    <p className="text-2xl font-bold text-green-600">{fmt(energyComp.environmental.co2_avoided_vs_grid_kg, 0)} <span className="text-sm font-normal">kg</span></p>
                    <p className="text-xs text-gray-400 mt-1">vs grid</p>
                  </div>
                  <div className="p-5 bg-green-50 border border-green-100 rounded-xl text-center">
                    <p className="text-xs text-gray-500 mb-2">Lifetime CO2 Avoided</p>
                    <p className="text-2xl font-bold text-green-600">{fmt(energyComp.environmental.co2_avoided_lifetime_tonnes, 1)} <span className="text-sm font-normal">tonnes</span></p>
                  </div>
                  <div className="p-5 bg-green-50 border border-green-100 rounded-xl text-center">
                    <p className="text-xs text-gray-500 mb-2">Trees Equivalent</p>
                    <p className="text-2xl font-bold text-green-600">{fmt(energyComp.environmental.trees_equivalent, 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">per year</p>
                  </div>
                  <div className="p-5 bg-amber-50 border border-amber-100 rounded-xl text-center">
                    <p className="text-xs text-gray-500 mb-2">Diesel Avoided</p>
                    <p className="text-2xl font-bold text-amber-600">{fmt(energyComp.environmental.diesel_avoided_litres, 0)} <span className="text-sm font-normal">L</span></p>
                    <p className="text-xs text-gray-400 mt-1">per year</p>
                  </div>
                </div>
              </section>
            )}

            {/* AI Expert Analysis */}
            {(result?.ai_expert_feedback || result?.ai_feedback_text) && (
              <section id="ai-analysis" ref={(el) => { sectionRefs.current['ai-analysis'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <RiRobot2Line className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#0D3B2E]">AI Expert Analysis</h2>
                    <p className="text-sm text-gray-500">Intelligent insights and recommendations</p>
                  </div>
                </div>

                {/* Display structured AI feedback if available */}
                {result?.ai_expert_feedback && typeof result.ai_expert_feedback === 'object' ? (
                  <div className="space-y-6">
                    {/* Rating + Summary */}
                    {result.ai_expert_feedback.overall_rating && (
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          result.ai_expert_feedback.overall_rating === 'excellent' || result.ai_expert_feedback.overall_rating === 'good'
                            ? 'bg-green-100 text-green-700'
                            : result.ai_expert_feedback.overall_rating === 'fair'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {result.ai_expert_feedback.overall_rating.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        {result.ai_feedback_generated_at && (
                          <span className="text-xs text-gray-400">
                            Generated {new Date(result.ai_feedback_generated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                    {result.ai_expert_feedback.summary && (
                      <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-sm leading-relaxed text-gray-700">{result.ai_expert_feedback.summary}</p>
                      </div>
                    )}

                    {/* Sizing Assessment */}
                    {result.ai_expert_feedback.sizing_assessment && (
                      <div className="p-5 bg-gray-50 rounded-xl">
                        <h3 className="text-sm font-semibold mb-3">Sizing Assessment</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">PV Sizing:</span>{' '}
                            <span className={`font-medium ${
                              result.ai_expert_feedback.sizing_assessment.pv_sizing === 'appropriate' 
                                ? 'text-green-600' 
                                : 'text-amber-600'
                            }`}>
                              {result.ai_expert_feedback.sizing_assessment.pv_sizing?.replace('_', ' ')}
                            </span>
                            {result.ai_expert_feedback.sizing_assessment.pv_comment && (
                              <p className="text-xs text-gray-400 mt-0.5">{result.ai_expert_feedback.sizing_assessment.pv_comment}</p>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500">Battery Sizing:</span>{' '}
                            <span className={`font-medium ${
                              result.ai_expert_feedback.sizing_assessment.battery_sizing === 'appropriate'
                                ? 'text-green-600'
                                : result.ai_expert_feedback.sizing_assessment.battery_sizing === 'not_applicable'
                                ? 'text-gray-400'
                                : 'text-amber-600'
                            }`}>
                              {result.ai_expert_feedback.sizing_assessment.battery_sizing?.replace('_', ' ')}
                            </span>
                            {result.ai_expert_feedback.sizing_assessment.battery_comment && (
                              <p className="text-xs text-gray-400 mt-0.5">{result.ai_expert_feedback.sizing_assessment.battery_comment}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Strengths & Concerns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.ai_expert_feedback.strengths?.length > 0 && (
                        <div className="p-5 bg-green-50 rounded-xl border border-green-200">
                          <h3 className="text-sm font-semibold text-green-700 mb-3">Strengths</h3>
                          <ul className="space-y-2">
                            {result.ai_expert_feedback.strengths.map((s, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">&#10003;</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {result.ai_expert_feedback.concerns?.length > 0 && (
                        <div className="p-5 bg-amber-50 rounded-xl border border-amber-200">
                          <h3 className="text-sm font-semibold text-amber-700 mb-3">Concerns</h3>
                          <ul className="space-y-2">
                            {result.ai_expert_feedback.concerns.map((c, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">&#9888;</span>
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Recommendations */}
                    {result.ai_expert_feedback.recommendations?.length > 0 && (
                      <div className="p-5 bg-gray-50 rounded-xl">
                        <h3 className="text-sm font-semibold mb-3">Recommendations</h3>
                        <ol className="space-y-2">
                          {result.ai_expert_feedback.recommendations.map((r, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="w-5 h-5 bg-[#10B981] text-white rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fallback: plain text feedback */
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{result.ai_feedback_text}</p>
                  </div>
                )}
              </section>
            )}

            {/* Design Warnings */}
            {Array.isArray(result?.design_warnings) && result.design_warnings.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-[#0D3B2E] mb-4">Design Warnings & Notes</h2>
                <div className="space-y-2">
                  {result.design_warnings.map((w, i) => (
                    <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {w?.message || String(w)}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Monthly Summary */}
            {monthly.length > 0 && (
              <section id="monthly" ref={(el) => { sectionRefs.current['monthly'] = el; }} className="bg-white rounded-2xl shadow-sm border p-6">
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
              <p className="text-sm text-gray-500">Solar engineering and lifecycle intelligence platform</p>
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
