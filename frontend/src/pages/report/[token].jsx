import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { designReportAPI } from '../../services/api';
import { RiSunLine, RiBatteryLine, RiMoneyDollarCircleLine, RiFlashlightLine } from 'react-icons/ri';
import dynamic from 'next/dynamic';

const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false });
const Doughnut = dynamic(() => import('react-chartjs-2').then(m => m.Doughnut), { ssr: false });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BRAND = { primary: '#0D3B2E', accent: '#10B981', amber: '#F59E0B' };

function fmt(n, d = 0) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
}

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
      import('chart.js').then(({ Chart, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend }) => {
        Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Report Unavailable</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { project, design, result } = data;
  const monthly = result?.monthly_summary || [];

  const energySplitChart = {
    labels: ['Self-Consumed', 'Grid Import', 'Grid Export'],
    datasets: [{
      data: [result?.self_consumption_kwh || 0, result?.grid_import_kwh || 0, result?.grid_export_kwh || 0].map(v => v || 0),
      backgroundColor: [BRAND.accent, BRAND.primary, BRAND.amber],
    }],
  };

  const monthlyChart = {
    labels: MONTHS,
    datasets: [
      { label: 'Load', data: monthly.map(m => m.load_kwh), backgroundColor: BRAND.primary + '80' },
      { label: 'Solar', data: monthly.map(m => m.generation_kwh), backgroundColor: BRAND.amber + '80' },
    ],
  };

  return (
    <>
      <Head>
        <title>{project?.name || 'Solar Design Report'} | SolNuv</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header bar */}
        <div className="bg-[#0D3B2E] text-white px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{project?.name || 'Solar Design Report'}</h1>
              <p className="text-sm text-green-300">{project?.company || 'SolNuv'} — {project?.location}</p>
            </div>
            <a href="https://solnuv.com" target="_blank" rel="noopener noreferrer" className="text-sm text-green-300 hover:text-white">
              Powered by SolNuv
            </a>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Executive Summary */}
          {result?.executive_summary_text && (
            <div className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Executive Summary</h2>
              <p className="text-sm leading-relaxed text-gray-700">{result.executive_summary_text}</p>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: RiSunLine, label: 'PV Capacity', value: `${fmt(result?.pv_capacity_kwp, 1)} kWp` },
              { icon: RiFlashlightLine, label: 'Annual Generation', value: `${fmt(result?.annual_generation_kwh)} kWh` },
              { icon: RiMoneyDollarCircleLine, label: 'Annual Savings', value: `${fmt(result?.annual_savings)}` },
              { icon: RiMoneyDollarCircleLine, label: 'Payback', value: result?.simple_payback_years ? `${fmt(result.simple_payback_years, 1)} years` : '—' },
            ].map((m, i) => (
              <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <m.icon className="text-green-600" />
                  <span className="text-xs text-gray-400 uppercase">{m.label}</span>
                </div>
                <p className="text-lg font-bold text-gray-800">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400">Solar Fraction</p>
              <p className="text-lg font-bold">{result?.solar_fraction ? (result.solar_fraction * 100).toFixed(1) + '%' : '—'}</p>
            </div>
            <div className="p-4 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400">NPV (25yr)</p>
              <p className="text-lg font-bold">{fmt(result?.npv_25yr)}</p>
            </div>
            <div className="p-4 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400">IRR</p>
              <p className="text-lg font-bold">{result?.irr ? (result.irr * 100).toFixed(1) + '%' : '—'}</p>
            </div>
            <div className="p-4 bg-white rounded-xl shadow-sm border text-center">
              <p className="text-xs text-gray-400">LCOE</p>
              <p className="text-lg font-bold">{result?.lcoe ? fmt(result.lcoe, 2) + '/kWh' : '—'}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-5 bg-white rounded-xl shadow-sm border">
              <h3 className="text-sm font-semibold mb-4">Energy Split</h3>
              <div className="h-64">
                <Doughnut data={energySplitChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
              </div>
            </div>
            <div className="p-5 bg-white rounded-xl shadow-sm border">
              <h3 className="text-sm font-semibold mb-4">Monthly Energy (kWh)</h3>
              <div className="h-64">
                <Bar data={monthlyChart} options={{
                  responsive: true, maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true } },
                  plugins: { legend: { position: 'bottom' } },
                }} />
              </div>
            </div>
          </div>

          {/* Monthly table */}
          {monthly.length > 0 && (
            <div className="p-5 bg-white rounded-xl shadow-sm border mb-8">
              <h3 className="text-sm font-semibold mb-4">Monthly Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0D3B2E] text-white">
                      <th className="px-3 py-2 text-left">Month</th>
                      <th className="px-3 py-2 text-right">Load kWh</th>
                      <th className="px-3 py-2 text-right">Generation kWh</th>
                      <th className="px-3 py-2 text-right">Self-Use kWh</th>
                      <th className="px-3 py-2 text-right">Grid kWh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2">{MONTHS[i]}</td>
                        <td className="px-3 py-2 text-right">{fmt(m.load_kwh)}</td>
                        <td className="px-3 py-2 text-right">{fmt(m.generation_kwh)}</td>
                        <td className="px-3 py-2 text-right text-green-600">{fmt(m.self_consumption_kwh)}</td>
                        <td className="px-3 py-2 text-right">{fmt(m.grid_import_kwh)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 py-6">
            <p>This report was generated by the SolNuv platform for preliminary assessment purposes.</p>
            <p className="mt-1">
              <a href="https://solnuv.com" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                Start your own solar design at solnuv.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
