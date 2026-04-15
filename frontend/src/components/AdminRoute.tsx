import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute({
  children,
  requiredRoles = [],
}: {
  children: ReactNode;
  requiredRoles?: string[];
}) {
  const router = useRouter();
  const { session, loading, profileResolved, wakingServer, isPlatformAdmin, platformAdminRole } = useAuth();

  const roleRestricted = Array.isArray(requiredRoles) && requiredRoles.length > 0;
  const roleAllowed = !roleRestricted || requiredRoles.includes(platformAdminRole || "");

  useEffect(() => {
    if (loading || !profileResolved) return;
    if (!session) {
      void router.replace("/login");
      return;
    }
    if (!isPlatformAdmin) {
      void router.replace("/dashboard");
      return;
    }
    if (!roleAllowed) {
      void router.replace("/admin");
    }
  }, [loading, session, profileResolved, isPlatformAdmin, roleAllowed, router]);

  if (loading || !profileResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-medium">
            {wakingServer ? "Waking server (10-20s)..." : "Loading admin workspace..."}
          </p>
        </div>
      </div>
    );
  }

  if (session && profileResolved && isPlatformAdmin && roleAllowed) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm font-medium">Verifying permissions...</p>
      </div>
    </div>
  );
}
