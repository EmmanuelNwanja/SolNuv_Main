import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabase';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FullPageLoader } from '../../components/ui/index';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function resolveAuthRedirect() {
      if (!router.isReady) return;

      const authError = router.query.error_description || router.query.error;
      if (authError) {
        toast.error(String(authError));
        router.replace('/login');
        return;
      }

      let { data: { session } } = await supabase.auth.getSession();

      // On OAuth return, session exchange may not be complete yet. If a code is present,
      // exchange it explicitly before deciding the user is unauthenticated.
      if (!session && typeof window !== 'undefined') {
        const authCode = new URL(window.location.href).searchParams.get('code');
        if (authCode) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
          if (!exchangeError) {
            session = exchangeData?.session || null;
          }
        }
      }

      if (!session) {
        router.replace('/login');
        return;
      }

      try {
        const { data } = await authAPI.getMe();
        const profile = data?.data;

        // Admin users always go to /admin, skip onboarding check
        if (profile?.is_platform_admin) {
          router.replace('/admin');
          return;
        }

        if (!profile?.is_onboarded) {
          router.replace('/onboarding');
          return;
        }

        router.replace('/dashboard');
      } catch {
        // Backend may be waking from cold start; refresh session token then retry once.
        try {
          // Ensure the Supabase token is fresh before retrying — avoids a scenario
          // where the token expired between getSession() and getMe(), causing the
          // retry to also fail with 401 and silently dropping the user to /login.
          await supabase.auth.refreshSession();
          await authAPI.wakeBackend();
          const { data } = await authAPI.getMe();
          const profile = data?.data;
          if (profile?.is_platform_admin) {
            router.replace('/admin');
            return;
          }
          if (!profile?.is_onboarded) {
            router.replace('/onboarding');
            return;
          }
          router.replace('/dashboard');
        } catch {
          router.replace('/login');
        }
      }
    }

    resolveAuthRedirect();
  }, [router, router.isReady, router.query.error, router.query.error_description]);

  return <FullPageLoader message="Completing sign in..." />;
}