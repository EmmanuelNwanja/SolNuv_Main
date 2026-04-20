import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type ReactNode } from "react";
import {
  RiAdminLine,
  RiBankLine,
  RiCloseLine,
  RiDashboardLine,
  RiFileList3Line,
  RiKey2Line,
  RiLogoutBoxLine,
  RiMenuLine,
  RiNotification3Line,
  RiPriceTag3Line,
  RiSettings3Line,
  RiWallet3Line,
  RiArticleLine,
  RiBarChartBoxLine,
  RiMailLine,
  RiQuestionLine,
  RiRobotLine,
  RiSunLine,
  RiSearchEyeLine,
  RiTeamLine,
  RiBriefcaseLine,
  RiEditLine,
} from "react-icons/ri";
import type { IconType } from "react-icons";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { PageMotion } from "./PageMotion";
import CmsRuntimeContent from "./CmsRuntimeContent";
import toast from "react-hot-toast";

interface AdminNavItem {
  href: string;
  label: string;
  icon: IconType;
}

interface AdminNavSection {
  label: string | null;
  items: AdminNavItem[];
}

const adminNavSections: AdminNavSection[] = [
  {
    label: null,
    items: [{ href: "/admin", label: "Control Center", icon: RiDashboardLine }],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/users", label: "Users", icon: RiFileList3Line },
      { href: "/admin/partners", label: "Partner organizations", icon: RiTeamLine },
      { href: "/admin/admins", label: "Admins", icon: RiAdminLine },
      { href: "/admin/finance", label: "Finance", icon: RiWallet3Line },
      { href: "/admin/promo", label: "Promotions", icon: RiPriceTag3Line },
      { href: "/admin/push", label: "Notifications", icon: RiNotification3Line },
      { href: "/admin/paystack", label: "Paystack Plans", icon: RiWallet3Line },
      { href: "/admin/direct-payments", label: "Direct Payments", icon: RiBankLine },
      { href: "/admin/logs", label: "Activity Log", icon: RiFileList3Line },
      { href: "/admin/otp-management", label: "OTP Operations", icon: RiKey2Line },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/blog", label: "Blog & Ads", icon: RiArticleLine },
      { href: "/admin/pitchdeck", label: "Pitchdeck CMS", icon: RiFileList3Line },
      { href: "/admin/content-studio", label: "Content Studio", icon: RiEditLine },
      { href: "/admin/contact", label: "Contact Inbox", icon: RiMailLine },
      { href: "/admin/faq", label: "FAQ Management", icon: RiQuestionLine },
      { href: "/admin/opportunities", label: "Jobs & Opportunities", icon: RiBriefcaseLine },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/admin/design", label: "Design & Modelling", icon: RiSunLine },
      { href: "/admin/analytics", label: "Analytics", icon: RiBarChartBoxLine },
      { href: "/admin/agents", label: "AI Agents", icon: RiRobotLine },
      { href: "/admin/seo", label: "SEO & Search", icon: RiSearchEyeLine },
    ],
  },
  {
    label: null,
    items: [{ href: "/settings", label: "Platform Settings", icon: RiSettings3Line }],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile, platformAdminRole, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    await router.push("/");
  }

  const name =
    `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.email || "Admin";
  const roleLabel = String(platformAdminRole || "admin").replace("_", " ").toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-slate-900 border-r border-slate-800 z-40 transform transition-transform duration-300 overflow-hidden min-h-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static`}
      >
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <RiAdminLine />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">SolNuv Admin</p>
              <p className="text-[11px] text-slate-400">Platform Operations</p>
            </div>
          </Link>
          <button type="button" className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <RiCloseLine />
          </button>
        </div>

        <nav className="flex-1 min-h-0 p-3 space-y-3 overflow-y-auto overscroll-contain">
          {adminNavSections.map((section, si) => (
            <div key={si}>
              {section.label && (
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon }) => {
                  const active =
                    href === "/admin"
                      ? router.pathname === "/admin"
                      : router.pathname === href || router.asPath.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? "bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30"
                          : "text-slate-300 hover:bg-slate-800/80"
                      }`}
                    >
                      <Icon className="text-base flex-shrink-0" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 truncate">{name}</p>
          <p className="text-[11px] text-emerald-300 mt-1">{roleLabel}</p>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <RiLogoutBoxLine /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-slate-800 bg-slate-900/95 backdrop-blur px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20">
          <button type="button" className="lg:hidden text-slate-300" onClick={() => setSidebarOpen(true)}>
            <RiMenuLine className="text-xl" />
          </button>
          <div className="hidden lg:block text-sm text-slate-400">Platform Operations</div>
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            <div className="text-xs text-slate-500">{new Date().toLocaleDateString()}</div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 admin-content overflow-auto">
          <CmsRuntimeContent routePath={router.pathname} />
          <PageMotion>{children}</PageMotion>
        </main>
      </div>
    </div>
  );
}
