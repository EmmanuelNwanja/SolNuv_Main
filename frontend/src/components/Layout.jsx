import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import AdminLayout from './AdminLayout';
import { ThemeToggle } from './ThemeToggle';
import { PageMotion } from './PageMotion';
import AIChatPanel from './AIChatPanel';
import { authAPI } from '../services/api';
import {
  RiDashboardLine, RiSunLine, RiBarChartLine, RiFileTextLine,
  RiTrophyLine, RiCalculatorLine, RiSettingsLine, RiLogoutBoxLine,
  RiMenuLine, RiCloseLine, RiBellLine, RiArrowUpLine, RiLeafLine, RiAdminLine,
  RiArticleLine, RiQuestionLine
} from 'react-icons/ri';
import toast from 'react-hot-toast';

const navItems = [
  { href: '/dashboard', icon: RiDashboardLine, label: 'Dashboard' },
  { href: '/projects', icon: RiSunLine, label: 'My Projects' },
  { href: '/dashboard/impact', icon: RiLeafLine, label: 'Impact' },
  { href: '/dashboard/feedback', icon: RiBarChartLine, label: 'Client Feedback' },
  { href: '/leaderboard', icon: RiTrophyLine, label: 'Leaderboard' },
  { href: '/reports', icon: RiFileTextLine, label: 'Reports', pro: true },
  { href: '/calculator', icon: RiCalculatorLine, label: 'Calculator' },
  { href: '/blog', icon: RiArticleLine, label: 'Blog' },
  { href: '/faq', icon: RiQuestionLine, label: 'FAQ' },
  { href: '/settings', icon: RiSettingsLine, label: 'Settings' },
];

export default function Layout({ children }) {
  const { profile, plan, isPro, isFree, isBasic, isInGracePeriod, graceUntil, company, signOut, isPlatformAdmin, session } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Days remaining in grace period (null when not applicable)
  const graceDaysLeft = isInGracePeriod && graceUntil
    ? Math.max(0, Math.ceil((new Date(graceUntil) - new Date()) / 86_400_000))
    : null;

  // Poll for unread notifications count (only when logged in)
  useEffect(() => {
    if (!session) return;

    let isActive = true;

    async function fetchNotifications() {
      if (!isActive) return;
      try {
        const r = await authAPI.getNotifications();
        if (!isActive) return;
        const items = r.data.data || [];
        setUnreadCount(items.filter((n) => !n.is_read).length);
      } catch {}
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every 60s

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [session]);

  // Reset bell badge when user navigates to the notifications page
  useEffect(() => {
    if (router.pathname === '/notifications') {
      setUnreadCount(0);
    }
  }, [router.pathname]);

  async function handleSignOut() {
    await signOut();
    toast.success('Signed out');
    router.push('/');
  }

  const displayName = profile?.first_name || profile?.email?.split('@')[0] || 'User';
  const orgName = company?.name || profile?.brand_name || 'My Account';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-30 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        {/* Logo */}
        <div className="p-6 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-forest-900 rounded-lg flex items-center justify-center">
              <RiSunLine className="text-amber-400 text-lg" />
            </div>
            <span className="font-display font-bold text-forest-900 text-lg">SolNuv</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[...navItems, ...(isPlatformAdmin ? [{ href: '/admin', icon: RiAdminLine, label: 'Admin' }] : [])].map(({ href, icon: Icon, label, pro }) => {
            const active = router.pathname === href || router.pathname.startsWith(href + '/');
            const locked = pro && !isPro;
            return (
              <Link
                key={href}
                href={locked ? '/plans' : href}
                className={active ? 'sidebar-link-active' : 'sidebar-link'}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="text-lg flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {locked && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">PRO</span>}
              </Link>
            );
          })}
        </nav>

        {/* Plan badge */}
        <div className="p-4 border-t border-slate-100">
          {isFree && (
            <Link href="/plans" className="block mb-3 bg-violet-50 border border-violet-200 rounded-xl p-3 text-center hover:bg-violet-100 transition-colors">
              <RiArrowUpLine className="text-violet-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-violet-800">Subscribe to unlock features</p>
              <p className="text-xs text-violet-600 mt-0.5">Simulations, AI Assistant & more</p>
            </Link>
          )}
          {!isPro && !isFree && (
            <Link href="/plans" className="block mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center hover:bg-amber-100 transition-colors">
              <RiArrowUpLine className="text-amber-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-amber-800">Upgrade to Pro</p>
              <p className="text-xs text-amber-600 mt-0.5">Design Reports + Unlimited Simulations</p>
            </Link>
          )}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-forest-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="avatar" />
                : initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{orgName}</p>
            </div>
            <button onClick={handleSignOut} title="Sign out" className="text-slate-400 hover:text-red-500 transition-colors p-1">
              <RiLogoutBoxLine />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-4 flex items-center gap-4 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-forest-900 p-1">
            <RiMenuLine className="text-xl" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            <span className={`badge ${
              isFree    ? 'badge-slate' :
              isBasic   ? 'badge-amber'  :
              plan === 'pro'   ? 'badge-green'  :
              plan === 'elite' ? 'badge-forest' : 'badge-amber'
            }`}>
              {isFree ? 'FREE' : plan.toUpperCase()}
            </span>
            <Link href="/notifications" className="relative text-slate-500 hover:text-forest-900 transition-colors p-1">
              <RiBellLine className="text-xl" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Grace period / free tier banner */}
        {isInGracePeriod && graceDaysLeft !== null && (
          <div className={`px-4 lg:px-8 py-2.5 flex items-center gap-3 text-sm ${
            graceDaysLeft <= 1 ? 'bg-red-50 border-b border-red-200 text-red-800'
              : graceDaysLeft <= 3 ? 'bg-orange-50 border-b border-orange-200 text-orange-800'
              : 'bg-amber-50 border-b border-amber-200 text-amber-800'
          }`}>
            <span className="flex-1">
              {graceDaysLeft === 0
                ? 'Your subscription grace period ends today.'
                : `Your subscription has expired — ${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'} of grace period remaining.`}
              {' '}Features will be restricted after this.
            </span>
            <Link href="/plans" className="font-semibold underline underline-offset-2 whitespace-nowrap">Renew now</Link>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <PageMotion>{children}</PageMotion>
        </main>
      </div>

      {/* AI Chat panel — available on all dashboard pages */}
      <AIChatPanel />
    </div>
  );
}

// Wrap dashboard pages with this layout
export function getDashboardLayout(page) {
  return (
    <ProtectedRoute>
      <Layout>{page}</Layout>
    </ProtectedRoute>
  );
}

// Wrap public pages — shows the full nav shell but does NOT require authentication
export function getPublicLayout(page) {
  return <Layout>{page}</Layout>;
}

// Wrap admin pages — skips the isOnboarded check so admin-only accounts can access /admin
export function getAdminLayout(page) {
  return <AdminLayout>{page}</AdminLayout>;
}
