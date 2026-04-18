import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

const linkCls = "block px-3 py-2 rounded-lg text-sm font-medium transition-colors";

export function PartnerLayout({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "recycler" | "financier";
}) {
  const router = useRouter();
  const base = variant === "recycler" ? "/partners/recycling" : "/partners/finance";
  const nav =
    variant === "recycler"
      ? [
          { href: `${base}`, label: "Dashboard" },
          { href: `${base}/pickups`, label: "Pickups" },
          { href: `${base}/esg`, label: "ESG" },
          { href: `${base}/portfolio`, label: "Portfolio" },
        ]
      : [
          { href: `${base}`, label: "Dashboard" },
          { href: `${base}/financials`, label: "Financials" },
          { href: `${base}/funding`, label: "Funding requests" },
        ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4 space-y-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 mb-2">
          {variant === "recycler" ? "Recycling partner" : "Finance partner"}
        </p>
        {nav.map((item) => {
          const active = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${linkCls} ${active ? "bg-forest-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {item.label}
            </Link>
          );
        })}
        <Link href="/dashboard" className={`${linkCls} text-slate-500 hover:bg-slate-100 mt-6`}>
          Main app
        </Link>
      </aside>
      <main className="flex-1 p-6 md:p-8 max-w-5xl w-full">{children}</main>
    </div>
  );
}

export default PartnerLayout;
