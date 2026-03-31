import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardAPI } from '../../services/api';
import Layout, { getDashboardLayout } from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { StatCard, UrgencyBadge, StatusBadge, EmptyState } from '../../components/ui/index';
import {
  RiSunLine, RiRecycleLine, RiAlertLine, RiLeafLine,
  RiAddLine, RiTrophyLine, RiArrowRightLine, RiTimeLine
} from 'react-icons/ri';

export default function Dashboard() {
  const { profile, plan, isPro } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.get()
      .then(r => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const displayName = profile?.first_name || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-64 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const upcoming = data?.upcoming_decommissions || [];
  const silver = data?.silver_portfolio || {};
  const rank = data?.leaderboard_rank;

  return (
    <>
      <Head><title>Dashboard — SolNuv</title></Head>

      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-forest-900">{greeting}, {displayName} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {stats.total_projects > 0 ? `Tracking ${stats.total_projects} project${stats.total_projects !== 1 ? 's' : ''} across Nigeria` : 'No projects yet — add your first installation below'}
          </p>
        </div>
        <Link href="/projects/add" className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <RiAddLine /> Add Project
        </Link>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Projects" value={stats.active_projects || 0} sub={`${stats.total_panels || 0} panels`} icon={RiSunLine} color="forest" />
        <StatCard label="Total Panels" value={stats.total_panels || 0} sub={`${stats.total_batteries || 0} batteries`} icon={RiLeafLine} color="emerald" />
        <StatCard label="Pending Recovery" value={stats.pending_recovery || 0} sub="awaiting pickup" icon={RiTimeLine} color="amber" />
        <StatCard label="Recycled" value={stats.recycled || 0} sub="projects completed" icon={RiRecycleLine} color="slate" />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Link href="/dashboard/feedback" className="card-hover">
          <p className="text-xs text-slate-500">Client Reputation</p>
          <p className="text-sm font-semibold text-forest-900 mt-1">Generate feedback links</p>
          <p className="text-xs text-slate-400 mt-1">Collect ratings and showcase reviews</p>
        </Link>
        <Link href="/leaderboard" className="card-hover">
          <p className="text-xs text-slate-500">Leaderboard</p>
          <p className="text-sm font-semibold text-forest-900 mt-1">Track CO2 and rating rank</p>
          <p className="text-xs text-slate-400 mt-1">Use filters to benchmark peers</p>
        </Link>
        <Link href="/calculator" className="card-hover">
          <p className="text-xs text-slate-500">Engineering Tools</p>
          <p className="text-sm font-semibold text-forest-900 mt-1">ROI, SoH, and cable sizing</p>
          <p className="text-xs text-slate-400 mt-1">Export proposal and compliance PDFs</p>
        </Link>
        {profile?.public_slug && (
          <a href={`/profile/${profile.public_slug}`} target="_blank" rel="noreferrer" className="card-hover">
            <p className="text-xs text-slate-500">Public Portfolio</p>
            <p className="text-sm font-semibold text-forest-900 mt-1">Share your profile link</p>
            <p className="text-xs text-slate-400 mt-1">Showcase projects, impact, and reviews</p>
          </a>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {/* Silver portfolio card */}
        <div className="md:col-span-2 bg-forest-900 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/70 text-sm font-medium">Total Silver in Your Fleet</p>
              <p className="font-display text-4xl font-bold text-amber-400 mt-1">
                {silver.total_silver_grams?.toFixed(2) || '0.00'}g
              </p>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-1.5">
              <p className="text-xs text-white/70">Current Price</p>
              <p className="font-semibold text-amber-400 text-sm">₦{silver.silver_price_ngn_per_gram?.toFixed(0) || '1,555'}/g</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-white/60 mb-1">Expected Recovery Value</p>
              <p className="font-bold text-xl text-emerald-400">₦{(silver.expected_recovery_value_ngn || 0).toLocaleString('en-NG')}</p>
              <p className="text-xs text-white/50 mt-0.5">at 35% formal recovery</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-white/60 mb-1">Lost to Informal Sector</p>
              <p className="font-bold text-xl text-red-400">₦0</p>
              <p className="text-xs text-white/50 mt-0.5">scrap dealers pay nothing for silver</p>
            </div>
          </div>
        </div>

        {/* Leaderboard rank */}
        <div className="card flex flex-col items-center justify-center text-center">
          <RiTrophyLine className="text-4xl text-amber-500 mb-2" />
          <p className="text-slate-500 text-sm mb-1">Your Leaderboard Rank</p>
          {rank ? (
            <>
              <p className="font-display font-bold text-4xl text-forest-900">#{rank.rank_impact}</p>
              <p className="text-sm text-slate-500 mt-1">Impact Score</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{rank.impact_score?.toFixed(0)}</p>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-3xl text-slate-300">—</p>
              <p className="text-xs text-slate-400 mt-2">Add your first project to appear on the leaderboard</p>
            </>
          )}
          <Link href="/leaderboard" className="mt-4 text-xs text-forest-900 font-semibold hover:underline flex items-center gap-1">
            View Leaderboard <RiArrowRightLine />
          </Link>
        </div>
      </div>

      {/* Upcoming decommissions */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-forest-900 flex items-center gap-2">
            <RiAlertLine className="text-amber-500" /> Upcoming Decommissions
          </h2>
          <Link href="/projects?status=active" className="text-xs text-forest-900 font-medium hover:underline">View all</Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No urgent decommissions"
            description="All active projects have more than 1 year before their predicted end-of-life."
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map(proj => (
              <Link key={proj.id} href={`/projects/${proj.id}`} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-forest-900/20 hover:bg-forest-900/5 transition-all group">
                <div>
                  <p className="font-semibold text-sm text-slate-800 group-hover:text-forest-900">{proj.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{proj.city}, {proj.state}</p>
                </div>
                <div className="text-right">
                  <UrgencyBadge daysUntil={proj.days_until_decommission} />
                  <p className="text-xs text-slate-400 mt-1">{new Date(proj.estimated_decommission_date).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pro upgrade prompt */}
      {!isPro && (
        <div className="bg-gradient-to-r from-forest-900 to-emerald-800 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Unlock NESREA EPR Compliance Reports</p>
            <p className="text-sm text-white/70 mt-1">Generate Cradle-to-Grave certificates and auto-send EPR reports to NESREA — one click.</p>
          </div>
          <Link href="/plans" className="btn-amber flex-shrink-0">Upgrade to Pro →</Link>
        </div>
      )}
    </>
  );
}

Dashboard.getLayout = getDashboardLayout;

export function getServerSideProps() {
  return { props: {} };
}
