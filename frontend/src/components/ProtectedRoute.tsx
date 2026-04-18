import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getPartnerPortalPath } from "../utils/partnerPortal";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading, isOnboarded, profileResolved, wakingServer } = useAuth();
  const router = useRouter();
  const isReadyToDecide = profileResolved && !loading;
  const partnerPath = getPartnerPortalPath(profile);

  useEffect(() => {
    if (!isReadyToDecide) return;
    if (!session) {
      void router.replace("/login");
      return;
    }
    if (isOnboarded) return;
    if (partnerPath) {
      void router.replace(partnerPath);
      return;
    }
    void router.replace("/onboarding");
  }, [session, isReadyToDecide, isOnboarded, partnerPath, router]);

  if (loading || !profileResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">
            {wakingServer ? "Waking server (10-20s)..." : "Loading SolNuv..."}
          </p>
        </div>
      </div>
    );
  }

  if (session && profileResolved && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="font-display font-bold text-forest-900 text-xl mb-2">Server unreachable</h2>
          <p className="text-slate-500 text-sm mb-6">
            We couldn&apos;t load your profile. The server may be starting up. Please wait a moment and try again.
          </p>
          <button type="button" onClick={() => window.location.reload()} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (session && profileResolved && isOnboarded) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm font-medium">Loading SolNuv...</p>
      </div>
    </div>
  );
}
