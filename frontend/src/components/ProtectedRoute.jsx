import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { session, profile, loading, isOnboarded, profileResolved, wakingServer } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !profileResolved) return;  // auth not fully resolved yet — wait
    if (!session) { router.replace('/login'); return; }
    if (!isOnboarded) { router.replace('/onboarding'); return; }
  }, [session, loading, profileResolved, isOnboarded, router]);

  // Spinner while loading OR while auth hasn't been fully determined.
  // Prevents the 10s safety timer (sets loading=false) from firing the !session
  // guard before getSession() / Supabase token refresh has actually completed.
  if (loading || !profileResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">
            {wakingServer ? 'Waking server (10-20s)...' : 'Loading SolNuv...'}
          </p>
        </div>
      </div>
    );
  }

  // Profile resolved but null AND session is present — backend unreachable (no cache available).
  // Show a recovery prompt instead of silently redirecting to onboarding.
  if (session && profileResolved && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="font-display font-bold text-forest-900 text-xl mb-2">Server unreachable</h2>
          <p className="text-slate-500 text-sm mb-6">
            We couldn't load your profile. The server may be starting up. Please wait a moment and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session || !profileResolved || !isOnboarded) return null;
  return children;
}