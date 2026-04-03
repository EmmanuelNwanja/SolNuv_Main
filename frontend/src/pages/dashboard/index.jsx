import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { dashboardAPI, blogAPI } from '../../services/api';
import Layout, { getDashboardLayout } from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { StatCard, UrgencyBadge, StatusBadge, EmptyState } from '../../components/ui/index';
import { MotionSection } from '../../components/PageMotion';
import {
  RiSunLine, RiRecycleLine, RiAlertLine, RiLeafLine,
  RiAddLine, RiTrophyLine, RiArrowRightLine, RiTimeLine, RiCloseLine
} from 'react-icons/ri';

function PopupAd() {
  const [ad, setAd] = useState(null);

  useEffect(() => {
    let seenIds = [];
    try { seenIds = JSON.parse(localStorage.getItem('snuv_seen_popups') || '[]'); } catch {}

    blogAPI.getPopupAd({ seen_ids: seenIds.join(',') })
      .then((r) => {
        const popup = r.data.data;
        if (!popup) return;
        const updated = [...seenIds.filter((id) => id !== popup.id), popup.id].slice(-20);
        try { localStorage.setItem('snuv_seen_popups', JSON.stringify(updated)); } catch {}
        setAd(popup);
        blogAPI.trackAdImpression(popup.id, '/dashboard').catch(() => {});
      })
      .catch(() => {});
  }, []);

  if (!ad) return null;

  function handleClose() { setAd(null); }
  function handleClick() {
    blogAPI.trackAdClick(ad.id, '/dashboard').catch(() => {});
    if (ad.target_url) window.open(ad.target_url, '_blank', 'noopener,noreferrer');
    setAd(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {ad.image_url && (
          <img src={ad.image_url} alt={ad.title} className="w-full h-48 object-cover" />
        )}
        <div className="p-6">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">Sponsored</span>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-700 -mt-1 -mr-1 p-1 rounded-lg transition-colors">
              <RiCloseLine className="text-lg" />
            </button>
          </div>
          <p className="font-bold text-slate-800 text-lg leading-snug">{ad.title}</p>
          {ad.body_text && <p className="text-sm text-slate-500 mt-2">{ad.body_text}</p>}
          <div className="mt-5 flex gap-3">
            {ad.target_url && (
              <button onClick={handleClick} className="flex-1 bg-forest-900 hover:bg-forest-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                Learn More
              </button>
            )}
            <button onClick={handleClose} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-xl text-sm transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardAd({ placement }) {
  const [ad, setAd] = useState(null);

  useEffect(() => {
    blogAPI.listAds({ placement, limit: 1 })
      .then((r) => {
        const first = r.data.data?.[0];
        if (first) {
          setAd(first);
          blogAPI.trackAdImpression(first.id, '/dashboard').catch(() => {});
        }
      })
      .catch(() => {});
  }, [placement]);

  if (!ad) return null;

  function handleClick() {
    blogAPI.trackAdClick(ad.id, '/dashboard').catch(() => {});
  }

  if (placement === 'banner') {
    return (
      <a href={ad.target_url} target="_blank" rel="noopener noreferrer" onClick={handleClick}
        className="block w-full rounded-2xl overflow-hidden border border-slate-200 hover:border-forest-900/30 transition-colors">
        {ad.image_url
          ? <img src={ad.image_url} alt={ad.title} className="w-full h-20 object-cover" />
          : (
            <div className="w-full h-16 bg-gradient-to-r from-forest-900 to-emerald-700 flex items-center justify-between px-6">
              <span className="font-semibold text-white text-sm">{ad.title}</span>
              {ad.body_text && <span className="text-white/80 text-xs hidden sm:block">{ad.body_text}</span>}
              <span className="text-amber-400 text-xs font-semibold flex-shrink-0 ml-4">Learn more →</span>
            </div>
          )}
      </a>
    );
  }

  // sidebar / in-feed card
  return (
    <a href={ad.target_url} target="_blank" rel="noopener noreferrer" onClick={handleClick}
      className="block rounded-2xl border border-slate-200 hover:border-forest-900/30 transition-colors overflow-hidden">
      {ad.image_url && <img src={ad.image_url} alt={ad.title} className="w-full h-32 object-cover" />}
      <div className="p-4 bg-white">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Sponsored</p>
        <p className="font-semibold text-sm text-slate-800">{ad.title}</p>
        {ad.body_text && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ad.body_text}</p>}
      </div>
    </a>
  );
}

export default function Dashboard() {
  const { profile, isOnboarded, plan, isPro } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const router = useRouter();

  function loadDashboard() {
    setLoading(true);
    setLoadError('');

    dashboardAPI.get()
      .then(r => setData(r.data.data))
      .catch((err) => {
        if (err?.response?.data?.code === 'PROFILE_INCOMPLETE') {
          router.replace('/onboarding');
          return;
        }
        setLoadError('We could not load your latest dashboard data. Your records are safe. Please retry.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isOnboarded) {
      setLoading(false);
      return;
    }

    loadDashboard();
  }, [isOnboarded, router]);

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
  const recycle = data?.recycle_income?.expected || {};

  return (
    <>
      <Head><title>Dashboard — SolNuv</title></Head>

      <PopupAd />

      <MotionSection className="mb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-900 via-forest-800 to-emerald-700 p-6 sm:p-8 text-white">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/60 mb-3">Operations Pulse</p>
              <h1 className="font-display font-bold text-3xl sm:text-4xl leading-tight">{greeting}, {displayName}</h1>
              <p className="text-white/75 text-sm mt-2 max-w-xl">
                {stats.total_projects > 0
                  ? `Tracking ${stats.total_projects} project${stats.total_projects !== 1 ? 's' : ''} across Nigeria with end-of-life visibility and recovery value forecasts.`
                  : 'No projects yet. Start by adding your first installation to activate impact and compliance analytics.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{stats.total_projects || 0} tracked projects</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{stats.total_panels || 0} solar panels</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{stats.pending_recovery || 0} pending recovery</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 self-start lg:self-auto">
              <Link href="/projects/add" className="btn-amber flex items-center gap-2">
                <RiAddLine /> Add Project
              </Link>
              <Link href="/leaderboard" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                View Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </MotionSection>

      {/* ── Banner Ad ───────────────────────────────────────────────────── */}
      <MotionSection className="mb-6">
        <DashboardAd placement="banner" />
      </MotionSection>

      {/* Income Forecast */}
      <MotionSection className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Total Est. Income (Recycle + Silver) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-forest-900 p-5 text-white">
          <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/60 mb-1">Total Est. Income</p>
          <p className="font-display text-3xl sm:text-4xl font-bold text-emerald-300">
            ₦{(recycle.total_with_silver_ngn || 0).toLocaleString('en-NG')}
          </p>
          <p className="text-xs text-white/60 mt-1.5">Recycle + Silver · active fleet</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
            <span>Recycle: ₦{(recycle.total_recycle_ngn || 0).toLocaleString('en-NG')}</span>
            <span>Silver: ₦{(recycle.silver_ngn || 0).toLocaleString('en-NG')}</span>
          </div>
        </div>

        {/* Total Est. Recycle Income */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-900 to-slate-800 p-5 text-white">
          <div className="absolute -top-8 -left-8 h-28 w-28 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/60 mb-1">Total Est. Recycle Income</p>
          <p className="font-display text-3xl sm:text-4xl font-bold text-amber-300">
            ₦{(recycle.total_recycle_ngn || 0).toLocaleString('en-NG')}
          </p>
          <p className="text-xs text-white/60 mt-1.5">Second-life & material recovery</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
            <span>Panels: ₦{(recycle.panel_recycle_ngn || 0).toLocaleString('en-NG')}</span>
            <span>Batteries: ₦{(recycle.battery_recycle_ngn || 0).toLocaleString('en-NG')}</span>
          </div>
        </div>
      </MotionSection>

      {loadError && (
        <MotionSection className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-amber-800">{loadError}</p>
          <button onClick={loadDashboard} className="btn-outline text-sm px-4 py-2">Retry</button>
        </MotionSection>
      )}

      <MotionSection className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Projects" value={stats.active_projects || 0} sub={`${stats.total_panels || 0} panels`} icon={RiSunLine} color="forest" />
        <StatCard label="Total Panels" value={stats.total_panels || 0} sub={`${stats.total_batteries || 0} batteries`} icon={RiLeafLine} color="emerald" />
        <StatCard label="Pending Recovery" value={stats.pending_recovery || 0} sub="awaiting pickup" icon={RiTimeLine} color="amber" />
        <StatCard label="Recycled" value={stats.recycled || 0} sub="projects completed" icon={RiRecycleLine} color="slate" />
      </MotionSection>

      <MotionSection className="grid sm:grid-cols-3 gap-3 mb-6">
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
          <a href={`/profile/${encodeURIComponent(profile.public_slug)}`} target="_blank" rel="noreferrer" className="card-hover">
            <p className="text-xs text-slate-500">Public Portfolio</p>
            <p className="text-sm font-semibold text-forest-900 mt-1">Share your profile link</p>
            <p className="text-xs text-slate-400 mt-1">Showcase projects, impact, and reviews</p>
          </a>
        )}
      </MotionSection>

      <MotionSection className="grid md:grid-cols-3 gap-6 mb-6">
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
      </MotionSection>

      {/* Upcoming decommissions */}
      <MotionSection className="card mb-6">
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
      </MotionSection>

      {/* Pro upgrade prompt */}
      {!isPro && (
        <MotionSection className="bg-gradient-to-r from-forest-900 to-emerald-800 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Unlock the Full SolNuv Toolkit</p>
            <p className="text-sm text-white/70 mt-1">Unlimited calculator use · NESREA EPR compliance PDF · QR field traceability · CSV/Excel export · Custom portfolio page — all from &#x20A6;15,000/mo.</p>
          </div>
          <Link href="/plans" className="btn-amber flex-shrink-0">Upgrade to Pro →</Link>
        </MotionSection>
      )}

      {/* ── In-feed Ad ──────────────────────────────────────────────────── */}
      <MotionSection className="mt-6">
        <DashboardAd placement="in-feed" />
      </MotionSection>
    </>
  );
}

Dashboard.getLayout = getDashboardLayout;

export function getServerSideProps() {
  return { props: {} };
}
