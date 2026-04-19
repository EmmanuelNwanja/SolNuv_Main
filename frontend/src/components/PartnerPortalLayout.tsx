import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { PageMotion } from "./PageMotion";
import AIChatPanel from "./AIChatPanel";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { authAPI } from "../services/api";
import { getPartnerMemberships } from "../utils/partnerPortal";
import {
  RiSunLine,
  RiDashboardLine,
  RiRecycleLine,
  RiLeafLine,
  RiUserLine,
  RiArticleLine,
  RiQuestionLine,
  RiMailLine,
  RiRocketLine,
  RiCodeSSlashLine,
  RiBellLine,
  RiSettingsLine,
  RiLogoutBoxLine,
  RiMenuLine,
  RiLineChartLine,
  RiHandCoinLine,
  RiShieldCheckLine,
} from "react-icons/ri";
import type { IconType } from "react-icons";
import toast from "react-hot-toast";

type Variant = "recycler" | "financier";

interface NavEntry {
  href: string;
  icon: IconType;
  label: string;
  /** Match prefix for nested routes */
  match?: "exact" | "prefix";
}

interface NotificationRow {
  is_read?: boolean;
  [key: string]: unknown;
}

function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 first:border-0 first:pt-0 first:mt-0">
      <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function PartnerPortalLayout({ variant, children }: { variant: Variant; children: ReactNode }) {
  const base = variant === "recycler" ? "/partners/recycling" : "/partners/finance";
  const { profile, company, signOut, session } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const memberships = getPartnerMemberships(profile);
  const orgLabel =
    memberships.find((m) => m.organization?.organization_type === variant)?.organization?.name ||
    company?.name ||
    profile?.brand_name ||
    "Partner organization";

  useEffect(() => {
    if (!session) return;
    let alive = true;
    async function load() {
      try {
        const r = await authAPI.getNotifications();
        if (!alive) return;
        const items = (r.data.data || []) as NotificationRow[];
        setUnreadCount(items.filter((n) => !n.is_read).length);
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [session]);

  useEffect(() => {
    if (router.pathname.endsWith("/notifications")) setUnreadCount(0);
  }, [router.pathname]);

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    await router.push("/");
  }

  const displayName = profile?.first_name || profile?.email?.split("@")[0] || "Partner";
  const initials = displayName.charAt(0).toUpperCase();

  const workspace: NavEntry[] =
    variant === "recycler"
      ? [
          { href: base, icon: RiDashboardLine, label: "Dashboard", match: "exact" },
          { href: `${base}/pickups`, icon: RiRecycleLine, label: "Pickups", match: "prefix" },
          { href: `${base}/esg`, icon: RiLeafLine, label: "ESG & impact", match: "prefix" },
          { href: `${base}/portfolio`, icon: RiUserLine, label: "Portfolio", match: "prefix" },
        ]
      : [
          { href: base, icon: RiDashboardLine, label: "Dashboard", match: "exact" },
          { href: `${base}/financials`, icon: RiLineChartLine, label: "Financials", match: "prefix" },
          { href: `${base}/escrow`, icon: RiShieldCheckLine, label: "Escrow decisions", match: "prefix" },
          { href: `${base}/funding`, icon: RiHandCoinLine, label: "Funding requests", match: "prefix" },
        ];

  const resources: NavEntry[] = [
    { href: "/blog", icon: RiArticleLine, label: "Blog", match: "prefix" },
    { href: "/faq", icon: RiQuestionLine, label: "FAQ", match: "prefix" },
    { href: "/contact", icon: RiMailLine, label: "Contact", match: "exact" },
  ];

  const comingSoon: NavEntry[] = [
    { href: `${base}/advanced-app`, icon: RiRocketLine, label: "Advanced App", match: "prefix" },
    { href: `${base}/api-integration`, icon: RiCodeSSlashLine, label: "API integration", match: "prefix" },
  ];

  const account: NavEntry[] = [
    { href: `${base}/notifications`, icon: RiBellLine, label: "Notifications", match: "prefix" },
    { href: `${base}/settings`, icon: RiSettingsLine, label: "Settings", match: "prefix" },
  ];

  function isActive(entry: NavEntry) {
    const p = router.pathname;
    if (entry.match === "exact") return p === entry.href;
    return p === entry.href || p.startsWith(`${entry.href}/`);
  }

  function renderLink(entry: NavEntry) {
    const active = isActive(entry);
    const Icon = entry.icon;
    return (
      <Link
        key={entry.href}
        href={entry.href}
        className={active ? "sidebar-link-active" : "sidebar-link"}
        onClick={() => setSidebarOpen(false)}
      >
        <Icon className="text-lg flex-shrink-0" />
        <span className="flex-1">{entry.label}</span>
      </Link>
    );
  }

  const portalTitle = variant === "recycler" ? "Recycling partner" : "Finance partner";

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full h-[100dvh] w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 z-30 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static lg:flex`}
      >
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <Link href={base} className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
            <div className="w-8 h-8 bg-forest-900 rounded-lg flex items-center justify-center">
              <RiSunLine className="text-amber-400 text-lg" />
            </div>
            <div className="min-w-0">
              <span className="font-display font-bold text-forest-900 dark:text-white text-lg block leading-tight">SolNuv</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 truncate block">
                {portalTitle}
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-2 sm:p-4 overflow-y-auto">
          <NavSection label="Workspace">{workspace.map(renderLink)}</NavSection>
          <NavSection label="Resources">{resources.map(renderLink)}</NavSection>
          <NavSection label="Coming soon">{comingSoon.map(renderLink)}</NavSection>
          <NavSection label="Account">{account.map(renderLink)}</NavSection>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/30 px-3 py-2 mb-3">
            <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">Partner access</p>
            <p className="text-[10px] text-emerald-800/90 dark:text-emerald-300/90 mt-0.5 leading-snug">
              Operations and funding tools without a solar workspace subscription.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-forest-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {typeof profile?.avatar_url === "string" && profile.avatar_url ? (
                <img src={profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{orgLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              title="Sign out"
              className="text-slate-400 hover:text-red-500 transition-colors p-1"
            >
              <RiLogoutBoxLine />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 lg:px-8 py-3 sm:py-4 flex items-center gap-4 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-600 dark:text-slate-300 hover:text-forest-900 dark:hover:text-white p-1"
          >
            <RiMenuLine className="text-xl" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{portalTitle}</p>
            <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 truncate">{orgLabel}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <ThemeToggle compact />
            <span className="badge badge-green text-[10px]">Partner</span>
            <Link
              href={`${base}/notifications`}
              className="relative text-slate-500 dark:text-slate-400 hover:text-forest-900 dark:hover:text-white transition-colors p-1"
            >
              <RiBellLine className="text-xl" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <PageMotion>{children}</PageMotion>
        </main>
      </div>

      <AIChatPanel />
      <PWAInstallBanner />
    </div>
  );
}
