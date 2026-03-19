import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { session, loading, isOnboarded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login'); return; }
    if (!isOnboarded) { router.replace('/onboarding'); return; }
  }, [session, loading, isOnboarded, router]);

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

  if (!session || !isOnboarded) return null;
  return children;
}
