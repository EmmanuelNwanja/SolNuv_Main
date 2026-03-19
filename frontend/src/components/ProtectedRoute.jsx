import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { session, loading, isOnboarded, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Never act while still loading — this is the key fix
    if (loading) return;

    // No session at all → go to login
    if (!session) {
      router.replace('/login');
      return;
    }

    // Session exists but profile hasn't loaded yet → wait
    // (profile===null during initial fetch is different from profile.is_onboarded===false)
    if (session && profile === null) return;

    // Session + profile loaded + not onboarded → go to onboarding
    if (session && profile && !isOnboarded) {
      router.replace('/onboarding');
      return;
    }
  }, [session, loading, isOnboarded, profile, router]);

  // Show spinner while loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Loading SolNuv...</p>
        </div>
      </div>
    );
  }

  // Show spinner while session exists but profile is still fetching
  if (session && profile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Not authenticated → render nothing (redirect handled above)
  if (!session || !isOnboarded) return null;

  return children;
}