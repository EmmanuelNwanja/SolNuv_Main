import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getPartnerPortalPath, hasPartnerFinancier, hasPartnerRecycler } from "../utils/partnerPortal";

type PartnerKind = "recycler" | "financier";

export default function PartnerProtectedRoute({
  children,
  allowed,
}: {
  children: ReactNode;
  allowed: PartnerKind[];
}) {
  const { session, profile, loading, profileResolved, wakingServer } = useAuth();
  const router = useRouter();
  const ready = profileResolved && !loading;

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      const next = encodeURIComponent(router.asPath || "/");
      void router.replace(`/login?next=${next}`);
      return;
    }
    const okRecycler = allowed.includes("recycler") && hasPartnerRecycler(profile);
    const okFinancier = allowed.includes("financier") && hasPartnerFinancier(profile);
    if (okRecycler || okFinancier) return;

    const fallback = getPartnerPortalPath(profile);
    if (fallback) {
      void router.replace(fallback);
      return;
    }
    const signup =
      allowed[0] === "recycler" ? "/partners/recycling/signup" : "/partners/finance/signup";
    void router.replace(signup);
  }, [ready, session, profile, allowed, router]);

  if (loading || !profileResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">
            {wakingServer ? "Waking server (10-20s)..." : "Loading partner portal..."}
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const okRecycler = allowed.includes("recycler") && hasPartnerRecycler(profile);
  const okFinancier = allowed.includes("financier") && hasPartnerFinancier(profile);
  if (okRecycler || okFinancier) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );
}
