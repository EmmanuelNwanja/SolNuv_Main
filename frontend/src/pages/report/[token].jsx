import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { designReportAPI } from '../../services/api';
import { RiSunLine, RiBatteryLine, RiMoneyDollarCircleLine, RiFlashlightLine, RiMapPinLine, RiBarChartBoxLine } from 'react-icons/ri';
import dynamic from 'next/dynamic';

const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false });
const Doughnut = dynamic(() => import('react-chartjs-2').then(m => m.Doughnut), { ssr: false });
const Line = dynamic(() => import('react-chartjs-2').then(m => m.Line), { ssr: false });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BRAND = { primary: '#0D3B2E', accent: '#10B981', amber: '#F59E0B' };

function fmt(n, d = 0) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtCurrency(n) {
  if (n == null) return '—';
  return '₦' + Number(n).toLocaleString('en', { maximumFractionDigits: 0 });
}

function SectionCard({ title, children }) {
  return (
    <div className="p-5 bg-white rounded-xl shadow-sm border mb-6">
      <h3 className="text-base font-semibold text-[#0D3B2E] mb-4 pb-2 border-b border-gray-200">{title}</h3>
      {children}
    </div>
  );
}

function KVRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
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

export default function SharedReport() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Report Unavailable</h1>
          <p className="text-gray-500 mb-4">{error}</p>
          <a href="https://solnuv.com" className="text-green-600 hover:underline">Go to SolNuv →</a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { project, design, result } = data;
  const monthly = result?.monthly_summary || [];
  const cashflow = result?.yearly_cashflow || [];

  // Calculate totals
  const totalSelfConsumed = monthly.reduce((s, m) => s + (m.solar_utilised_kwh || 0), 0);
  const totalGridImport = monthly.reduce((s, m) => s + (m.grid_import_kwh || 0), 0);
  const totalGridExport = monthly.reduce((s, m) => s + (m.grid_export_kwh || 0), 0);
  const totalLoad = monthly.reduce((s, m) => s + (m.load_kwh || 0), 0);

  // Charts
  const energySplitChart = {
    labels: ['Self-Consumed', 'Grid Import', 'Grid Export'],
    datasets: [{
      data: [Math.round(totalSelfConsumed), Math.round(totalGridImport), Math.round(totalGridExport)],
      backgroundColor: [BRAND.accent, BRAND.primary, BRAND.amber],
    }],
  };

  const monthlyChart = {
    labels: MONTHS,
    datasets: [
      { label: 'Load', data: monthly.map(m => Math.round(m.load_kwh || 0)), backgroundColor: BRAND.primary + '99' },
      { label: 'Solar', data: monthly.map(m => Math.round(m.pv_gen_kwh || 0)), backgroundColor: BRAND.amber + '99' },
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

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-[#0D3B2E] text-white px-6 py-5">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-green-300 mb-1">SolNuv Design Report</div>
                <h1 className="text-xl font-bold">{project?.name || 'Solar Project'}</h1>
                <p className="text-sm text-green-300 mt-1">
                  {project?.company && <span>{project.company} • </span>}
                  {project?.location}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-300 mb-1">Powered by</div>
                <a href="https://solnuv.com" target="_blank" rel="noopener noreferrer" className="text-white font-semibold hover:text-green-300">
                  SolNuv
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Executive Summary */}
          {result?.executive_summary_text && (
            <div className="mb-6 p-5 bg-gradient-to-r from-[#0D3B2E] to-[#166534] text-white rounded-xl">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-green-300 mb-2">Executive Summary</h2>
              <p className="text-sm leading-relaxed opacity-95">{result.executive_summary_text}</p>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400 uppercase mb-1">PV Capacity</p>
              <p className="text-xl font-bold text-[#0D3B2E]">{fmt(design?.pv_capacity_kwp, 1)} kWp</p>
            </div>
            <div className="p-4 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400 uppercase mb-1">Annual Generation</p>
              <p className="text-xl font-bold text-[#0D3B2E]">{fmt(result?.annual_generation_kwh)} kWh</p>
            </div>
            <div className="p-4 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400 uppercase mb-1">Year 1 Savings</p>
              <p className="text-xl font-bold text-[#10B981]">{fmtCurrency(result?.annual_savings)}</p>
            </div>
            <div className="p-4 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400 uppercase mb-1">Payback Period</p>
              <p className="text-xl font-bold text-[#0D3B2E]">{result?.simple_payback_years ? fmt(result.simple_payback_years, 1) + ' yrs' : '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-3 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400">Solar Fraction</p>
              <p className="text-lg font-bold">{result?.solar_fraction != null ? fmt(result.solar_fraction, 1) + '%' : '—'}</p>
            </div>
            <div className="p-3 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400">Self-Consumption</p>
              <p className="text-lg font-bold">{result?.self_consumption_ratio != null ? fmt(result.self_consumption_ratio, 1) + '%' : '—'}</p>
            </div>
            <div className="p-3 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400">NPV</p>
              <p className="text-lg font-bold text-[#10B981]">{fmtCurrency(result?.npv_25yr)}</p>
            </div>
            <div className="p-3 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400">IRR</p>
              <p className="text-lg font-bold">{result?.irr != null ? fmt(result.irr, 1) + '%' : '—'}</p>
            </div>
          </div>

          {/* Solar System Overview */}
          <SectionCard title="Solar System Configuration">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400">Technology</p>
                <p className="text-sm font-medium">{TECH_LABELS[design?.pv_technology] || design?.pv_technology || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Array Tilt</p>
                <p className="text-sm font-medium">{design?.pv_tilt_deg ?? '—'}°</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Array Azimuth</p>
                <p className="text-sm font-medium">{design?.pv_azimuth_deg ?? '—'}°</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">System Losses</p>
                <p className="text-sm font-medium">{design?.pv_system_losses_pct ?? 14}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Annual Degradation</p>
                <p className="text-sm font-medium">{design?.pv_degradation_annual_pct ?? 0.5}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Analysis Period</p>
                <p className="text-sm font-medium">{design?.analysis_period_years || 25} years</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Discount Rate</p>
                <p className="text-sm font-medium">{design?.discount_rate_pct ?? 10}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tariff Escalation</p>
                <p className="text-sm font-medium">{design?.tariff_escalation_pct ?? 8}%</p>
              </div>
            </div>
          </SectionCard>

          {/* Battery Section */}
          {design?.bess_capacity_kwh > 0 && (
            <SectionCard title="Battery Energy Storage System">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400">Rated Capacity</p>
                  <p className="text-sm font-medium">{fmt(design?.bess_capacity_kwh)} kWh</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Usable Capacity</p>
                  <p className="text-sm font-medium">{fmt(design?.bess_capacity_kwh * (design?.bess_dod_pct || 80) / 100)} kWh</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Chemistry</p>
                  <p className="text-sm font-medium">{CHEM_LABELS[design?.bess_chemistry] || design?.bess_chemistry || 'LFP'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Round-Trip Efficiency</p>
                  <p className="text-sm font-medium">{((design?.bess_round_trip_efficiency || 0.9) * 100).toFixed(0)}%</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Annual Throughput</p>
                  <p className="text-lg font-bold">{fmt(result?.battery_discharged_kwh)} kWh</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Annual Cycles</p>
                  <p className="text-lg font-bold">{fmt(result?.battery_cycles_annual, 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Dispatch Strategy</p>
                  <p className="text-sm font-medium capitalize">{(design?.bess_dispatch_strategy || 'self_consumption').replace(/_/g, ' ')}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-5 bg-white rounded-xl shadow-sm border">
              <h3 className="text-sm font-semibold mb-4 text-[#0D3B2E]">Energy Split (Annual)</h3>
              <div className="h-64">
                <Doughnut data={energySplitChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div><span className="inline-block w-3 h-3 bg-[#10B981] mr-1"></span>Self-Used: {fmt(totalSelfConsumed)} kWh</div>
                <div><span className="inline-block w-3 h-3 bg-[#0D3B2E] mr-1"></span>Grid Import: {fmt(totalGridImport)} kWh</div>
                <div><span className="inline-block w-3 h-3 bg-[#F59E0B] mr-1"></span>Grid Export: {fmt(totalGridExport)} kWh</div>
              </div>
            </div>
            <div className="p-5 bg-white rounded-xl shadow-sm border">
              <h3 className="text-sm font-semibold mb-4 text-[#0D3B2E]">Monthly Energy (kWh)</h3>
              <div className="h-64">
                <Bar data={monthlyChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }} />
              </div>
            </div>
          </div>

          {/* Cashflow Chart */}
          {cashflowChart && (
            <div className="p-5 bg-white rounded-xl shadow-sm border mb-6">
              <h3 className="text-sm font-semibold mb-4 text-[#0D3B2E]">Financial Projection</h3>
              <div className="h-64">
                <Line data={cashflowChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } }, plugins: { legend: { position: 'bottom' } } }} />
              </div>
            </div>
          )}

          {/* Monthly Summary Table */}
          {monthly.length > 0 && (
            <SectionCard title="Monthly Energy Summary">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0D3B2E] text-white">
                      <th className="px-3 py-2 text-left text-xs">Month</th>
                      <th className="px-3 py-2 text-right text-xs">Load kWh</th>
                      <th className="px-3 py-2 text-right text-xs">Generation kWh</th>
                      <th className="px-3 py-2 text-right text-xs">Self-Used kWh</th>
                      <th className="px-3 py-2 text-right text-xs">Grid Import</th>
                      <th className="px-3 py-2 text-right text-xs">Grid Export</th>
                      <th className="px-3 py-2 text-right text-xs">Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{MONTHS[i] || `M${i + 1}`}</td>
                        <td className="px-3 py-2 text-right">{fmt(m.load_kwh || 0)}</td>
                        <td className="px-3 py-2 text-right">{fmt(m.pv_gen_kwh || 0)}</td>
                        <td className="px-3 py-2 text-right text-green-600">{fmt(m.solar_utilised_kwh || 0)}</td>
                        <td className="px-3 py-2 text-right text-blue-600">{fmt(m.grid_import_kwh || 0)}</td>
                        <td className="px-3 py-2 text-right text-amber-600">{fmt(m.grid_export_kwh || 0)}</td>
                        <td className="px-3 py-2 text-right text-green-600 font-medium">{fmtCurrency(m.savings)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right">{fmt(totalLoad)}</td>
                      <td className="px-3 py-2 text-right">{fmt(result?.annual_generation_kwh)}</td>
                      <td className="px-3 py-2 text-right text-green-600">{fmt(totalSelfConsumed)}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{fmt(totalGridImport)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{fmt(totalGridExport)}</td>
                      <td className="px-3 py-2 text-right text-green-600">{fmtCurrency(result?.annual_savings)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Cost Analysis */}
          <SectionCard title="Cost Analysis">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400">Baseline Annual Cost</p>
                <p className="text-lg font-bold">{fmtCurrency(result?.baseline_annual_cost)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400">With Solar Cost</p>
                <p className="text-lg font-bold">{fmtCurrency(result?.year1_annual_cost)}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-400">Year 1 Savings</p>
                <p className="text-lg font-bold text-green-600">{fmtCurrency(result?.annual_savings)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400">LCOE</p>
                <p className="text-lg font-bold">{result?.lcoe != null ? '₦' + fmt(result.lcoe, 2) + '/kWh' : '—'}</p>
              </div>
            </div>
          </SectionCard>

          {/* Disclaimer */}
          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <strong>Disclaimer:</strong> This report is generated by the SolNuv platform for preliminary design and feasibility assessment purposes. Actual system performance may vary based on local conditions, equipment specifications, and installation quality.
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 mt-8 pt-6 border-t">
            <p>Generated by SolNuv — Africa's Solar Engineering Platform</p>
            <p className="mt-1">
              <a href="https://solnuv.com" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                Create your own solar design at solnuv.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
