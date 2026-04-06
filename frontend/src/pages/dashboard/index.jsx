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
  RiAddLine, RiTrophyLine, RiArrowRightLine, RiTimeLine, RiCloseLine,
  RiArrowLeftSLine, RiArrowRightSLine
} from 'react-icons/ri';

// Popup carousel — shows a campaign's ads in order, auto-advances every 6s,
// tracks impressions per ad. Triggers: on login (once/session) or on interval.
function PopupCampaign() {
  const [campaign, setCampaign] = useState(null);
  const [adIndex, setAdIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    blogAPI.getCampaignPopups()
      .then((r) => {
        for (const c of (r.data.data || [])) {
          if (!c.ads?.length) continue;

          const sessionKey = `snuv_camp_s_${c.id}`;
          const intervalKey = `snuv_camp_i_${c.id}`;
          let shouldShow = false;

          if (c.show_on_login && !sessionStorage.getItem(sessionKey)) {
            shouldShow = true;
          }
          if (c.show_on_interval && c.interval_minutes) {
            const last = localStorage.getItem(intervalKey);
            if (!last || (Date.now() - Number(last)) / 60000 >= c.interval_minutes) {
              shouldShow = true;
            }
          }

          if (shouldShow) {
            try { sessionStorage.setItem(sessionKey, '1'); } catch {}
            if (c.show_on_interval) {
              try { localStorage.setItem(intervalKey, String(Date.now())); } catch {}
            }
            setCampaign(c);
            return;
          }
        }
      })
      .catch(() => {});
  }, []);

  // Record impression whenever the visible ad changes
  const currentAd = campaign?.ads?.[adIndex];
  useEffect(() => {
    if (currentAd) {
      blogAPI.trackAdImpression(currentAd.id, '/dashboard').catch(() => {});
    }
  }, [currentAd?.id]);

  // Auto-advance with smooth progress bar (6 s per ad, loops)
  useEffect(() => {
    if (!campaign) return;
    setProgress(0);
    let prog = 0;
    const tick = 50; // ms
    const total = 6000;
    const step = (tick / total) * 100;
    const timer = setInterval(() => {
      prog += step;
      if (prog >= 100) {
        setAdIndex((i) => (i + 1) % campaign.ads.length);
        prog = 0;
      }
      setProgress(prog);
    }, tick);
    return () => clearInterval(timer);
  }, [campaign, adIndex]);

  if (!campaign?.ads?.length) return null;

  const ad = campaign.ads[adIndex];
  const total = campaign.ads.length;
  function goTo(i) { setAdIndex((i + total) % total); setProgress(0); }
  function handleClose() { setCampaign(null); }
  function handleClick() {
    blogAPI.trackAdClick(ad.id, '/dashboard').catch(() => {});
    if (ad.target_url) window.open(ad.target_url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-6"
      onClick={handleClose}
    >
      <div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-xs overflow-hidden flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Story-style progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 pt-2.5">
          {campaign.ads.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width: i < adIndex ? '100%' : i === adIndex ? `${progress}%` : '0%',
                  transition: i === adIndex ? 'none' : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* Top-right: counter + close */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {total > 1 && (
            <span className="bg-black/50 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {adIndex + 1}/{total}
            </span>
          )}
          <button
            onClick={handleClose}
            className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
            aria-label="Close"
          >
            <RiCloseLine className="text-base" />
          </button>
        </div>

        {/* Invisible tap zones: left third = prev, right third = next */}
        {total > 1 && (
          <>
            <button
              className="absolute left-0 top-0 w-1/3 h-full z-10 opacity-0"
              onClick={(e) => { e.stopPropagation(); goTo(adIndex - 1); }}
              aria-label="Previous ad"
            />
            <button
              className="absolute right-0 top-0 w-1/3 h-full z-10 opacity-0"
              onClick={(e) => { e.stopPropagation(); goTo(adIndex + 1); }}
              aria-label="Next ad"
            />
          </>
        )}

        {/* 4:5 portrait image */}
        {ad.image_url ? (
          <div className="w-full flex-shrink-0" style={{ aspectRatio: '4/5', maxHeight: '62vh' }}>
            <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div
            className="w-full flex-shrink-0 bg-gradient-to-br from-forest-900 to-emerald-700 flex items-center justify-center"
            style={{ aspectRatio: '4/5', maxHeight: '62vh' }}
          >
            <span className="text-white/40 text-sm uppercase tracking-widest text-xs">Sponsored</span>
          </div>
        )}

        {/* Text + CTA */}
        <div className="p-5 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">Sponsored</span>
            {total > 1 && (
              <div className="flex gap-1">
                <button onClick={() => goTo(adIndex - 1)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                  <RiArrowLeftSLine className="text-base" />
                </button>
                <button onClick={() => goTo(adIndex + 1)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                  <RiArrowRightSLine className="text-base" />
                </button>
              </div>
            )}
          </div>
          <p className="font-bold text-slate-800 text-base leading-snug">{ad.title}</p>
          {ad.body_text && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{ad.body_text}</p>}
          <div className="mt-4 flex gap-3">
            {ad.target_url && (
              <button
                onClick={handleClick}
                className="flex-1 bg-forest-900 hover:bg-forest-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Learn More
              </button>
            )}
            <button
              onClick={handleClose}
              className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
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
      <Head><title>Dashboard — SolNuv | Solar Engineering Platform</title></Head>

      <PopupCampaign />

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
            <p className="text-sm text-white/70 mt-1">Unlimited calculator use · QR field traceability · CSV/Excel export · Custom portfolio page · NESREA EPR PDFs coming soon — all from &#x20A6;15,000/mo.</p>
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
