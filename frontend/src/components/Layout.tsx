import { useState, useEffect, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import PartnerProtectedRoute from "./PartnerProtectedRoute";
import PartnerPortalLayout from "./PartnerPortalLayout";
import AdminLayout from "./AdminLayout";
import { ThemeToggle } from "./ThemeToggle";
import { PageMotion } from "./PageMotion";
import AIChatPanel from "./AIChatPanel";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { authAPI } from "../services/api";
import {
  RiDashboardLine,
  RiSunLine,
  RiBarChartLine,
  RiFileTextLine,
  RiTrophyLine,
  RiCalculatorLine,
  RiSettingsLine,
  RiLogoutBoxLine,
  RiMenuLine,
  RiBellLine,
  RiArrowUpLine,
  RiLeafLine,
  RiAdminLine,
  RiArticleLine,
  RiQuestionLine,
  RiArrowRightLine,
  RiCloseLine,
  RiRocketLine,
  RiCodeSSlashLine,
} from "react-icons/ri";
import type { IconType } from "react-icons";
import toast from "react-hot-toast";
import { getAppHomePath, isPartnerUserType } from "../utils/partnerPortal";

interface NavItem {
  href: string;
  icon: IconType;
  label: string;
  pro?: boolean;
  soon?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", icon: RiDashboardLine, label: "Dashboard" },
  { href: "/projects", icon: RiSunLine, label: "My Projects" },
  { href: "/dashboard/impact", icon: RiLeafLine, label: "Impact" },
  { href: "/dashboard/feedback", icon: RiBarChartLine, label: "Client Feedback" },
  { href: "/leaderboard", icon: RiTrophyLine, label: "Leaderboard" },
  { href: "/reports", icon: RiFileTextLine, label: "Reports", pro: true },
  { href: "/calculator", icon: RiCalculatorLine, label: "Calculator" },
  { href: "/blog", icon: RiArticleLine, label: "Blog" },
  { href: "/faq", icon: RiQuestionLine, label: "FAQ" },
  { href: "/advanced-app", icon: RiRocketLine, label: "Advanced App", soon: true },
  { href: "/api-integration", icon: RiCodeSSlashLine, label: "API integration" },
  { href: "/settings", icon: RiSettingsLine, label: "Settings" },
];

interface NotificationRow {
  is_read?: boolean;
  [key: string]: unknown;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, plan, isPro, isFree, isBasic, isInGracePeriod, graceUntil, company, signOut, isPlatformAdmin, session } =
    useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const graceDaysLeft =
    isInGracePeriod && graceUntil
      ? Math.max(0, Math.ceil((new Date(graceUntil).getTime() - Date.now()) / 86_400_000))
      : null;

  useEffect(() => {
    if (!session) return;

    let isActive = true;

    async function fetchNotifications() {
      if (!isActive) return;
      try {
        const r = await authAPI.getNotifications();
        if (!isActive) return;
        const items = (r.data.data || []) as NotificationRow[];
        setUnreadCount(items.filter((n) => !n.is_read).length);
      } catch {
        /* ignore */
      }
    }

    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), 60000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    if (router.pathname === "/notifications") {
      setUnreadCount(0);
    }
  }, [router.pathname]);

  const appHomePath = getAppHomePath(profile);

  useEffect(() => {
    if (!session || !profile) return;
    if (!isPartnerUserType(profile)) return;
    const home = getAppHomePath(profile);
    if (home === "/dashboard") return;
    const p = router.pathname;
    if (p === "/settings" || p.startsWith("/settings/")) {
      void router.replace(`${home}/settings`);
      return;
    }
    if (p === "/notifications") {
      void router.replace(`${home}/notifications`);
      return;
    }
    if (p === "/advanced-app" || p.startsWith("/advanced-app/")) {
      void router.replace(`${home}/advanced-app`);
      return;
    }
    if (p === "/api-integration" || p.startsWith("/api-integration/")) {
      void router.replace(`${home}/api-integration`);
      return;
    }
    const solarOnly = ["/dashboard", "/projects", "/leaderboard", "/reports", "/calculator"];
    const onSolarOnly = solarOnly.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
    if (onSolarOnly) void router.replace(home);
  }, [session, profile, router]);

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    await router.push("/");
  }

  const displayName = profile?.first_name || profile?.email?.split("@")[0] || "User";
  const brandName = profile && typeof profile.brand_name === "string" ? profile.brand_name : undefined;
  const orgName = company?.name || brandName || "My Account";
  const initials = displayName.charAt(0).toUpperCase();

  const adminNav: NavItem[] = isPlatformAdmin
    ? [{ href: "/admin", icon: RiAdminLine, label: "Admin" }]
    : [];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full h-[100dvh] w-64 bg-white border-r border-slate-100 z-30 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static lg:flex`}
      >
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-forest-900 rounded-lg flex items-center justify-center">
              <RiSunLine className="text-amber-400 text-lg" />
            </div>
            <span className="font-display font-bold text-forest-900 text-lg">SolNuv</span>
          </Link>
        </div>

        <nav className="flex-1 p-2 sm:p-4 space-y-1 overflow-y-auto">
          {[...navItems, ...adminNav].map(({ href, icon: Icon, label, pro, soon }) => {
            const active = router.pathname === href || router.pathname.startsWith(`${href}/`);
            const locked = pro && !isPro;
            return (
              <Link
                key={href}
                href={locked ? "/plans" : href}
                className={active ? "sidebar-link-active" : "sidebar-link"}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="text-lg flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {soon && (
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold">
                    Soon
                  </span>
                )}
                {locked && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                    PRO
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          {isFree && (
            <Link
              href="/plans"
              className="block mb-3 bg-violet-50 border border-violet-200 rounded-xl p-3 text-center hover:bg-violet-100 transition-colors"
            >
              <RiArrowUpLine className="text-violet-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-violet-800">Subscribe to unlock features</p>
              <p className="text-xs text-violet-600 mt-0.5">Simulations, AI Assistant & more</p>
            </Link>
          )}
          {!isPro && !isFree && (
            <Link
              href="/plans"
              className="block mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center hover:bg-amber-100 transition-colors"
            >
              <RiArrowUpLine className="text-amber-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-amber-800">Upgrade to Pro</p>
              <p className="text-xs text-amber-600 mt-0.5">Design Reports + Unlimited Simulations</p>
            </Link>
          )}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-forest-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {typeof profile?.avatar_url === "string" && profile.avatar_url ? (
                <img src={profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="avatar" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{orgName}</p>
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
        <header className="bg-white border-b border-slate-100 px-4 lg:px-8 py-3 sm:py-4 flex items-center gap-4 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-600 hover:text-forest-900 p-1"
          >
            <RiMenuLine className="text-xl" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle compact />
            <span
              className={`badge ${
                isFree
                  ? "badge-slate"
                  : isBasic
                    ? "badge-amber"
                    : plan === "pro"
                      ? "badge-green"
                      : plan === "elite"
                        ? "badge-forest"
                        : "badge-amber"
              }`}
            >
              {isFree ? "FREE" : plan.toUpperCase()}
            </span>
            <Link href="/notifications" className="relative text-slate-500 hover:text-forest-900 transition-colors p-1">
              <RiBellLine className="text-xl" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {isInGracePeriod && graceDaysLeft !== null && (
          <div
            className={`px-4 lg:px-8 py-2 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm ${
              graceDaysLeft <= 1
                ? "bg-red-50 border-b border-red-200 text-red-800"
                : graceDaysLeft <= 3
                  ? "bg-orange-50 border-b border-orange-200 text-orange-800"
                  : "bg-amber-50 border-b border-amber-200 text-amber-800"
            }`}
          >
            <span className="flex-1">
              {graceDaysLeft === 0
                ? "Your subscription grace period ends today."
                : `Your subscription has expired — ${graceDaysLeft} day${graceDaysLeft === 1 ? "" : "s"} of grace period remaining.`}{" "}
              Features will be restricted after this.
            </span>
            <Link href="/plans" className="font-semibold underline underline-offset-2 whitespace-nowrap">
              Renew now
            </Link>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <PageMotion>{children}</PageMotion>
        </main>
      </div>

      <AIChatPanel />
      <PWAInstallBanner />
    </div>
  );
}

export function getDashboardLayout(page: ReactElement): ReactElement {
  return (
    <ProtectedRoute>
      <Layout>{page}</Layout>
    </ProtectedRoute>
  );
}

export function getPartnerRecyclerLayout(page: ReactElement): ReactElement {
  return (
    <ProtectedRoute>
      <PartnerProtectedRoute allowed={["recycler"]}>
        <PartnerPortalLayout variant="recycler">{page}</PartnerPortalLayout>
      </PartnerProtectedRoute>
    </ProtectedRoute>
  );
}

export function getPartnerFinancierLayout(page: ReactElement): ReactElement {
  return (
    <ProtectedRoute>
      <PartnerProtectedRoute allowed={["financier"]}>
        <PartnerPortalLayout variant="financier">{page}</PartnerPortalLayout>
      </PartnerProtectedRoute>
    </ProtectedRoute>
  );
}

export function getPublicLayout(page: ReactElement): ReactElement {
  function PublicSiteLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { session, profile } = useAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const marketingBrandHref = session ? getAppHomePath(profile) : "/";

    const isActive = (href: string) => {
      if (href === "/") return router.pathname === "/";
      if (href.includes("#")) {
        const [path] = href.split("#");
        return router.pathname === (path || "/");
      }
      return router.pathname === href || router.pathname.startsWith(`${href}/`);
    };

    const publicNavItems = [
      { href: "/#how-it-works", label: "How it works", activeHref: "/#how-it-works" },
      { href: "/#platform", label: "Platform", activeHref: "/#platform" },
      { href: "/pricing", label: "Pricing", activeHref: "/pricing" },
      { href: "/blog", label: "Resources", activeHref: "/blog" },
      { href: "/contact", label: "Contact", activeHref: "/contact" },
    ] as const;

    useEffect(() => {
      function onRouteDone() {
        setMobileNavOpen(false);
      }
      router.events.on("routeChangeComplete", onRouteDone);
      return () => router.events.off("routeChangeComplete", onRouteDone);
    }, [router.events]);

    useEffect(() => {
      if (!mobileNavOpen) return;
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }, [mobileNavOpen]);

    return (
      <div className="marketing-shell">
        <header className={`marketing-nav-wrap ${mobileNavOpen ? "marketing-nav-wrap-open" : ""}`}>
          <div className="marketing-nav">
            <Link href={marketingBrandHref} className="marketing-brand">
              <span className="marketing-brand-icon">
                <RiSunLine />
              </span>
              <span>SolNuv</span>
            </Link>
            <nav className="marketing-nav-links" aria-label="Primary">
              {publicNavItems.map(({ href, label, activeHref }) => (
                <Link
                  key={href}
                  href={href}
                  className={isActive(activeHref) ? "marketing-nav-link-active" : ""}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="marketing-nav-cta">
              <ThemeToggle compact />
              <Link href="/login" className="btn-ghost marketing-nav-signin">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary marketing-nav-btn">
                Get started
              </Link>
              <button
                type="button"
                className="marketing-nav-mobile-btn"
                aria-expanded={mobileNavOpen}
                aria-controls="marketing-mobile-nav"
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileNavOpen((o) => !o)}
              >
                {mobileNavOpen ? <RiCloseLine className="text-xl" /> : <RiMenuLine className="text-xl" />}
              </button>
            </div>
          </div>
          {mobileNavOpen && (
            <>
              <div
                className="marketing-mobile-backdrop"
                aria-hidden
                onClick={() => setMobileNavOpen(false)}
              />
              <div
                id="marketing-mobile-nav"
                className="marketing-mobile-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Site navigation"
              >
                <nav className="marketing-mobile-drawer-inner">
                  {publicNavItems.map(({ href, label, activeHref }) => (
                    <Link
                      key={href}
                      href={href}
                      className={isActive(activeHref) ? "marketing-mobile-link marketing-mobile-link-active" : "marketing-mobile-link"}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {label}
                    </Link>
                  ))}
                  <Link
                    href="/login"
                    className="marketing-mobile-link marketing-mobile-link-secondary"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    Sign in
                  </Link>
                </nav>
              </div>
            </>
          )}
        </header>
        <main className="marketing-main">
          <PageMotion>{children}</PageMotion>
        </main>
        <footer className="marketing-footer">
          <div className="marketing-footer-grid">
            <div>
              <div className="marketing-brand mb-3">
                <span className="marketing-brand-icon">
                  <RiSunLine />
                </span>
                <span>SolNuv</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-400">
                Solar engineering, lifecycle intelligence, and compliance workflow support for project teams and partners.
              </p>
            </div>
            <div>
              <p className="marketing-footer-title">Platform</p>
              <div className="marketing-footer-links">
                <Link href="/#how-it-works">How it works</Link>
                <Link href="/#platform">Capabilities</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/contact">Book a demo</Link>
              </div>
            </div>
            <div>
              <p className="marketing-footer-title">Resources</p>
              <div className="marketing-footer-links">
                <Link href="/blog">Blog</Link>
                <Link href="/faq">FAQ</Link>
                <Link href="/terms">Terms</Link>
                <Link href="/privacy">Privacy</Link>
              </div>
            </div>
            <div>
              <p className="marketing-footer-title">Conversion</p>
              <div className="space-y-2">
                <Link href="/register" className="inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200">
                  Create account <RiArrowRightLine />
                </Link>
                <Link href="/contact" className="inline-flex items-center gap-1 text-sm text-amber-300 hover:text-amber-200">
                  Partner or enterprise enquiries <RiArrowRightLine />
                </Link>
              </div>
            </div>
          </div>
          <div className="marketing-footer-meta">
            <p>© {new Date().getFullYear()} SolNuv by Fudo Greentech.</p>
            <p>Built for dependable solar operations.</p>
          </div>
        </footer>
      </div>
    );
  }

  return <PublicSiteLayout>{page}</PublicSiteLayout>;
}

export function getAdminLayout(page: ReactElement): ReactElement {
  return <AdminLayout>{page}</AdminLayout>;
}
