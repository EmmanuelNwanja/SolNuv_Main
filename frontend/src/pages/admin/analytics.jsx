import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import AdminRoute from '../../components/AdminRoute';
import { getAdminLayout } from '../../components/Layout';
import { analyticsAPI } from '../../services/api';
import {
  RiBarChartLine, RiUserLine, RiFileTextLine, RiMoneyDollarCircleLine,
  RiAdvertisementLine, RiGlobalLine, RiRefreshLine, RiCalendar2Line,
  RiArrowUpLine, RiArrowDownLine, RiCalculatorLine, RiChatSmileLine,
  RiProjectorLine, RiEyeLine, RiMouseLine, RiTimeLine,
  RiSunLine, RiFlashlightLine, RiShareLine, RiBatteryChargeLine,
} from 'react-icons/ri';

function StatCard({ icon: Icon, label, value, sub, color = 'emerald' }) {
  const colorMap = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5 flex items-start gap-4">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        <Icon className="text-lg" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color = 'emerald' }) {
  const colors = {
    emerald: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    amber: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    blue: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    violet: 'text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20',
    rose: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20',
  };
  return (
    <div className="flex items-center gap-2 mt-8 mb-4">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="text-sm" />
      </span>
      <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">{title}</h2>
    </div>
  );
}

function SimpleTable({ columns, rows, emptyText = 'No data.' }) {
  if (!rows?.length) return <p className="text-sm text-slate-400 dark:text-slate-500 py-4">{emptyText}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50 last:border-none hover:bg-slate-50 dark:hover:bg-slate-800/30">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatMoney(n) {
  if (!n && n !== 0) return '—';
  return `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const DATE_PRESETS = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: '1 Year', days: 365 },
];

function AnalyticsPage() {
  const { isPlatformAdmin } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState(30);
  const [activeSection, setActiveSection] = useState('overview');

  const SECTIONS = ['overview', 'blog', 'pages', 'finance', 'users', 'ads', 'contact', 'projects', 'design'];

  const load = useCallback(async (days) => {
    setLoading(true);
    setError('');
    try {
      const toDate = new Date();
      const fromDate = new Date(Date.now() - days * 24 * 3600_000);
      const { data: res } = await analyticsAPI.getFullAnalytics({
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      });
      setData(res.data);
    } catch {
      setError('Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isPlatformAdmin) load(preset); }, [isPlatformAdmin, preset]);

  if (!isPlatformAdmin) return null;

  const d = data;

  // Build derived tables
  const topPagesRows = (d?.pages?.top_pages || []).slice(0, 15);
  const revenueByPlanRows = Object.entries(d?.finance?.revenue_by_plan || {}).map(([plan, amt]) => ({ plan, amount_ngn: amt })).sort((a, b) => b.amount_ngn - a.amount_ngn);
  const calcTypeRows = Object.entries(d?.users?.calculator_usage_by_type || {}).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  const blogReadsByPost = Object.entries(d?.blog?.reads_by_post || {}).map(([post_id, reads]) => ({ post_id, reads })).sort((a, b) => b.reads - a.reads).slice(0, 10);
  const blogClicksByPost = Object.entries(d?.blog?.clicks_by_post || {}).map(([post_id, clicks]) => ({ post_id, clicks })).sort((a, b) => b.clicks - a.clicks).slice(0, 10);

  return (
    <>
      <Head>
        <title>Platform Analytics - SolNuv Admin</title>
      </Head>

      <div className="p-6 max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Platform Analytics</h1>
            <p className="text-sm text-slate-400 mt-0.5">Full-scope view across the entire SolNuv platform</p>
          </div>
          <div className="flex items-center gap-2">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => setPreset(p.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  preset === p.days
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => load(preset)}
              className="ml-1 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <RiRefreshLine />
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex flex-wrap gap-1 mb-6 p-1 bg-slate-800/50 rounded-xl w-fit">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                activeSection === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-400 text-sm mb-6">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* ─── OVERVIEW ─── */}
            {(activeSection === 'overview') && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={RiGlobalLine} label="Page Views" value={d?.pages?.total_views?.toLocaleString()} sub={`last ${preset} days`} color="blue" />
                  <StatCard icon={RiUserLine} label="Total Users" value={d?.users?.total_users?.toLocaleString()} sub={`+${d?.users?.new_last_30d || 0} new in range`} color="violet" />
                  <StatCard icon={RiMoneyDollarCircleLine} label="Revenue" value={formatMoney(d?.finance?.total_revenue_ngn)} sub={`${d?.finance?.total_transactions || 0} transactions`} color="amber" />
                  <StatCard icon={RiProjectorLine} label="Projects" value={d?.projects?.total_projects?.toLocaleString()} sub={`+${d?.projects?.new_in_range || 0} new in range`} color="emerald" />
                  <StatCard icon={RiFileTextLine} label="Blog Posts" value={d?.blog?.total_published_posts?.toLocaleString()} sub={`${d?.blog?.total_reads || 0} reads in range`} color="emerald" />
                  <StatCard icon={RiAdvertisementLine} label="Ad Impressions" value={d?.ads?.total_impressions?.toLocaleString()} sub={`CTR: ${d?.ads?.overall_ctr || '0.00'}%`} color="amber" />
                  <StatCard icon={RiChatSmileLine} label="Contact Submissions" value={d?.contact?.total_submissions?.toLocaleString()} sub={`${d?.contact?.new_in_range || 0} in range`} color="rose" />
                  <StatCard icon={RiTimeLine} label="Avg Session" value={d?.pages?.avg_session_duration_s ? `${d.pages.avg_session_duration_s}s` : '—'} sub="average time on platform" color="slate" />
                  <StatCard icon={RiSunLine} label="Solar Designs" value={d?.design?.total_designs?.toLocaleString()} sub={`+${d?.design?.designs_in_range || 0} in range`} color="amber" />
                  <StatCard icon={RiFlashlightLine} label="Simulations" value={d?.design?.total_simulations?.toLocaleString()} sub={`+${d?.design?.simulations_in_range || 0} in range`} color="blue" />
                </div>
              </>
            )}

            {/* ─── BLOG ─── */}
            {activeSection === 'blog' && (
              <>
                <SectionHeader icon={RiFileTextLine} title="Blog Analytics" color="emerald" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <StatCard icon={RiFileTextLine} label="Published Posts" value={d?.blog?.total_published_posts} color="emerald" />
                  <StatCard icon={RiEyeLine} label="Total Reads" value={d?.blog?.total_reads?.toLocaleString()} sub={`in last ${preset} days`} color="blue" />
                  <StatCard icon={RiMouseLine} label="Total Link Clicks" value={d?.blog?.total_link_clicks?.toLocaleString()} sub="outbound links in posts" color="violet" />
                  <StatCard icon={RiBarChartLine} label="Reads / Post" value={d?.blog?.total_published_posts ? Math.round((d.blog.total_reads || 0) / d.blog.total_published_posts) : '—'} sub="avg per published post" color="amber" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Top Posts by Reads</h3>
                    <SimpleTable
                      columns={[
                        { key: 'post_id', label: 'Post ID', render: (r) => <span className="font-mono text-xs text-slate-400">{r.post_id.slice(0, 8)}…</span> },
                        { key: 'reads', label: 'Reads', render: (r) => <span className="font-semibold text-emerald-400">{r.reads.toLocaleString()}</span> },
                      ]}
                      rows={blogReadsByPost}
                      emptyText="No read data for this period."
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Top Posts by Link Clicks</h3>
                    <SimpleTable
                      columns={[
                        { key: 'post_id', label: 'Post ID', render: (r) => <span className="font-mono text-xs text-slate-400">{r.post_id.slice(0, 8)}…</span> },
                        { key: 'clicks', label: 'Clicks', render: (r) => <span className="font-semibold text-violet-400">{r.clicks.toLocaleString()}</span> },
                      ]}
                      rows={blogClicksByPost}
                      emptyText="No click data for this period."
                    />
                  </div>
                </div>
              </>
            )}

            {/* ─── PAGE ACTIVITY ─── */}
            {activeSection === 'pages' && (
              <>
                <SectionHeader icon={RiGlobalLine} title="Page Activity" color="blue" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <StatCard icon={RiGlobalLine} label="Total Page Views" value={d?.pages?.total_views?.toLocaleString()} sub={`last ${preset} days`} color="blue" />
                  <StatCard icon={RiUserLine} label="Active Users" value={d?.users?.active_last_30d?.toLocaleString()} sub="signed-in users with activity" color="violet" />
                  <StatCard icon={RiTimeLine} label="Avg Session Duration" value={d?.pages?.avg_session_duration_s ? `${d.pages.avg_session_duration_s}s` : '—'} sub="across logged sessions" color="slate" />
                </div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Top Pages by Views</h3>
                <SimpleTable
                  columns={[
                    { key: 'path', label: 'Page Path' },
                    { key: 'views', label: 'Views', render: (r) => <span className="font-semibold text-blue-400">{r.views.toLocaleString()}</span> },
                    { key: 'pct', label: '% of Total', render: (r) => {
                      const total = d?.pages?.total_views || 0;
                      return <span className="text-slate-400">{total ? ((r.views / total) * 100).toFixed(1) + '%' : '—'}</span>;
                    }},
                  ]}
                  rows={topPagesRows}
                  emptyText="No page view data recorded yet. Ensure the tracker is installed."
                />
              </>
            )}

            {/* ─── FINANCE ─── */}
            {activeSection === 'finance' && (
              <>
                <SectionHeader icon={RiMoneyDollarCircleLine} title="Finance & Revenue" color="amber" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <StatCard icon={RiMoneyDollarCircleLine} label="Total Revenue" value={formatMoney(d?.finance?.total_revenue_ngn)} sub={`last ${preset} days`} color="amber" />
                  <StatCard icon={RiBarChartLine} label="Total Transactions" value={d?.finance?.total_transactions?.toLocaleString()} color="emerald" />
                  <StatCard icon={RiFileTextLine} label="Paystack Payments" value={d?.finance?.paystack_transactions?.toLocaleString()} sub="via Paystack gateway" color="violet" />
                  <StatCard icon={RiFileTextLine} label="Direct Payments" value={d?.finance?.direct_transactions?.toLocaleString()} sub="other payment methods" color="blue" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Revenue by Plan</h3>
                    <SimpleTable
                      columns={[
                        { key: 'plan', label: 'Plan', render: (r) => <span className="capitalize font-medium text-slate-200">{r.plan}</span> },
                        { key: 'amount_ngn', label: 'Revenue', render: (r) => <span className="font-semibold text-amber-400">{formatMoney(r.amount_ngn)}</span> },
                      ]}
                      rows={revenueByPlanRows}
                      emptyText="No transaction data for this period."
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Payment Method Split</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Paystack', count: d?.finance?.paystack_transactions || 0, color: 'bg-violet-500' },
                        { label: 'Direct / Other', count: d?.finance?.direct_transactions || 0, color: 'bg-blue-500' },
                      ].map(({ label, count, color }) => {
                        const total = (d?.finance?.paystack_transactions || 0) + (d?.finance?.direct_transactions || 0);
                        const pct = total ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={label} className="bg-slate-800 rounded-xl p-4">
                            <div className="flex justify-between mb-2">
                              <span className="text-sm text-slate-300">{label}</span>
                              <span className="text-sm font-semibold text-white">{count} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-slate-300 mb-3">Top Companies by Revenue</h3>
                      <SimpleTable
                        columns={[
                          { key: 'company_id', label: 'Company ID', render: (r) => <span className="font-mono text-xs text-slate-400">{r.company_id.slice(0, 8)}…</span> },
                          { key: 'amount_ngn', label: 'Revenue', render: (r) => <span className="font-semibold text-amber-400">{formatMoney(r.amount_ngn)}</span> },
                        ]}
                        rows={d?.finance?.top_company_revenue || []}
                        emptyText="No company revenue data."
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ─── USERS ─── */}
            {activeSection === 'users' && (
              <>
                <SectionHeader icon={RiUserLine} title="User Activity" color="violet" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <StatCard icon={RiUserLine} label="Total Users" value={d?.users?.total_users?.toLocaleString()} color="violet" />
                  <StatCard icon={RiArrowUpLine} label="New Users" value={d?.users?.new_last_30d?.toLocaleString()} sub={`in last ${preset} days`} color="emerald" />
                  <StatCard icon={RiBarChartLine} label="Active Users" value={d?.users?.active_last_30d?.toLocaleString()} sub="had sign-in activity" color="blue" />
                  <StatCard icon={RiCalculatorLine} label="Calculator Uses" value={Object.values(d?.users?.calculator_usage_by_type || {}).reduce((s, c) => s + c, 0).toLocaleString()} sub="total tool invocations" color="amber" />
                </div>

                <h3 className="text-sm font-semibold text-slate-300 mb-3">Calculator Usage by Tool</h3>
                <SimpleTable
                  columns={[
                    { key: 'type', label: 'Calculator Type', render: (r) => <span className="capitalize font-medium text-slate-200">{r.type.replace(/-/g, ' ')}</span> },
                    { key: 'count', label: 'Uses', render: (r) => <span className="font-semibold text-amber-400">{r.count.toLocaleString()}</span> },
                  ]}
                  rows={calcTypeRows}
                  emptyText="No calculator usage data for this period."
                />
              </>
            )}

            {/* ─── ADS ─── */}
            {activeSection === 'ads' && (
              <>
                <SectionHeader icon={RiAdvertisementLine} title="Ads Analytics" color="amber" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <StatCard icon={RiEyeLine} label="Total Impressions" value={d?.ads?.total_impressions?.toLocaleString()} sub={`last ${preset} days`} color="amber" />
                  <StatCard icon={RiMouseLine} label="Total Clicks" value={d?.ads?.total_clicks?.toLocaleString()} color="emerald" />
                  <StatCard icon={RiBarChartLine} label="Overall CTR" value={`${d?.ads?.overall_ctr || '0.00'}%`} sub="click-through rate" color="violet" />
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
                  <p className="text-sm text-slate-400">
                    Active ads: <strong className="text-white">{d?.ads?.active_ads || 0}</strong>.
                    Use the <strong className="text-emerald-400">Blog &amp; Ads</strong> admin section to manage individual ad performance and creative details.
                  </p>
                </div>
              </>
            )}

            {/* ─── CONTACT ─── */}
            {activeSection === 'contact' && (
              <>
                <SectionHeader icon={RiChatSmileLine} title="Contact Submissions" color="rose" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <StatCard icon={RiChatSmileLine} label="Total Submissions" value={d?.contact?.total_submissions?.toLocaleString()} color="rose" />
                  <StatCard icon={RiArrowUpLine} label="New in Range" value={d?.contact?.new_in_range?.toLocaleString()} sub={`last ${preset} days`} color="amber" />
                </div>
                <p className="text-sm text-slate-400">Manage and respond to contact enquiries from the <a href="/admin/contact" className="text-emerald-400 hover:underline">Contact Management</a> tab.</p>
              </>
            )}

            {/* ─── PROJECTS ─── */}
            {activeSection === 'projects' && (
              <>
                <SectionHeader icon={RiProjectorLine} title="Projects" color="emerald" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatCard icon={RiProjectorLine} label="Total Projects" value={d?.projects?.total_projects?.toLocaleString()} color="emerald" />
                  <StatCard icon={RiArrowUpLine} label="New in Range" value={d?.projects?.new_in_range?.toLocaleString()} sub={`last ${preset} days`} color="amber" />
                </div>
              </>
            )}

            {/* ─── DESIGN & MODELLING ─── */}
            {activeSection === 'design' && (
              <>
                <SectionHeader icon={RiSunLine} title="Design & Modelling" color="amber" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <StatCard icon={RiSunLine} label="Total Designs" value={d?.design?.total_designs?.toLocaleString()} sub={`+${d?.design?.designs_in_range || 0} in range`} color="amber" />
                  <StatCard icon={RiFlashlightLine} label="Simulations" value={d?.design?.total_simulations?.toLocaleString()} sub={`+${d?.design?.simulations_in_range || 0} in range`} color="blue" />
                  <StatCard icon={RiShareLine} label="Report Shares" value={d?.design?.total_report_shares?.toLocaleString()} color="violet" />
                  <StatCard icon={RiBatteryChargeLine} label="Load Profiles" value={d?.design?.total_load_profiles?.toLocaleString()} color="emerald" />
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
                  <p className="text-sm text-slate-400">
                    For detailed tariff management, simulation drill-down, share link administration, and adoption breakdowns, visit the <a href="/admin/design" className="text-emerald-400 hover:underline">Design & Modelling</a> admin section.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

AnalyticsPage.getLayout = getAdminLayout;

export default function AnalyticsPageWrapper() {
  return (
    <AdminRoute>
      <AnalyticsPage />
    </AdminRoute>
  );
}
